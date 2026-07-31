// Survey Question
export interface SurveyQuestion {
  id: string;
  type: 'text' | 'choice' | 'rating' | 'multi';
  question: string;
  options?: string[];
  required: boolean;
}

// Survey
export interface Survey {
  id: string;
  event_id: string;
  title: string;
  description?: string;
  questions: SurveyQuestion[];
  is_active: boolean;
  starts_at?: string;
  ends_at?: string;
  created_at: string;
  updated_at: string;
}

// Survey Response
export interface SurveyResponse {
  id: string;
  survey_id: string;
  user_id: string;
  answers: Record<string, string | number | string[]>;
  created_at: string;
}

// Survey Stats
export interface SurveyStats {
  survey_id: string;
  total_responses: number;
  question_stats: QuestionStat[];
}

export interface QuestionStat {
  question_id: string;
  question: string;
  type: 'text' | 'choice' | 'rating' | 'multi';
  total_answers: number;
  // For choice/rating/multi
  distribution?: Record<string, number>;
  average?: number;
}

// Create Survey Request
export interface CreateSurveyRequest {
  title: string;
  description?: string;
  questions: SurveyQuestion[];
  starts_at?: string;
  ends_at?: string;
  is_active?: boolean;
}

// Update Survey Request
export interface UpdateSurveyRequest {
  title?: string;
  description?: string;
  questions?: SurveyQuestion[];
  starts_at?: string;
  ends_at?: string;
  is_active?: boolean;
}

// Submit Response Request
export interface SubmitSurveyResponseRequest {
  answers: Record<string, string | number | string[]>;
}
