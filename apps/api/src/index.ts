import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { routes } from './routes/index.js';
import { auth } from './routes/auth.js';
import { events } from './routes/events.js';
import { upload } from './routes/upload.js';
import { registrations } from './routes/registrations.js';
import { tickets } from './routes/tickets.js';
import { payments, handleStripeWebhookRoute, getEventPaymentsRoute } from './routes/payments.js';
import { checkin } from './routes/checkin.js';
import { support } from './routes/support.js';
import { faq } from './routes/faq.js';
import { chat } from './routes/chat.js';
import { articles } from './routes/articles.js';
import { publicApi } from './routes/public-api.js';
import { webhooks } from './routes/webhooks.js';
import { apiKeys } from './routes/api-keys.js';
import { search } from './routes/search.js';
import { community } from './routes/community.js';
import { eventSurveys, surveys } from './routes/surveys.js';
import { authMiddleware, optionalAuthMiddleware } from './middleware/auth.js';
import { CheckInCoordinator } from './durable-objects/check-in.js';
import { EventChatRoom } from './durable-objects/chat.js';
import type { Env } from './services/supabase.js';

// Create Hono app
const app = new Hono<{ Bindings: Env }>();

// CORS middleware
app.use('/*', cors({
  origin: ['http://localhost:4321', 'https://event-platform.pages.dev'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
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

// Event routes (public endpoints use optionalAuth, protected ones check inside)
app.use('/api/events/*', optionalAuthMiddleware);
app.route('/api/events', events);

// Stripe webhook (no auth — uses signature verification, must be before auth middleware)
app.post('/api/webhooks/stripe', handleStripeWebhookRoute);

// Registration routes (share optionalAuth with events)
app.route('/api', registrations);

// Ticket routes
app.route('/api', tickets);

// FAQ routes (public GET endpoints)
app.route('/api', faq);

// Chat history route (public)
app.route('/api', chat);

// Search routes (public)
app.route('/api/search', search);

// Article routes (public GET endpoints use optionalAuth, protected ones check inside)
app.use('/api/articles/*', optionalAuthMiddleware);
app.route('/api/articles', articles);

// Community routes (organizer profiles, followers, event series)
app.use('/api/organizers/*', optionalAuthMiddleware);
app.route('/api/organizers', community);
app.route('/api', community);

// Survey routes (event-scoped: GET is public, POST is auth-required checked inside)
app.use('/api/events/*', optionalAuthMiddleware);
app.route('/api/events', eventSurveys);

// Survey routes (survey-scoped: mixed public/auth)
app.use('/api/surveys/*', optionalAuthMiddleware);
app.route('/api/surveys', surveys);

// Support routes (mixed: some public FAQ, some auth-required tickets)
app.route('/api', support);

// Payment routes (auth required)
app.use('/api/payments/*', authMiddleware);
app.route('/api/payments', payments);

// Event payments (organizer only, auth required)
app.get('/api/events/:slug/payments', authMiddleware, getEventPaymentsRoute);

// Check-in routes (auth required — staff/organizer)
app.use('/api/events/:slug/check-in/*', authMiddleware);
app.use('/api/registrations/:id/qr-code', authMiddleware);
app.route('/api', checkin);

// WebSocket route for real-time check-in dashboard
app.get('/ws/event/:eventId/checkin', async (c) => {
  const eventId = c.req.param('eventId');
  if (!eventId) {
    return c.json({ success: false, error: { code: 'BAD_REQUEST', message: 'eventId required' } }, 400);
  }

  const doId = c.env.CHECK_IN_COORDINATOR.idFromName(eventId);
  const doStub = c.env.CHECK_IN_COORDINATOR.get(doId);

  // Forward the WebSocket upgrade request to the Durable Object
  const url = new URL(c.req.url);
  url.searchParams.set('eventId', eventId);
  return doStub.fetch(new Request(url.toString(), c.req.raw));
});

// WebSocket route for real-time event chat
app.get('/ws/event/:eventId/chat', async (c) => {
  const eventId = c.req.param('eventId');
  if (!eventId) {
    return c.json({ success: false, error: { code: 'BAD_REQUEST', message: 'eventId required' } }, 400);
  }

  const doId = c.env.EVENT_CHAT_ROOM.idFromName(eventId);
  const doStub = c.env.EVENT_CHAT_ROOM.get(doId);

  // Forward the WebSocket upgrade request to the Durable Object
  const url = new URL(c.req.url);
  return doStub.fetch(new Request(url.toString(), c.req.raw));
});

// Public API routes (no JWT auth — uses API key auth per-route)
app.route('/public/api', publicApi);

// Webhook management routes (auth checked per-route inside webhooks router)
app.route('/api/webhooks', webhooks);

// API key management routes (auth checked per-route)
app.route('/api/api-keys', apiKeys);

// Upload routes (require authentication)
app.use('/api/upload/*', authMiddleware);
app.route('/api/upload', upload);

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
export { CheckInCoordinator, EventChatRoom };
