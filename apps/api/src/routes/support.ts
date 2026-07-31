import { Hono } from 'hono';
import type { AuthContext, AuthUser } from '../middleware/auth.js';
import { getSupabaseClient, getAdminClient } from '../services/supabase.js';
import type { Env } from '../services/supabase.js';
import { getEventBySlug, getEventById } from '../services/events.js';
import {
  createSupportTicket,
  replyToTicket,
  updateTicketStatus,
  getEventTickets,
  getTicketDetail,
  createFAQ,
  getEventFAQs,
} from '../services/support.js';
import { createTicketSchema, replySchema, faqSchema } from '@event-platform/shared';
import type { TicketStatus } from '@event-platform/shared';

const support = new Hono<{ Bindings: Env }>();

// ============================================
// STAFF VERIFICATION HELPER
// ============================================

const verifyStaffAccess = async (
  eventSlug: string,
  user: AuthUser,
  supabase: ReturnType<typeof getSupabaseClient>
) => {
  const event = await getEventBySlug(eventSlug, supabase);
  if (!event) {
    throw new Error('EVENT_NOT_FOUND');
  }

  if (event.organizer_id === user.id) {
    return event;
  }

  const { data: staffRecord } = await supabase
    .from('event_staff')
    .select('id')
    .eq('event_id', event.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (staffRecord) {
    return event;
  }

  throw new Error('FORBIDDEN');
};

// ============================================
// POST /api/events/:slug/support - Create support ticket
// ============================================

support.post('/events/:slug/support', async (c) => {
  const authCtx = c as unknown as AuthContext;
  const user = (authCtx as any).get('user') as AuthUser | undefined;
  if (!user) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }

  const slug = c.req.param('slug');
  const body = await c.req.json();

  const parsed = createTicketSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0]?.message ?? 'Invalid input' } }, 400);
  }

  const supabase = getAdminClient(c.env);

  try {
    const event = await getEventBySlug(slug, supabase);
    if (!event) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Event not found' } }, 404);
    }

    const ticket = await createSupportTicket(event.id, user.id, parsed.data.subject, parsed.data.message, supabase);
    return c.json({ success: true, data: ticket }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create ticket';
    return c.json({ success: false, error: { code: 'INTERNAL_ERROR', message } }, 500);
  }
});

// ============================================
// GET /api/events/:slug/support/tickets - List tickets (organizer/staff)
// ============================================

support.get('/events/:slug/support/tickets', async (c) => {
  const authCtx = c as unknown as AuthContext;
  const user = (authCtx as any).get('user') as AuthUser | undefined;
  if (!user) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }

  const slug = c.req.param('slug');
  const status = c.req.query('status') as TicketStatus | undefined;
  const page = Number(c.req.query('page') || '1');
  const limit = Number(c.req.query('limit') || '20');

  const supabase = getAdminClient(c.env);

  try {
    await verifyStaffAccess(slug, user, supabase);
    const event = await getEventBySlug(slug, supabase);
    if (!event) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Event not found' } }, 404);
    }

    const result = await getEventTickets(event.id, { status, page, limit }, supabase);
    return c.json({
      success: true,
      data: result.tickets,
      pagination: {
        page,
        limit,
        total: result.total,
        total_pages: Math.ceil(result.total / limit),
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'EVENT_NOT_FOUND') {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Event not found' } }, 404);
    }
    if (msg === 'FORBIDDEN') {
      return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Staff access required' } }, 403);
    }
    return c.json({ success: false, error: { code: 'INTERNAL_ERROR', message: msg || 'Failed to list tickets' } }, 500);
  }
});

// ============================================
// GET /api/support/tickets/:id - Get ticket detail
// ============================================

support.get('/support/tickets/:id', async (c) => {
  const authCtx = c as unknown as AuthContext;
  const user = (authCtx as any).get('user') as AuthUser | undefined;
  if (!user) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }

  const ticketId = c.req.param('id');
  const supabase = getAdminClient(c.env);

  try {
    const detail = await getTicketDetail(ticketId, supabase);

    // Check access: owner or staff
    if (detail.ticket.user_id !== user.id) {
      const event = await getEventById(detail.ticket.event_id, supabase);
      if (!event || event.organizer_id !== user.id) {
        const { data: staffRecord } = await supabase
          .from('event_staff')
          .select('id')
          .eq('event_id', detail.ticket.event_id)
          .eq('user_id', user.id)
          .maybeSingle();
        if (!staffRecord) {
          return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } }, 403);
        }
      }
    }

    return c.json({ success: true, data: detail });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to get ticket';
    return c.json({ success: false, error: { code: 'INTERNAL_ERROR', message } }, 500);
  }
});

