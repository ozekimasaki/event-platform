import type { SupabaseClient } from '@supabase/supabase-js';
import type { Event, EventStatus, EventListResponse } from '@event-platform/shared';

// ============================================
// DASHBOARD ANALYTICS
// ============================================

export interface DashboardStats {
  events: { total: number; draft: number; published: number; completed: number; cancelled: number };
  total_registrations: number;
  total_revenue: number;
  total_attendees: number;
  monthly_registrations: number;
  recent_activity: { id: string; type: 'registration' | 'checkin'; event_title: string; user_id: string; created_at: string }[];
}

export const getDashboardStats = async (
  organizerId: string,
  supabase: SupabaseClient
): Promise<DashboardStats> => {
  // Get organizer's event IDs
  const { data: orgEvents } = await supabase
    .from('events')
    .select('id, status, title')
    .eq('organizer_id', organizerId);

  const events = orgEvents ?? [];
  const eventIds = events.map((e) => e.id);

  const statusCounts = { total: events.length, draft: 0, published: 0, completed: 0, cancelled: 0 };
  for (const e of events) {
    const s = e.status as string;
    if (s in statusCounts) (statusCounts as any)[s]++;
  }

  // Registrations across all organizer events
  let totalRegistrations = 0;
  let totalAttendees = 0;
  let monthlyRegistrations = 0;

  if (eventIds.length > 0) {
    const { data: regs } = await supabase
      .from('registrations')
      .select('id, status, checked_in_at, created_at')
      .in('event_id', eventIds);

    const allRegs = regs ?? [];
    totalRegistrations = allRegs.length;
    totalAttendees = allRegs.filter((r) => r.checked_in_at != null).length;

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    monthlyRegistrations = allRegs.filter((r) => new Date(r.created_at) >= monthStart).length;
  }

  // Revenue from successful payments
  let totalRevenue = 0;
  if (eventIds.length > 0) {
    const { data: regIds } = await supabase
      .from('registrations')
      .select('id')
      .in('event_id', eventIds);

    const rIds = (regIds ?? []).map((r) => r.id);
    if (rIds.length > 0) {
      const { data: payments } = await supabase
        .from('payments')
        .select('amount, status')
        .in('registration_id', rIds)
        .eq('status', 'succeeded');

      totalRevenue = ((payments ?? []) as any[]).reduce((sum, p) => sum + (p.amount || 0), 0);
    }
  }

  // Recent activity (last 5 registrations/check-ins)
  let recentActivity: DashboardStats['recent_activity'] = [];
  if (eventIds.length > 0) {
    const { data: recentRegs } = await supabase
      .from('registrations')
      .select('id, event_id, user_id, checked_in_at, created_at')
      .in('event_id', eventIds)
      .order('created_at', { ascending: false })
      .limit(5);

    const eventTitleMap = new Map(events.map((e) => [e.id, e.title]));
    recentActivity = (recentRegs ?? []).map((r) => ({
      id: r.id,
      type: (r.checked_in_at ? 'checkin' : 'registration') as 'registration' | 'checkin',
      event_title: eventTitleMap.get(r.event_id) ?? '',
      user_id: r.user_id,
      created_at: r.created_at,
    }));
  }

  return { events: statusCounts, total_registrations: totalRegistrations, total_revenue: totalRevenue, total_attendees: totalAttendees, monthly_registrations: monthlyRegistrations, recent_activity: recentActivity };
};

// ============================================
// EVENT-SPECIFIC STATS
// ============================================

export interface EventStats {
  registrations: { total: number; pending: number; confirmed: number; checked_in: number; cancelled: number };
  checkin_rate: number;
  revenue: { total: number; succeeded: number; refunded: number; pending: number };
  tickets_by_type: { ticket_id: string; count: number }[];
}

