import { Hono } from 'hono';
import type { Env } from '../services/supabase.js';

// Create router
const routes = new Hono<{ Bindings: Env }>();

// Events routes placeholder
routes.get('/events', (c) => {
  return c.json({
    success: true,
    data: [],
    pagination: {
      page: 1,
      limit: 20,
      total: 0,
      total_pages: 0,
    },
  });
});

routes.post('/events', (c) => {
  return c.json({
    success: true,
    data: { message: 'Event created (placeholder)' },
  }, 201);
});

routes.get('/events/:id', (c) => {
  const id = c.req.param('id');
  return c.json({
    success: true,
    data: { id, message: 'Event details (placeholder)' },
  });
});

export { routes };