// ============================================
// POST /api/support/tickets/:id/reply - Reply to ticket
// ============================================

support.post('/support/tickets/:id/reply', async (c) => {
  const authCtx = c as unknown as AuthContext;
  const user = (authCtx as any).get('user') as AuthUser | undefined;
  if (!user) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }

  const ticketId = c.req.param('id');
  const body = await c.req.json();

  const parsed = replySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0]?.message ?? 'Invalid input' } }, 400);
  }

  const supabase = getAdminClient(c.env);

  try {
    const detail = await getTicketDetail(ticketId, supabase);

    // Check access
    let isStaff = false;
    if (detail.ticket.user_id !== user.id) {
      const event = await getEventById(detail.ticket.event_id, supabase);
      if (event?.organizer_id === user.id) {
        isStaff = true;
      } else {
        const { data: staffRecord } = await supabase
          .from('event_staff')
          .select('id')
          .eq('event_id', detail.ticket.event_id)
          .eq('user_id', user.id)
          .maybeSingle();
        if (staffRecord) {
          isStaff = true;
        } else {
          return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } }, 403);
        }
      }
    }

    const message = await replyToTicket(ticketId, user.id, parsed.data.message, isStaff, supabase);
    return c.json({ success: true, data: message });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to reply';
    return c.json({ success: false, error: { code: 'INTERNAL_ERROR', message } }, 500);
  }
});

// ============================================
// PATCH /api/support/tickets/:id/status - Update ticket status (staff)
// ============================================

support.patch('/support/tickets/:id/status', async (c) => {
  const authCtx = c as unknown as AuthContext;
  const user = (authCtx as any).get('user') as AuthUser | undefined;
  if (!user) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }

  const ticketId = c.req.param('id');
  const body = await c.req.json();
  const { status } = body as { status: TicketStatus };

  if (!status || !['open', 'in_progress', 'resolved', 'closed'].includes(status)) {
    return c.json({ success: false, error: { code: 'BAD_REQUEST', message: 'Invalid status' } }, 400);
  }

  const supabase = getAdminClient(c.env);

  try {
    const detail = await getTicketDetail(ticketId, supabase);

    // Verify staff access
    const event = await getEventById(detail.ticket.event_id, supabase);
    if (!event || event.organizer_id !== user.id) {
      const { data: staffRecord } = await supabase
        .from('event_staff')
        .select('id')
        .eq('event_id', detail.ticket.event_id)
        .eq('user_id', user.id)
        .maybeSingle();
      if (!staffRecord) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Staff access required' } }, 403);
      }
    }

    const ticket = await updateTicketStatus(ticketId, status, supabase);
    return c.json({ success: true, data: ticket });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update status';
    return c.json({ success: false, error: { code: 'INTERNAL_ERROR', message } }, 500);
  }
});

// ============================================
// POST /api/events/:slug/faq - Create FAQ (organizer)
// ============================================

support.post('/events/:slug/faq', async (c) => {
  const authCtx = c as unknown as AuthContext;
  const user = (authCtx as any).get('user') as AuthUser | undefined;
  if (!user) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }

  const slug = c.req.param('slug');
  const body = await c.req.json();

  const parsed = faqSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0]?.message ?? 'Invalid input' } }, 400);
  }

  const supabase = getAdminClient(c.env);

  try {
    const event = await getEventBySlug(slug, supabase);
    if (!event) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Event not found' } }, 404);
    }

    if (event.organizer_id !== user.id) {
      return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Organizer access required' } }, 403);
    }

    const faq = await createFAQ(event.id, parsed.data.question, parsed.data.answer, supabase);
    return c.json({ success: true, data: faq }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create FAQ';
    return c.json({ success: false, error: { code: 'INTERNAL_ERROR', message } }, 500);
  }
});

// ============================================
// GET /api/events/:slug/faq - Get FAQs (public)
// ============================================

support.get('/events/:slug/faq', async (c) => {
  const slug = c.req.param('slug');
  const supabase = getAdminClient(c.env);

  try {
    const event = await getEventBySlug(slug, supabase);
    if (!event) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Event not found' } }, 404);
    }

    const faqs = await getEventFAQs(event.id, supabase);
    return c.json({ success: true, data: faqs });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to get FAQs';
    return c.json({ success: false, error: { code: 'INTERNAL_ERROR', message } }, 500);
  }
});

export { support };
