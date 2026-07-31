import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

// Mock the supabase client factory
vi.mock('../services/supabase.js', () => ({
  getSupabaseClient: vi.fn().mockReturnValue({}),
}));

// Mock service functions
vi.mock('../services/events.js', () => ({
  listEvents: vi.fn(),
  getEventBySlug: vi.fn(),
  getEventById: vi.fn(),
  createEvent: vi.fn(),
  updateEvent: vi.fn(),
  deleteEvent: vi.fn(),
  checkSlugAvailability: vi.fn(),
  listEventsByOrganizer: vi.fn(),
}));

// Mock shared schemas (pass-through)
vi.mock('@event-platform/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@event-platform/shared')>();
  return { ...actual };
});

import { events } from './events.js';
import {
  listEvents,
  getEventBySlug,
  createEvent,
  updateEvent,
  deleteEvent,
  checkSlugAvailability,
} from '../services/events.js';

const mocked = (fn: any) => fn as ReturnType<typeof vi.fn>;

// Helper: create a test app with optional auth user
const createApp = (user?: { id: string; email: string }) => {
  const app = new Hono();

  // Add auth middleware before routes
  if (user) {
    app.use('*', async (c, next) => {
      (c as any).set('user', user);
      (c as any).set('jwt', 'mock-jwt');
      await next();
    });
  }

  // Mount events router
  app.route('/api/events', events);
  return app;
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================
// GET /api/events - List events (public)
// ============================================

describe('GET /api/events', () => {
  it('should return a list of published events', async () => {
    const app = createApp();
    const mockEvents = [
      { id: 'evt-1', title: 'Event 1', status: 'published' },
      { id: 'evt-2', title: 'Event 2', status: 'published' },
    ];

    mocked(listEvents).mockResolvedValue({
      events: mockEvents,
      total: 2,
      page: 1,
      limit: 20,
      total_pages: 1,
    });

    const res = await app.request('/api/events');
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data).toHaveLength(2);
    expect(json.pagination.total).toBe(2);
  });

  it('should handle service errors gracefully', async () => {
    const app = createApp();
    mocked(listEvents).mockRejectedValue(new Error('DB error'));

    const res = await app.request('/api/events');
    expect(res.status).toBe(500);
  });
});

// ============================================
// GET /api/events/check-slug
// ============================================

describe('GET /api/events/check-slug', () => {
  it('should return availability for a slug', async () => {
    const app = createApp();
    mocked(checkSlugAvailability).mockResolvedValue({ available: true });

    const res = await app.request('/api/events/check-slug?slug=my-event');
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.available).toBe(true);
  });

  it('should return 400 when slug is missing', async () => {
    const app = createApp();

    const res = await app.request('/api/events/check-slug');
    expect(res.status).toBe(400);
  });
});

// ============================================
// GET /api/events/:slug - Get event detail
// ============================================

describe('GET /api/events/:slug', () => {
  it('should return an event when found', async () => {
    const app = createApp();
    const mockEvent = { id: 'evt-1', slug: 'my-event', title: 'My Event' };
    mocked(getEventBySlug).mockResolvedValue(mockEvent);

    const res = await app.request('/api/events/my-event');
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.title).toBe('My Event');
  });

  it('should return 404 when event not found', async () => {
    const app = createApp();
    mocked(getEventBySlug).mockResolvedValue(null);

    const res = await app.request('/api/events/nonexistent');
    expect(res.status).toBe(404);

    const json = await res.json();
    expect(json.success).toBe(false);
  });
});

// ============================================
// POST /api/events - Create event (auth required)
// ============================================

describe('POST /api/events', () => {
  it('should create an event and return 201', async () => {
    const app = createApp({ id: 'user-1', email: 'test@example.com' });

    const mockEvent = { id: 'evt-1', title: 'New Event', slug: 'new-event', status: 'draft' };
    mocked(createEvent).mockResolvedValue(mockEvent);

    const res = await app.request('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'New Event',
        description: 'A new event',
        start_at: '2026-08-01T10:00:00Z',
        end_at: '2026-08-01T18:00:00Z',
        pricing_type: 'free',
      }),
    });

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.title).toBe('New Event');
  });

  it('should return 401 when not authenticated', async () => {
    const app = createApp(); // No user

    const res = await app.request('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'New Event',
        description: 'desc',
        start_at: '2026-08-01T10:00:00Z',
        end_at: '2026-08-01T18:00:00Z',
        pricing_type: 'free',
      }),
    });

    expect(res.status).toBe(401);
  });
});

// ============================================
// PATCH /api/events/:id - Update event
// ============================================

describe('PATCH /api/events/:id', () => {
  it('should update an event', async () => {
    const app = createApp({ id: 'user-1', email: 'test@example.com' });

    const updatedEvent = { id: 'evt-1', title: 'Updated Title' };
    mocked(updateEvent).mockResolvedValue(updatedEvent);

    const res = await app.request('/api/events/evt-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Updated Title' }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.title).toBe('Updated Title');
  });

  it('should return 404 when event not found', async () => {
    const app = createApp({ id: 'user-1', email: 'test@example.com' });
    mocked(updateEvent).mockRejectedValue(new Error('Event not found'));

    const res = await app.request('/api/events/evt-x', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'X' }),
    });

    expect(res.status).toBe(404);
  });

  it('should return 403 when user is not the organizer', async () => {
    const app = createApp({ id: 'user-2', email: 'other@example.com' });
    mocked(updateEvent).mockRejectedValue(new Error('Unauthorized: not the event organizer'));

    const res = await app.request('/api/events/evt-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'X' }),
    });

    expect(res.status).toBe(403);
  });

  it('should return 401 when not authenticated', async () => {
    const app = createApp(); // No user

    const res = await app.request('/api/events/evt-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'X' }),
    });

    expect(res.status).toBe(401);
  });
});

// ============================================
// DELETE /api/events/:id - Delete event
// ============================================

describe('DELETE /api/events/:id', () => {
  it('should delete an event successfully', async () => {
    const app = createApp({ id: 'user-1', email: 'test@example.com' });
    mocked(deleteEvent).mockResolvedValue(undefined);

    const res = await app.request('/api/events/evt-1', {
      method: 'DELETE',
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it('should return 404 when event not found', async () => {
    const app = createApp({ id: 'user-1', email: 'test@example.com' });
    mocked(deleteEvent).mockRejectedValue(new Error('Event not found'));

    const res = await app.request('/api/events/evt-x', {
      method: 'DELETE',
    });

    expect(res.status).toBe(404);
  });

  it('should return 403 when not organizer', async () => {
    const app = createApp({ id: 'user-2', email: 'other@example.com' });
    mocked(deleteEvent).mockRejectedValue(new Error('Unauthorized: not the event organizer'));

    const res = await app.request('/api/events/evt-1', {
      method: 'DELETE',
    });

    expect(res.status).toBe(403);
  });

  it('should return 401 when not authenticated', async () => {
    const app = createApp(); // No user

    const res = await app.request('/api/events/evt-1', {
      method: 'DELETE',
    });

    expect(res.status).toBe(401);
  });
});
