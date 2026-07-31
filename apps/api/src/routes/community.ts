import { Hono } from 'hono';
import type { AuthContext } from '../middleware/auth.js';
import { getSupabaseClient } from '../services/supabase.js';
import {
  getOrganizerProfile,
  updateOrganizerProfile,
  followOrganizer,
  unfollowOrganizer,
  getFollowers,
  getEventSeries,
  createEventSeries,
  isFollowing,
} from '../services/community.js';
import { updateProfileSchema, createEventSeriesSchema } from '@event-platform/shared';

const community = new Hono();

// GET /api/organizers/:slug - Get organizer profile (public)
community.get('/:slug', async (c) => {
  const slug = c.req.param('slug');

  const supabase = getSupabaseClient(c.env);
  const profile = await getOrganizerProfile(slug, supabase);

  if (!profile) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Organizer not found' } }, 404);
  }

  // Check if current user is following (if authenticated)
  let is_following = false;
  const authCtx = c as unknown as AuthContext;
  const user = (authCtx as any).get('user') as { id: string } | null;
  if (user) {
    is_following = await isFollowing(profile.id, user.id, supabase);
  }

  return c.json({ success: true, data: { ...profile, is_following } });
});

// PATCH /api/organizers/me - Update current user's organizer profile (auth required)
community.patch('/me', async (c) => {
  const authCtx = c as unknown as AuthContext;
  const user = (authCtx as any).get('user') as { id: string };
  if (!user) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }

  const body = await c.req.json();
  const data = updateProfileSchema.parse(body);

  const supabase = getSupabaseClient(c.env, (authCtx as any).get('jwt'));
  const profile = await updateOrganizerProfile(user.id, data, supabase);

  return c.json({ success: true, data: profile });
});

// POST /api/organizers/:id/follow - Follow organizer (auth required)
community.post('/:id/follow', async (c) => {
  const authCtx = c as unknown as AuthContext;
  const user = (authCtx as any).get('user') as { id: string };
  if (!user) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }

  const organizerId = c.req.param('id');
  const supabase = getSupabaseClient(c.env, (authCtx as any).get('jwt'));

  const result = await followOrganizer(organizerId, user.id, supabase);

  return c.json({ success: true, data: result });
});

// DELETE /api/organizers/:id/follow - Unfollow organizer (auth required)
community.delete('/:id/follow', async (c) => {
  const authCtx = c as unknown as AuthContext;
  const user = (authCtx as any).get('user') as { id: string };
  if (!user) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }

  const organizerId = c.req.param('id');
  const supabase = getSupabaseClient(c.env, (authCtx as any).get('jwt'));

  const result = await unfollowOrganizer(organizerId, user.id, supabase);

  return c.json({ success: true, data: result });
});

// GET /api/organizers/:id/followers - Get followers list (public)
community.get('/:id/followers', async (c) => {
  const organizerId = c.req.param('id');

  const supabase = getSupabaseClient(c.env);
  const followers = await getFollowers(organizerId, supabase);

  return c.json({ success: true, data: followers });
});

// GET /api/organizers/:id/series - Get event series list (public)
community.get('/:id/series', async (c) => {
  const organizerId = c.req.param('id');

  const supabase = getSupabaseClient(c.env);
  const series = await getEventSeries(organizerId, supabase);

  return c.json({ success: true, data: series });
});

// POST /api/series - Create event series (auth required)
community.post('/series', async (c) => {
  const authCtx = c as unknown as AuthContext;
  const user = (authCtx as any).get('user') as { id: string };
  if (!user) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }

  const body = await c.req.json();
  const data = createEventSeriesSchema.parse(body);

  // Ensure organizer_id matches authenticated user
  if (data.organizer_id !== user.id) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Cannot create series for another organizer' } }, 403);
  }

  const supabase = getSupabaseClient(c.env, (authCtx as any).get('jwt'));
  const series = await createEventSeries(data, supabase);

  return c.json({ success: true, data: series }, 201);
});

export { community };
