import { Hono } from 'hono';
import type { Env } from '../services/supabase.js';
import type { AuthContext } from '../middleware/auth.js';
import { getSupabaseClient, getAdminClient } from '../services/supabase.js';
import {
  getDashboardStats,
  getEventStats,
  getRevenueBreakdown,
  listEventsByOrganizer,
  getEventById,
} from '../services/events.js';
import { getEventPayments } from '../services/payments.js';

// Create router (mounted at /api with auth middleware)
const routes = new Hono<{ Bindings: Env }>();

// ============================================
// GET /api/dashboard/stats - Overall dashboard stats
// ============================================
routes.get('/dashboard/stats', async (c) => {
  const authCtx = c as unknown as AuthContext;
  const user = (authCtx as any).get('user') as { id: string };
  if (!user) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }

  const supabase = getSupabaseClient(c.env, (authCtx as any).get('jwt'));

  try {
    const stats = await getDashboardStats(user.id, supabase);
    return c.json({ success: true, data: stats });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch dashboard stats';
    console.error('Dashboard stats error:', message);
    return c.json({ success: false, error: { code: 'INTERNAL_ERROR', message } }, 500);
  }
});

// ============================================
// GET /api/dashboard/events/manage - List organizer's events with stats
// ============================================
routes.get('/dashboard/events/manage', async (c) => {
  const authCtx = c as unknown as AuthContext;
  const user = (authCtx as any).get('user') as { id: string };
  if (!user) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }

  const rawQuery = c.req.query();
  const page = Number(rawQuery.page || '1');
  const limit = Number(rawQuery.limit || '20');
  const status = rawQuery.status || undefined;
  const search = rawQuery.search || undefined;

  const supabase = getSupabaseClient(c.env, (authCtx as any).get('jwt'));

  try {
    const result = await listEventsByOrganizer(
      user.id,
      { page, limit, status: status as any, search, sort: '-created_at' },
      supabase
    );

    // Enrich events with registration counts and revenue
    const eventIds = result.events.map((e) => e.id);
    let regCountsMap = new Map<string, number>();
    let revenueMap = new Map<string, number>();

    if (eventIds.length > 0) {
      const { data: regs } = await supabase
        .from('registrations')
        .select('id, event_id')
        .in('event_id', eventIds);

      for (const r of (regs ?? [])) {
        regCountsMap.set(r.event_id, (regCountsMap.get(r.event_id) ?? 0) + 1);
      }

      const regIds = (regs ?? []).map((r) => r.id);
      if (regIds.length > 0) {
        const { data: pays } = await supabase
          .from('payments')
          .select('registration_id, amount, status')
          .in('registration_id', regIds)
          .eq('status', 'succeeded');

        const regEventMap = new Map((regs ?? []).map((r) => [r.id, r.event_id]));
        for (const p of (pays ?? []) as any[]) {
          const evId = regEventMap.get(p.registration_id);
          if (evId) revenueMap.set(evId, (revenueMap.get(evId) ?? 0) + (p.amount || 0));
        }
      }
    }

    const enrichedEvents = result.events.map((e) => ({
      ...e,
      registration_count: regCountsMap.get(e.id) ?? 0,
      revenue: revenueMap.get(e.id) ?? 0,
    }));

    return c.json({
      success: true,
      data: enrichedEvents,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        total_pages: result.total_pages,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list events';
    return c.json({ success: false, error: { code: 'INTERNAL_ERROR', message } }, 500);
  }
});

// ============================================
// GET /api/dashboard/events/:id/stats - Event-specific stats
// ============================================
routes.get('/dashboard/events/:id/stats', async (c) => {
  const authCtx = c as unknown as AuthContext;
  const user = (authCtx as any).get('user') as { id: string };
  if (!user) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }

  const eventId = c.req.param('id');
  const supabase = getSupabaseClient(c.env, (authCtx as any).get('jwt'));

  try {
    const event = await getEventById(eventId, supabase);
    if (!event) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Event not found' } }, 404);
    }
    if (event.organizer_id !== user.id) {
      return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } }, 403);
    }

    const stats = await getEventStats(eventId, supabase);
    return c.json({ success: true, data: stats });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch event stats';
    return c.json({ success: false, error: { code: 'INTERNAL_ERROR', message } }, 500);
  }
});

