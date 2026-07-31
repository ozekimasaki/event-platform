// ============================================
// EMAIL TYPES
// ============================================

export type EmailCategory = 'transactional' | 'marketing' | 'notification';
export type EmailStatus = 'queued' | 'sent' | 'delivered' | 'bounced' | 'failed';

export interface EmailLog {
  id: string;
  to_email: string;
  from_email: string;
  subject: string;
  template_id?: string;
  status: EmailStatus;
  category: EmailCategory;
  event_id?: string;
  user_id?: string;
  error_message?: string;
  sent_at: string;
  delivered_at?: string;
}

export interface SendEmailRequest {
  to: string | string[];
  subject: string;
  template_id?: string;
  template_data?: Record<string, string>;
  html?: string;
  text?: string;
  category: EmailCategory;
  event_id?: string;
}

export interface SendEmailResponse {
  queued: number;
  failed: number;
  message: string;
}

export interface EmailDeliveryStats {
  total: number;
  sent: number;
  delivered: number;
  bounced: number;
  failed: number;
  by_category: {
    transactional: number;
    marketing: number;
    notification: number;
  };
}

export interface UnsubscribeRequest {
  email: string;
  event_id?: string;
}
