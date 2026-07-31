import { z } from 'zod';

export const createSessionSchema = z.object({
  event_id: z.string().uuid(),
  title: z.string().min(1).max(300),
  description: z.string().max(5000).optional(),
  speaker_id: z.string().uuid().nullable().optional(),
  track: z.string().max(100).optional(),
  start_at: z.string().datetime(),
  end_at: z.string().datetime(),
  order_index: z.number().int().min(0).default(0),
}).refine((data) => new Date(data.end_at) > new Date(data.start_at), {
  message: 'end_at must be after start_at',
  path: ['end_at'],
});

export const updateSessionSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(5000).optional().nullable(),
  speaker_id: z.string().uuid().nullable().optional(),
  track: z.string().max(100).optional().nullable(),
  start_at: z.string().datetime().optional(),
  end_at: z.string().datetime().optional(),
  order_index: z.number().int().min(0).optional(),
});

export const reorderSessionsSchema = z.object({
  session_ids: z.array(z.string().uuid()),
});

export const createCfpSchema = z.object({
  event_id: z.string().uuid(),
  title: z.string().min(1).max(300),
  abstract: z.string().min(10).max(5000),
  speaker_name: z.string().min(1).max(200),
  speaker_email: z.string().email().max(300),
  duration_minutes: z.number().int().min(5).max(180),
});

export const reviewCfpSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  notes: z.string().max(2000).optional(),
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type UpdateSessionInput = z.infer<typeof updateSessionSchema>;
export type ReorderSessionsInput = z.infer<typeof reorderSessionsSchema>;
export type CreateCfpInput = z.infer<typeof createCfpSchema>;
export type ReviewCfpInput = z.infer<typeof reviewCfpSchema>;
