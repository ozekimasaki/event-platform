import { Hono } from 'hono';
import type { AuthContext } from '../middleware/auth.js';
import { getSupabaseClient } from '../services/supabase.js';
import {
  createTicket,
  updateTicket,
  deleteTicket,
  getEventTickets,
} from '../services/tickets.js';
import { getEventBySlug, getEventById } from '../services/events.js';
import { ticketSchema, ticketUpdateSchema } from '@event-platform/shared';
import type { Env } from '../services/supabase.js';

const tickets = new Hono<{ Bindings: Env }>();

// POST /api/events/:eventId/tickets - Create ticket (organizer only)
tickets.post('/events/:eventId/tickets', async (c) => {
  const authCtx = c as unknown as AuthContext;
  const user = (authCtx as any).get('user') as { id: string };
  if (!user) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }

  const eventId = c.req.param('eventId');
  const body = await c.req.json();
  const data = ticketSchema.parse(body);

  const supabase = getSupabaseClient(c.env, (authCtx as any).get('jwt'));

  // Verify event ownership
  const event = await getEventById(eventId, supabase);
  if (!event) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Event not found' } }, 404);
  }
  if (event.organizer_id !== user.id) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } }, 403);
  }

  const ticket = await createTicket(eventId, data, supabase);
  return c.json({ success: true, data: ticket }, 201);
});

// PATCH /api/tickets/:id - Update ticket (organizer only)
tickets.patch('/:id', async (c) => {
  const authCtx = c as unknown as AuthContext;
  const user = (authCtx as any).get('user') as { id: string };
  if (!user) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }

  const ticketId = c.req.param('id');
  const body = await c.req.json();
  const data = ticketUpdateSchema.parse(body);

  const supabase = getSupabaseClient(c.env, (authCtx as any).get('jwt'));

  // Verify ownership via ticket -> event
  const { data: ticketData } = await supabase
    .from('tickets')
    .select('event_id, events!inner(organizer_id)')
    .eq('id', ticketId)
    .single();

  if (!ticketData) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Ticket not found' } }, 404);
  }

  const ticket = await updateTicket(ticketId, data, supabase);
  return c.json({ success: true, data: ticket });
});

// DELETE /api/tickets/:id - Delete ticket (organizer only)
tickets.delete('/:id', async (c) => {
  const authCtx = c as unknown as AuthContext;
  const user = (authCtx as any).get('user') as { id: string };
  if (!user) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }

  const ticketId = c.req.param('id');
  const supabase = getSupabaseClient(c.env, (authCtx as any).get('jwt'));

  await deleteTicket(ticketId, supabase);
  return c.json({ success: true, data: { message: 'Ticket deleted successfully' } });
});

// GET /api/events/:slug/tickets - List tickets for event (public)
tickets.get('/events/:slug/tickets', async (c) => {
  const slug = c.req.param('slug');
  const supabase = getSupabaseClient(c.env);

  const event = await getEventBySlug(slug, supabase);
  if (!event) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Event not found' } }, 404);
  }

  const ticketsList = await getEventTickets(event.id, supabase);

  const ticketsWithAvailability = ticketsList.map((t) => ({
    ...t,
    available: t.quantity - t.sold_count,
  }));

  return c.json({ success: true, data: ticketsWithAvailability });
});

export { tickets };
