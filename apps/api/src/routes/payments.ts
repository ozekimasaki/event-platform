import { Hono } from 'hono';
import type { Context } from 'hono';
import type { AuthContext } from '../middleware/auth.js';
import { getSupabaseClient, getAdminClient } from '../services/supabase.js';
import {
  createPaymentIntent,
  createPaymentRecord,
  handleStripeWebhook,
  getEventPayments,
} from '../services/payments.js';
import { getEventBySlug } from '../services/events.js';
import { paymentIntentSchema } from '@event-platform/shared';
import type { Env } from '../services/supabase.js';

const payments = new Hono<{ Bindings: Env }>();

// POST /api/payments/create-intent - Create PaymentIntent (auth required)
payments.post('/create-intent', async (c) => {
  const authCtx = c as unknown as AuthContext;
  const user = (authCtx as any).get('user') as { id: string };
  if (!user) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }

  const body = await c.req.json();
  const data = paymentIntentSchema.parse(body);

  const supabase = getSupabaseClient(c.env, (authCtx as any).get('jwt'));

  try {
    // Create Stripe PaymentIntent
    const intent = await createPaymentIntent(
      data.registration_id,
      data.amount,
      data.currency,
      c.env
    );

    // Create payment record in DB
    await createPaymentRecord({
      registration_id: data.registration_id,
      amount: data.amount,
      currency: data.currency,
      stripe_payment_intent_id: intent.payment_intent_id,
    }, supabase);

    return c.json({
      success: true,
      data: {
        client_secret: intent.client_secret,
        payment_intent_id: intent.payment_intent_id,
        amount: intent.amount,
        currency: intent.currency,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Payment creation failed';
    return c.json({ success: false, error: { code: 'PAYMENT_ERROR', message } }, 400);
  }
});

// ============================================
// STANDALONE WEBHOOK HANDLER (mounted directly on app, no auth)
// ============================================

export const handleStripeWebhookRoute = async (c: Context<{ Bindings: Env }>) => {
  const body = await c.req.text();
  const signature = c.req.header('stripe-signature');

  if (!signature) {
    return c.json({ success: false, error: { code: 'BAD_REQUEST', message: 'Missing stripe-signature header' } }, 400);
  }

  // Use admin client for webhook processing (bypasses RLS)
  const supabase = getAdminClient(c.env);

  try {
    await handleStripeWebhook(signature, body, c.env, supabase);
    return c.json({ success: true, data: { received: true } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Webhook processing failed';
    console.error('Stripe webhook error:', message);
    return c.json({ success: false, error: { code: 'WEBHOOK_ERROR', message } }, 400);
  }
};

// ============================================
// GET EVENT PAYMENTS (organizer only)
// ============================================

export const getEventPaymentsRoute = async (c: Context<{ Bindings: Env }>) => {
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

  if (event.organizer_id !== user.id) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } }, 403);
  }

  const paymentsList = await getEventPayments(event.id, supabase);
  return c.json({ success: true, data: paymentsList });
};

export { payments };
