// ============================================
// NOTIFICATION TYPES
// ============================================

export type NotificationType =
  | 'registration'
  | 'reminder'
  | 'cancellation'
  | 'checkin'
  | 'payment'
  | 'marketing'
  | 'system';

export type MessagingChannel = 'email' | 'push' | 'sms' | 'all';

export type NotificationStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'read';

export interface Notification {
  id: string;
  user_id: string;
  event_id?: string;
  type: NotificationType;
  channel: MessagingChannel;
  subject: string;
  body: string;
  status: NotificationStatus;
  metadata?: Record<string, unknown>;
  created_at: string;
  read_at?: string;
}

export interface SendNotificationRequest {
  subject: string;
  message: string;
  channel: MessagingChannel;
  recipient_filter?: 'all' | 'checked_in' | 'waitlisted';
}

export interface IndividualNotificationRequest {
  user_id: string;
  subject: string;
  message: string;
}

export interface NotificationResponse {
  notification_id: string;
  recipients_count: number;
  channel: MessagingChannel;
  status: 'queued' | 'sent' | 'partial' | 'failed';
}

export interface DeliveryStats {
  total: number;
  sent: number;
  delivered: number;
  failed: number;
  read: number;
  by_channel: {
    email: number;
    push: number;
    sms: number;
  };
}
