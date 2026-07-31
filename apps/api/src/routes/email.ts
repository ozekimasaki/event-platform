import { Hono } from 'hono';
import type { Env } from '../services/supabase.js';
import type { AuthContext } from '../middleware/auth.js';
import { getSupabaseClient } from '../services/supabase.js';
import { sendEmailSchema } from '@event-platform/shared';
import {
  sendEmail,
  sendBulkEmail,
  getEmailLogs,
  getEmailDeliveryStats,
} from '../services/email.js';
import { getEventById, getEventBySlug } from '../services/events.js';

// Email routes (mounted at /api with auth)
export const email = new Hono<{ Bindings: Env }>();

// ============================================
// POST /api/email/send
// Send email(s) - transactional or marketing
// ============================================
email.post('/email/send', async (c) => {
  const authCtx = c as unknown as AuthContext;
  const user = (authCtx as any).get('user') as { id: string };
  if (!user) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }

  try {
    const body = await c.req.json();
    const parsed = sendEmailSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.message } }, 400);
    }

    const { to, subject, template_id, template_data, html, text, category, event_id } = parsed.data;

    // If marketing email, verify organizer ownership
    if (category === 'marketing' && event_id) {
      const supabase = getSupabaseClient(c.env, (authCtx as any).get('jwt'));
      const event = await getEventById(event_id, supabase);
      if (!event || event.organizer_id !== user.id) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } }, 403);
      }
    }

    const result = await sendEmail(to, subject, c.env, {
      templateId: template_id,
      templateData: template_data,
      html,
      text,
      category,
      eventId: event_id,
    });

    return c.json({ success: true, data: result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to send email';
    console.error('Email send error:', msg);
    return c.json({ success: false, error: { code: 'INTERNAL_ERROR', message: msg } }, 500);
  }
});

// ============================================
// POST /api/email/bulk
// Send bulk email to event participants
// ============================================
email.post('/email/bulk', async (c) => {
  const authCtx = c as unknown as AuthContext;
  const user = (authCtx as any).get('user') as { id: string };
  if (!user) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }

  try {
    const body = await c.req.json();
    const { event_id, subject, html, text, template_id, template_data, filter } = body;

    if (!event_id || !subject || (!html && !template_id)) {
      return c.json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'event_id, subject, and html/template_id are required' },
      }, 400);
    }

    const supabase = getSupabaseClient(c.env, (authCtx as any).get('jwt'));

    // Verify organizer ownership
    const event = await getEventById(event_id, supabase);
    if (!event || event.organizer_id !== user.id) {
      return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Only the organizer can send bulk emails' } }, 403);
    }

    const result = await sendBulkEmail(event_id, subject, html || '', text || '', c.env, supabase, {
      templateId: template_id,
      templateData: template_data,
      filter,
    });

    return c.json({ success: true, data: result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to send bulk email';
    console.error('Bulk email error:', msg);
    return c.json({ success: false, error: { code: 'INTERNAL_ERROR', message: msg } }, 500);
  }
});

// ============================================
// GET /api/email/logs
// Get email delivery logs
// ============================================
email.get('/email/logs', async (c) => {
  const authCtx = c as unknown as AuthContext;
  const user = (authCtx as any).get('user') as { id: string };
  if (!user) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }

  const page = Number(c.req.query('page') || '1');
  const limit = Number(c.req.query('limit') || '20');
  const status = c.req.query('status') || undefined;
  const category = c.req.query('category') || undefined;
  const event_id = c.req.query('event_id') || undefined;
  const search = c.req.query('search') || undefined;

  const supabase = getSupabaseClient(c.env, (authCtx as any).get('jwt'));

  try {
    const result = await getEmailLogs(page, limit, supabase, { status, category, event_id, search });
    return c.json({
      success: true,
      data: result.logs,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        total_pages: result.total_pages,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch email logs';
    return c.json({ success: false, error: { code: 'INTERNAL_ERROR', message: msg } }, 500);
  }
});

// ============================================
// GET /api/email/stats
// Get email delivery statistics
// ============================================
email.get('/email/stats', async (c) => {
  const authCtx = c as unknown as AuthContext;
  const user = (authCtx as any).get('user') as { id: string };
  if (!user) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }

  const event_id = c.req.query('event_id') || undefined;
  const supabase = getSupabaseClient(c.env, (authCtx as any).get('jwt'));

  try {
    const stats = await getEmailDeliveryStats(supabase, event_id);
    return c.json({ success: true, data: stats });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch email stats';
    return c.json({ success: false, error: { code: 'INTERNAL_ERROR', message: msg } }, 500);
  }
});
