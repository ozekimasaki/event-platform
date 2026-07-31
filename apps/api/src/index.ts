import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { routes } from './routes/index.js';
import { auth } from './routes/auth.js';
import { authMiddleware } from './middleware/auth.js';
import { CheckInCoordinator } from './durable-objects/check-in.js';
import type { Env } from './services/supabase.js';

// Create Hono app
const app = new Hono<{ Bindings: Env }>();

// CORS middleware
app.use('/*', cors({
  origin: ['http://localhost:4321', 'https://event-platform.pages.dev'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Health check (public)
app.get('/api/health', (c) => {
  return c.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
    },
  });
});

// Auth routes (public — login/signup/refresh/oauth)
app.route('/api/auth', auth);

// Protected API routes (require authentication)
app.use('/api/*', authMiddleware);
app.route('/api', routes);

// Global error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json(
    {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    },
    500
  );
});

// 404 handler
app.notFound((c) => {
  return c.json(
    {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Route ${c.req.method} ${c.req.path} not found`,
      },
    },
    404
  );
});

// Export app for Cloudflare Workers
export default app;
export { CheckInCoordinator };