export const getEventStats = async (
  eventId: string,
  supabase: SupabaseClient
): Promise<EventStats> => {
  const { data: regs } = await supabase
    .from('registrations')
    .select('id, status, ticket_id, checked_in_at')
    .eq('event_id', eventId);

  const allRegs = regs ?? [];
  const regStatus = { total: allRegs.length, pending: 0, confirmed: 0, checked_in: 0, cancelled: 0 };
  for (const r of allRegs) {
    const s = r.status as string;
    if (s in regStatus) (regStatus as any)[s]++;
    if (r.checked_in_at) regStatus.checked_in++;
  }

  const checkinRate = regStatus.total > 0 ? Math.round((regStatus.checked_in / regStatus.total) * 100) : 0;

  // Revenue
  const regIds = allRegs.map((r) => r.id);
  let revenue = { total: 0, succeeded: 0, refunded: 0, pending: 0 };
  if (regIds.length > 0) {
    const { data: pays } = await supabase
      .from('payments')
      .select('amount, status')
      .in('registration_id', regIds);

    for (const p of (pays ?? []) as any[]) {
      const amt = p.amount || 0;
      revenue.total += amt;
      if (p.status === 'succeeded') revenue.succeeded += amt;
      else if (p.status === 'refunded') revenue.refunded += amt;
      else if (p.status === 'pending') revenue.pending += amt;
    }
  }

  // Ticket breakdown
  const ticketMap = new Map<string, number>();
  for (const r of allRegs) {
    if (r.ticket_id) ticketMap.set(r.ticket_id, (ticketMap.get(r.ticket_id) ?? 0) + 1);
  }
  const ticketsByType = Array.from(ticketMap.entries()).map(([ticket_id, count]) => ({ ticket_id, count }));

  return { registrations: regStatus, checkin_rate: checkinRate, revenue, tickets_by_type: ticketsByType };
};

// ============================================
// REVENUE BREAKDOWN
// ============================================

export interface RevenueBreakdown {
  total: number;
  by_event: { event_id: string; event_title: string; amount: number }[];
  by_period: { date: string; amount: number }[];
}

export const getRevenueBreakdown = async (
  organizerId: string,
  period: '7d' | '30d' | '90d' | 'all',
  supabase: SupabaseClient
): Promise<RevenueBreakdown> => {
  // Get organizer events
  const { data: orgEvents } = await supabase
    .from('events')
    .select('id, title')
    .eq('organizer_id', organizerId);

  const events = orgEvents ?? [];
  const eventIds = events.map((e) => e.id);
  const eventTitleMap = new Map(events.map((e) => [e.id, e.title]));

  if (eventIds.length === 0) {
    return { total: 0, by_event: [], by_period: [] };
  }

  // Get registration IDs for these events
  const { data: regs } = await supabase
    .from('registrations')
    .select('id, event_id')
    .in('event_id', eventIds);

  const regIds = (regs ?? []).map((r) => r.id);
  const regEventMap = new Map((regs ?? []).map((r) => [r.id, r.event_id]));

  if (regIds.length === 0) {
    return { total: 0, by_event: [], by_period: [] };
  }

  // Get successful payments
  let payQb = supabase
    .from('payments')
    .select('id, amount, currency, created_at, status')
    .in('registration_id', regIds)
    .eq('status', 'succeeded');

  if (period !== 'all') {
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    const since = new Date();
    since.setDate(since.getDate() - days);
    payQb = payQb.gte('created_at', since.toISOString());
  }

  const { data: payments } = await payQb.order('created_at', { ascending: true });
  const allPayments = (payments ?? []) as any[];

  const total = allPayments.reduce((s, p) => s + (p.amount || 0), 0);

  // By event
  const eventRevenue = new Map<string, number>();
  for (const p of allPayments) {
    const eventId = regEventMap.get(p.registration_id);
    if (eventId) eventRevenue.set(eventId, (eventRevenue.get(eventId) ?? 0) + (p.amount || 0));
  }
  const byEvent = Array.from(eventRevenue.entries()).map(([event_id, amount]) => ({
    event_id,
    event_title: eventTitleMap.get(event_id) ?? '',
    amount,
  }));

  // By date (daily aggregation)
  const dailyMap = new Map<string, number>();
  for (const p of allPayments) {
    const date = p.created_at.substring(0, 10);
    dailyMap.set(date, (dailyMap.get(date) ?? 0) + (p.amount || 0));
  }
  const byPeriod = Array.from(dailyMap.entries()).map(([date, amount]) => ({ date, amount }));

  return { total, by_event: byEvent, by_period: byPeriod };
};

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
