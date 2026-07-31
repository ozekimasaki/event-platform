import { z } from 'zod';

// ============================================
// NOTIFICATION SCHEMAS
// ============================================

/**
 * Schema for sending a notification through the orchestrator.
 */
export const sendNotificationSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1).max(500),
  channels: z
    .array(z.enum(['email', 'sms', 'push', 'in_app']))
    .min(1)
    .default(['email']),
  template: z.object({
    subject: z.string().min(1).max(200),
    body: z.string().min(1).max(5000),
    overrides: z
      .record(
        z.enum(['email', 'sms', 'push', 'in_app']),
        z.object({
          subject: z.string().max(200).optional(),
          body: z.string().max(5000).optional(),
        })
      )
      .optional(),
    data: z.record(z.unknown()).optional(),
  }),
  eventId: z.string().uuid().optional(),
});

export type SendNotificationInput = z.infer<typeof sendNotificationSchema>;

/**
 * Schema for user notification preferences.
 */
export const notificationPreferenceSchema = z.object({
  channels: z
    .record(z.enum(['email', 'sms', 'push', 'in_app']), z.boolean())
    .optional(),
  marketingOptOut: z.boolean().optional(),
});

export type NotificationPreferenceInput = z.infer<typeof notificationPreferenceSchema>;
