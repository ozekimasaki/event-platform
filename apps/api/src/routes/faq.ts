import { Hono } from 'hono';
import type { AuthContext, AuthUser } from '../middleware/auth.js';
import { getSupabaseClient, getAdminClient } from '../services/supabase.js';
import type { Env } from '../services/supabase.js';
import { getEventById } from '../services/events.js';
import { createFAQ, updateFAQ, deleteFAQ, getFAQById, getEventFAQs, getGlobalFAQs } from '../services/faq.js';
import { faqSchema } from '@event-platform/shared';

const faq = new Hono<{ Bindings: Env }>();

// ============================================
// GET /api/faq - Get global FAQs (public)
// ============================================

faq.get('/faq', async (c) => {
  const supabase = getAdminClient(c.env);

  try {
    const faqs = await getGlobalFAQs(supabase);
    return c.json({ success: true, data: faqs });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to get FAQs';
    return c.json({ success: false, error: { code: 'INTERNAL_ERROR', message } }, 500);
  }
});

// ============================================
// GET /api/faq/event/:eventId - Get event-specific FAQs (public)
// ============================================

faq.get('/faq/event/:eventId', async (c) => {
  const eventId = c.req.param('eventId');
  const supabase = getAdminClient(c.env);

  try {
    const faqs = await getEventFAQs(eventId, supabase);
    return c.json({ success: true, data: faqs });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to get FAQs';
    return c.json({ success: false, error: { code: 'INTERNAL_ERROR', message } }, 500);
  }
});

// ============================================
// GET /api/faq/:id - Get FAQ by ID (public)
// ============================================

faq.get('/faq/:id', async (c) => {
  const id = c.req.param('id');
  const supabase = getAdminClient(c.env);

  try {
    const faqItem = await getFAQById(id, supabase);
    if (!faqItem) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'FAQ not found' } }, 404);
    }
    return c.json({ success: true, data: faqItem });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to get FAQ';
    return c.json({ success: false, error: { code: 'INTERNAL_ERROR', message } }, 500);
  }
});

// ============================================
// POST /api/faq - Create FAQ (auth required)
// ============================================

faq.post('/faq', async (c) => {
  const authCtx = c as unknown as AuthContext;
  const user = (authCtx as any).get('user') as AuthUser | undefined;
  if (!user) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }

  const body = await c.req.json();
  const parsed = faqSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0]?.message ?? 'Invalid input' } }, 400);
  }

  const { event_id } = body as { event_id?: string };
  const supabase = getAdminClient(c.env);

  // If event_id provided, verify organizer access
  if (event_id) {
    const event = await getEventById(event_id, getSupabaseClient(c.env, (authCtx as any).get('jwt')));
    if (!event) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Event not found' } }, 404);
    }
    if (event.organizer_id !== user.id) {
      return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Organizer access required' } }, 403);
    }
  }

  try {
    const faqItem = await createFAQ(event_id ?? null, parsed.data.question, parsed.data.answer, supabase);
    return c.json({ success: true, data: faqItem }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create FAQ';
    return c.json({ success: false, error: { code: 'INTERNAL_ERROR', message } }, 500);
  }
});

// ============================================
// PATCH /api/faq/:id - Update FAQ (auth required)
// ============================================

faq.patch('/faq/:id', async (c) => {
  const authCtx = c as unknown as AuthContext;
  const user = (authCtx as any).get('user') as AuthUser | undefined;
  if (!user) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }

  const id = c.req.param('id');
  const body = await c.req.json();
  const { question, answer } = body as { question?: string; answer?: string };

  const supabase = getAdminClient(c.env);

  try {
    // Verify ownership via event
    const existing = await getFAQById(id, supabase);
    if (!existing) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'FAQ not found' } }, 404);
    }

    if (existing.event_id) {
      const event = await getEventById(existing.event_id, getSupabaseClient(c.env, (authCtx as any).get('jwt')));
      if (!event || event.organizer_id !== user.id) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Organizer access required' } }, 403);
      }
    }

    const faqItem = await updateFAQ(id, question, answer, supabase);
    return c.json({ success: true, data: faqItem });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update FAQ';
    return c.json({ success: false, error: { code: 'INTERNAL_ERROR', message } }, 500);
  }
});

// ============================================
// DELETE /api/faq/:id - Delete FAQ (auth required)
// ============================================

faq.delete('/faq/:id', async (c) => {
  const authCtx = c as unknown as AuthContext;
  const user = (authCtx as any).get('user') as AuthUser | undefined;
  if (!user) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }

  const id = c.req.param('id');
  const supabase = getAdminClient(c.env);

  try {
    const existing = await getFAQById(id, supabase);
    if (!existing) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'FAQ not found' } }, 404);
    }

    if (existing.event_id) {
      const event = await getEventById(existing.event_id, getSupabaseClient(c.env, (authCtx as any).get('jwt')));
      if (!event || event.organizer_id !== user.id) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Organizer access required' } }, 403);
      }
    }

    await deleteFAQ(id, supabase);
    return c.json({ success: true, data: { message: 'FAQ deleted successfully' } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete FAQ';
    return c.json({ success: false, error: { code: 'INTERNAL_ERROR', message } }, 500);
  }
});

export { faq };
