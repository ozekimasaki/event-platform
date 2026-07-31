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
