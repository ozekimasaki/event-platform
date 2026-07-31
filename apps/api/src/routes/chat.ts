import { Hono } from 'hono';
import type { AuthContext, AuthUser } from '../middleware/auth.js';
import { getAdminClient } from '../services/supabase.js';
import type { Env } from '../services/supabase.js';
import { getChatHistory } from '../services/chat.js';

const chat = new Hono<{ Bindings: Env }>();

// ============================================
// GET /api/events/:id/chat/history - Get chat history
// ============================================

chat.get('/events/:id/chat/history', async (c) => {
  const eventId = c.req.param('id');
  const limit = Number(c.req.query('limit') || '100');
  const before = c.req.query('before') || undefined;

  const supabase = getAdminClient(c.env);

  try {
    const messages = await getChatHistory(eventId, Math.min(limit, 100), before, supabase);
    return c.json({ success: true, data: messages });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to get chat history';
    return c.json({ success: false, error: { code: 'INTERNAL_ERROR', message } }, 500);
  }
});

export { chat };
