// User
export interface User {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
}

// Profile
export interface Profile {
  id: string;
  user_id: string;
  display_name: string;
  avatar_url?: string;
  bio?: string;
  website?: string;
  twitter_handle?: string;
  created_at: string;
  updated_at: string;
}

// Organizer
export interface Organizer {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  description?: string;
  logo_url?: string;
  website?: string;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

// Create Profile Input
export interface CreateProfileInput {
  display_name: string;
  avatar_url?: string;
  bio?: string;
  website?: string;
  twitter_handle?: string;
}

// Update Profile Input
export interface UpdateProfileInput {
  display_name?: string;
  avatar_url?: string;
  bio?: string;
  website?: string;
  twitter_handle?: string;
}

// ============================================
// AUTH TYPES
// ============================================

// OAuth providers supported by the platform
export type OAuthProvider = 'google' | 'github';

// Auth tokens returned after login/signup
export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at: number;
  token_type: 'bearer';
}

// Login request body
export interface LoginRequest {
  email: string;
  password: string;
}

// Signup request body
export interface SignupRequest {
  email: string;
  password: string;
  display_name?: string;
}

// OAuth callback request body
export interface OAuthCallbackRequest {
  code: string;
  provider: OAuthProvider;
}

// Current user response (me endpoint)
export interface CurrentUser {
  id: string;
  email: string;
  display_name: string;
  avatar_url?: string;
  created_at: string;
}

// Decoded JWT payload from Supabase
export interface SupabaseJWTPayload {
  sub: string;
  email?: string;
  role?: string;
  exp?: number;
  iat?: number;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}
