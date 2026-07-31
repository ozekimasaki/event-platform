import type { SupabaseClient } from '@supabase/supabase-js';
import type { Webhook, WebhookEventType } from '@event-platform/shared';

// ============================================
// HMAC-SHA256 SIGNATURE
// ============================================

const signPayload = async (payload: string, secret: string): Promise<string> => {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(payload);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  const hashArray = Array.from(new Uint8Array(signature));
  return 'sha256=' + hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
};

// ============================================
// CREATE WEBHOOK
// ============================================

export const createWebhook = async (
  organizerId: string,
  url: string,
  events: WebhookEventType[],
  secret: string | undefined,
  isActive: boolean,
  supabase: SupabaseClient
): Promise<Webhook> => {
  // Generate a default secret if not provided
  const webhookSecret = secret ?? crypto.randomUUID();

  const { data, error } = await supabase
    .from('webhooks')
    .insert({
      organizer_id: organizerId,
      url,
      events,
      secret: webhookSecret,
      is_active: isActive,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create webhook: ${error.message}`);
  }

  return data as Webhook;
};

// ============================================
// DELETE WEBHOOK
// ============================================

export const deleteWebhook = async (
  webhookId: string,
  organizerId: string,
  supabase: SupabaseClient
): Promise<void> => {
  const { error } = await supabase
    .from('webhooks')
    .delete()
    .eq('id', webhookId)
    .eq('organizer_id', organizerId);

  if (error) {
    throw new Error(`Failed to delete webhook: ${error.message}`);
  }
};

// ============================================
// GET WEBHOOKS FOR ORGANIZER
// ============================================

export const getWebhooks = async (
  organizerId: string,
  supabase: SupabaseClient
): Promise<Webhook[]> => {
  const { data, error } = await supabase
    .from('webhooks')
    .select('*')
    .eq('organizer_id', organizerId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to get webhooks: ${error.message}`);
  }

  return (data ?? []) as Webhook[];
};

// ============================================
// GET WEBHOOK BY ID
// ============================================

export const getWebhookById = async (
  webhookId: string,
  organizerId: string,
  supabase: SupabaseClient
): Promise<Webhook | null> => {
  const { data, error } = await supabase
    .from('webhooks')
    .select('*')
    .eq('id', webhookId)
    .eq('organizer_id', organizerId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to get webhook: ${error.message}`);
  }

  return data as Webhook | null;
};

// ============================================
// TRIGGER WEBHOOK
// ============================================

export const triggerWebhook = async (
  eventType: WebhookEventType,
  payload: Record<string, unknown>,
  organizerId: string,
  supabase: SupabaseClient
): Promise<void> => {
  // Get all active webhooks for this organizer that subscribe to this event type
  const { data: webhooks, error } = await supabase
    .from('webhooks')
    .select('*')
    .eq('organizer_id', organizerId)
    .eq('is_active', true);

  if (error || !webhooks) return;

  const matchingWebhooks = (webhooks as Webhook[]).filter((wh) =>
    wh.events.includes(eventType)
  );

  if (matchingWebhooks.length === 0) return;

  const body = JSON.stringify({
    event_type: eventType,
    payload,
    timestamp: new Date().toISOString(),
  });

  // Deliver to all matching webhooks in parallel
  const deliveryPromises = matchingWebhooks.map(async (webhook) => {
    const signature = await signPayload(body, webhook.secret);

    // Record the webhook event
    const { data: webhookEvent } = await supabase
      .from('webhook_events')
      .insert({
        webhook_id: webhook.id,
        event_type: eventType,
        payload,
        status: 'pending',
        attempts: 0,
      })
      .select()
      .single();

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': eventType,
          'X-Webhook-Delivery': webhookEvent?.id ?? crypto.randomUUID(),
        },
        body,
      });

      const responseBody = await response.text().catch(() => '');

      const status = response.ok ? 'delivered' : 'failed';
      await supabase
        .from('webhook_events')
        .update({
          status,
          response_status: response.status,
          response_body: responseBody.substring(0, 1000),
          attempts: 1,
          delivered_at: response.ok ? new Date().toISOString() : null,
        })
        .eq('id', webhookEvent?.id);
    } catch (err) {
      await supabase
        .from('webhook_events')
        .update({
          status: 'failed',
          response_body: err instanceof Error ? err.message : 'Unknown error',
          attempts: 1,
        })
        .eq('id', webhookEvent?.id);
    }
  });

  await Promise.allSettled(deliveryPromises);
};
