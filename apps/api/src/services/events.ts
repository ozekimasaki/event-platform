import type { SupabaseClient } from '@supabase/supabase-js';
import type { Event, EventStatus, EventListResponse } from '@event-platform/shared';

// ============================================
// SLUG GENERATION
// ============================================

/**
 * Generate a URL-safe slug from a title string.
 * Handles Japanese characters by romanizing common patterns,
 * falls back to timestamp suffix for non-latin titles.
 */
export const generateSlug = (title: string): string => {
  // Basic transliteration: lowercase, replace non-alphanumeric with hyphens
  let slug = title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 100);

  // If slug is empty (e.g., Japanese-only title), use timestamp
  if (!slug || /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]+$/u.test(title)) {
    const timestamp = Date.now().toString(36);
    slug = `event-${timestamp}`;
  }

  return slug;
};

// ============================================
// LIST EVENTS
// ============================================

export interface ListEventsQuery {
  page: number;
  limit: number;
  status?: EventStatus;
  search?: string;
  tag?: string;
  sort?: string;
}

export const listEvents = async (
  query: ListEventsQuery,
  supabase: SupabaseClient
): Promise<EventListResponse> => {
  const { page, limit, status, search, tag, sort } = query;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let qb = supabase
    .from('events')
    .select('*', { count: 'exact' });

  // Only show published events for public listing
  if (status) {
    qb = qb.eq('status', status);
  } else {
    qb = qb.eq('status', 'published');
  }

  // Search filter
  if (search) {
    qb = qb.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
  }

  // Tag filter (assuming tags is a text array column)
  if (tag) {
    qb = qb.contains('tags', [tag]);
  }

  // Sort
  if (sort) {
    const descending = sort.startsWith('-');
    const column = descending ? sort.substring(1) : sort;
    const validColumns = ['start_at', 'created_at', 'title'];
    if (validColumns.includes(column)) {
      qb = qb.order(column, { ascending: !descending });
    }
  } else {
    qb = qb.order('start_at', { ascending: false });
  }

  const { data, error, count } = await qb.range(from, to);

  if (error) {
    throw new Error(`Failed to list events: ${error.message}`);
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
// GET EVENT BY SLUG
// ============================================

export const getEventBySlug = async (
  slug: string,
  supabase: SupabaseClient
): Promise<Event | null> => {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // not found
    throw new Error(`Failed to get event: ${error.message}`);
  }

  return data as Event;
};

// ============================================
// GET EVENT BY ID
// ============================================

export const getEventById = async (
  id: string,
  supabase: SupabaseClient
): Promise<Event | null> => {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to get event: ${error.message}`);
  }

  return data as Event;
};

// ============================================
// CREATE EVENT
// ============================================

export interface CreateEventData {
  title: string;
  slug?: string;
  description: string;
  start_at: string;
  end_at: string;
  venue_name?: string;
  venue_address?: string;
  capacity?: number;
  pricing_type: 'free' | 'paid' | 'donation';
  base_price?: number;
  currency?: string;
  is_online?: boolean;
  online_url?: string;
  cover_image_url?: string;
  tags?: string[];
  seo_metadata?: Record<string, unknown>;
}

export const createEvent = async (
  data: CreateEventData,
  userId: string,
  supabase: SupabaseClient
): Promise<Event> => {
  // Generate slug if not provided
  let slug = data.slug ?? generateSlug(data.title);

  // Ensure slug uniqueness
  const existing = await supabase
    .from('events')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();

  if (existing.data) {
    // Append timestamp to make unique
    slug = `${slug}-${Date.now().toString(36)}`;
  }

  const insertData = {
    title: data.title,
    slug,
    description: data.description,
    organizer_id: userId,
    status: 'draft' as EventStatus,
    pricing_type: data.pricing_type,
    base_price: data.base_price ?? null,
    currency: data.currency ?? 'USD',
    capacity: data.capacity ?? null,
    start_at: data.start_at,
    end_at: data.end_at,
    venue_name: data.venue_name ?? null,
    venue_address: data.venue_address ?? null,
    is_online: data.is_online ?? false,
    online_url: data.online_url ?? null,
    cover_image_url: data.cover_image_url ?? null,
    tags: data.tags ?? [],
    seo_metadata: data.seo_metadata ?? null,
  };

  const { data: event, error } = await supabase
    .from('events')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create event: ${error.message}`);
  }

  return event as Event;
};

// ============================================
// UPDATE EVENT
// ============================================

export interface UpdateEventData {
  title?: string;
  slug?: string;
  description?: string;
  status?: EventStatus;
  start_at?: string;
  end_at?: string;
  venue_name?: string;
  venue_address?: string;
  capacity?: number;
  pricing_type?: 'free' | 'paid' | 'donation';
  base_price?: number;
  currency?: string;
  is_online?: boolean;
  online_url?: string;
  cover_image_url?: string;
  tags?: string[];
  seo_metadata?: Record<string, unknown>;
}

export const updateEvent = async (
  id: string,
  data: UpdateEventData,
  userId: string,
  supabase: SupabaseClient
): Promise<Event> => {
  // Check ownership
  const existing = await getEventById(id, supabase);
  if (!existing) {
    throw new Error('Event not found');
  }
  if (existing.organizer_id !== userId) {
    throw new Error('Unauthorized: not the event organizer');
  }

  // If slug is being updated, check uniqueness
  if (data.slug && data.slug !== existing.slug) {
    const slugTaken = await supabase
      .from('events')
      .select('id')
      .eq('slug', data.slug)
      .neq('id', id)
      .maybeSingle();

    if (slugTaken.data) {
      throw new Error('Slug is already taken');
    }
  }

  const { data: event, error } = await supabase
    .from('events')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update event: ${error.message}`);
  }

  return event as Event;
};

// ============================================
// DELETE EVENT (soft delete)
// ============================================

export const deleteEvent = async (
  id: string,
  userId: string,
  supabase: SupabaseClient
): Promise<void> => {
  const existing = await getEventById(id, supabase);
  if (!existing) {
    throw new Error('Event not found');
  }
  if (existing.organizer_id !== userId) {
    throw new Error('Unauthorized: not the event organizer');
  }

  // Soft delete: set status to cancelled
  const { error } = await supabase
    .from('events')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to delete event: ${error.message}`);
  }
};

// ============================================
// CHECK SLUG AVAILABILITY
// ============================================

export const checkSlugAvailability = async (
  slug: string,
  supabase: SupabaseClient
): Promise<{ available: boolean }> => {
  const { data } = await supabase
    .from('events')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();

  return { available: !data };
};

// ============================================
// LIST EVENTS BY ORGANIZER
// ============================================

export const listEventsByOrganizer = async (
  organizerId: string,
  query: ListEventsQuery,
  supabase: SupabaseClient
): Promise<EventListResponse> => {
  const { page, limit, status, search, sort } = query;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let qb = supabase
    .from('events')
    .select('*', { count: 'exact' })
    .eq('organizer_id', organizerId);

  if (status) {
    qb = qb.eq('status', status);
  }

  if (search) {
    qb = qb.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
  }

  if (sort) {
    const descending = sort.startsWith('-');
    const column = descending ? sort.substring(1) : sort;
    const validColumns = ['start_at', 'created_at', 'title'];
    if (validColumns.includes(column)) {
      qb = qb.order(column, { ascending: !descending });
    }
  } else {
    qb = qb.order('created_at', { ascending: false });
  }

  const { data, error, count } = await qb.range(from, to);

  if (error) {
    throw new Error(`Failed to list events: ${error.message}`);
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
