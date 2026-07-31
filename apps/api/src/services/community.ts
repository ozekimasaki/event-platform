import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  OrganizerProfile,
  FollowerWithUser,
  EventSeries,
  EventSeriesWithEvents,
  UpdateProfileInput,
  CreateEventSeriesInput,
} from '@event-platform/shared';

// ============================================
// ORGANIZER PROFILE
// ============================================

export const getOrganizerProfile = async (
  slug: string,
  supabase: SupabaseClient
): Promise<OrganizerProfile | null> => {
  const { data, error } = await supabase
    .from('organizer_profiles')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to get organizer profile: ${error.message}`);
  }

  return data as OrganizerProfile;
};

export const getOrganizerProfileById = async (
  id: string,
  supabase: SupabaseClient
): Promise<OrganizerProfile | null> => {
  const { data, error } = await supabase
    .from('organizer_profiles')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to get organizer profile: ${error.message}`);
  }

  return data as OrganizerProfile;
};

export const updateOrganizerProfile = async (
  organizerId: string,
  data: UpdateProfileInput,
  supabase: SupabaseClient
): Promise<OrganizerProfile> => {
  const { data: profile, error } = await supabase
    .from('organizer_profiles')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', organizerId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update organizer profile: ${error.message}`);
  }

  return profile as OrganizerProfile;
};

// ============================================
// FOLLOWERS
// ============================================

export const followOrganizer = async (
  organizerId: string,
  userId: string,
  supabase: SupabaseClient
): Promise<{ following: boolean; followers_count: number }> => {
  // Check if already following
  const { data: existing } = await supabase
    .from('followers')
    .select('id')
    .eq('organizer_id', organizerId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!existing) {
    const { error } = await supabase
      .from('followers')
      .insert({ organizer_id: organizerId, user_id: userId });

    if (error) {
      throw new Error(`Failed to follow organizer: ${error.message}`);
    }
  }

  // Get updated count
  const { count } = await supabase
    .from('followers')
    .select('*', { count: 'exact', head: true })
    .eq('organizer_id', organizerId);

  return { following: true, followers_count: count ?? 0 };
};

export const unfollowOrganizer = async (
  organizerId: string,
  userId: string,
  supabase: SupabaseClient
): Promise<{ following: boolean; followers_count: number }> => {
  const { error } = await supabase
    .from('followers')
    .delete()
    .eq('organizer_id', organizerId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to unfollow organizer: ${error.message}`);
  }

  // Get updated count
  const { count } = await supabase
    .from('followers')
    .select('*', { count: 'exact', head: true })
    .eq('organizer_id', organizerId);

  return { following: false, followers_count: count ?? 0 };
};

export const getFollowers = async (
  organizerId: string,
  supabase: SupabaseClient
): Promise<FollowerWithUser[]> => {
  const { data, error } = await supabase
    .from('followers')
    .select('*, user:user_id(id, email, display_name, avatar_url)')
    .eq('organizer_id', organizerId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to get followers: ${error.message}`);
  }

  return (data ?? []) as FollowerWithUser[];
};

export const isFollowing = async (
  organizerId: string,
  userId: string,
  supabase: SupabaseClient
): Promise<boolean> => {
  const { data } = await supabase
    .from('followers')
    .select('id')
    .eq('organizer_id', organizerId)
    .eq('user_id', userId)
    .maybeSingle();

  return !!data;
};

// ============================================
// EVENT SERIES
// ============================================

export const createEventSeries = async (
  data: CreateEventSeriesInput,
  supabase: SupabaseClient
): Promise<EventSeries> => {
  const { data: series, error } = await supabase
    .from('event_series')
    .insert({
      name: data.name,
      description: data.description ?? null,
      organizer_id: data.organizer_id,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create event series: ${error.message}`);
  }

  return series as EventSeries;
};

export const getEventSeries = async (
  organizerId: string,
  supabase: SupabaseClient
): Promise<EventSeries[]> => {
  const { data, error } = await supabase
    .from('event_series')
    .select('*')
    .eq('organizer_id', organizerId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to get event series: ${error.message}`);
  }

  return (data ?? []) as EventSeries[];
};

export const getEventSeriesWithEvents = async (
  seriesId: string,
  supabase: SupabaseClient
): Promise<EventSeriesWithEvents | null> => {
  const { data: series, error } = await supabase
    .from('event_series')
    .select('*')
    .eq('id', seriesId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to get event series: ${error.message}`);
  }

  // Get events in this series
  const { data: events, error: eventsError } = await supabase
    .from('events')
    .select('id, title, slug, start_at, end_at, status, venue_name, cover_image_url')
    .eq('series_id', seriesId)
    .order('start_at', { ascending: false });

  if (eventsError) {
    throw new Error(`Failed to get series events: ${eventsError.message}`);
  }

  return {
    ...(series as EventSeries),
    events: events ?? [],
  } as EventSeriesWithEvents;
};
