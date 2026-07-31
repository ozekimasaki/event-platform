import type { SupabaseClient } from '@supabase/supabase-js';
import type { ApiKey, ApiKeyCreated, ApiKeyScope } from '@event-platform/shared';

// ============================================
// HELPERS
// ============================================

const generateRandomKey = (): string => {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return 'epk_' + Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
};

const hashKey = async (key: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
};

// ============================================
// GENERATE API KEY
// ============================================

export const generateApiKey = async (
  organizerId: string,
  name: string,
  scopes: ApiKeyScope[],
  expiresAt: string | undefined,
  supabase: SupabaseClient
): Promise<ApiKeyCreated> => {
  const rawKey = generateRandomKey();
  const keyHash = await hashKey(rawKey);
  const keyPrefix = rawKey.substring(0, 12) + '...';

  const { data, error } = await supabase
    .from('api_keys')
    .insert({
      organizer_id: organizerId,
      name,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      scopes,
      is_active: true,
      expires_at: expiresAt ?? null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create API key: ${error.message}`);
  }

  return {
    id: data.id,
    name: data.name,
    key: rawKey, // only returned once
    key_prefix: keyPrefix,
    scopes: data.scopes,
    is_active: data.is_active,
    expires_at: data.expires_at,
    created_at: data.created_at,
  };
};

// ============================================
// REVOKE API KEY
// ============================================

export const revokeApiKey = async (
  keyId: string,
  organizerId: string,
  supabase: SupabaseClient
): Promise<void> => {
  const { error } = await supabase
    .from('api_keys')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', keyId)
    .eq('organizer_id', organizerId);

  if (error) {
    throw new Error(`Failed to revoke API key: ${error.message}`);
  }
};

// ============================================
// VALIDATE API KEY
// ============================================

export const validateApiKey = async (
  rawKey: string,
  supabase: SupabaseClient
): Promise<ApiKey | null> => {
  const keyHash = await hashKey(rawKey);

  const { data, error } = await supabase
    .from('api_keys')
    .select('*')
    .eq('key_hash', keyHash)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const apiKey = data as ApiKey;

  // Check expiration
  if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
    return null;
  }

  // Update last_used_at
  await supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', apiKey.id);

  return apiKey;
};

// ============================================
// GET API KEYS FOR ORGANIZER
// ============================================

export const getApiKeys = async (
  organizerId: string,
  supabase: SupabaseClient
): Promise<ApiKey[]> => {
  const { data, error } = await supabase
    .from('api_keys')
    .select('*')
    .eq('organizer_id', organizerId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to get API keys: ${error.message}`);
  }

  return (data ?? []) as ApiKey[];
};
