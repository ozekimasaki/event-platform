import type { SupabaseClient } from '@supabase/supabase-js';
import type { Session, TimetableEntry, TimetableByTrack } from '@event-platform/shared';

// ============================================
// CREATE SESSION
// ============================================

export interface CreateSessionData {
  event_id: string;
  title: string;
  description?: string;
  speaker_id?: string | null;
  track?: string;
  start_at: string;
  end_at: string;
  order_index?: number;
}

export const createSession = async (
  data: CreateSessionData,
  supabase: SupabaseClient
): Promise<Session> => {
  const insertData = {
    event_id: data.event_id,
    title: data.title,
    description: data.description ?? null,
    speaker_id: data.speaker_id ?? null,
    track: data.track ?? null,
    start_at: data.start_at,
    end_at: data.end_at,
    order_index: data.order_index ?? 0,
  };

  const { data: session, error } = await supabase
    .from('sessions')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create session: ${error.message}`);
  }

  return session as Session;
};

// ============================================
// UPDATE SESSION
// ============================================

export interface UpdateSessionData {
  title?: string;
  description?: string | null;
  speaker_id?: string | null;
  track?: string | null;
  start_at?: string;
  end_at?: string;
  order_index?: number;
}

export const updateSession = async (
  id: string,
  data: UpdateSessionData,
  supabase: SupabaseClient
): Promise<Session> => {
  const { data: session, error } = await supabase
    .from('sessions')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update session: ${error.message}`);
  }

  if (!session) {
    throw new Error('Session not found');
  }

  return session as Session;
};

// ============================================
// DELETE SESSION
// ============================================

export const deleteSession = async (
  id: string,
  supabase: SupabaseClient
): Promise<void> => {
  const { error } = await supabase
    .from('sessions')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to delete session: ${error.message}`);
  }
};

// ============================================
// GET SESSIONS BY EVENT ID
// ============================================

export const getSessions = async (
  eventId: string,
  supabase: SupabaseClient
): Promise<Session[]> => {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('event_id', eventId)
    .order('order_index', { ascending: true })
    .order('start_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to get sessions: ${error.message}`);
  }

  return (data ?? []) as Session[];
};

// ============================================
// GET SESSION BY ID
// ============================================

export const getSessionById = async (
  id: string,
  supabase: SupabaseClient
): Promise<Session | null> => {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to get session: ${error.message}`);
  }

  return data as Session;
};

// ============================================
// GET TIMETABLE (grouped by track)
// ============================================

export const getTimetable = async (
  eventId: string,
  supabase: SupabaseClient
): Promise<TimetableByTrack[]> => {
  const sessions = await getSessions(eventId, supabase);

  const entries: TimetableEntry[] = sessions.map((s) => {
    const durationMs = new Date(s.end_at).getTime() - new Date(s.start_at).getTime();
    return {
      ...s,
      duration_minutes: Math.round(durationMs / 60000),
    };
  });

  // Group by track
  const trackMap = new Map<string, TimetableEntry[]>();
  for (const entry of entries) {
    const track = entry.track ?? 'Main';
    if (!trackMap.has(track)) trackMap.set(track, []);
    trackMap.get(track)!.push(entry);
  }

  return Array.from(trackMap.entries()).map(([track, sessions]) => ({
    track,
    sessions,
  }));
};

// ============================================
// REORDER SESSIONS
// ============================================

export const reorderSessions = async (
  sessionIds: string[],
  supabase: SupabaseClient
): Promise<void> => {
  for (let i = 0; i < sessionIds.length; i++) {
    const { error } = await supabase
      .from('sessions')
      .update({ order_index: i, updated_at: new Date().toISOString() })
      .eq('id', sessionIds[i]);

    if (error) {
      throw new Error(`Failed to reorder sessions: ${error.message}`);
    }
  }
};
