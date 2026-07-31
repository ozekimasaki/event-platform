import { z } from 'zod';

// ============================================
// API KEY SCHEMAS
// ============================================

export const apiKeyScopeEnum = z.enum([
  'read:events',
  'read:participants',
  'write:events',
  'read:registrations',
]);

export const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(apiKeyScopeEnum).min(1).max(10),
  expires_at: z.string().datetime().optional(),
});

export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;

// ============================================
// WEBHOOK SCHEMAS
// ============================================

export const webhookEventTypeEnum = z.enum([
  'event.created',
  'event.updated',
  'event.published',
  'event.cancelled',
  'registration.created',
  'registration.cancelled',
  'registration.checked_in',
  'payment.succeeded',
  'payment.refunded',
]);

export const createWebhookSchema = z.object({
  url: z.string().url(),
  events: z.array(webhookEventTypeEnum).min(1),
  secret: z.string().min(8).max(128).optional(),
  is_active: z.boolean().default(true),
});

export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;
