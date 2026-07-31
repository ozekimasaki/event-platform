import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ============================================
// ENVIRONMENT BINDINGS
// ============================================

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_JWT_SECRET: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  CACHE_KV: KVNamespace;
  STORAGE: R2Bucket;
  TRANSACTIONAL_QUEUE: Queue;
  MARKETING_QUEUE: Queue;
  CHECK_IN_COORDINATOR: DurableObjectNamespace;
  EVENT_CHAT_ROOM: DurableObjectNamespace;
}

// ============================================
// CLIENT FACTORY
// ============================================

const DEFAULT_CLIENT_OPTIONS = {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
};

/**
 * Creates a Supabase client scoped to a user's JWT.
 * All queries will be subject to RLS policies using the user's identity.
 */
export const createSupabaseClient = (
  supabaseUrl: string,
  supabaseAnonKey: string,
  userJwt?: string
): SupabaseClient => {
  return createClient(supabaseUrl, supabaseAnonKey, {
    ...DEFAULT_CLIENT_OPTIONS,
    global: {
      headers: userJwt
        ? { Authorization: `Bearer ${userJwt}` }
        : {},
    },
  });
};

/**
 * Creates a Supabase client with the service role key.
 * This bypasses RLS — use only for trusted server-side operations.
 */
export const createAdminClient = (
  supabaseUrl: string,
  supabaseServiceRoleKey: string
): SupabaseClient => {
  return createClient(supabaseUrl, supabaseServiceRoleKey, DEFAULT_CLIENT_OPTIONS);
};

/**
 * Get a user-scoped Supabase client from the Hono context env bindings.
 */
export const getSupabaseClient = (env: Env, userJwt?: string): SupabaseClient => {
  return createSupabaseClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, userJwt);
};

/**
 * Get an admin (service role) Supabase client from the Hono context env bindings.
 */
export const getAdminClient = (env: Env): SupabaseClient => {
  return createAdminClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
};
