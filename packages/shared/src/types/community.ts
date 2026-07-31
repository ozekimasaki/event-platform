// Organizer Profile
export interface OrganizerProfile {
  id: string;
  slug: string;
  display_name: string;
  bio?: string;
  avatar_url?: string;
  followers_count: number;
  events_count: number;
  created_at: string;
  updated_at: string;
}

// Follower
export interface Follower {
  id: string;
  organizer_id: string;
  user_id: string;
  created_at: string;
}

// Follower with user info
export interface FollowerWithUser extends Follower {
  user: {
    id: string;
    email: string;
    display_name?: string;
    avatar_url?: string;
  };
}

// Event Series
export interface EventSeries {
  id: string;
  name: string;
  description?: string;
  organizer_id: string;
  created_at: string;
  updated_at: string;
}

// Event Series with events
export interface EventSeriesWithEvents extends EventSeries {
  events: {
    id: string;
    title: string;
    slug: string;
    start_at: string;
    end_at: string;
    status: string;
    venue_name?: string;
    cover_image_url?: string;
  }[];
}

// Follow/Unfollow response
export interface FollowResponse {
  following: boolean;
  followers_count: number;
}
