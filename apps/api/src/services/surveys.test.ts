import { describe, it, expect, vi } from 'vitest';
import {
  createSurvey,
  submitSurveyResponse,
  getSurveyStats,
  listSurveys,
  getSurveyById,
  updateSurvey,
  deleteSurvey,
  getUserResponse,
} from './surveys.js';

const createMockSupabase = () => {
  const chain: Record<string, any> = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.select = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.delete = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn();
  chain.maybeSingle = vi.fn();
  return chain;
};

const mockSurveyQuestions = [
  { id: 'q1', type: 'rating' as const, question: 'How was the event?', required: true },
  { id: 'q2', type: 'choice' as const, question: 'Favorite session?', required: false, options: ['A', 'B', 'C'] },
  { id: 'q3', type: 'text' as const, question: 'Any feedback?', required: false },
];

// ============================================
// createSurvey
// ============================================

describe('createSurvey', () => {
  it('should create a survey and return it', async () => {
    const mockSurvey = {
      id: 'surv-1',
      event_id: 'evt-1',
      title: 'Post-event Survey',
      description: 'Please share your feedback',
      questions: mockSurveyQuestions,
      is_active: true,
      created_at: '2026-07-31T00:00:00Z',
      updated_at: '2026-07-31T00:00:00Z',
    };

    const supabase = createMockSupabase();
    supabase.single.mockResolvedValue({ data: mockSurvey, error: null });

    const result = await createSurvey(
      'evt-1',
      {
        title: 'Post-event Survey',
        description: 'Please share your feedback',
        questions: mockSurveyQuestions,
      },
      supabase as any
    );

    expect(result.id).toBe('surv-1');
    expect(result.title).toBe('Post-event Survey');
    expect(supabase.from).toHaveBeenCalledWith('surveys');
    expect(supabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_id: 'evt-1',
        title: 'Post-event Survey',
        is_active: true,
      })
    );
  });

  it('should throw when insert fails', async () => {
    const supabase = createMockSupabase();
    supabase.single.mockResolvedValue({
      data: null,
      error: { message: 'invalid input' },
    });

    await expect(
      createSurvey('evt-1', { title: 'Bad Survey', questions: [] }, supabase as any)
    ).rejects.toThrow('Failed to create survey');
  });
});

// ============================================
// submitSurveyResponse
// ============================================

describe('submitSurveyResponse', () => {
  it('should insert a new response when user has not responded', async () => {
    const mockResponse = {
      id: 'resp-1',
      survey_id: 'surv-1',
      user_id: 'user-1',
      answers: { q1: 5, q2: 'A', q3: 'Great event!' },
      created_at: '2026-07-31T00:00:00Z',
    };

    const supabase = createMockSupabase();
    // maybeSingle: no existing response
    supabase.maybeSingle.mockResolvedValue({ data: null, error: null });
    // single: insert result
    supabase.single.mockResolvedValue({ data: mockResponse, error: null });

    const result = await submitSurveyResponse(
      'surv-1',
      'user-1',
      { q1: 5, q2: 'A', q3: 'Great event!' },
      supabase as any
    );

    expect(result).toEqual(mockResponse);
    expect(supabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        survey_id: 'surv-1',
        user_id: 'user-1',
        answers: { q1: 5, q2: 'A', q3: 'Great event!' },
      })
    );
  });

  it('should update existing response when user has already responded', async () => {
    const existingResponse = { id: 'resp-1', survey_id: 'surv-1', user_id: 'user-1' };
    const updatedResponse = {
      ...existingResponse,
      answers: { q1: 3, q2: 'B', q3: 'Changed my mind' },
    };

    const supabase = createMockSupabase();
    // maybeSingle: existing response found
    supabase.maybeSingle.mockResolvedValue({ data: existingResponse, error: null });
    // single: update result
    supabase.single.mockResolvedValue({ data: updatedResponse, error: null });

    const result = await submitSurveyResponse(
      'surv-1',
      'user-1',
      { q1: 3, q2: 'B', q3: 'Changed my mind' },
      supabase as any
    );

    expect(result.answers.q1).toBe(3);
    expect(supabase.update).toHaveBeenCalledWith(expect.objectContaining({ answers: { q1: 3, q2: 'B', q3: 'Changed my mind' } }));
  });

  it('should throw when insert fails', async () => {
    const supabase = createMockSupabase();
    supabase.maybeSingle.mockResolvedValue({ data: null, error: null });
    supabase.single.mockResolvedValue({ data: null, error: { message: 'DB error' } });

    await expect(
      submitSurveyResponse('surv-1', 'user-1', { q1: 5 }, supabase as any)
    ).rejects.toThrow('Failed to submit survey response');
  });
});

