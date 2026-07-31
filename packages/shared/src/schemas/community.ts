import { z } from 'zod';

export const updateProfileSchema = z.object({
  display_name: z.string().min(1).max(100).optional(),
  bio: z.string().max(1000).optional(),
  avatar_url: z.string().url().optional(),
});

export const createEventSeriesSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  organizer_id: z.string().uuid(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type CreateEventSeriesInput = z.infer<typeof createEventSeriesSchema>;
