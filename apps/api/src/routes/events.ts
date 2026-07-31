import { Hono } from 'hono';
import type { AuthContext } from '../middleware/auth.js';
import { getSupabaseClient } from '../services/supabase.js';
import {
  listEvents,
  getEventBySlug,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
  checkSlugAvailability,
  listEventsByOrganizer,
} from '../services/events.js';
import { createEventSchema, updateEventSchema, eventQuerySchema } from '@event-platform/shared';

const events = new Hono<AuthContext>();

// GET /api/events - List events (public, paginated)
events.get('/', async (c) => {
  const rawQuery = c.req.query();
  const query = eventQuerySchema.parse(rawQuery);

  const supabase = getSupabaseClient(c.env);
  const result = await listEvents(query, supabase);

  return c.json({
    success: true,
    data: result.events,
    pagination: {
      page: result.page,
      limit: result.limit,
      total: result.total,
      total_pages: result.total_pages,
    },
  });
});

// GET /api/events/check-slug - Check slug availability (must be before :slug)
events.get('/check-slug', async (c) => {
  const slug = c.req.query('slug');
  if (!slug) {
    return c.json({ success: false, error: { code: 'BAD_REQUEST', message: 'slug is required' } }, 400);
  }

  const supabase = getSupabaseClient(c.env);
  const result = await checkSlugAvailability(slug, supabase);

  return c.json({ success: true, data: result });
});

// GET /api/events/my - List current user's events (auth required)
events.get('/my', async (c) => {
  const authCtx = c as unknown as AuthContext;
  const user = (authCtx as any).get('user') as { id: string };
  if (!user) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }

  const rawQuery = c.req.query();
  const query = eventQuerySchema.parse(rawQuery);

  const supabase = getSupabaseClient(c.env, (authCtx as any).get('jwt'));
  const result = await listEventsByOrganizer(user.id, query, supabase);

  return c.json({
    success: true,
    data: result.events,
    pagination: {
      page: result.page,
      limit: result.limit,
      total: result.total,
      total_pages: result.total_pages,
    },
  });
});

// POST /api/events - Create event (auth required)
events.post('/', async (c) => {
  const authCtx = c as unknown as AuthContext;
  const user = (authCtx as any).get('user') as { id: string; email: string };
  if (!user) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }

  const body = await c.req.json();
  const data = createEventSchema.parse(body);

  const supabase = getSupabaseClient(c.env, (authCtx as any).get('jwt'));
  const event = await createEvent(data, user.id, supabase);

  return c.json({ success: true, data: event }, 201);
});

// GET /api/events/:slug - Get event detail (public)
events.get('/:slug', async (c) => {
  const slug = c.req.param('slug');

  const supabase = getSupabaseClient(c.env);
  const event = await getEventBySlug(slug, supabase);

  if (!event) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Event not found' } }, 404);
  }

  return c.json({ success: true, data: event });
});

// PATCH /api/events/:id - Update event (organizer/staff only)
events.patch('/:id', async (c) => {
  const authCtx = c as unknown as AuthContext;
  const user = (authCtx as any).get('user') as { id: string };
  if (!user) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }

  const id = c.req.param('id');
  const body = await c.req.json();
  const data = updateEventSchema.parse(body);

  const supabase = getSupabaseClient(c.env, (authCtx as any).get('jwt'));

  try {
    const event = await updateEvent(id, data, user.id, supabase);
    return c.json({ success: true, data: event });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Update failed';
    if (message.includes('not found')) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message } }, 404);
    }
    if (message.includes('Unauthorized')) {
      return c.json({ success: false, error: { code: 'FORBIDDEN', message } }, 403);
    }
    throw err;
  }
});

// DELETE /api/events/:id - Delete event (organizer only, soft delete)
events.delete('/:id', async (c) => {
  const authCtx = c as unknown as AuthContext;
  const user = (authCtx as any).get('user') as { id: string };
  if (!user) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }

  const id = c.req.param('id');
  const supabase = getSupabaseClient(c.env, (authCtx as any).get('jwt'));

  try {
    await deleteEvent(id, user.id, supabase);
    return c.json({ success: true, data: { message: 'Event deleted successfully' } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Delete failed';
    if (message.includes('not found')) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message } }, 404);
    }
    if (message.includes('Unauthorized')) {
      return c.json({ success: false, error: { code: 'FORBIDDEN', message } }, 403);
    }
    throw err;
  }
});

// GET /api/events/by-id/:id - Get event by ID (auth required, for dashboard)
events.get('/by-id/:id', async (c) => {
  const authCtx = c as unknown as AuthContext;
  const user = (authCtx as any).get('user') as { id: string };
  if (!user) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }

  const id = c.req.param('id');
  const supabase = getSupabaseClient(c.env, (authCtx as any).get('jwt'));
  const event = await getEventById(id, supabase);

  if (!event) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Event not found' } }, 404);
  }

  // Check ownership
  if (event.organizer_id !== user.id) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } }, 403);
  }

  return c.json({ success: true, data: event });
});

export { events };
