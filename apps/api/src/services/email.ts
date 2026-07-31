import type { SupabaseClient } from '@supabase/supabase-js';
import type { Env } from './supabase.js';
import type {
  EmailLog,
  EmailCategory,
  SendEmailResponse,
  EmailDeliveryStats,
} from '@event-platform/shared';

// ============================================
// EMAIL JOB TYPE (shared with worker-email)
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
}

// ============================================
// SEND EMAIL (Queue Producer)
// ============================================

export const sendEmail = async (
  to: string | string[],
  subject: string,
  env: Env,
  options: {
    templateId?: string;
    templateData?: Record<string, string>;
    html?: string;
    text?: string;
    category?: EmailCategory;
    eventId?: string;
    from?: string;
  } = {}
): Promise<SendEmailResponse> => {
  const recipients = Array.isArray(to) ? to : [to];
  const category = options.category || 'transactional';
  const from = options.from || (category === 'marketing'
    ? 'events@event-platform.example.com'
    : 'noreply@event-platform.example.com');

  const queue = category === 'marketing' ? env.MARKETING_QUEUE : env.TRANSACTIONAL_QUEUE;

  let queued = 0;
  let failed = 0;

  for (const recipient of recipients) {
    try {
      const job: EmailJob = {
        to: recipient,
        from,
        subject,
        templateId: options.templateId,
        templateData: options.templateData,
        html: options.html,
        text: options.text,
        isMarketing: category === 'marketing',
      };

      if (category === 'marketing') {
        job.unsubscribeUrl = options.eventId
          ? `https://event-platform.example.com/unsubscribe?event=${options.eventId}&email=${encodeURIComponent(recipient)}`
          : `https://event-platform.example.com/unsubscribe?email=${encodeURIComponent(recipient)}`;
      }

      await queue.send(job);
      queued++;
    } catch (err) {
      console.error(`Failed to queue email to ${recipient}:`, err);
      failed++;
    }
  }

  return {
    queued,
    failed,
    message: failed === 0
      ? `${queued} email(s) queued successfully`
      : `${queued} queued, ${failed} failed`,
  };
};

// ============================================
// SEND BULK EMAIL TO EVENT PARTICIPANTS
// ============================================

export const sendBulkEmail = async (
  eventId: string,
  subject: string,
  html: string,
  text: string,
  env: Env,
  supabase: SupabaseClient,
  options: {
    templateId?: string;
    templateData?: Record<string, string>;
    category?: EmailCategory;
    filter?: 'all' | 'confirmed' | 'checked_in';
  } = {}
): Promise<SendEmailResponse> => {
  // Get event
  const { data: event } = await supabase
    .from('events')
    .select('id, title')
    .eq('id', eventId)
    .single();

  if (!event) {
    throw new Error('Event not found');
  }

  // Get participant emails
  let regQuery = supabase
    .from('registrations')
    .select('user_id, status, checked_in_at, users:profiles(id, email)')
    .eq('event_id', eventId)
    .neq('status', 'cancelled');

  const { data: registrations } = await regQuery;
  let regs = (registrations ?? []) as any[];

  // Apply filter
  const filter = options.filter || 'all';
  if (filter === 'confirmed') {
    regs = regs.filter((r) => r.status === 'confirmed');
  } else if (filter === 'checked_in') {
    regs = regs.filter((r) => r.checked_in_at != null);
  }

  // Extract unique emails
  const emails = [...new Set(regs.map((r) => r.users?.email).filter(Boolean))] as string[];

  if (emails.length === 0) {
    return { queued: 0, failed: 0, message: 'No recipients found' };
  }

  return sendEmail(emails, subject, env, {
    html,
    text,
    templateId: options.templateId,
    templateData: options.templateData,
    category: options.category || 'marketing',
    eventId,
  });
};

// ============================================
// GET EMAIL DELIVERY LOGS
// ============================================

export const getEmailLogs = async (
  page: number,
  limit: number,
  supabase: SupabaseClient,
  filters?: {
    status?: string;
    category?: string;
    event_id?: string;
    search?: string;
  }
): Promise<{
  logs: EmailLog[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}> => {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from('email_log')
    .select('*', { count: 'exact' })
    .order('sent_at', { ascending: false });

  if (filters?.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }
  if (filters?.category) {
    query = query.eq('category', filters.category);
  }
  if (filters?.event_id) {
    query = query.eq('event_id', filters.event_id);
  }
  if (filters?.search) {
    query = query.ilike('to_email', `%${filters.search}%`);
  }

  const { data, error, count } = await query.range(from, to);

  if (error) {
    throw new Error(`Failed to fetch email logs: ${error.message}`);
  }

  return {
    logs: (data ?? []) as EmailLog[],
    total: count ?? 0,
    page,
    limit,
    total_pages: Math.ceil((count ?? 0) / limit),
  };
};

// ============================================
// GET EMAIL DELIVERY STATS
// ============================================

export const getEmailDeliveryStats = async (
  supabase: SupabaseClient,
  eventId?: string
): Promise<EmailDeliveryStats> => {
  let query = supabase.from('email_log').select('status, category');

  if (eventId) {
    query = query.eq('event_id', eventId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to fetch email stats: ${error.message}`);
  }

  const logs = (data ?? []) as { status: string; category: string }[];

  const stats: EmailDeliveryStats = {
    total: logs.length,
    sent: 0,
    delivered: 0,
    bounced: 0,
    failed: 0,
    by_category: { transactional: 0, marketing: 0, notification: 0 },
  };

  for (const log of logs) {
    if (log.status === 'sent') stats.sent++;
    else if (log.status === 'delivered') stats.delivered++;
    else if (log.status === 'bounced') stats.bounced++;
    else if (log.status === 'failed') stats.failed++;

    const cat = log.category as 'transactional' | 'marketing' | 'notification';
    if (cat in stats.by_category) {
      stats.by_category[cat]++;
    }
  }

  return stats;
};

// ============================================
// UNSUBSCRIBE
// ============================================

export const unsubscribeEmail = async (
  email: string,
  eventId: string | undefined,
  supabase: SupabaseClient
): Promise<{ success: boolean }> => {
  // Insert into unsubscribed list
  const { error } = await supabase
    .from('email_unsubscribes')
    .upsert(
      {
        email,
        event_id: eventId ?? null,
        unsubscribed_at: new Date().toISOString(),
      },
      { onConflict: 'email,event_id' }
    );

  if (error) {
    // If table doesn't exist or conflict, try without event_id constraint
    const { error: err2 } = await supabase
      .from('email_unsubscribes')
      .insert({
        email,
        event_id: eventId ?? null,
        unsubscribed_at: new Date().toISOString(),
      });

    if (err2) {
      console.error('Unsubscribe error:', err2.message);
      throw new Error(`Failed to unsubscribe: ${err2.message}`);
    }
  }

  return { success: true };
};

export const checkUnsubscribed = async (
  email: string,
  eventId: string | undefined,
  supabase: SupabaseClient
): Promise<boolean> => {
  let query = supabase
    .from('email_unsubscribes')
    .select('id')
    .eq('email', email);

  if (eventId) {
    query = query.or(`event_id.eq.${eventId},event_id.is.null`);
  }

  const { data } = await query.limit(1);
  return (data ?? []).length > 0;
};
