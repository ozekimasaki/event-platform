import type { SupabaseClient } from '@supabase/supabase-js';
import type { Env } from './supabase.js';
import type {
  Notification,
  NotificationType,
  MessagingChannel,
  NotificationResponse,
  DeliveryStats,
} from '@event-platform/shared';

// ============================================
// EMAIL JOB TYPES (shared with worker-email)
// ============================================

interface EmailJob {
  to: string;
  from: string;
  subject: string;
  templateId?: string;
  templateData?: Record<string, string>;
  html?: string;
  text?: string;
  isMarketing?: boolean;
  unsubscribeUrl?: string;
  notificationId?: string;
}

// ============================================
// SEND TRANSACTIONAL EMAIL
// ============================================

export const sendTransactionalEmail = async (
  to: string,
  templateId: string,
  variables: Record<string, string>,
  env: Env,
  notificationId?: string
): Promise<void> => {
  const job: EmailJob = {
    to,
    from: 'noreply@event-platform.example.com',
    subject: '', // Will be resolved by template in worker
    templateId,
    templateData: variables,
    notificationId,
  };

  await env.TRANSACTIONAL_QUEUE.send(job);
};

// ============================================
// SEND MARKETING EMAIL
// ============================================

export const sendMarketingEmail = async (
  recipients: string[],
  templateId: string,
  variables: Record<string, string>,
  env: Env,
  eventId?: string
): Promise<{ queued: number }> => {
  let queued = 0;

  for (const to of recipients) {
    const job: EmailJob = {
      to,
      from: 'events@event-platform.example.com',
      subject: '',
      templateId,
      templateData: variables,
      isMarketing: true,
      unsubscribeUrl: eventId
        ? `https://event-platform.example.com/unsubscribe?event=${eventId}&email=${encodeURIComponent(to)}`
        : `https://event-platform.example.com/unsubscribe?email=${encodeURIComponent(to)}`,
    };

    await env.MARKETING_QUEUE.send(job);
    queued++;
  }

  return { queued };
};

// ============================================
// SEND BULK NOTIFICATION TO EVENT PARTICIPANTS
// ============================================

export const sendBulkNotification = async (
  eventId: string,
  subject: string,
  message: string,
  channel: MessagingChannel,
  recipientFilter: 'all' | 'checked_in' | 'waitlisted',
  env: Env,
  supabase: SupabaseClient
): Promise<NotificationResponse> => {
  // Get event details
  const { data: event, error: eventErr } = await supabase
    .from('events')
    .select('id, title, slug, start_at, venue_name')
    .eq('id', eventId)
    .single();

  if (eventErr || !event) {
    throw new Error('Event not found');
  }

  // Build registration query based on filter
  let regQuery = supabase
    .from('registrations')
    .select('id, user_id, status, checked_in_at, users:profiles(id, email, display_name)')
    .eq('event_id', eventId);

  const { data: registrations, error: regErr } = await regQuery;

  if (regErr) {
    throw new Error(`Failed to fetch registrations: ${regErr.message}`);
  }

  let filteredRegs = (registrations ?? []) as any[];

  // Apply filter
  if (recipientFilter === 'checked_in') {
    filteredRegs = filteredRegs.filter((r) => r.checked_in_at != null);
  } else if (recipientFilter === 'waitlisted') {
    filteredRegs = filteredRegs.filter((r) => r.status === 'waitlisted');
  }

  // Insert notification records
  const notificationIds: string[] = [];
  for (const reg of filteredRegs) {
    const { data: notif, error: notifErr } = await supabase
      .from('notifications')
      .insert({
        user_id: reg.user_id,
        event_id: eventId,
        type: 'system' as NotificationType,
        channel,
        subject,
        body: message,
        status: 'pending',
        metadata: { bulk: true, filter: recipientFilter },
      })
      .select('id')
      .single();

    if (!notifErr && notif) {
      notificationIds.push(notif.id);
    }
  }

  // Queue emails for each recipient
  const channels: MessagingChannel[] = channel === 'all' ? ['email', 'push', 'sms'] : [channel];
  let queuedCount = 0;

  for (const reg of filteredRegs) {
    const userEmail = reg.users?.email;
    if (!userEmail) continue;

    if (channels.includes('email')) {
      const job: EmailJob = {
        to: userEmail,
        from: 'events@event-platform.example.com',
        subject,
        html: buildBulkEmailHtml(event.title, event.start_at, event.venue_name, message),
        text: message,
      };
      await env.TRANSACTIONAL_QUEUE.send(job);
      queuedCount++;
    }

    // Push and SMS are placeholders
    if (channels.includes('push')) {
      console.log(`[Push] To user ${reg.user_id}: ${subject}`);
    }
    if (channels.includes('sms')) {
      console.log(`[SMS] To user ${reg.user_id}: ${subject}`);
    }
  }

  // Update notification statuses to sent
  if (notificationIds.length > 0) {
    await supabase
      .from('notifications')
      .update({ status: 'sent' })
      .in('id', notificationIds);
  }

  return {
    notification_id: notificationIds[0] || '',
    recipients_count: filteredRegs.length,
    channel,
    status: queuedCount > 0 ? 'queued' : 'failed',
  };
};

