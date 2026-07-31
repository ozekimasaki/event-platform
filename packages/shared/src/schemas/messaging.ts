import { z } from 'zod';

export const notifySchema = z.object({
  subject: z.string().min(1).max(200),
  message: z.string().min(1).max(5000),
  channel: z.enum(['email', 'push', 'sms', 'all']).default('email'),
  recipient_filter: z.enum(['all', 'checked_in', 'waitlisted']).default('all'),
});

export const individualNotifySchema = z.object({
  user_id: z.string().uuid(),
  subject: z.string().min(1).max(200),
  message: z.string().min(1).max(5000),
});

export type NotifyInput = z.infer<typeof notifySchema>;
export type IndividualNotifyInput = z.infer<typeof individualNotifySchema>;
