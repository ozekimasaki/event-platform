// ============================================
// API KEY TYPES
// ============================================

export type ApiKeyScope =
  | 'read:events'
  | 'read:participants'
  | 'write:events'
  | 'read:registrations';

export interface ApiKey {
  id: string;
  organizer_id: string;
  name: string;
  key_hash: string;
  key_prefix: string; // first 8 chars for display: "epk_abc..."
  scopes: ApiKeyScope[];
  is_active: boolean;
  expires_at?: string;
  last_used_at?: string;
  created_at: string;
  updated_at: string;
}

// Returned only once on creation
export interface ApiKeyCreated {
  id: string;
  name: string;
  key: string; // full key, shown only once
  key_prefix: string;
  scopes: ApiKeyScope[];
  is_active: boolean;
  expires_at?: string;
  created_at: string;
}

// ============================================
// WEBHOOK TYPES
// ============================================

export type WebhookEventType =
  | 'event.created'
  | 'event.updated'
  | 'event.published'
  | 'event.cancelled'
  | 'registration.created'
  | 'registration.cancelled'
  | 'registration.checked_in'
  | 'payment.succeeded'
  | 'payment.refunded';

export interface Webhook {
  id: string;
  organizer_id: string;
  url: string;
  events: WebhookEventType[];
  secret: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WebhookEvent {
  id: string;
  webhook_id: string;
  event_type: WebhookEventType;
  payload: Record<string, unknown>;
  status: 'pending' | 'delivered' | 'failed';
  response_status?: number;
  response_body?: string;
  attempts: number;
  created_at: string;
  delivered_at?: string;
}
