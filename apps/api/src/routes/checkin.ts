import { Hono } from 'hono';
import type { AuthContext, AuthUser } from '../middleware/auth.js';
import { getSupabaseClient, getAdminClient } from '../services/supabase.js';
import { checkInByToken, checkInManually, getCheckInStatus, getCheckInLog } from '../services/checkin.js';
import { getQRCodeForRegistration } from '../services/qrcode.js';
import { getEventBySlug } from '../services/events.js';
import type { Env } from '../services/supabase.js';

const checkin = new Hono<{ Bindings: Env }>();

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

  // Organizer always has access
  if (event.organizer_id === user.id) {
    return event;
  }

  // Check for event_staff role in event_staff table
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
// POST /api/events/:slug/check-in - Check in by QR token
// ============================================

checkin.post('/events/:slug/check-in', async (c) => {
  const authCtx = c as unknown as AuthContext;
  const user = (authCtx as any).get('user') as AuthUser | undefined;
  if (!user) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }

  const slug = c.req.param('slug');
  const body = await c.req.json();
  const { qr_token } = body as { qr_token: string };

  if (!qr_token) {
    return c.json({ success: false, error: { code: 'BAD_REQUEST', message: 'qr_token is required' } }, 400);
  }

  // Use admin client to bypass RLS for staff operations
  const supabase = getAdminClient(c.env);

  try {
    await verifyStaffAccess(slug, user, supabase);
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'EVENT_NOT_FOUND') {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Event not found' } }, 404);
    }
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Staff access required' } }, 403);
  }

  try {
    const registration = await checkInByToken(slug, qr_token, user.id, supabase);

    // Broadcast to Durable Object if available
    try {
      const event = await getEventBySlug(slug, supabase);
      if (event && c.env.CHECK_IN_COORDINATOR) {
        const doId = c.env.CHECK_IN_COORDINATOR.idFromName(event.id);
        const doStub = c.env.CHECK_IN_COORDINATOR.get(doId);
        const doUrl = new URL(request.url);
        doUrl.pathname = `/check-in-broadcast`;
        await doStub.fetch(new Request(doUrl.toString(), {
          method: 'POST',
          body: JSON.stringify({
            type: 'check-in',
            checkedInAt: registration.checked_in_at,
            userId: registration.user_id,
          }),
        }));
      }
    } catch (doErr) {
      console.warn('Failed to broadcast to DO:', doErr);
    }

    return c.json({ success: true, data: { registration } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Check-in failed';
    if (message.includes('not found')) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message } }, 404);
    }
    if (message.includes('Already')) {
      return c.json({ success: false, error: { code: 'ALREADY_CHECKED_IN', message } }, 409);
    }
    if (message.includes('cancelled') || message.includes('waitlisted') || message.includes('not in a')) {
      return c.json({ success: false, error: { code: 'BAD_REQUEST', message } }, 400);
    }
    return c.json({ success: false, error: { code: 'INTERNAL_ERROR', message } }, 500);
  }
});

// ============================================
// POST /api/events/:slug/check-in/manual - Manual check-in
// ============================================

checkin.post('/events/:slug/check-in/manual', async (c) => {
  const authCtx = c as unknown as AuthContext;
  const user = (authCtx as any).get('user') as AuthUser | undefined;
  if (!user) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }

  const slug = c.req.param('slug');
  const body = await c.req.json();
  const { user_id } = body as { user_id: string };

  if (!user_id) {
    return c.json({ success: false, error: { code: 'BAD_REQUEST', message: 'user_id is required' } }, 400);
  }

  const supabase = getAdminClient(c.env);

  try {
    await verifyStaffAccess(slug, user, supabase);
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'EVENT_NOT_FOUND') {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Event not found' } }, 404);
    }
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Staff access required' } }, 403);
  }

  try {
    const registration = await checkInManually(slug, user_id, user.id, supabase);
    return c.json({ success: true, data: { registration } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Check-in failed';
    if (message.includes('not found')) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message } }, 404);
    }
    if (message.includes('Already')) {
      return c.json({ success: false, error: { code: 'ALREADY_CHECKED_IN', message } }, 409);
    }
    return c.json({ success: false, error: { code: 'BAD_REQUEST', message } }, 400);
  }
});

// ============================================
// GET /api/events/:slug/check-in/status - Check-in statistics
// ============================================

checkin.get('/events/:slug/check-in/status', async (c) => {
  const authCtx = c as unknown as AuthContext;
  const user = (authCtx as any).get('user') as AuthUser | undefined;
  if (!user) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }

  const slug = c.req.param('slug');
  const supabase = getAdminClient(c.env);

  try {
    await verifyStaffAccess(slug, user, supabase);
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'EVENT_NOT_FOUND') {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Event not found' } }, 404);
    }
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Staff access required' } }, 403);
  }

  try {
    const status = await getCheckInStatus(slug, supabase);
    return c.json({ success: true, data: status });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to get status';
    return c.json({ success: false, error: { code: 'INTERNAL_ERROR', message } }, 500);
  }
});

// ============================================
// GET /api/events/:slug/check-in/log - Check-in log
// ============================================

checkin.get('/events/:slug/check-in/log', async (c) => {
  const authCtx = c as unknown as AuthContext;
  const user = (authCtx as any).get('user') as AuthUser | undefined;
  if (!user) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }

  const slug = c.req.param('slug');
  const supabase = getAdminClient(c.env);

  let event;
  try {
    event = await verifyStaffAccess(slug, user, supabase);
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'EVENT_NOT_FOUND') {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Event not found' } }, 404);
    }
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Staff access required' } }, 403);
  }

  try {
    const log = await getCheckInLog(event.id, supabase);
    return c.json({ success: true, data: log });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to get log';
    return c.json({ success: false, error: { code: 'INTERNAL_ERROR', message } }, 500);
  }
});

// ============================================
// GET /api/registrations/:id/qr-code - Get QR code image
// ============================================

checkin.get('/registrations/:id/qr-code', async (c) => {
  const authCtx = c as unknown as AuthContext;
  const user = (authCtx as any).get('user') as AuthUser | undefined;
  if (!user) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }

  const registrationId = c.req.param('id');
  const format = (c.req.query('format') ?? 'svg') as 'svg' | 'png';

  const supabase = getSupabaseClient(c.env, (authCtx as any).get('jwt'));

  try {
    // Verify ownership: get registration and check user_id
    const { data: registration } = await supabase
      .from('registrations')
      .select('id, user_id, qr_token')
      .eq('id', registrationId)
      .single();

    if (!registration) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Registration not found' } }, 404);
    }

    // Allow access to owner or event organizer
    if (registration.user_id !== user.id) {
      // Check if user is organizer
      const { data: regFull } = await supabase
        .from('registrations')
        .select('event_id, events!inner(organizer_id)')
        .eq('id', registrationId)
        .single();

      // If we can't verify organizer access, deny
      return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } }, 403);
    }

    const result = await getQRCodeForRegistration(registrationId, supabase, format);

    if (format === 'png' && result.png) {
      return new Response(result.png, {
        headers: {
          'Content-Type': 'image/png',
          'Content-Disposition': `inline; filename="qr-${registrationId}.png"`,
        },
      });
    }

    // Default: SVG
    return new Response(result.svg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Content-Disposition': `inline; filename="qr-${registrationId}.svg"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate QR code';
    return c.json({ success: false, error: { code: 'INTERNAL_ERROR', message } }, 500);
  }
});

export { checkin };
