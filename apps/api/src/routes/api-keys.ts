import { Hono } from 'hono';
import type { AuthContext } from '../middleware/auth.js';
import { getSupabaseClient } from '../services/supabase.js';
import { generateApiKey, revokeApiKey, getApiKeys } from '../services/api-keys.js';
import { createApiKeySchema } from '@event-platform/shared';

const apiKeys = new Hono();

// POST /api/api-keys - Create API key
apiKeys.post('/', async (c) => {
  const authCtx = c as unknown as AuthContext;
  const user = (authCtx as any).get('user') as { id: string };
  if (!user) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }

  const body = await c.req.json();
  const data = createApiKeySchema.parse(body);

  const supabase = getSupabaseClient(c.env, (authCtx as any).get('jwt'));
  const apiKey = await generateApiKey(user.id, data.name, data.scopes, data.expires_at, supabase);

  return c.json({ success: true, data: apiKey }, 201);
});

// GET /api/api-keys - List API keys
apiKeys.get('/', async (c) => {
  const authCtx = c as unknown as AuthContext;
  const user = (authCtx as any).get('user') as { id: string };
  if (!user) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }

  const supabase = getSupabaseClient(c.env, (authCtx as any).get('jwt'));
  const keys = await getApiKeys(user.id, supabase);

  return c.json({ success: true, data: keys });
});

// DELETE /api/api-keys/:id - Revoke API key
apiKeys.delete('/:id', async (c) => {
  const authCtx = c as unknown as AuthContext;
  const user = (authCtx as any).get('user') as { id: string };
  if (!user) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }

  const id = c.req.param('id');
  const supabase = getSupabaseClient(c.env, (authCtx as any).get('jwt'));
  await revokeApiKey(id, user.id, supabase);

  return c.json({ success: true, data: { message: 'API key revoked' } });
});

export { apiKeys };
