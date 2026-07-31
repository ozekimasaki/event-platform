import { z } from 'zod';

export const ticketStatusEnum = z.enum(['open', 'in_progress', 'resolved', 'closed']);

export const createTicketSchema = z.object({
  subject: z.string().min(1, '件名は必須です').max(200),
  message: z.string().min(1, 'メッセージは必須です').max(5000),
});

export const replySchema = z.object({
  message: z.string().min(1, 'メッセージは必須です').max(5000),
});

export const faqSchema = z.object({
  question: z.string().min(1, '質問は必須です').max(500),
  answer: z.string().min(1, '回答は必須です').max(5000),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type ReplyInput = z.infer<typeof replySchema>;
export type FAQInput = z.infer<typeof faqSchema>;
