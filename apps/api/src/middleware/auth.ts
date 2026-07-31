import { Context, Next } from 'hono';
import { jwtVerify, createRemoteJWKSet, type JWTPayload } from 'jose';
import type { Env } from '../services/supabase.js';

// ============================================
// TYPES
// ============================================

export interface AuthUser {
  id: string;
  email: string;
  role: string;
}

export type AuthContext = {
  Variables: {
    user: AuthUser;
    jwt: string;
  };
  Bindings: Env;
};

// ============================================
// JWKS CACHE
// ============================================

// Cache the JWKS fetcher per Supabase URL to avoid re-creating it on every request.
// In Workers, module-level state persists across requests on the same isolate.
let cachedJWKS: ReturnType<typeof createRemoteJWKSet> | null = null;
let cachedJWKSUrl = '';

const getJWKS = (supabaseUrl: string) => {
  const jwksUrl = `${supabaseUrl}/auth/v1/keys`;
  if (cachedJWKS && cachedJWKSUrl === jwksUrl) {
    return cachedJWKS;
  }
  cachedJWKS = createRemoteJWKSet(new URL(jwksUrl));
  cachedJWKSUrl = jwksUrl;
  return cachedJWKS;
};

// ============================================
// TOKEN EXTRACTION
// ============================================

const extractBearerToken = (c: Context): string | null => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
};

// ============================================
// JWT VERIFICATION
// ============================================

/**
 * Verify a Supabase JWT.
 * Tries JWKS endpoint first, falls back to HS256 secret verification.
 */
const verifyToken = async (
  token: string,
  env: Env
): Promise<JWTPayload> => {
  // Method 1: JWKS endpoint verification (preferred for RS256 tokens)
  try {
    const jwks = getJWKS(env.SUPABASE_URL);
    const { payload } = await jwtVerify(token, jwks, {
      issuer: `${env.SUPABASE_URL}/auth/v1`,
    });
    return payload;
  } catch {
    // JWKS failed — fall through to HS256 secret verification
  }

  // Method 2: HS256 manual verification with Supabase JWT secret
  if (!env.SUPABASE_JWT_SECRET) {
    throw new Error('No verification method available');
  }

  const secret = new TextEncoder().encode(env.SUPABASE_JWT_SECRET);
  const { payload } = await jwtVerify(token, secret, {
    issuer: `${env.SUPABASE_URL}/auth/v1`,
  });
  return payload;
};

// ============================================
// UNAUTHORIZED RESPONSE HELPER
// ============================================

const unauthorizedResponse = (c: Context, message: string, code = 'UNAUTHORIZED') => {
  return c.json(
    {
      success: false,
      error: { code, message },
    },
    401
  );
};

// ============================================
// AUTH MIDDLEWARES
// ============================================

/**
 * Required authentication middleware.
 * Extracts Bearer token, verifies JWT, attaches user info to context.
 * Returns 401 if token is missing or invalid.
 */
export const authMiddleware = async (c: Context, next: Next) => {
  const token = extractBearerToken(c);
  if (!token) {
    return unauthorizedResponse(c, 'Missing or invalid Authorization header');
  }

  try {
    const payload = await verifyToken(token, c.env as Env);

    const user: AuthUser = {
      id: payload.sub as string,
      email: ((payload as Record<string, unknown>).email ?? ((payload as Record<string, unknown>).user_metadata as Record<string, unknown> | undefined)?.email ?? '') as string,
      role: ((payload as Record<string, unknown>).role ?? 'authenticated') as string,
    };

    c.set('user', user);
    c.set('jwt', token);

    await next();
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes('expired')
        ? 'Token has expired'
        : 'Invalid or expired token';
    console.error('JWT verification failed:', error);
    return unauthorizedResponse(c, message);
  }
};

/**
 * Admin authentication middleware.
 * Requires a valid JWT AND service_role access.
 * In practice, this checks for the service role key passed as a Bearer token
 * or verifies the JWT has the `service_role` role claim.
 */
export const adminAuthMiddleware = async (c: Context, next: Next) => {
  const token = extractBearerToken(c);
  if (!token) {
    return unauthorizedResponse(c, 'Missing or invalid Authorization header');
  }

  // Check if the token is the service role key itself (direct admin access)
  if (token === (c.env as Env).SUPABASE_SERVICE_ROLE_KEY) {
    c.set('user', {
      id: 'service-role',
      email: 'service@internal',
      role: 'service_role',
    });
    c.set('jwt', token);
    return next();
  }

  // Otherwise verify as JWT and check for service_role claim
  try {
    const payload = await verifyToken(token, c.env as Env);
    const role = (payload.role ?? '') as string;

    if (role !== 'service_role') {
      return unauthorizedResponse(
        c,
        'Insufficient permissions: service_role required',
        'FORBIDDEN'
      );
    }

    c.set('user', {
      id: payload.sub as string,
      email: ((payload as Record<string, unknown>).email ?? 'service@internal') as string,
      role: 'service_role',
    });
    c.set('jwt', token);

    await next();
  } catch (error) {
    console.error('Admin auth verification failed:', error);
    return unauthorizedResponse(c, 'Invalid admin credentials', 'FORBIDDEN');
  }
};

/**
 * Optional authentication middleware.
 * Attempts to extract and verify JWT, but does NOT fail if no token is present.
 * If a valid token is provided, user info is attached to context.
 * If no token or invalid token, continues without user info.
 */
export const optionalAuthMiddleware = async (c: Context, next: Next) => {
  const token = extractBearerToken(c);

  if (!token) {
    // No token provided — continue without auth
    await next();
    return;
  }

  try {
    const payload = await verifyToken(token, c.env as Env);

    const user: AuthUser = {
      id: payload.sub as string,
      email: ((payload as Record<string, unknown>).email ?? ((payload as Record<string, unknown>).user_metadata as Record<string, unknown> | undefined)?.email ?? '') as string,
      role: ((payload as Record<string, unknown>).role ?? 'authenticated') as string,
    };

    c.set('user', user);
    c.set('jwt', token);
  } catch {
    // Invalid token — continue without auth (no error)
    console.warn('Optional auth: invalid token provided, continuing unauthenticated');
  }

  await next();
};
