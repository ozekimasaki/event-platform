import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Survey,
  SurveyResponse,
  SurveyStats,
  QuestionStat,
  CreateSurveyRequest,
  UpdateSurveyRequest,
} from '@event-platform/shared';

// ============================================
// LIST SURVEYS FOR EVENT
// ============================================

export const listSurveys = async (
  eventId: string,
  supabase: SupabaseClient
): Promise<Survey[]> => {
  const { data, error } = await supabase
    .from('surveys')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to list surveys: ${error.message}`);
  }

  return (data ?? []).map(mapSurveyRow) as unknown as Survey[];
};

// ============================================
// GET SURVEY BY ID
// ============================================

export const getSurveyById = async (
  id: string,
  supabase: SupabaseClient
): Promise<Survey | null> => {
  const { data, error } = await supabase
    .from('surveys')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to get survey: ${error.message}`);
  }

  return mapSurveyRow(data) as unknown as Survey;
};

// ============================================
// CREATE SURVEY
// ============================================

export const createSurvey = async (
  eventId: string,
  data: CreateSurveyRequest,
  supabase: SupabaseClient
): Promise<Survey> => {
  const insertData = {
    event_id: eventId,
    title: data.title,
    description: data.description ?? null,
    questions: data.questions,
    is_active: data.is_active ?? true,
    starts_at: data.starts_at ?? null,
    ends_at: data.ends_at ?? null,
  };

  const { data: survey, error } = await supabase
    .from('surveys')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create survey: ${error.message}`);
  }

  return mapSurveyRow(survey) as unknown as Survey;
};

// ============================================
// UPDATE SURVEY
// ============================================

export const updateSurvey = async (
  id: string,
  data: UpdateSurveyRequest,
  supabase: SupabaseClient
): Promise<Survey> => {
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.questions !== undefined) updateData.questions = data.questions;
  if (data.is_active !== undefined) updateData.is_active = data.is_active;
  if (data.starts_at !== undefined) updateData.starts_at = data.starts_at;
  if (data.ends_at !== undefined) updateData.ends_at = data.ends_at;

  const { data: survey, error } = await supabase
    .from('surveys')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update survey: ${error.message}`);
  }

  return mapSurveyRow(survey) as unknown as Survey;
};

// ============================================
// DELETE SURVEY
// ============================================

export const deleteSurvey = async (
  id: string,
  supabase: SupabaseClient
): Promise<void> => {
  const { error } = await supabase
    .from('surveys')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to delete survey: ${error.message}`);
  }
};

// ============================================
// SUBMIT SURVEY RESPONSE
// ============================================

export const submitSurveyResponse = async (
  surveyId: string,
  userId: string,
  answers: Record<string, string | number | string[]>,
  supabase: SupabaseClient
): Promise<SurveyResponse> => {
  // Check if user already responded
  const { data: existing } = await supabase
    .from('survey_responses')
    .select('id')
    .eq('survey_id', surveyId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    // Update existing response
    const { data, error } = await supabase
      .from('survey_responses')
      .update({ answers })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update survey response: ${error.message}`);
    }

    return data as SurveyResponse;
  }

  // Insert new response
  const { data, error } = await supabase
    .from('survey_responses')
    .insert({
      survey_id: surveyId,
      user_id: userId,
      answers,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to submit survey response: ${error.message}`);
  }

  return data as SurveyResponse;
};

// ============================================
// GET SURVEY STATS
// ============================================

export const getSurveyStats = async (
  surveyId: string,
  supabase: SupabaseClient
): Promise<SurveyStats> => {
  // Get survey
  const survey = await getSurveyById(surveyId, supabase);
  if (!survey) {
    throw new Error('Survey not found');
  }

  // Get all responses
  const { data: responses, error } = await supabase
    .from('survey_responses')
    .select('answers')
    .eq('survey_id', surveyId);

  if (error) {
    throw new Error(`Failed to get survey stats: ${error.message}`);
  }

  const allResponses = responses ?? [];
  const totalResponses = allResponses.length;

  // Calculate stats per question
  const questionStats: QuestionStat[] = survey.questions.map((q) => {
    const answers = allResponses
      .map((r) => (r.answers as Record<string, unknown>)[q.id])
      .filter((a) => a !== undefined && a !== null && a !== '');

    const stat: QuestionStat = {
      question_id: q.id,
      question: q.question,
      type: q.type,
      total_answers: answers.length,
    };

    if (q.type === 'rating') {
      const numericAnswers = answers.filter((a) => typeof a === 'number') as number[];
      if (numericAnswers.length > 0) {
        stat.average = Math.round((numericAnswers.reduce((s, v) => s + v, 0) / numericAnswers.length) * 10) / 10;
        const dist: Record<string, number> = {};
        for (const val of numericAnswers) {
          const key = String(val);
          dist[key] = (dist[key] ?? 0) + 1;
        }
        stat.distribution = dist;
      }
    } else if (q.type === 'choice' || q.type === 'multi') {
      const dist: Record<string, number> = {};
      for (const answer of answers) {
        if (Array.isArray(answer)) {
          for (const val of answer) {
            dist[val] = (dist[val] ?? 0) + 1;
          }
        } else {
          const key = String(answer);
          dist[key] = (dist[key] ?? 0) + 1;
        }
      }
      stat.distribution = dist;
    }
    // text type: no distribution needed

    return stat;
  });

  return {
    survey_id: surveyId,
    total_responses: totalResponses,
    question_stats: questionStats,
  };
};

// ============================================
// GET USER'S RESPONSE FOR SURVEY
// ============================================

export const getUserResponse = async (
  surveyId: string,
  userId: string,
  supabase: SupabaseClient
): Promise<SurveyResponse | null> => {
  const { data, error } = await supabase
    .from('survey_responses')
    .select('*')
    .eq('survey_id', surveyId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to get user response: ${error.message}`);
  }

  return data as SurveyResponse | null;
};

// ============================================
// HELPER: Map DB row to Survey type
// ============================================

const mapSurveyRow = (row: Record<string, unknown>): Record<string, unknown> => {
  // Handle questions column - may be null/undefined if not in DB
  if (!row.questions) {
    row.questions = [];
  }
  // Parse questions if it's a string (JSONB may come as string in some cases)
  if (typeof row.questions === 'string') {
    try {
      row.questions = JSON.parse(row.questions);
    } catch {
      row.questions = [];
    }
  }
  return row;
};