// ============================================
// getSurveyStats
// ============================================

describe('getSurveyStats', () => {
  it('should calculate stats for rating questions (average + distribution)', async () => {
    const survey = {
      id: 'surv-1',
      event_id: 'evt-1',
      title: 'Feedback',
      questions: [{ id: 'q1', type: 'rating' as const, question: 'Rate us', required: true }],
      is_active: true,
      created_at: '2026-07-31T00:00:00Z',
      updated_at: '2026-07-31T00:00:00Z',
    };

    const responses = [
      { answers: { q1: 5 } },
      { answers: { q1: 4 } },
      { answers: { q1: 3 } },
    ];

    const supabase = createMockSupabase();
    // getSurveyById: from().select().eq().single() → single returns chain (awaited)
    // getSurveyStats responses: from().select().eq() → eq returns chain (awaited)
    // Both single() and eq() must return the chain (not a promise)
    supabase.single.mockReturnValue(chain);
    supabase.eq.mockReturnValue(chain);
    // First await on chain: single() → survey; Second await on chain: eq() → responses
    // We use a counter to differentiate
    let awaitCount = 0;
    const origThen = chain.then;
    // Instead, let's make the chain thenable that returns different values
    // Actually simpler: mock single and eq to return chain, and make the chain
    // resolve differently based on call order using a thenable
    Object.defineProperty(chain, Symbol.for('vitest:survey:stats'), { value: true });

    // Use a different approach: make chain a thenable that resolves based on context
    // The simplest: use vi.spyOn to track and differentiate
    const chainCopy = { ...chain };
    let callIdx = 0;
    supabase.single.mockImplementation(() => {
      callIdx++;
      // First call is getSurveyById
      const resultPromise = Promise.resolve({ data: survey, error: null });
      return resultPromise;
    });
    // Wait, single returns chain in the mock pattern. But the code does .eq().single()
    // and awaits the result. If single returns a promise, that's fine - it's the last in chain.
    // But then eq must return the chain (not a promise).
    // For the second query: .from().select().eq() → eq is last, awaited.
    // eq must return the chain which is then awaited.
    // The chain is a plain object, awaiting it returns itself. { data: responses, error: null } would need to be the chain.
    // That won't work because chain has methods.

    // Let me use a completely different approach - make chain thenable
    // Actually, let's just make eq return a thenable that resolves to { data: responses, error: null }
    // and single return a thenable that resolves to { data: survey, error: null }

    // Reset
    supabase.single.mockResolvedValue({ data: survey, error: null });
    // For eq, we need it to be awaitable AND return data. Make it return a thenable object:
    const eqResult = { data: responses, error: null, then: undefined as any };
    eqResult.then = function(resolve: any) { resolve(this); };
    supabase.eq.mockReturnValue(eqResult);

    const stats = await getSurveyStats('surv-1', supabase as any);

    expect(stats.survey_id).toBe('surv-1');
    expect(stats.total_responses).toBe(3);
    expect(stats.question_stats).toHaveLength(1);

    const q1Stat = stats.question_stats[0];
    expect(q1Stat.type).toBe('rating');
    expect(q1Stat.average).toBe(4); // (5+4+3)/3 = 4
    expect(q1Stat.distribution).toEqual({ '5': 1, '4': 1, '3': 1 });
  });

  it('should calculate stats for choice questions (distribution)', async () => {
    const survey = {
      id: 'surv-2',
      event_id: 'evt-1',
      title: 'Choice Survey',
      questions: [{ id: 'q1', type: 'choice' as const, question: 'Pick one', required: true, options: ['A', 'B'] }],
      is_active: true,
      created_at: '2026-07-31T00:00:00Z',
      updated_at: '2026-07-31T00:00:00Z',
    };

    const responses = [
      { answers: { q1: 'A' } },
      { answers: { q1: 'B' } },
      { answers: { q1: 'A' } },
    ];

    const supabase = createMockSupabase();
    supabase.single.mockResolvedValue({ data: survey, error: null });
    supabase.eq.mockResolvedValue({ data: responses, error: null });

    const stats = await getSurveyStats('surv-2', supabase as any);
    const q1Stat = stats.question_stats[0];

    expect(q1Stat.distribution).toEqual({ A: 2, B: 1 });
  });

  it('should calculate stats for multi-select questions', async () => {
    const survey = {
      id: 'surv-3',
      event_id: 'evt-1',
      title: 'Multi Survey',
      questions: [{ id: 'q1', type: 'multi' as const, question: 'Pick many', required: true, options: ['X', 'Y', 'Z'] }],
      is_active: true,
      created_at: '2026-07-31T00:00:00Z',
      updated_at: '2026-07-31T00:00:00Z',
    };

    const responses = [
      { answers: { q1: ['X', 'Y'] } },
      { answers: { q1: ['Y', 'Z'] } },
    ];

    const supabase = createMockSupabase();
    supabase.single.mockResolvedValue({ data: survey, error: null });
    supabase.eq.mockResolvedValue({ data: responses, error: null });

    const stats = await getSurveyStats('surv-3', supabase as any);
    const q1Stat = stats.question_stats[0];

    expect(q1Stat.distribution).toEqual({ X: 1, Y: 2, Z: 1 });
  });

  it('should throw when survey not found', async () => {
    const supabase = createMockSupabase();
    supabase.single.mockResolvedValue({ data: null, error: { code: 'PGRST116', message: 'Not found' } });

    await expect(getSurveyStats('surv-x', supabase as any)).rejects.toThrow('Survey not found');
  });

  it('should return zero total_responses when no responses exist', async () => {
    const survey = {
      id: 'surv-4',
      event_id: 'evt-1',
      title: 'Empty Survey',
      questions: [{ id: 'q1', type: 'text' as const, question: 'Feedback?', required: false }],
      is_active: true,
      created_at: '2026-07-31T00:00:00Z',
      updated_at: '2026-07-31T00:00:00Z',
    };

    const supabase = createMockSupabase();
    supabase.single.mockResolvedValue({ data: survey, error: null });
    supabase.eq.mockResolvedValue({ data: [], error: null });

    const stats = await getSurveyStats('surv-4', supabase as any);
    expect(stats.total_responses).toBe(0);
    expect(stats.question_stats[0].total_answers).toBe(0);
  });
});

