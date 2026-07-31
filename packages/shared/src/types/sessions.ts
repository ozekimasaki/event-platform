// Session
export interface Session {
  id: string;
  event_id: string;
  title: string;
  description?: string;
  speaker_id?: string;
  track?: string;
  start_at: string;
  end_at: string;
  order_index: number;
  created_at: string;
  updated_at: string;
}

// CfP Submission Status
export type CfpStatus = 'pending' | 'approved' | 'rejected';

// CfP Submission
export interface CfpSubmission {
  id: string;
  event_id: string;
  title: string;
  abstract: string;
  speaker_name: string;
  speaker_email: string;
  duration_minutes: number;
  status: CfpStatus;
  reviewed_by?: string;
  review_notes?: string;
  reviewed_at?: string;
  created_at: string;
  updated_at: string;
}

// CfP Stats
export interface CfpStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  avg_duration_minutes: number;
}

// Timetable entry (session with computed fields)
export interface TimetableEntry extends Session {
  duration_minutes: number;
}

// Timetable grouped by track
export interface TimetableByTrack {
  track: string;
  sessions: TimetableEntry[];
}
