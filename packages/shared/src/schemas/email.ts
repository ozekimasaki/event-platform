import { z } from 'zod';

export const sendEmailSchema = z.object({
  to: z.union([z.string().email(), z.array(z.string().email()).min(1)]),
  subject: z.string().min(1).max(200),
  template_id: z.string().optional(),
  template_data: z.record(z.string()).optional(),
  html: z.string().optional(),
  text: z.string().optional(),
  category: z.enum(['transactional', 'marketing', 'notification']).default('transactional'),
  event_id: z.string().uuid().optional(),
});

export const emailTemplateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  subject: z.string().min(1).max(200),
  html: z.string(),
  text: z.string(),
  variables: z.array(z.string()),
  category: z.enum(['transactional', 'marketing', 'notification']),
});

export const unsubscribeSchema = z.object({
  email: z.string().email(),
  event_id: z.string().uuid().optional(),
});

export type SendEmailInput = z.infer<typeof sendEmailSchema>;
export type EmailTemplateInput = z.infer<typeof emailTemplateSchema>;
export type UnsubscribeInput = z.infer<typeof unsubscribeSchema>;