// ============================================
// listSurveys
// ============================================

describe('listSurveys', () => {
  it('should return surveys for an event', async () => {
    const mockSurveys = [
      { id: 'surv-1', event_id: 'evt-1', title: 'Survey 1', questions: [], is_active: true, created_at: '2026-07-31T00:00:00Z', updated_at: '2026-07-31T00:00:00Z' },
    ];

    const supabase = createMockSupabase();
    supabase.order.mockResolvedValue({ data: mockSurveys, error: null });

    const result = await listSurveys('evt-1', supabase as any);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Survey 1');
  });

  it('should throw on database error', async () => {
    const supabase = createMockSupabase();
    supabase.order.mockResolvedValue({ data: null, error: { message: 'DB error' } });

    await expect(listSurveys('evt-1', supabase as any)).rejects.toThrow('Failed to list surveys');
  });
});

// ============================================
// getSurveyById
// ============================================

describe('getSurveyById', () => {
  it('should return a survey when found', async () => {
    const mockSurvey = { id: 'surv-1', title: 'Survey', questions: [], is_active: true, created_at: '2026-07-31T00:00:00Z', updated_at: '2026-07-31T00:00:00Z' };
    const supabase = createMockSupabase();
    supabase.single.mockResolvedValue({ data: mockSurvey, error: null });

    const result = await getSurveyById('surv-1', supabase as any);
    expect(result).toEqual(expect.objectContaining({ id: 'surv-1' }));
  });

  it('should return null when not found', async () => {
    const supabase = createMockSupabase();
    supabase.single.mockResolvedValue({ data: null, error: { code: 'PGRST116', message: 'Not found' } });

    const result = await getSurveyById('surv-x', supabase as any);
    expect(result).toBeNull();
  });
});

