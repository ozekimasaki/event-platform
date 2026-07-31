import { Context } from 'hono';
import { jwtVerify, createRemoteJWKSet, JWTPayload } from 'jose';
import type { AuthUser } from '../middleware/auth.js';
import { getAdminClient, type Env } from './supabase.js';

// ============================================
// USER FROM TOKEN
// ============================================

/**
 * Extract user info from a Supabase JWT.
 * Tries JWKS first, then falls back to HS256 secret.
 */
export const getUserFromToken = async (
  token: string,
  env: Env
): Promise<AuthUser> => {
  let payload: JWTPayload;

  // Try JWKS endpoint
  try {
    const jwks = createRemoteJWKSet(
      new URL(`${env.SUPABASE_URL}/auth/v1/keys`)
    );
    const result = await jwtVerify(token, jwks, {
      issuer: `${env.SUPABASE_URL}/auth/v1`,
    });
    payload = result.payload;
  } catch {
    // Fall back to HS256
    if (!env.SUPABASE_JWT_SECRET) {
      throw new Error('Cannot verify token: no JWT secret configured');
    }
    const secret = new TextEncoder().encode(env.SUPABASE_JWT_SECRET);
    const result = await jwtVerify(token, secret, {
      issuer: `${env.SUPABASE_URL}/auth/v1`,
    });
    payload = result.payload;
  }

  return {
    id: payload.sub as string,
    email: ((payload as Record<string, unknown>).email ?? ((payload as Record<string, unknown>).user_metadata as Record<string, unknown> | undefined)?.email ?? '') as string,
    role: ((payload as Record<string, unknown>).role ?? 'authenticated') as string,
  };
};

// ============================================
// SERVICE ROLE VERIFICATION
// ============================================

/**
 * Verify that the request has service role access.
 * Checks if the Bearer token matches the SUPABASE_SERVICE_ROLE_KEY.
 */
export const verifyServiceRole = (env: Env, token?: string): boolean => {
  if (!token || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return false;
  }
  return token === env.SUPABASE_SERVICE_ROLE_KEY;
};

// ============================================
// ORGANIZER ROLE CHECK
// ============================================

export type EventRole = 'owner' | 'admin' | 'staff' | null;

/**
 * Check a user's role within a specific event.
 * Returns 'owner' if user owns the organizer that owns the event,
 * 'admin' or 'staff' based on event_staff record, or null if no access.
 */
export const getOrganizerRole = async (
  userId: string,
  eventId: string,
  env: Env
): Promise<EventRole> => {
  const admin = getAdminClient(env);

  // Check if user is the organizer owner
  const { data: event, error: eventError } = await admin
    .from('events')
    .select('organizer_id, organizers!inner(user_id)')
    .eq('id', eventId)
    .single();

  if (eventError || !event) {
    return null;
  }

  // Check if user owns the organizer
  const organizer = event.organizers as unknown as { user_id: string } | null;
  if (organizer && organizer.user_id === userId) {
    return 'owner';
  }

  // Check event_staff for role
  const { data: staffRecord, error: staffError } = await admin
    .from('event_staff')
    .select('role')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .single();

  if (staffError || !staffRecord) {
    return null;
  }

  const role = staffRecord.role as string;
  if (role === 'admin') return 'admin';
  if (role === 'staff') return 'staff';

  return null;
};

// ============================================
// REQUIRE AUTH HELPER
// ============================================

/**
 * Helper to extract the authenticated user from Hono context.
 * Must be used after authMiddleware or optionalAuthMiddleware.
 * Throws if no user is present (should not happen if middleware is applied).
 */
export const requireAuth = (c: Context): AuthUser => {
  const user = c.get('user') as AuthUser | undefined;
  if (!user) {
    throw new Error('requireAuth called without authenticated user in context');
  }
  return user;
};

/**
 * Get the JWT token from context (set by auth middleware).
 */
export const getJwtFromContext = (c: Context): string | undefined => {
  return c.get('jwt') as string | undefined;
};
