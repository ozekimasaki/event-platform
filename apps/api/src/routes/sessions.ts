import { Hono } from 'hono';
import type { AuthContext } from '../middleware/auth.js';
import { getSupabaseClient } from '../services/supabase.js';
import {
  createSession,
  updateSession,
  deleteSession,
  getSessions,
  getTimetable,
  reorderSessions,
} from '../services/sessions.js';
import { createSessionSchema, updateSessionSchema, reorderSessionsSchema } from '@event-platform/shared';

const sessions = new Hono<AuthContext>();

// GET /api/events/:eventId/sessions - List sessions for event (public)
sessions.get('/events/:eventId/sessions', async (c) => {
  const eventId = c.req.param('eventId');
  const supabase = getSupabaseClient(c.env);

  const sessionList = await getSessions(eventId, supabase);

  return c.json({
    success: true,
    data: sessionList,
  });
});

// GET /api/events/:eventId/timetable - Get timetable grouped by track (public)
sessions.get('/events/:eventId/timetable', async (c) => {
  const eventId = c.req.param('eventId');
  const supabase = getSupabaseClient(c.env);

  const timetable = await getTimetable(eventId, supabase);

  return c.json({
    success: true,
    data: timetable,
  });
});

// POST /api/events/:eventId/sessions - Create session (auth required)
sessions.post('/events/:eventId/sessions', async (c) => {
  const authCtx = c as unknown as AuthContext;
  const user = (authCtx as any).get('user') as { id: string };
  if (!user) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }

  const eventId = c.req.param('eventId');
  const body = await c.req.json();
  const data = createSessionSchema.parse({ ...body, event_id: eventId });

  const supabase = getSupabaseClient(c.env, (authCtx as any).get('jwt'));
  const session = await createSession(data, supabase);

  return c.json({ success: true, data: session }, 201);
});

// PATCH /api/sessions/:id - Update session (auth required)
sessions.patch('/:id', async (c) => {
  const authCtx = c as unknown as AuthContext;
  const user = (authCtx as any).get('user') as { id: string };
  if (!user) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }

  const id = c.req.param('id');
  const body = await c.req.json();
  const data = updateSessionSchema.parse(body);

  const supabase = getSupabaseClient(c.env, (authCtx as any).get('jwt'));

  try {
    const session = await updateSession(id, data, supabase);
    return c.json({ success: true, data: session });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Update failed';
    if (message.includes('not found')) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message } }, 404);
    }
    throw err;
  }
});

// DELETE /api/sessions/:id - Delete session (auth required)
sessions.delete('/:id', async (c) => {
  const authCtx = c as unknown as AuthContext;
  const user = (authCtx as any).get('user') as { id: string };
  if (!user) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }

  const id = c.req.param('id');
  const supabase = getSupabaseClient(c.env, (authCtx as any).get('jwt'));

  try {
    await deleteSession(id, supabase);
    return c.json({ success: true, data: { message: 'Session deleted successfully' } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Delete failed';
    if (message.includes('not found')) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message } }, 404);
    }
    throw err;
  }
});

// POST /api/events/:eventId/sessions/reorder - Reorder sessions (auth required)
sessions.post('/events/:eventId/sessions/reorder', async (c) => {
  const authCtx = c as unknown as AuthContext;
  const user = (authCtx as any).get('user') as { id: string };
  if (!user) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }

  const body = await c.req.json();
  const data = reorderSessionsSchema.parse(body);

  const supabase = getSupabaseClient(c.env, (authCtx as any).get('jwt'));
  await reorderSessions(data.session_ids, supabase);

  return c.json({ success: true, data: { message: 'Sessions reordered successfully' } });
});

export { sessions };
