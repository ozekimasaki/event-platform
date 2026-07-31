import { Hono } from 'hono';
import type { Env } from '../services/supabase.js';

const upload = new Hono<{ Bindings: Env }>();

// POST /api/upload/image - Direct upload to R2 via Workers
upload.post('/image', async (c) => {
  const contentType = c.req.header('Content-Type') || '';

  if (!contentType.startsWith('image/')) {
    return c.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'Only image files are allowed' } },
      400
    );
  }

  const body = await c.req.arrayBuffer();
  const size = body.byteLength;

  if (size > 10 * 1024 * 1024) {
    return c.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'File size must be under 10MB' } },
      400
    );
  }

  // Generate unique key
  const ext = contentType.split('/')[1] || 'jpg';
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 10);
  const key = `uploads/${timestamp}-${randomStr}.${ext}`;

  try {
    await c.env.STORAGE.put(key, body, {
      httpMetadata: { contentType },
    });

    // Construct public URL (assuming R2 public bucket or custom domain)
    const url = `/api/uploads/${key}`;

    return c.json({
      success: true,
      data: {
        url,
        key,
        size,
        mimetype: contentType,
      },
    });
  } catch (err) {
    console.error('R2 upload error:', err);
    return c.json(
      { success: false, error: { code: 'UPLOAD_FAILED', message: 'Failed to upload image' } },
      500
    );
  }
});

// POST /api/upload/presign - Return upload info (simple endpoint for now)
upload.post('/presign', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const filename = (body as Record<string, unknown>).filename as string || 'upload';

  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 10);
  const key = `uploads/${timestamp}-${randomStr}-${filename}`;

  return c.json({
    success: true,
    data: {
      uploadUrl: '/api/upload/image',
      key,
      method: 'POST',
      maxFileSize: 10 * 1024 * 1024,
      allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    },
  });
});

export { upload };
