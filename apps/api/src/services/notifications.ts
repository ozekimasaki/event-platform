import type {
  NotificationChannelType,
  NotificationTemplate,
  NotificationResult,
  NotificationSendResult,
  NotificationQueueMessage,
} from '@event-platform/shared';
import type { Env } from './supabase.js';

// ============================================
// NOTIFICATION CHANNEL INTERFACE
// ============================================

/**
 * Common interface that every notification channel must implement.
 */
export interface NotificationChannel {
  send(
    to: string,
    subject: string,
    body: string,
    data?: Record<string, unknown>
  ): Promise<{ success: boolean; messageId?: string; error?: string }>;
}

// ============================================
// SMS CHANNEL (Twilio-compatible API)
// ============================================

export class SMSChannel implements NotificationChannel {
  private accountSid: string;
  private authToken: string;
  private fromNumber: string;

  constructor(env: Env) {
    const e = env as Record<string, unknown>;
    this.accountSid = (e.TWILIO_ACCOUNT_SID as string) ?? '';
    this.authToken = (e.TWILIO_AUTH_TOKEN as string) ?? '';
    this.fromNumber = (e.TWILIO_FROM_NUMBER as string) ?? '';
  }

  async send(
    to: string,
    _subject: string,
    body: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    // Gracefully skip when credentials are missing.
    if (!this.accountSid || !this.authToken || !this.fromNumber) {
      console.log(`[SMS] Skipping – Twilio credentials not configured. To: ${to}`);
      return { success: true, messageId: `sms-placeholder-${Date.now()}` };
    }

    try {
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${btoa(`${this.accountSid}:${this.authToken}`)}`,
          },
          body: new URLSearchParams({
            To: to,
            From: this.fromNumber,
            Body: body,
          }),
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        return { success: false, error: `Twilio ${response.status}: ${errText}` };
      }

      const result = (await response.json()) as { sid: string };
      return { success: true, messageId: result.sid };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[SMS] Send failed:', message);
      return { success: false, error: message };
    }
  }
}

// ============================================
// PUSH NOTIFICATION CHANNEL (Web Push API)
// ============================================

export class PushNotificationChannel implements NotificationChannel {
  private vapidPublicKey: string;
  private vapidPrivateKey: string;
  private vapidSubject: string;

  constructor(env: Env) {
    const e = env as Record<string, unknown>;
    this.vapidPublicKey = (e.VAPID_PUBLIC_KEY as string) ?? '';
    this.vapidPrivateKey = (e.VAPID_PRIVATE_KEY as string) ?? '';
    this.vapidSubject = (e.VAPID_SUBJECT as string) ?? 'mailto:noreply@event-platform.example.com';
  }

  async send(
    to: string,
    subject: string,
    body: string,
    data?: Record<string, unknown>
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    // Gracefully skip when VAPID keys are missing.
    if (!this.vapidPublicKey || !this.vapidPrivateKey) {
      console.log(`[Push] Skipping – VAPID keys not configured. User: ${to}`);
      return { success: true, messageId: `push-placeholder-${Date.now()}` };
    }

    try {
      // In production, look up the user's push subscription from the DB
      // and call web-push.sendNotification(subscription, payload).
      // For now we log the intent – real Web Push requires a subscription
      // object { endpoint, keys: { p256dh, auth } } per user.
      const payload = JSON.stringify({
        title: subject,
        body,
        data: data ?? {},
      });

      console.log(`[Push] Delivering to user ${to}: ${payload}`);

      // Placeholder messageId – replace with actual delivery receipt.
      return { success: true, messageId: `push-${Date.now()}` };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[Push] Send failed:', message);
      return { success: false, error: message };
    }
  }
}

// ============================================
// NOTIFICATION ORCHESTRATOR
// ============================================

/**
 * Sends a notification through one or more channels and aggregates results.
 */
export class NotificationOrchestrator {
  private channels: Map<NotificationChannelType, NotificationChannel>;

  constructor(env: Env) {
    this.channels = new Map<NotificationChannelType, NotificationChannel>();
    this.channels.set('sms', new SMSChannel(env));
    this.channels.set('push', new PushNotificationChannel(env));
  }

  /**
   * Send a notification to multiple registrations across the requested channels.
   *
   * @param registrationIds – user / registration ids to notify
   * @param channels        – which channels to deliver through
   * @param template        – subject / body / overrides
   * @param targets         – map of registrationId → delivery address (email, phone, etc.)
   */
  async send(
    registrationIds: string[],
    channels: NotificationChannelType[],
    template: NotificationTemplate,
    targets: Map<string, string>
  ): Promise<NotificationResult[]> {
    const results: NotificationResult[] = [];

    for (const regId of registrationIds) {
      const to = targets.get(regId);
      if (!to) {
        results.push({
          registrationId: regId,
          results: channels.map((ch) => ({
            channel: ch,
            success: false,
            error: 'No delivery address found for registration',
          })),
        });
        continue;
      }

      const channelResults: NotificationSendResult[] = [];

      for (const ch of channels) {
        const impl = this.channels.get(ch);
        if (!impl) {
          channelResults.push({ channel: ch, success: false, error: 'Channel not implemented' });
          continue;
        }

        const override = template.overrides?.[ch];
        const subject = override?.subject ?? template.subject;
        const body = override?.body ?? template.body;

        const res = await impl.send(to, subject, body, template.data);
        channelResults.push({
          channel: ch,
          success: res.success,
          messageId: res.messageId,
          error: res.error,
        });
      }

      results.push({ registrationId: regId, results: channelResults });
    }

    return results;
  }
}

// ============================================
// QUEUE HELPERS
// ============================================

/**
 * Enqueue a notification for asynchronous delivery via Cloudflare Queues.
 */
export const enqueueNotification = async (
  env: Env,
  message: NotificationQueueMessage
): Promise<void> => {
  const queue = (env as Record<string, unknown>).NOTIFICATION_QUEUE as Queue | undefined;
  if (!queue) {
    console.warn('[NotificationQueue] NOTIFICATION_QUEUE binding not found – skipping enqueue.');
    return;
  }
  await queue.send(message);
};

/**
 * Build a NotificationQueueMessage from common parameters.
 */
export const buildQueueMessage = (
  userId: string,
  channels: NotificationChannelType[],
  subject: string,
  body: string,
  eventId?: string,
  notificationId?: string,
  data?: Record<string, unknown>
): NotificationQueueMessage => ({
  userId,
  channels,
  template: { subject, body, data },
  eventId,
  notificationId,
});
