// ============================================
// NOTIFICATION CHANNEL TYPES
// ============================================

/**
 * Supported notification channel identifiers.
 */
export type NotificationChannelType = 'email' | 'sms' | 'push' | 'in_app';

/**
 * Result of a single notification send attempt.
 */
export interface NotificationSendResult {
  channel: NotificationChannelType;
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Template payload used when sending notifications through the orchestrator.
 */
export interface NotificationTemplate {
  subject: string;
  body: string;
  /** Channel-specific overrides (e.g. SMS may need a shorter body). */
  overrides?: Partial<Record<NotificationChannelType, { subject?: string; body?: string }>>;
  /** Arbitrary data forwarded to push payloads or email template variables. */
  data?: Record<string, unknown>;
}

/**
 * Aggregated result returned by the orchestrator after attempting to deliver
 * a notification through one or more channels.
 */
export interface NotificationResult {
  /** The user / registration this result pertains to. */
  registrationId: string;
  results: NotificationSendResult[];
}

/**
 * Shape of a message enqueued for asynchronous delivery via Cloudflare Queues.
 */
export interface NotificationQueueMessage {
  /** Target user id. */
  userId: string;
  /** Channels to deliver through. */
  channels: NotificationChannelType[];
  /** Resolved template. */
  template: NotificationTemplate;
  /** Optional event context. */
  eventId?: string;
  /** Optional notification record id for status tracking. */
  notificationId?: string;
}

/**
 * User-level notification preferences.
 */
export interface NotificationPreference {
  userId: string;
  channels: Partial<Record<NotificationChannelType, boolean>>;
  /** Timezone offset in minutes (IANA tz not stored – resolved at render time). */
  timezoneOffset?: number;
  /** Whether the user has opted out of all marketing notifications. */
  marketingOptOut?: boolean;
}
