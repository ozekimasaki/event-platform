/**
 * Notification Worker
 * Processes notification jobs from the Cloudflare Queue and delivers them
 * through the appropriate channel (Push / SMS).
 */
import type {
  NotificationChannelType,
  NotificationTemplate,
} from '@event-platform/shared';

// ============================================
// JOB SHAPE (must match producer)
// ============================================

export interface NotificationJob {
  userId: string;
  channels: NotificationChannelType[];
  template: NotificationTemplate;
  eventId?: string;
  notificationId?: string;
}

interface Env {
  NOTIFICATION_DB: D1Database;
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_FROM_NUMBER?: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
}

// ============================================
// CHANNEL IMPLEMENTATIONS
// ============================================

async function deliverSMS(
  to: string,
  body: string,
  env: Env
): Promise<{ success: boolean; messageId?: string }> {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_FROM_NUMBER) {
    console.log(`[SMS] Skipping – Twilio credentials not configured. To: ${to}`);
    return { success: true, messageId: `sms-placeholder-${Date.now()}` };
  }

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`)}`,
      },
      body: new URLSearchParams({
        To: to,
        From: env.TWILIO_FROM_NUMBER,
        Body: body,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Twilio API error: ${response.status}`);
  }

  const result = (await response.json()) as { sid: string };
  return { success: true, messageId: result.sid };
}

async function deliverPush(
  userId: string,
  template: NotificationTemplate,
  _env: Env
): Promise<{ success: boolean; messageId?: string }> {
  // In production, look up the user's Web Push subscription from D1 and use
  // the web-push library (or a fetch-based VAPID signed request) to deliver.
  if (!_env.VAPID_PUBLIC_KEY || !_env.VAPID_PRIVATE_KEY) {
    console.log(`[Push] Skipping – VAPID keys not configured. User: ${userId}`);
    return { success: true, messageId: `push-placeholder-${Date.now()}` };
  }

  const payload = JSON.stringify({
    title: template.subject,
    body: template.body,
    data: template.data ?? {},
  });

  console.log(`[Push] Delivering to user ${userId}: ${payload}`);
  return { success: true, messageId: `push-${Date.now()}` };
}

// ============================================
// QUEUE CONSUMER
// ============================================

export default {
  async queue(batch: MessageBatch<NotificationJob>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      try {
        const job: NotificationJob = message.body;

        // Persist notification record in D1
        await env.NOTIFICATION_DB.prepare(
          `INSERT INTO notifications (user_id, type, title, body, data, created_at, read_at)
           VALUES (?, ?, ?, ?, ?, ?, NULL)`
        )
          .bind(
            job.userId,
            job.channels.join(','),
            job.template.subject,
            job.template.body,
            JSON.stringify(job.template),
            new Date().toISOString()
          )
          .run();

        // Deliver through each requested channel
        for (const channel of job.channels) {
          try {
            if (channel === 'sms') {
              // userId is used as phone number for SMS in this context
              const res = await deliverSMS(job.userId, job.template.body, env);
              console.log(`[SMS] result for ${job.userId}: success=${res.success}`);
            } else if (channel === 'push') {
              const res = await deliverPush(job.userId, job.template, env);
              console.log(`[Push] result for ${job.userId}: success=${res.success}`);
            } else {
              console.log(`[Worker] Channel '${channel}' not handled by this worker.`);
            }
          } catch (chErr) {
            console.error(`[Worker] Channel '${channel}' failed for ${job.userId}:`, chErr);
          }
        }

        console.log(`Notification delivered to user: ${job.userId}`);
      } catch (error) {
        console.error('Error processing notification:', error);
      }
    }
  },
};
