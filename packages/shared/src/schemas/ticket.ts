import { z } from 'zod';

export const ticketSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  price: z.number().min(0),
  quantity: z.number().int().positive(),
  sale_start_at: z.string().datetime().optional(),
  sale_end_at: z.string().datetime().optional(),
});

export const ticketUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  price: z.number().min(0).optional(),
  quantity: z.number().int().positive().optional(),
  sale_start_at: z.string().datetime().optional(),
  sale_end_at: z.string().datetime().optional(),
  is_active: z.boolean().optional(),
});

export type TicketInput = z.infer<typeof ticketSchema>;
export type TicketUpdateInput = z.infer<typeof ticketUpdateSchema>;