// ============================================
// SEND PUSH NOTIFICATION (placeholder)
// ============================================

export const sendPushNotification = async (
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<{ success: boolean }> => {
  // Web Push implementation placeholder
  // In production, use Web Push API with VAPID keys
  console.log(`[Push Notification] User: ${userId}, Title: ${title}, Body: ${body}`, data);
  return { success: true };
};

// ============================================
// SEND SMS (placeholder with Twilio structure)
// ============================================

export const sendSMS = async (
  to: string,
  message: string,
  env: Env
): Promise<{ success: boolean; sid?: string }> => {
  // Twilio SMS placeholder
  // In production, call Twilio API
  const TWILIO_ACCOUNT_SID = (env as any).TWILIO_ACCOUNT_SID;
  const TWILIO_AUTH_TOKEN = (env as any).TWILIO_AUTH_TOKEN;
  const TWILIO_FROM_NUMBER = (env as any).TWILIO_FROM_NUMBER;

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
    console.log(`[SMS Placeholder] To: ${to}, Message: ${message}`);
    return { success: true, sid: `placeholder-${Date.now()}` };
  }

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
        },
        body: new URLSearchParams({
          To: to,
          From: TWILIO_FROM_NUMBER,
          Body: message,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Twilio API error: ${response.status}`);
    }

    const result = await response.json();
    return { success: true, sid: result.sid };
  } catch (error) {
    console.error('SMS send failed:', error);
    return { success: false };
  }
};

// ============================================
// GET NOTIFICATION HISTORY
// ============================================

export const getNotificationHistory = async (
  userId: string,
  page: number,
  limit: number,
  supabase: SupabaseClient,
  typeFilter?: string
): Promise<{
  notifications: Notification[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}> => {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from('notifications')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (typeFilter && typeFilter !== 'all') {
    query = query.eq('type', typeFilter);
  }

  const { data, error, count } = await query.range(from, to);

  if (error) {
    throw new Error(`Failed to fetch notifications: ${error.message}`);
  }

  const total = count ?? 0;

  return {
    notifications: (data ?? []) as Notification[],
    total,
    page,
    limit,
    total_pages: Math.ceil(total / limit),
  };
};

// ============================================
// GET DELIVERY STATS
// ============================================

export const getDeliveryStats = async (
  eventId: string,
  supabase: SupabaseClient
): Promise<DeliveryStats> => {
  const { data: notifications, error } = await supabase
    .from('notifications')
    .select('status, channel')
    .eq('event_id', eventId);

  if (error) {
    throw new Error(`Failed to fetch delivery stats: ${error.message}`);
  }

  const all = (notifications ?? []) as { status: string; channel: string }[];

  const stats: DeliveryStats = {
    total: all.length,
    sent: 0,
    delivered: 0,
    failed: 0,
    read: 0,
    by_channel: { email: 0, push: 0, sms: 0 },
  };

  for (const n of all) {
    if (n.status === 'sent') stats.sent++;
    else if (n.status === 'delivered') stats.delivered++;
    else if (n.status === 'failed') stats.failed++;
    else if (n.status === 'read') stats.read++;

    const ch = n.channel as 'email' | 'push' | 'sms';
    if (ch in stats.by_channel) {
      stats.by_channel[ch]++;
    }
  }

  return stats;
};

// ============================================
// HELPERS
// ============================================

function buildBulkEmailHtml(
  eventTitle: string,
  eventDate: string,
  venueName: string | null,
  message: string
): string {
  const formattedDate = new Date(eventDate).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: 'Helvetica Neue', Arial, 'Hiragino Sans', Meiryo, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
  <div style="background-color: #fff; border-radius: 8px; padding: 32px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <h1 style="font-size: 20px; color: #111; margin: 0 0 16px 0;">${eventTitle}</h1>
    <p style="color: #6b7280; font-size: 14px; margin: 0 0 16px 0;">${formattedDate}${venueName ? ` | ${venueName}` : ''}</p>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;">
    <div style="font-size: 15px; color: #333;">${message.replace(/\n/g, '<br>')}</div>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0 16px 0;">
    <p style="font-size: 12px; color: #9ca3af; text-align: center;">Event Platform - イベント管理プラットフォーム</p>
  </div>
</body>
</html>`;
}
