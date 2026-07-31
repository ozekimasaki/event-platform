import { Hono } from 'hono';
import type { AuthContext } from '../middleware/auth.js';
import { getSupabaseClient } from '../services/supabase.js';
import {
  listSurveys,
  getSurveyById,
  createSurvey,
  updateSurvey,
  deleteSurvey,
  submitSurveyResponse,
  getSurveyStats,
  getUserResponse,
} from '../services/surveys.js';
import {
  createSurveySchema,
  updateSurveySchema,
  submitResponseSchema,
} from '@event-platform/shared';

// ============================================
// EVENT-SCOPED SURVEY ROUTES
// Mounted at: /api/events/:eventId/surveys
// ============================================

const eventSurveys = new Hono();

// GET /api/events/:eventId/surveys - List surveys for event (public for active, auth for all)
eventSurveys.get('/', async (c) => {
  const eventId = c.req.param('eventId');
  const supabase = getSupabaseClient(c.env);

  const surveys = await listSurveys(eventId, supabase);

  return c.json({
    success: true,
    data: surveys,
  });
});

// POST /api/events/:eventId/surveys - Create survey (organizer only)
eventSurveys.post('/', async (c) => {
  const authCtx = c as unknown as AuthContext;
  const user = (authCtx as any).get('user') as { id: string };
  if (!user) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }

  const eventId = c.req.param('eventId');
  const body = await c.req.json();
  const data = createSurveySchema.parse(body);

  const supabase = getSupabaseClient(c.env, (authCtx as any).get('jwt'));

  // Verify event ownership
  const { data: event } = await supabase
    .from('events')
    .select('organizer_id')
    .eq('id', eventId)
    .single();

  if (!event) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Event not found' } }, 404);
  }

  // Check organizer ownership via organizers table
  const { data: organizer } = await supabase
    .from('organizers')
    .select('id')
    .eq('id', event.organizer_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!organizer) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized for this event' } }, 403);
  }

  const survey = await createSurvey(eventId, data, supabase);

  return c.json({ success: true, data: survey }, 201);
});

// ============================================
// SURVEY-SCOPED ROUTES
// Mounted at: /api/surveys
// ============================================

const surveys = new Hono();

// GET /api/surveys/:id - Get survey detail
surveys.get('/:id', async (c) => {
  const id = c.req.param('id');
  const supabase = getSupabaseClient(c.env);

  const survey = await getSurveyById(id, supabase);
  if (!survey) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Survey not found' } }, 404);
  }

  // Also check if user has already responded (if authenticated)
  let userResponse = null;
  try {
    const authCtx = c as unknown as AuthContext;
    const user = (authCtx as any).get('user') as { id: string } | null;
    if (user) {
      const userJwt = (authCtx as any).get('jwt') as string | undefined;
      const userSupabase = getSupabaseClient(c.env, userJwt);
      userResponse = await getUserResponse(id, user.id, userSupabase);
    }
  } catch {
    // Ignore - user response is optional
  }

  return c.json({
    success: true,
    data: {
      survey,
      user_response: userResponse,
    },
  });
});

// PATCH /api/surveys/:id - Update survey (organizer only)
surveys.patch('/:id', async (c) => {
  const authCtx = c as unknown as AuthContext;
  const user = (authCtx as any).get('user') as { id: string };
  if (!user) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }

  const id = c.req.param('id');
  const body = await c.req.json();
  const data = updateSurveySchema.parse(body);

  const supabase = getSupabaseClient(c.env, (authCtx as any).get('jwt'));

  // Verify ownership via event → organizer
  const survey = await getSurveyById(id, supabase);
  if (!survey) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Survey not found' } }, 404);
  }

  const { data: event } = await supabase
    .from('events')
    .select('organizer_id')
    .eq('id', survey.event_id)
    .single();

  if (!event) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Event not found' } }, 404);
  }

  const { data: organizer } = await supabase
    .from('organizers')
    .select('id')
    .eq('id', event.organizer_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!organizer) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
  }

  const updated = await updateSurvey(id, data, supabase);

  return c.json({ success: true, data: updated });
});

// DELETE /api/surveys/:id - Delete survey (organizer only)
surveys.delete('/:id', async (c) => {
  const authCtx = c as unknown as AuthContext;
  const user = (authCtx as any).get('user') as { id: string };
  if (!user) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }

  const id = c.req.param('id');
  const supabase = getSupabaseClient(c.env, (authCtx as any).get('jwt'));

  // Verify ownership
  const survey = await getSurveyById(id, supabase);
  if (!survey) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Survey not found' } }, 404);
  }

  const { data: event } = await supabase
    .from('events')
    .select('organizer_id')
    .eq('id', survey.event_id)
    .single();

  const { data: organizer } = await supabase
    .from('organizers')
    .select('id')
    .eq('id', event?.organizer_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!organizer) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
  }

  await deleteSurvey(id, supabase);

  return c.json({ success: true, data: { message: 'Survey deleted successfully' } });
});

// POST /api/surveys/:id/respond - Submit survey response (auth required)
surveys.post('/:id/respond', async (c) => {
  const authCtx = c as unknown as AuthContext;
  const user = (authCtx as any).get('user') as { id: string };
  if (!user) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }

  const id = c.req.param('id');
  const body = await c.req.json();
  const data = submitResponseSchema.parse(body);

  const supabase = getSupabaseClient(c.env, (authCtx as any).get('jwt'));

  // Check survey exists and is active
  const survey = await getSurveyById(id, supabase);
  if (!survey) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Survey not found' } }, 404);
  }
  if (!survey.is_active) {
    return c.json({ success: false, error: { code: 'BAD_REQUEST', message: 'Survey is no longer active' } }, 400);
  }

  const response = await submitSurveyResponse(id, user.id, data.answers, supabase);

  return c.json({ success: true, data: response });
});

// GET /api/surveys/:id/stats - Get survey statistics (organizer only)
surveys.get('/:id/stats', async (c) => {
  const authCtx = c as unknown as AuthContext;
  const user = (authCtx as any).get('user') as { id: string };
  if (!user) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }

  const id = c.req.param('id');
  const supabase = getSupabaseClient(c.env, (authCtx as any).get('jwt'));

  // Verify ownership
  const survey = await getSurveyById(id, supabase);
  if (!survey) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Survey not found' } }, 404);
  }

  const { data: event } = await supabase
    .from('events')
    .select('organizer_id')
    .eq('id', survey.event_id)
    .single();

  const { data: organizer } = await supabase
    .from('organizers')
    .select('id')
    .eq('id', event?.organizer_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!organizer) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
  }

  const stats = await getSurveyStats(id, supabase);

  return c.json({ success: true, data: stats });
});

export { eventSurveys, surveys };
