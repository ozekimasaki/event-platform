import type { SupabaseClient } from '@supabase/supabase-js';
import type { CfpSubmission, CfpStats } from '@event-platform/shared';

// ============================================
// SUBMIT CFP
// ============================================

export interface SubmitCfpData {
  event_id: string;
  title: string;
  abstract: string;
  speaker_name: string;
  speaker_email: string;
  duration_minutes: number;
}

export const submitCfp = async (
  data: SubmitCfpData,
  supabase: SupabaseClient
): Promise<CfpSubmission> => {
  const insertData = {
    event_id: data.event_id,
    title: data.title,
    abstract: data.abstract,
    speaker_name: data.speaker_name,
    speaker_email: data.speaker_email,
    duration_minutes: data.duration_minutes,
    status: 'pending',
  };

  const { data: submission, error } = await supabase
    .from('cfp_submissions')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to submit CfP: ${error.message}`);
  }

  return submission as CfpSubmission;
};

// ============================================
// GET CFP SUBMISSIONS BY EVENT
// ============================================

export const getCfpSubmissions = async (
  eventId: string,
  supabase: SupabaseClient
): Promise<CfpSubmission[]> => {
  const { data, error } = await supabase
    .from('cfp_submissions')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to get CfP submissions: ${error.message}`);
  }

  return (data ?? []) as CfpSubmission[];
};

// ============================================
// GET CFP SUBMISSION BY ID
// ============================================

export const getCfpById = async (
  id: string,
  supabase: SupabaseClient
): Promise<CfpSubmission | null> => {
  const { data, error } = await supabase
    .from('cfp_submissions')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to get CfP submission: ${error.message}`);
  }

  return data as CfpSubmission;
};

// ============================================
// REVIEW CFP
// ============================================

export const reviewCfp = async (
  cfpId: string,
  status: 'approved' | 'rejected',
  reviewedBy: string,
  notes?: string,
  supabase?: SupabaseClient
): Promise<CfpSubmission> => {
  if (!supabase) {
    throw new Error('Supabase client is required');
  }

  const existing = await getCfpById(cfpId, supabase);
  if (!existing) {
    throw new Error('CfP submission not found');
  }

  const { data, error } = await supabase
    .from('cfp_submissions')
    .update({
      status,
      reviewed_by: reviewedBy,
      review_notes: notes ?? null,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', cfpId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to review CfP: ${error.message}`);
  }

  return data as CfpSubmission;
};

// ============================================
// GET CFP STATS
// ============================================

export const getCfpStats = async (
  eventId: string,
  supabase: SupabaseClient
): Promise<CfpStats> => {
  const submissions = await getCfpSubmissions(eventId, supabase);

  const stats: CfpStats = {
    total: submissions.length,
    pending: 0,
    approved: 0,
    rejected: 0,
    avg_duration_minutes: 0,
  };

  let totalDuration = 0;
  for (const s of submissions) {
    if (s.status === 'pending') stats.pending++;
    else if (s.status === 'approved') stats.approved++;
    else if (s.status === 'rejected') stats.rejected++;
    totalDuration += s.duration_minutes;
  }

  stats.avg_duration_minutes = stats.total > 0 ? Math.round(totalDuration / stats.total) : 0;

  return stats;
};
