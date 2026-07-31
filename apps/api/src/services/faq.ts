import type { SupabaseClient } from '@supabase/supabase-js';
import type { FAQ } from '@event-platform/shared';

// ============================================
// CREATE FAQ
// ============================================

export const createFAQ = async (
  eventId: string | null,
  question: string,
  answer: string,
  supabase: SupabaseClient
): Promise<FAQ> => {
  const { data, error } = await supabase
    .from('faqs')
    .insert({
      event_id: eventId,
      question,
      answer,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create FAQ: ${error.message}`);
  }

  return data as FAQ;
};

// ============================================
// UPDATE FAQ
// ============================================

export const updateFAQ = async (
  id: string,
  question: string | undefined,
  answer: string | undefined,
  supabase: SupabaseClient
): Promise<FAQ> => {
  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (question !== undefined) updateData.question = question;
  if (answer !== undefined) updateData.answer = answer;

  const { data, error } = await supabase
    .from('faqs')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update FAQ: ${error.message}`);
  }

  return data as FAQ;
};

// ============================================
// DELETE FAQ
// ============================================

export const deleteFAQ = async (
  id: string,
  supabase: SupabaseClient
): Promise<void> => {
  const { error } = await supabase
    .from('faqs')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to delete FAQ: ${error.message}`);
  }
};

// ============================================
// GET FAQ BY ID
// ============================================

export const getFAQById = async (
  id: string,
  supabase: SupabaseClient
): Promise<FAQ | null> => {
  const { data, error } = await supabase
    .from('faqs')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to get FAQ: ${error.message}`);
  }

  return data as FAQ;
};

// ============================================
// GET EVENT FAQs
// ============================================

export const getEventFAQs = async (
  eventId: string,
  supabase: SupabaseClient
): Promise<FAQ[]> => {
  const { data, error } = await supabase
    .from('faqs')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to get FAQs: ${error.message}`);
  }

  return (data ?? []) as FAQ[];
};

// ============================================
// GET GLOBAL FAQs (no event_id)
// ============================================

export const getGlobalFAQs = async (
  supabase: SupabaseClient
): Promise<FAQ[]> => {
  const { data, error } = await supabase
    .from('faqs')
    .select('*')
    .is('event_id', null)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to get global FAQs: ${error.message}`);
  }

  return (data ?? []) as FAQ[];
};
