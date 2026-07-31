import { Hono } from 'hono';
import type { AuthContext } from '../middleware/auth.js';
import { getSupabaseClient } from '../services/supabase.js';
import {
  getArticles,
  getArticleBySlug,
  getArticleById,
  createArticle,
  updateArticle,
  deleteArticle,
} from '../services/articles.js';
import { createArticleSchema, updateArticleSchema, articleQuerySchema } from '@event-platform/shared';

const articles = new Hono();

// GET /api/articles - List published articles (public)
articles.get('/', async (c) => {
  const rawQuery = c.req.query();
  const query = articleQuerySchema.parse(rawQuery);

  const supabase = getSupabaseClient(c.env);
  const result = await getArticles(query, supabase);

  return c.json({
    success: true,
    data: result.articles,
    pagination: {
      page: result.page,
      limit: result.limit,
      total: result.total,
      total_pages: result.total_pages,
    },
  });
});

// GET /api/articles/my - List current user's articles (auth required)
articles.get('/my', async (c) => {
  const authCtx = c as unknown as AuthContext;
  const user = (authCtx as any).get('user') as { id: string };
  if (!user) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }

  const rawQuery = c.req.query();
  const query = articleQuerySchema.parse(rawQuery);

  const supabase = getSupabaseClient(c.env, (authCtx as any).get('jwt'));
  const result = await getArticles(query, supabase, user.id);

  return c.json({
    success: true,
    data: result.articles,
    pagination: {
      page: result.page,
      limit: result.limit,
      total: result.total,
      total_pages: result.total_pages,
    },
  });
});

// POST /api/articles - Create article (auth required)
articles.post('/', async (c) => {
  const authCtx = c as unknown as AuthContext;
  const user = (authCtx as any).get('user') as { id: string };
  if (!user) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }

  const body = await c.req.json();
  const data = createArticleSchema.parse(body);

  const supabase = getSupabaseClient(c.env, (authCtx as any).get('jwt'));
  const article = await createArticle(data, user.id, supabase);

  return c.json({ success: true, data: article }, 201);
});

// GET /api/articles/by-id/:id - Get article by ID (auth required)
articles.get('/by-id/:id', async (c) => {
  const authCtx = c as unknown as AuthContext;
  const user = (authCtx as any).get('user') as { id: string };
  if (!user) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }

  const id = c.req.param('id');
  const supabase = getSupabaseClient(c.env, (authCtx as any).get('jwt'));
  const article = await getArticleById(id, supabase);

  if (!article) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Article not found' } }, 404);
  }

  if (article.organizer_id !== user.id) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } }, 403);
  }

  return c.json({ success: true, data: article });
});

// GET /api/articles/:slug - Get article detail by slug (public)
articles.get('/:slug', async (c) => {
  const slug = c.req.param('slug');

  const supabase = getSupabaseClient(c.env);
  const article = await getArticleBySlug(slug, supabase);

  if (!article) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Article not found' } }, 404);
  }

  return c.json({ success: true, data: article });
});

// PATCH /api/articles/:id - Update article (auth required)
articles.patch('/:id', async (c) => {
  const authCtx = c as unknown as AuthContext;
  const user = (authCtx as any).get('user') as { id: string };
  if (!user) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }

  const id = c.req.param('id');
  const body = await c.req.json();
  const data = updateArticleSchema.parse(body);

  const supabase = getSupabaseClient(c.env, (authCtx as any).get('jwt'));

  try {
    const article = await updateArticle(id, data, user.id, supabase);
    return c.json({ success: true, data: article });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Update failed';
    if (message.includes('not found')) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message } }, 404);
    }
    if (message.includes('Unauthorized')) {
      return c.json({ success: false, error: { code: 'FORBIDDEN', message } }, 403);
    }
    throw err;
  }
});

// DELETE /api/articles/:id - Delete article (auth required)
articles.delete('/:id', async (c) => {
  const authCtx = c as unknown as AuthContext;
  const user = (authCtx as any).get('user') as { id: string };
  if (!user) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }

  const id = c.req.param('id');
  const supabase = getSupabaseClient(c.env, (authCtx as any).get('jwt'));

  try {
    await deleteArticle(id, user.id, supabase);
    return c.json({ success: true, data: { message: 'Article deleted successfully' } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Delete failed';
    if (message.includes('not found')) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message } }, 404);
    }
    if (message.includes('Unauthorized')) {
      return c.json({ success: false, error: { code: 'FORBIDDEN', message } }, 403);
    }
    throw err;
  }
});

export { articles };
