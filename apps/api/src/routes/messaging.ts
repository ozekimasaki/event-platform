import { Hono } from 'hono';
import type { Env } from '../services/supabase.js';
import type { AuthContext } from '../middleware/auth.js';
import { getSupabaseClient, getAdminClient } from '../services/supabase.js';
import { notifySchema, individualNotifySchema } from '@event-platform/shared';
import {
  sendBulkNotification,
  sendTransactionalEmail,
  getNotificationHistory,
  getDeliveryStats,
} from '../services/messaging.js';
import { getEventBySlug, getEventById } from '../services/events.js';

// Router for messaging/notifications (mounted at /api with auth)
export const messaging = new Hono<{ Bindings: Env }>();

// ============================================
// POST /api/events/:slug/notify
// Send notification to all participants (organizer only)
// ============================================
messaging.post('/events/:slug/notify', async (c) => {
  const authCtx = c as unknown as AuthContext;
  const user = (authCtx as any).get('user') as { id: string; email: string };
  if (!user) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }

  const slug = c.req.param('slug');
  const supabase = getSupabaseClient(c.env, (authCtx as any).get('jwt'));

  try {
    const body = await c.req.json();
    const parsed = notifySchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.message } }, 400);
    }

    const { subject, message, channel, recipient_filter } = parsed.data;

    // Get event and verify ownership
    const event = await getEventBySlug(slug, supabase);
    if (!event) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Event not found' } }, 404);
    }
    if (event.organizer_id !== user.id) {
      return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Only the organizer can send notifications' } }, 403);
    }

    const result = await sendBulkNotification(
      event.id,
      subject,
      message,
      channel,
      recipient_filter ?? 'all',
      c.env,
      supabase
    );

    return c.json({ success: true, data: result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to send notification';
    console.error('Notify error:', msg);
    return c.json({ success: false, error: { code: 'INTERNAL_ERROR', message: msg } }, 500);
  }
});

// ============================================
// POST /api/events/:slug/notify/individual
// Send notification to a specific participant
// ============================================
messaging.post('/events/:slug/notify/individual', async (c) => {
  const authCtx = c as unknown as AuthContext;
  const user = (authCtx as any).get('user') as { id: string };
  if (!user) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }

  const slug = c.req.param('slug');
  const supabase = getSupabaseClient(c.env, (authCtx as any).get('jwt'));

  try {
    const body = await c.req.json();
    const parsed = individualNotifySchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.message } }, 400);
    }

    const { user_id, subject, message } = parsed.data;

    // Verify event ownership
    const event = await getEventBySlug(slug, supabase);
    if (!event) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Event not found' } }, 404);
    }
    if (event.organizer_id !== user.id) {
      return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Only the organizer can send notifications' } }, 403);
    }

    // Get target user email
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, display_name')
      .eq('id', user_id)
      .single();

    if (!profile?.email) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found or has no email' } }, 404);
    }

    // Insert notification record
    const { data: notif, error: notifErr } = await supabase
      .from('notifications')
      .insert({
        user_id,
        event_id: event.id,
        type: 'system',
        channel: 'email',
        subject,
        body: message,
        status: 'pending',
      })
      .select('id')
      .single();

    if (notifErr || !notif) {
      throw new Error('Failed to create notification record');
    }

    // Send email
    await sendTransactionalEmail(
      profile.email,
      'custom-notification',
      {
        userName: profile.display_name || '',
        eventName: event.title,
        message,
        subject,
      },
      c.env,
      notif.id
    );

    // Update status
    await supabase
      .from('notifications')
      .update({ status: 'sent' })
      .eq('id', notif.id);

    return c.json({
      success: true,
      data: { notification_id: notif.id, status: 'sent' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to send individual notification';
    console.error('Individual notify error:', msg);
    return c.json({ success: false, error: { code: 'INTERNAL_ERROR', message: msg } }, 500);
  }
});

// ============================================
// GET /api/notifications
// Get current user's notifications
// ============================================
messaging.get('/notifications', async (c) => {
  const authCtx = c as unknown as AuthContext;
  const user = (authCtx as any).get('user') as { id: string };
  if (!user) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }

  const page = Number(c.req.query('page') || '1');
  const limit = Number(c.req.query('limit') || '20');
  const typeFilter = c.req.query('type') || undefined;

  const supabase = getSupabaseClient(c.env, (authCtx as any).get('jwt'));

  try {
    const result = await getNotificationHistory(user.id, page, limit, supabase, typeFilter);
    return c.json({
      success: true,
      data: result.notifications,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        total_pages: result.total_pages,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch notifications';
    return c.json({ success: false, error: { code: 'INTERNAL_ERROR', message: msg } }, 500);
  }
});

// ============================================
// PATCH /api/notifications/:id/read
// Mark notification as read
// ============================================
messaging.patch('/notifications/:id/read', async (c) => {
  const authCtx = c as unknown as AuthContext;
  const user = (authCtx as any).get('user') as { id: string };
  if (!user) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }

  const notifId = c.req.param('id');
  const supabase = getSupabaseClient(c.env, (authCtx as any).get('jwt'));

  try {
    // Verify ownership
    const { data: notif } = await supabase
      .from('notifications')
      .select('id, user_id')
      .eq('id', notifId)
      .single();

    if (!notif || notif.user_id !== user.id) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Notification not found' } }, 404);
    }

    const { error } = await supabase
      .from('notifications')
      .update({ status: 'read', read_at: new Date().toISOString() })
      .eq('id', notifId);

    if (error) {
      throw new Error(`Failed to update notification: ${error.message}`);
    }

    return c.json({ success: true, data: { id: notifId, status: 'read' } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to mark notification as read';
    return c.json({ success: false, error: { code: 'INTERNAL_ERROR', message: msg } }, 500);
  }
});

// ============================================
// GET /api/events/:slug/messaging/stats
// Get delivery statistics (organizer only)
// ============================================
messaging.get('/events/:slug/messaging/stats', async (c) => {
  const authCtx = c as unknown as AuthContext;
  const user = (authCtx as any).get('user') as { id: string };
  if (!user) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }

  const slug = c.req.param('slug');
  const supabase = getSupabaseClient(c.env, (authCtx as any).get('jwt'));

  try {
    const event = await getEventBySlug(slug, supabase);
    if (!event) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Event not found' } }, 404);
    }
    if (event.organizer_id !== user.id) {
      return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } }, 403);
    }

    const stats = await getDeliveryStats(event.id, supabase);
    return c.json({ success: true, data: stats });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch delivery stats';
    return c.json({ success: false, error: { code: 'INTERNAL_ERROR', message: msg } }, 500);
  }
});
