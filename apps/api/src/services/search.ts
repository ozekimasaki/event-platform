import type { SupabaseClient } from '@supabase/supabase-js';
import type { Event } from '@event-platform/shared';

// ============================================
// SEARCH EVENTS
// ============================================

export interface SearchEventsFilters {
  q?: string;
  category?: string;
  date_from?: string;
  date_to?: string;
  region?: string;
  page?: number;
  limit?: number;
}

export interface SearchEventsResult {
  events: Event[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

/**
 * Full-text search on events (title / description LIKE),
 * with category, date range, and region filters.
 */
export const searchEvents = async (
  filters: SearchEventsFilters,
  supabase: SupabaseClient
): Promise<SearchEventsResult> => {
  const { q, category, date_from, date_to, region } = filters;
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 20;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let qb = supabase
    .from('events')
    .select('*', { count: 'exact' })
    .eq('status', 'published');

  // Full-text search (title / description LIKE)
  if (q && q.trim()) {
    const keyword = q.trim();
    qb = qb.or(`title.ilike.%${keyword}%,description.ilike.%${keyword}%`);
  }

  // Category filter
  if (category) {
    qb = qb.eq('category', category);
  }

  // Date range filter (events that overlap with the given range)
  if (date_from) {
    qb = qb.gte('start_at', date_from);
  }
  if (date_to) {
    qb = qb.lte('start_at', date_to);
  }

  // Region filter
  if (region) {
    qb = qb.eq('region', region);
  }

  // Sort by start_at descending (upcoming events first)
  qb = qb.order('start_at', { ascending: true });

  const { data, error, count } = await qb.range(from, to);

  if (error) {
    throw new Error(`Failed to search events: ${error.message}`);
  }

  const total = count ?? 0;
  const total_pages = Math.ceil(total / limit);

  return {
    events: (data ?? []) as Event[],
    total,
    page,
    limit,
    total_pages,
  };
};

// ============================================
// TRENDING EVENTS
// ============================================

export interface TrendingEvent extends Event {
  registration_count: number;
}

/**
 * Get trending events — published events ordered by registration count
 * in the last 7 days, returning the top 8.
 */
export const getTrendingEvents = async (
  supabase: SupabaseClient,
  resultLimit: number = 8
): Promise<TrendingEvent[]> => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const since = sevenDaysAgo.toISOString();

  // Get published events
  const { data: events, error: eventsError } = await supabase
    .from('events')
    .select('id')
    .eq('status', 'published');

  if (eventsError) {
    throw new Error(`Failed to get trending events: ${eventsError.message}`);
  }

  if (!events || events.length === 0) {
    return [];
  }

  const eventIds = events.map((e) => e.id);

  // Count registrations per event in the last 7 days
  const { data: registrations, error: regError } = await supabase
    .from('registrations')
    .select('event_id')
    .in('event_id', eventIds)
    .gte('created_at', since);

  if (regError) {
    throw new Error(`Failed to get trending events: ${regError.message}`);
  }

  // Aggregate registration counts
  const regCountMap = new Map<string, number>();
  for (const reg of registrations ?? []) {
    regCountMap.set(reg.event_id, (regCountMap.get(reg.event_id) ?? 0) + 1);
  }

  // Sort event IDs by registration count descending, take top N
  const sortedEventIds = eventIds
    .map((id) => ({ id, count: regCountMap.get(id) ?? 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, resultLimit)
    .map((e) => e.id);

  if (sortedEventIds.length === 0) {
    return [];
  }

  // Fetch full event data
  const { data: fullEvents, error: fullError } = await supabase
    .from('events')
    .select('*')
    .in('id', sortedEventIds);

  if (fullError) {
    throw new Error(`Failed to get trending events: ${fullError.message}`);
  }

  // Map back with registration counts, preserving sort order
  const eventMap = new Map((fullEvents ?? []).map((e) => [e.id, e]));
  return sortedEventIds
    .map((id) => {
      const event = eventMap.get(id);
      if (!event) return null;
      return {
        ...event,
        registration_count: regCountMap.get(id) ?? 0,
      } as TrendingEvent;
    })
    .filter((e): e is TrendingEvent => e !== null);
};

// ============================================
// GET CATEGORIES
// ============================================

export interface CategoryInfo {
  name: string;
  count: number;
}

/**
 * Get all distinct categories with their published event counts.
 */
export const getCategories = async (
  supabase: SupabaseClient
): Promise<CategoryInfo[]> => {
  const { data, error } = await supabase
    .from('events')
    .select('category')
    .eq('status', 'published')
    .not('category', 'is', null);

  if (error) {
    throw new Error(`Failed to get categories: ${error.message}`);
  }

  // Aggregate counts
  const countMap = new Map<string, number>();
  for (const row of data ?? []) {
    const cat = (row as any).category as string;
    if (cat) {
      countMap.set(cat, (countMap.get(cat) ?? 0) + 1);
    }
  }

  return Array.from(countMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
};
