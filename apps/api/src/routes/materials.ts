import { Hono } from 'hono';
import type { Env } from '../services/supabase.js';
import type { AuthContext } from '../middleware/auth.js';
import { getSupabaseClient } from '../services/supabase.js';
import { uploadMaterialSchema } from '@event-platform/shared';
import {
  uploadMaterial,
  getMaterialsByEvent,
  deleteMaterial,
  getDownloadUrl,
  streamMaterialFile,
} from '../services/materials.js';

export const materials = new Hono<{ Bindings: Env }>();

// GET /api/events/:eventId/materials - List materials for event (public)
materials.get('/events/:eventId/materials', async (c) => {
  try {
    const { eventId } = c.req.param();
    const supabase = getSupabaseClient(c.env);
    const mats = await getMaterialsByEvent(eventId, supabase);
    return c.json({ success: true, data: mats });
  } catch (err) {
    return c.json({ success: false, error: { code: 'INTERNAL_ERROR', message: (err as Error).message } }, 500);
  }
});

// POST /api/events/:eventId/materials - Upload material (auth required)
materials.post('/events/:eventId/materials', async (c) => {
  const authCtx = c as unknown as AuthContext;
  const user = (authCtx as any).get('user') as { id: string } | undefined;
  if (!user) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }

  try {
    const body = await c.req.json();
    const parsed = uploadMaterialSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.message } }, 400);
    }
    const supabase = getSupabaseClient(c.env, (authCtx as any).get('jwt'));
    const material = await uploadMaterial({ ...parsed.data, file_url: (body as Record<string, unknown>).file_url as string ?? '' }, supabase);
    return c.json({ success: true, data: material }, 201);
  } catch (err) {
    return c.json({ success: false, error: { code: 'INTERNAL_ERROR', message: (err as Error).message } }, 500);
  }
});

// GET /api/materials/:id/download - Get download URL (public)
materials.get('/materials/:id/download', async (c) => {
  try {
    const { id } = c.req.param();
    const supabase = getSupabaseClient(c.env);
    const result = await getDownloadUrl(id, supabase, c.env.STORAGE);
    return c.json({ success: true, data: result });
  } catch (err) {
    const message = (err as Error).message;
    if (message.includes('not found')) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message } }, 404);
    }
    return c.json({ success: false, error: { code: 'INTERNAL_ERROR', message } }, 500);
  }
});

// GET /api/materials/:id/file - Stream file from R2 (proxy, public)
materials.get('/materials/:id/file', async (c) => {
  try {
    const { id } = c.req.param();
    const supabase = getSupabaseClient(c.env);
    const result = await streamMaterialFile(id, supabase, c.env.STORAGE);
    if (!result) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'File not found' } }, 404);
    }
    return new Response(result.body, {
      headers: {
        'Content-Type': result.contentType,
        'Content-Disposition': `attachment; filename="${result.fileName}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (err) {
    return c.json({ success: false, error: { code: 'INTERNAL_ERROR', message: (err as Error).message } }, 500);
  }
});

// DELETE /api/materials/:id - Delete material (auth required)
materials.delete('/materials/:id', async (c) => {
  const authCtx = c as unknown as AuthContext;
  const user = (authCtx as any).get('user') as { id: string } | undefined;
  if (!user) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }

  try {
    const { id } = c.req.param();
    const supabase = getSupabaseClient(c.env, (authCtx as any).get('jwt'));
    await deleteMaterial(id, supabase);
    return c.json({ success: true, data: { message: 'Material deleted successfully' } });
  } catch (err) {
    return c.json({ success: false, error: { code: 'INTERNAL_ERROR', message: (err as Error).message } }, 500);
  }
});