// ============================================
// updateSurvey
// ============================================

describe('updateSurvey', () => {
  it('should update a survey title', async () => {
    const mockSurvey = { id: 'surv-1', title: 'Updated Title', questions: [], is_active: true, created_at: '2026-07-31T00:00:00Z', updated_at: '2026-07-31T01:00:00Z' };
    const supabase = createMockSupabase();
    supabase.single.mockResolvedValue({ data: mockSurvey, error: null });

    const result = await updateSurvey('surv-1', { title: 'Updated Title' }, supabase as any);
    expect(result.title).toBe('Updated Title');
  });

  it('should throw on update failure', async () => {
    const supabase = createMockSupabase();
    supabase.single.mockResolvedValue({ data: null, error: { message: 'DB error' } });

    await expect(updateSurvey('surv-1', { title: 'X' }, supabase as any)).rejects.toThrow('Failed to update survey');
  });
});

// ============================================
// deleteSurvey
// ============================================

describe('deleteSurvey', () => {
  it('should delete a survey', async () => {
    const supabase = createMockSupabase();
    supabase.eq.mockResolvedValue({ data: null, error: null });

    await deleteSurvey('surv-1', supabase as any);
    expect(supabase.from).toHaveBeenCalledWith('surveys');
    expect(supabase.delete).toHaveBeenCalled();
  });

  it('should throw on delete failure', async () => {
    const supabase = createMockSupabase();
    supabase.eq.mockResolvedValue({ data: null, error: { message: 'not found' } });

    await expect(deleteSurvey('surv-x', supabase as any)).rejects.toThrow('Failed to delete survey');
  });
});

// ============================================
// getUserResponse
// ============================================

describe('getUserResponse', () => {
  it('should return user response when found', async () => {
    const mockResponse = { id: 'resp-1', survey_id: 'surv-1', user_id: 'user-1', answers: { q1: 5 } };
    const supabase = createMockSupabase();
    supabase.maybeSingle.mockResolvedValue({ data: mockResponse, error: null });

    const result = await getUserResponse('surv-1', 'user-1', supabase as any);
    expect(result).toEqual(mockResponse);
  });

  it('should return null when user has not responded', async () => {
    const supabase = createMockSupabase();
    supabase.maybeSingle.mockResolvedValue({ data: null, error: null });

    const result = await getUserResponse('surv-1', 'user-1', supabase as any);
    expect(result).toBeNull();
  });

  it('should throw on database error', async () => {
    const supabase = createMockSupabase();
    supabase.maybeSingle.mockResolvedValue({ data: null, error: { message: 'DB error' } });

    await expect(getUserResponse('surv-1', 'user-1', supabase as any)).rejects.toThrow('Failed to get user response');
  });
});
