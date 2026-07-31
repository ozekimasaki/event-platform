import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase Client Factory
 * Creates a Supabase client per-request with the user's JWT for RLS
 */
export const createSupabaseClient = (
  supabaseUrl: string,
  supabaseAnonKey: string,
  userJwt?: string
): SupabaseClient => {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: userJwt
        ? { Authorization: `Bearer ${userJwt}` }
        : {},
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

/**
 * Get Supabase client from context environment
 */
export const getSupabaseClient = (env: Env, userJwt?: string): SupabaseClient => {
  return createSupabaseClient(
    env.SUPABASE_URL,
    env.SUPABASE_ANON_KEY,
    userJwt
  );
};

// Environment bindings
export interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_JWT_SECRET: string;
  CACHE_KV: KVNamespace;
  STORAGE: R2Bucket;
  TRANSACTIONAL_QUEUE: Queue;
  MARKETING_QUEUE: Queue;
  CHECK_IN_COORDINATOR: DurableObjectNamespace;
}
