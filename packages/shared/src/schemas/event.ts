import { z } from 'zod';

export const eventStatusEnum = z.enum(['draft', 'published', 'cancelled', 'completed']);
export const pricingTypeEnum = z.enum(['free', 'paid', 'donation']);

export const createEventSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(10000),
  pricing_type: pricingTypeEnum,
  base_price: z.number().min(0).optional(),
  currency: z.string().length(3).default('USD'),
  capacity: z.number().int().positive().optional(),
  start_at: z.string().datetime(),
  end_at: z.string().datetime(),
  venue_name: z.string().max(200).optional(),
  venue_address: z.string().max(500).optional(),
  is_online: z.boolean().default(false),
  online_url: z.string().url().optional(),
  cover_image_url: z.string().url().optional(),
  tags: z.array(z.string().max(50)).max(10).default([]),
}).refine((data) => new Date(data.end_at) > new Date(data.start_at), {
  message: 'end_at must be after start_at',
  path: ['end_at'],
});

export const updateEventSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(10000).optional(),
  status: eventStatusEnum.optional(),
  pricing_type: pricingTypeEnum.optional(),
  base_price: z.number().min(0).optional(),
  currency: z.string().length(3).optional(),
  capacity: z.number().int().positive().optional(),
  start_at: z.string().datetime().optional(),
  end_at: z.string().datetime().optional(),
  venue_name: z.string().max(200).optional(),
  venue_address: z.string().max(500).optional(),
  is_online: z.boolean().optional(),
  online_url: z.string().url().optional(),
  cover_image_url: z.string().url().optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
});

export const eventQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: eventStatusEnum.optional(),
  search: z.string().max(200).optional(),
  tag: z.string().max(50).optional(),
});

export type EventQueryInput = z.infer<typeof eventQuerySchema>;
