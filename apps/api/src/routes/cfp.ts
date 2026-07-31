import { Hono } from 'hono';
import type { AuthContext } from '../middleware/auth.js';
import { getSupabaseClient } from '../services/supabase.js';
import {
  submitCfp,
  getCfpSubmissions,
  reviewCfp,
  getCfpStats,
} from '../services/cfp.js';
import { createCfpSchema, reviewCfpSchema } from '@event-platform/shared';

const cfp = new Hono<AuthContext>();

// POST /api/events/:eventId/cfp - Submit CfP proposal (public)
cfp.post('/events/:eventId/cfp', async (c) => {
  const eventId = c.req.param('eventId');
  const body = await c.req.json();
  const data = createCfpSchema.parse({ ...body, event_id: eventId });

  const supabase = getSupabaseClient(c.env);
  const submission = await submitCfp(data, supabase);

  return c.json({ success: true, data: submission }, 201);
});

// GET /api/events/:eventId/cfp/submissions - List CfP submissions (auth required for organizer)
cfp.get('/events/:eventId/cfp/submissions', async (c) => {
  const authCtx = c as unknown as AuthContext;
  const user = (authCtx as any).get('user') as { id: string };
  if (!user) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }

  const eventId = c.req.param('eventId');
  const supabase = getSupabaseClient(c.env, (authCtx as any).get('jwt'));

  const [submissions, stats] = await Promise.all([
    getCfpSubmissions(eventId, supabase),
    getCfpStats(eventId, supabase),
  ]);

  return c.json({
    success: true,
    data: { submissions, stats },
  });
});

// PATCH /api/cfp/:id/review - Review CfP submission (auth required)
cfp.patch('/:id/review', async (c) => {
  const authCtx = c as unknown as AuthContext;
  const user = (authCtx as any).get('user') as { id: string };
  if (!user) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }

  const id = c.req.param('id');
  const body = await c.req.json();
  const data = reviewCfpSchema.parse(body);

  const supabase = getSupabaseClient(c.env, (authCtx as any).get('jwt'));

  try {
    const submission = await reviewCfp(id, data.status, user.id, data.notes, supabase);
    return c.json({ success: true, data: submission });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Review failed';
    if (message.includes('not found')) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message } }, 404);
    }
    throw err;
  }
});

export { cfp };
