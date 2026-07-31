import type { SupabaseClient } from '@supabase/supabase-js';
import type { Registration } from '@event-platform/shared';

// ============================================
// CHECK IN BY QR TOKEN
// ============================================

export const checkInByToken = async (
  eventSlug: string,
  qrToken: string,
  staffUserId: string,
  supabase: SupabaseClient
): Promise<Registration> => {
  // 1. Get event by slug
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('id')
    .eq('slug', eventSlug)
    .single();

  if (eventError || !event) {
    throw new Error('Event not found');
  }

  // 2. Find registration by qr_code_token
  const { data: registration, error: regError } = await supabase
    .from('registrations')
    .select('*')
    .eq('qr_token', qrToken)
    .eq('event_id', event.id)
    .maybeSingle();

  if (regError || !registration) {
    throw new Error('Registration not found for this QR code');
  }

  // 3. Verify registration belongs to this event (already filtered by event_id above)
  // 4. Verify registration status is 'confirmed'
  if (registration.status === 'cancelled') {
    throw new Error('Registration has been cancelled');
  }
  if (registration.status === 'waitlisted') {
    throw new Error('Registration is waitlisted and not confirmed');
  }
  if (registration.status !== 'confirmed') {
    throw new Error('Registration is not in a check-in-able state');
  }

  // 5. Check if already checked in
  if (registration.checked_in_at) {
    throw new Error('Already checked in');
  }

  // 6. Update registration with check-in info
  const { data: updated, error: updateError } = await supabase
    .from('registrations')
    .update({
      checked_in_at: new Date().toISOString(),
      checked_in_by: staffUserId,
      status: 'checked_in',
      updated_at: new Date().toISOString(),
    })
    .eq('id', registration.id)
    .select()
    .single();

  if (updateError) {
    throw new Error(`Failed to check in: ${updateError.message}`);
  }

  return updated as Registration;
};

// ============================================
// CHECK IN MANUALLY
// ============================================

export const checkInManually = async (
  eventSlug: string,
  userId: string,
  staffUserId: string,
  supabase: SupabaseClient
): Promise<Registration> => {
  // 1. Get event by slug
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('id')
    .eq('slug', eventSlug)
    .single();

  if (eventError || !event) {
    throw new Error('Event not found');
  }

  // 2. Find registration by user_id and event_id
  const { data: registration, error: regError } = await supabase
    .from('registrations')
    .select('*')
    .eq('user_id', userId)
    .eq('event_id', event.id)
    .maybeSingle();

  if (regError || !registration) {
    throw new Error('Registration not found for this user and event');
  }

  // 3. Verify registration status
  if (registration.status === 'cancelled') {
    throw new Error('Registration has been cancelled');
  }
  if (registration.status === 'waitlisted') {
    throw new Error('Registration is waitlisted and not confirmed');
  }
  if (registration.status !== 'confirmed') {
    throw new Error('Registration is not in a check-in-able state');
  }

  // 4. Check if already checked in
  if (registration.checked_in_at) {
    throw new Error('Already checked in');
  }

  // 5. Update registration
  const { data: updated, error: updateError } = await supabase
    .from('registrations')
    .update({
      checked_in_at: new Date().toISOString(),
      checked_in_by: staffUserId,
      status: 'checked_in',
      updated_at: new Date().toISOString(),
    })
    .eq('id', registration.id)
    .select()
    .single();

  if (updateError) {
    throw new Error(`Failed to check in: ${updateError.message}`);
  }

  return updated as Registration;
};

// ============================================
// GET CHECK-IN STATUS
// ============================================

export interface CheckInStatus {
  total: number;
  checked_in: number;
  pending: number;
  attendees: {
    id: string;
    user_id: string;
    checked_in_at: string;
    checked_in_by: string;
  }[];
}

export const getCheckInStatus = async (
  eventSlug: string,
  supabase: SupabaseClient
): Promise<CheckInStatus> => {
  // 1. Get event
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('id')
    .eq('slug', eventSlug)
    .single();

  if (eventError || !event) {
    throw new Error('Event not found');
  }

  // 2. Get all confirmed/checked_in registrations
  const { data: allRegistrations, error: regError } = await supabase
    .from('registrations')
    .select('*')
    .eq('event_id', event.id)
    .in('status', ['confirmed', 'checked_in', 'pending']);

  if (regError) {
    throw new Error(`Failed to get registrations: ${regError.message}`);
  }

  const registrations = allRegistrations ?? [];
  const checkedIn = registrations.filter((r) => r.checked_in_at != null);
  const pending = registrations.filter((r) => !r.checked_in_at);

  return {
    total: registrations.length,
    checked_in: checkedIn.length,
    pending: pending.length,
    attendees: checkedIn.map((r) => ({
      id: r.id,
      user_id: r.user_id,
      checked_in_at: r.checked_in_at,
      checked_in_by: r.checked_in_by ?? '',
    })),
  };
};

// ============================================
// GET CHECK-IN LOG
// ============================================

export interface CheckInLogEntry {
  id: string;
  user_id: string;
  checked_in_at: string;
  checked_in_by: string;
  qr_token: string;
}

export const getCheckInLog = async (
  eventId: string,
  supabase: SupabaseClient
): Promise<CheckInLogEntry[]> => {
  const { data, error } = await supabase
    .from('registrations')
    .select('id, user_id, checked_in_at, checked_in_by, qr_token')
    .eq('event_id', eventId)
    .not('checked_in_at', 'is', null)
    .order('checked_in_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to get check-in log: ${error.message}`);
  }

  return (data ?? []) as CheckInLogEntry[];
};
