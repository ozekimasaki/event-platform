import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { routes } from './routes/index.js';
import { CheckInCoordinator } from './durable-objects/check-in.js';

// Create Hono app
const app = new Hono();

// CORS middleware
app.use('/*', cors({
  origin: ['http://localhost:4321', 'https://event-platform.pages.dev'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Health check
app.get('/api/health', (c) => {
  return c.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
    },
  });
});

// Mount routes
app.route('/api', routes);

// Export app for Cloudflare Workers
export default app;
export { CheckInCoordinator };
