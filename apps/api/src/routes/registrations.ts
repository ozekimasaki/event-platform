import { Hono } from 'hono';
import type { AuthContext } from '../middleware/auth.js';
import { getSupabaseClient } from '../services/supabase.js';
import {
  registerForEvent,
  cancelRegistration,
  getEventRegistrations,
  getUserRegistrations,
} from '../services/registrations.js';
import { getEventBySlug } from '../services/events.js';
import { registrationSchema } from '@event-platform/shared';
import type { Env } from '../services/supabase.js';

const registrations = new Hono<{ Bindings: Env }>();

// POST /api/events/:slug/register - Register for event (auth required)
registrations.post('/events/:slug/register', async (c) => {
  const authCtx = c as unknown as AuthContext;
  const user = (authCtx as any).get('user') as { id: string; email: string };
  if (!user) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }

  const slug = c.req.param('slug');
  const body = await c.req.json();
  const data = registrationSchema.parse(body);

  const supabase = getSupabaseClient(c.env, (authCtx as any).get('jwt'));

  try {
    const result = await registerForEvent(slug, user.id, data, supabase);

    return c.json({
      success: true,
      data: {
        registration: result.registration,
        event: result.event,
        qr_token: result.registration.qr_token,
        is_waitlisted: result.is_waitlisted,
      },
    }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Registration failed';
    if (message.includes('not found')) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message } }, 404);
    }
    if (message.includes('not accepting')) {
      return c.json({ success: false, error: { code: 'BAD_REQUEST', message } }, 400);
    }
    throw err;
  }
});

// DELETE /api/events/:slug/register/:id - Cancel registration (auth required)
registrations.delete('/events/:slug/register/:id', async (c) => {
  const authCtx = c as unknown as AuthContext;
  const user = (authCtx as any).get('user') as { id: string };
  if (!user) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }

  const registrationId = c.req.param('id');
  const supabase = getSupabaseClient(c.env, (authCtx as any).get('jwt'));

  try {
    await cancelRegistration(registrationId, user.id, supabase);
    return c.json({ success: true, data: { message: 'Registration cancelled successfully' } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Cancel failed';
    if (message.includes('not found')) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message } }, 404);
    }
    if (message.includes('Unauthorized')) {
      return c.json({ success: false, error: { code: 'FORBIDDEN', message } }, 403);
    }
    throw err;
  }
});

// GET /api/events/:slug/participants - List participants (organizer/staff only)
registrations.get('/events/:slug/participants', async (c) => {
  const authCtx = c as unknown as AuthContext;
  const user = (authCtx as any).get('user') as { id: string };
  if (!user) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }

  const slug = c.req.param('slug');
  const supabase = getSupabaseClient(c.env, (authCtx as any).get('jwt'));

  const event = await getEventBySlug(slug, supabase);
  if (!event) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Event not found' } }, 404);
  }

  // Check organizer access
  if (event.organizer_id !== user.id) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } }, 403);
  }

  const registrationsList = await getEventRegistrations(event.id, supabase);

  return c.json({ success: true, data: registrationsList });
});

// GET /api/my/registrations - Get current user's registrations (auth required)
registrations.get('/my/registrations', async (c) => {
  const authCtx = c as unknown as AuthContext;
  const user = (authCtx as any).get('user') as { id: string };
  if (!user) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }

  const supabase = getSupabaseClient(c.env, (authCtx as any).get('jwt'));
  const result = await getUserRegistrations(user.id, supabase);

  return c.json({ success: true, data: result });
});

export { registrations };
