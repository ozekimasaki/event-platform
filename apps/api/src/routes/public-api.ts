import { Hono } from 'hono';
import type { AuthContext } from '../middleware/auth.js';
import { getSupabaseClient } from '../services/supabase.js';
import { validateApiKey } from '../services/api-keys.js';
import { listEvents, getEventBySlug } from '../services/events.js';
import { getEventRegistrations } from '../services/registrations.js';
import { eventQuerySchema } from '@event-platform/shared';
import type { ApiKeyScope } from '@event-platform/shared';
import type { Context, Next } from 'hono';

// ============================================
// API KEY AUTH MIDDLEWARE
// ============================================

const apiKeyAuthMiddleware = async (c: Context, next: Next) => {
  const apiKey = c.req.header('X-API-Key');
  if (!apiKey) {
    return c.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'X-API-Key header is required' } },
      401
    );
  }

  const supabase = getSupabaseClient(c.env);
  const validatedKey = await validateApiKey(apiKey, supabase);

  if (!validatedKey) {
    return c.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or expired API key' } },
      401
    );
  }

  // Attach API key info to context
  c.set('apiKey', validatedKey);
  c.set('apiKeyScopes', validatedKey.scopes as ApiKeyScope[]);

  await next();
};

// Helper to check scope
const hasScope = (c: Context, requiredScope: ApiKeyScope): boolean => {
  const scopes = (c as any).get('apiKeyScopes') as ApiKeyScope[] | undefined;
  return scopes?.includes(requiredScope) ?? false;
};

// ============================================
// PUBLIC API ROUTES
// ============================================

const publicApi = new Hono<AuthContext>();

// GET /public/api/events - List published events (no auth required)
publicApi.get('/events', async (c) => {
  const rawQuery = c.req.query();
  const query = eventQuerySchema.parse(rawQuery);

  const supabase = getSupabaseClient(c.env);
  const result = await listEvents(query, supabase);

  return c.json({
    success: true,
    data: result.events,
    pagination: {
      page: result.page,
      limit: result.limit,
      total: result.total,
      total_pages: result.total_pages,
    },
  });
});

// GET /public/api/events/:slug - Get event detail (no auth required)
publicApi.get('/events/:slug', async (c) => {
  const slug = c.req.param('slug');

  const supabase = getSupabaseClient(c.env);
  const event = await getEventBySlug(slug, supabase);

  if (!event) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Event not found' } }, 404);
  }

  return c.json({ success: true, data: event });
});

// GET /public/api/events/:slug/participants - List participants (API key required, read:participants scope)
publicApi.get('/events/:slug/participants', apiKeyAuthMiddleware, async (c) => {
  if (!hasScope(c, 'read:participants')) {
    return c.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'API key does not have read:participants scope' } },
      403
    );
  }

  const slug = c.req.param('slug')!;
  const supabase = getSupabaseClient(c.env);

  const event = await getEventBySlug(slug, supabase);
  if (!event) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Event not found' } }, 404);
  }

  // Verify the API key belongs to the event organizer
  const apiKeyData = (c as any).get('apiKey') as { organizer_id: string };
  if (apiKeyData.organizer_id !== event.organizer_id) {
    return c.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'API key does not have access to this event' } },
      403
    );
  }

  const participants = await getEventRegistrations(event.id, supabase);

  return c.json({
    success: true,
    data: participants,
    pagination: {
      total: participants.length,
    },
  });
});

export { publicApi };
