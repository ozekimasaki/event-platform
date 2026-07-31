import type { SupabaseClient } from '@supabase/supabase-js';
import type { Registration, Event } from '@event-platform/shared';

// ============================================
// REGISTER FOR EVENT
// ============================================

export const registerForEvent = async (
  eventSlug: string,
  userId: string,
  data: { ticket_id?: string; custom_fields?: Record<string, unknown> },
  supabase: SupabaseClient
): Promise<{ registration: Registration; event: Event; is_waitlisted: boolean }> => {
  // 1. Get event by slug
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('*')
    .eq('slug', eventSlug)
    .single();

  if (eventError || !event) {
    throw new Error('Event not found');
  }

  if (event.status !== 'published') {
    throw new Error('Event is not accepting registrations');
  }

  // 2. Check capacity
  const { count: registrationCount } = await supabase
    .from('registrations')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', event.id)
    .in('status', ['confirmed', 'pending']);

  const currentCount = registrationCount ?? 0;
  const isFull = event.capacity != null && currentCount >= event.capacity;
  const status = isFull ? 'waitlisted' : 'confirmed';

  // 3. Generate QR token
  const qr_token = crypto.randomUUID();

  // 4. Create registration record
  const { data: registration, error: regError } = await supabase
    .from('registrations')
    .insert({
      event_id: event.id,
      user_id: userId,
      ticket_id: data.ticket_id ?? null,
      status,
      qr_token,
      custom_fields: data.custom_fields ?? null,
    })
    .select()
    .single();

  if (regError) {
    throw new Error(`Failed to create registration: ${regError.message}`);
  }

  return {
    registration: registration as Registration,
    event: event as Event,
    is_waitlisted: isFull,
  };
};

// ============================================
// CANCEL REGISTRATION
// ============================================

export const cancelRegistration = async (
  registrationId: string,
  userId: string,
  supabase: SupabaseClient
): Promise<void> => {
  // 1. Get registration
  const { data: registration, error } = await supabase
    .from('registrations')
    .select('*')
    .eq('id', registrationId)
    .single();

  if (error || !registration) {
    throw new Error('Registration not found');
  }

  // 2. Verify ownership
  if (registration.user_id !== userId) {
    throw new Error('Unauthorized: not the registration owner');
  }

  if (registration.status === 'cancelled') {
    throw new Error('Registration is already cancelled');
  }

  // 3. Set status to cancelled
  const { error: updateError } = await supabase
    .from('registrations')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', registrationId);

  if (updateError) {
    throw new Error(`Failed to cancel registration: ${updateError.message}`);
  }

  // 4. If confirmed user cancels, promote first waitlisted user
  if (registration.status === 'confirmed') {
    const { data: waitlisted } = await supabase
      .from('registrations')
      .select('*')
      .eq('event_id', registration.event_id)
      .eq('status', 'waitlisted')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (waitlisted) {
      await supabase
        .from('registrations')
        .update({ status: 'confirmed', updated_at: new Date().toISOString() })
        .eq('id', waitlisted.id);
    }
  }
};

// ============================================
// GET EVENT REGISTRATIONS
// ============================================

export const getEventRegistrations = async (
  eventId: string,
  supabase: SupabaseClient
): Promise<Registration[]> => {
  const { data, error } = await supabase
    .from('registrations')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to get registrations: ${error.message}`);
  }

  return (data ?? []) as Registration[];
};

// ============================================
// GET USER REGISTRATIONS
// ============================================

export const getUserRegistrations = async (
  userId: string,
  supabase: SupabaseClient
): Promise<(Registration & { event?: Event })[]> => {
  const { data, error } = await supabase
    .from('registrations')
    .select('*, event:events(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to get user registrations: ${error.message}`);
  }

  return (data ?? []) as (Registration & { event?: Event })[];
};

// ============================================
// GET REGISTRATION BY TOKEN
// ============================================

export const getRegistrationByToken = async (
  token: string,
  supabase: SupabaseClient
): Promise<Registration | null> => {
  const { data, error } = await supabase
    .from('registrations')
    .select('*')
    .eq('qr_token', token)
    .maybeSingle();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to get registration: ${error.message}`);
  }

  return data as Registration | null;
};
