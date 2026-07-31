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

// ============================================
// AUTH SCHEMAS
// ============================================

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  display_name: z.string().min(1).max(100).optional(),
});

export const oauthCallbackSchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type OAuthCallbackInput = z.infer<typeof oauthCallbackSchema>;
