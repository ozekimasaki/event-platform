import type { SupabaseClient } from '@supabase/supabase-js';
import type { Payment } from '@event-platform/shared';
import type { Env } from './supabase.js';
import Stripe from 'stripe';

// ============================================
// CREATE PAYMENT INTENT
// ============================================

export const createPaymentIntent = async (
  registrationId: string,
  amount: number,
  currency: string,
  env: Env
): Promise<{ client_secret: string; payment_intent_id: string; amount: number; currency: string }> => {
  const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: '2026-07-29.dahlia',
  });

  const paymentIntent = await stripe.paymentIntents.create({
    amount,
    currency,
    metadata: {
      registration_id: registrationId,
    },
  });

  // Create payment record in DB
  // Note: This function receives supabase separately if needed, or we return data for the route to handle
  return {
    client_secret: paymentIntent.client_secret!,
    payment_intent_id: paymentIntent.id,
    amount,
    currency,
  };
};

// ============================================
// CREATE PAYMENT RECORD
// ============================================

export const createPaymentRecord = async (
  data: {
    registration_id: string;
    amount: number;
    currency: string;
    stripe_payment_intent_id: string;
  },
  supabase: SupabaseClient
): Promise<Payment> => {
  const { data: payment, error } = await supabase
    .from('payments')
    .insert({
      registration_id: data.registration_id,
      amount: data.amount,
      currency: data.currency,
      status: 'pending',
      payment_method: 'stripe',
      stripe_payment_intent_id: data.stripe_payment_intent_id,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create payment record: ${error.message}`);
  }

  return payment as Payment;
};

// ============================================
// HANDLE STRIPE WEBHOOK
// ============================================

export const handleStripeWebhook = async (
  signature: string,
  body: string,
  env: Env,
  supabase: SupabaseClient
): Promise<void> => {
  const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: '2026-07-29.dahlia',
  });

  const event = stripe.webhooks.constructEvent(
    body,
    signature,
    env.STRIPE_WEBHOOK_SECRET
  );

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const registrationId = paymentIntent.metadata.registration_id;

      // Update payment record
      await supabase
        .from('payments')
        .update({
          status: 'succeeded',
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_payment_intent_id', paymentIntent.id);

      // Confirm registration
      if (registrationId) {
        await supabase
          .from('registrations')
          .update({
            status: 'confirmed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', registrationId);
      }
      break;
    }

    case 'payment_intent.payment_failed': {
      const failedIntent = event.data.object as Stripe.PaymentIntent;

      await supabase
        .from('payments')
        .update({
          status: 'failed',
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_payment_intent_id', failedIntent.id);
      break;
    }

    case 'charge.refunded': {
      const charge = event.data.object as Stripe.Charge;
      const paymentIntentId = charge.payment_intent as string;

      await supabase
        .from('payments')
        .update({
          status: 'refunded',
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_payment_intent_id', paymentIntentId);

      // Optionally cancel the registration
      const { data: payment } = await supabase
        .from('payments')
        .select('registration_id')
        .eq('stripe_payment_intent_id', paymentIntentId)
        .single();

      if (payment) {
        await supabase
          .from('registrations')
          .update({
            status: 'cancelled',
            updated_at: new Date().toISOString(),
          })
          .eq('id', payment.registration_id);
      }
      break;
    }
  }
};

// ============================================
// GET EVENT PAYMENTS
// ============================================

export const getEventPayments = async (
  eventId: string,
  supabase: SupabaseClient
): Promise<Payment[]> => {
  const { data, error } = await supabase
    .from('payments')
    .select('*, registration:registrations(event_id)')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to get payments: ${error.message}`);
  }

  // Filter by event_id through registration relation
  const filtered = (data ?? []).filter(
    (row: any) => row.registration?.event_id === eventId
  );

  return filtered as Payment[];
};
