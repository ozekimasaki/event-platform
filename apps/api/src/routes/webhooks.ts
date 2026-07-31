import { Hono } from 'hono';
import type { AuthContext } from '../middleware/auth.js';
import { getSupabaseClient } from '../services/supabase.js';
import {
  createWebhook,
  deleteWebhook,
  getWebhooks,
  getWebhookById,
  triggerWebhook,
} from '../services/webhooks.js';
import { createWebhookSchema } from '@event-platform/shared';

const webhooks = new Hono();

// POST /api/webhooks - Create webhook
webhooks.post('/', async (c) => {
  const authCtx = c as unknown as AuthContext;
  const user = (authCtx as any).get('user') as { id: string };
  if (!user) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }

  const body = await c.req.json();
  const data = createWebhookSchema.parse(body);

  const supabase = getSupabaseClient(c.env, (authCtx as any).get('jwt'));
  const webhook = await createWebhook(user.id, data.url, data.events, data.secret, data.is_active, supabase);

  return c.json({ success: true, data: webhook }, 201);
});

// GET /api/webhooks - List webhooks
webhooks.get('/', async (c) => {
  const authCtx = c as unknown as AuthContext;
  const user = (authCtx as any).get('user') as { id: string };
  if (!user) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }

  const supabase = getSupabaseClient(c.env, (authCtx as any).get('jwt'));
  const webhookList = await getWebhooks(user.id, supabase);

  return c.json({ success: true, data: webhookList });
});

// DELETE /api/webhooks/:id - Delete webhook
webhooks.delete('/:id', async (c) => {
  const authCtx = c as unknown as AuthContext;
  const user = (authCtx as any).get('user') as { id: string };
  if (!user) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }

  const id = c.req.param('id');
  const supabase = getSupabaseClient(c.env, (authCtx as any).get('jwt'));

  const webhook = await getWebhookById(id, user.id, supabase);
  if (!webhook) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Webhook not found' } }, 404);
  }

  await deleteWebhook(id, user.id, supabase);
  return c.json({ success: true, data: { message: 'Webhook deleted successfully' } });
});

// POST /api/webhooks/:id/test - Test webhook delivery
webhooks.post('/:id/test', async (c) => {
  const authCtx = c as unknown as AuthContext;
  const user = (authCtx as any).get('user') as { id: string };
  if (!user) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }

  const id = c.req.param('id');
  const supabase = getSupabaseClient(c.env, (authCtx as any).get('jwt'));

  const webhook = await getWebhookById(id, user.id, supabase);
  if (!webhook) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Webhook not found' } }, 404);
  }

  // Trigger a test event
  await triggerWebhook('event.created', {
    test: true,
    message: 'This is a test webhook delivery',
    webhook_id: webhook.id,
  }, user.id, supabase);

  return c.json({ success: true, data: { message: 'Test webhook delivered' } });
});

export { webhooks };
