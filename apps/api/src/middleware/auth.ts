import { Context, Next } from 'hono';
import { jwtVerify, createRemoteJWKSet } from 'jose';

// Extend Hono context to include user
export type AuthContext = {
  Variables: {
    userId: string;
    userEmail: string;
  };
};

/**
 * JWT Auth Middleware
 * Verifies JWT tokens from Supabase and attaches user info to context
 */
export const authMiddleware = async (c: Context, next: Next) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing or invalid Authorization header',
      },
    }, 401);
  }

  const token = authHeader.substring(7);

  try {
    // Get Supabase JWT secret from environment
    const jwtSecret = c.env.SUPABASE_JWT_SECRET;

    if (!jwtSecret) {
      console.error('SUPABASE_JWT_SECRET not configured');
      return c.json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Authentication service unavailable',
        },
      }, 500);
    }

    // Verify JWT token
    const secret = new TextEncoder().encode(jwtSecret);
    const { payload } = await jwtVerify(token, secret);

    // Attach user info to context
    c.set('userId', payload.sub as string);
    c.set('userEmail', payload.email as string);

    await next();
  } catch (error) {
    console.error('JWT verification failed:', error);
    return c.json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired token',
      },
    }, 401);
  }
};
