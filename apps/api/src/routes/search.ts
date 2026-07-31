import { Hono } from 'hono';
import { getSupabaseClient } from '../services/supabase.js';
import {
  searchEvents,
  getTrendingEvents,
  getCategories,
} from '../services/search.js';

const search = new Hono();

// GET /api/search/events?q=keyword&category=xxx&date_from=xxx&region=xxx&page=1&limit=20
search.get('/events', async (c) => {
  const q = c.req.query('q') || '';
  const category = c.req.query('category') || '';
  const date_from = c.req.query('date_from') || '';
  const date_to = c.req.query('date_to') || '';
  const region = c.req.query('region') || '';
  const page = Number(c.req.query('page') || '1');
  const limit = Number(c.req.query('limit') || '20');

  const supabase = getSupabaseClient(c.env);

  try {
    const result = await searchEvents(
      {
        q: q || undefined,
        category: category || undefined,
        date_from: date_from || undefined,
        date_to: date_to || undefined,
        region: region || undefined,
        page,
        limit,
      },
      supabase
    );

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
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Search failed';
    console.error('Search events error:', message);
    return c.json({ success: false, error: { code: 'INTERNAL_ERROR', message } }, 500);
  }
});

// GET /api/search/trending - Trending events (most registrations in last 7 days)
search.get('/trending', async (c) => {
  const limit = Number(c.req.query('limit') || '8');
  const supabase = getSupabaseClient(c.env);

  try {
    const events = await getTrendingEvents(supabase, limit);
    return c.json({ success: true, data: events });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch trending events';
    console.error('Trending events error:', message);
    return c.json({ success: false, error: { code: 'INTERNAL_ERROR', message } }, 500);
  }
});

// GET /api/search/categories - Category list with counts
search.get('/categories', async (c) => {
  const supabase = getSupabaseClient(c.env);

  try {
    const categories = await getCategories(supabase);
    return c.json({ success: true, data: categories });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch categories';
    console.error('Categories error:', message);
    return c.json({ success: false, error: { code: 'INTERNAL_ERROR', message } }, 500);
  }
});

export { search };
