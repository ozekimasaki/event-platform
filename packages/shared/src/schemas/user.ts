import { z } from 'zod';

export const createProfileSchema = z.object({
  display_name: z.string().min(1).max(100),
  avatar_url: z.string().url().optional(),
  bio: z.string().max(1000).optional(),
  website: z.string().url().optional(),
  twitter_handle: z.string().max(50).optional(),
});

export const updateProfileSchema = z.object({
  display_name: z.string().min(1).max(100).optional(),
  avatar_url: z.string().url().optional(),
  bio: z.string().max(1000).optional(),
  website: z.string().url().optional(),
  twitter_handle: z.string().max(50).optional(),
});

export type CreateProfileInput = z.infer<typeof createProfileSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