// ============================================
// GET /api/dashboard/events/:id/payments - Payment management for event
// ============================================
routes.get('/dashboard/events/:id/payments', async (c) => {
  const authCtx = c as unknown as AuthContext;
  const user = (authCtx as any).get('user') as { id: string };
  if (!user) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }

  const eventId = c.req.param('id');
  const statusFilter = c.req.query('status');
  const page = Number(c.req.query('page') || '1');
  const limit = Number(c.req.query('limit') || '20');

  const supabase = getSupabaseClient(c.env, (authCtx as any).get('jwt'));

  try {
    const event = await getEventById(eventId, supabase);
    if (!event) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Event not found' } }, 404);
    }
    if (event.organizer_id !== user.id) {
      return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } }, 403);
    }

    const allPayments = await getEventPayments(eventId, supabase);

    // Filter by status
    let filtered = allPayments;
    if (statusFilter && statusFilter !== 'all') {
      filtered = filtered.filter((p) => p.status === statusFilter);
    }

    // Paginate
    const from = (page - 1) * limit;
    const paginated = filtered.slice(from, from + limit);

    // Summary
    const summary = {
      total: filtered.reduce((s, p) => s + (p.amount || 0), 0),
      succeeded: filtered.filter((p) => p.status === 'succeeded').reduce((s, p) => s + (p.amount || 0), 0),
      refunded: filtered.filter((p) => p.status === 'refunded').reduce((s, p) => s + (p.amount || 0), 0),
      pending: filtered.filter((p) => p.status === 'pending').reduce((s, p) => s + (p.amount || 0), 0),
    };

    return c.json({
      success: true,
      data: {
        payments: paginated,
        summary,
      },
      pagination: {
        page,
        limit,
        total: filtered.length,
        total_pages: Math.ceil(filtered.length / limit),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch payments';
    return c.json({ success: false, error: { code: 'INTERNAL_ERROR', message } }, 500);
  }
});

// ============================================
// POST /api/dashboard/payments/:id/refund - Process refund
// ============================================
routes.post('/dashboard/payments/:id/refund', async (c) => {
  const authCtx = c as unknown as AuthContext;
  const user = (authCtx as any).get('user') as { id: string };
  if (!user) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }

  const paymentId = c.req.param('id');
  const supabase = getAdminClient(c.env);

  try {
    // Get payment with registration and event info
    const { data: payment, error: payErr } = await supabase
      .from('payments')
      .select('*, registration:registrations(event_id)')
      .eq('id', paymentId)
      .single();

    if (payErr || !payment) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Payment not found' } }, 404);
    }

    const eventId = (payment as any).registration?.event_id;
    if (!eventId) {
      return c.json({ success: false, error: { code: 'BAD_REQUEST', message: 'Invalid payment record' } }, 400);
    }

    // Verify organizer ownership
    const event = await getEventById(eventId, getSupabaseClient(c.env, (authCtx as any).get('jwt')));
    if (!event || event.organizer_id !== user.id) {
      return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } }, 403);
    }

    if (payment.status !== 'succeeded') {
      return c.json({ success: false, error: { code: 'BAD_REQUEST', message: 'Only succeeded payments can be refunded' } }, 400);
    }

    // Update payment status to refunded
    await supabase
      .from('payments')
      .update({ status: 'refunded', updated_at: new Date().toISOString() })
      .eq('id', paymentId);

    // Cancel the registration
    if (payment.registration_id) {
      await supabase
        .from('registrations')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', payment.registration_id);
    }

    return c.json({ success: true, data: { message: 'Refund processed successfully' } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Refund failed';
    return c.json({ success: false, error: { code: 'REFUND_ERROR', message } }, 500);
  }
});

// ============================================
// GET /api/dashboard/revenue - Revenue breakdown
// ============================================
routes.get('/dashboard/revenue', async (c) => {
  const authCtx = c as unknown as AuthContext;
  const user = (authCtx as any).get('user') as { id: string };
  if (!user) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }

  const period = (c.req.query('period') || '30d') as '7d' | '30d' | '90d' | 'all';
  const validPeriods = ['7d', '30d', '90d', 'all'];
  const safePeriod = validPeriods.includes(period) ? period : '30d';

  const supabase = getSupabaseClient(c.env, (authCtx as any).get('jwt'));

  try {
    const breakdown = await getRevenueBreakdown(user.id, safePeriod as any, supabase);
    return c.json({ success: true, data: breakdown });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch revenue breakdown';
    return c.json({ success: false, error: { code: 'INTERNAL_ERROR', message } }, 500);
  }
});

export { routes };
