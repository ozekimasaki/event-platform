import { describe, it, expect, vi } from 'vitest';
import {
  createEvent,
  getEventBySlug,
  getEventById,
  updateEvent,
  deleteEvent,
  listEvents,
  listEventsByOrganizer,
  generateSlug,
  checkSlugAvailability,
} from './events.js';

const createMockSupabase = () => {
  const chain: Record<string, any> = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.select = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.neq = vi.fn().mockReturnValue(chain);
  chain.or = vi.fn().mockReturnValue(chain);
  chain.contains = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.range = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn();
  chain.maybeSingle = vi.fn();
  return chain;
};

// ============================================
// generateSlug
// ============================================

describe('generateSlug', () => {
  it('should generate a slug from an English title', () => {
    const slug = generateSlug('My Cool Event');
    expect(slug).toBe('my-cool-event');
  });

  it('should trim and lowercase', () => {
    const slug = generateSlug('  HELLO World  ');
    expect(slug).toBe('hello-world');
  });

  it('should use timestamp fallback for Japanese-only titles', () => {
    const slug = generateSlug('東京カンファレンス');
    expect(slug).toMatch(/^event-/);
  });
});

// ============================================
// createEvent
// ============================================

describe('createEvent', () => {
  it('should create an event with generated slug', async () => {
    const mockEvent = {
      id: 'evt-1',
      title: 'Test Event',
      slug: 'test-event',
      status: 'draft',
      organizer_id: 'user-1',
    };

    const supabase = createMockSupabase();
    // maybeSingle for slug uniqueness check → no existing
    supabase.maybeSingle.mockResolvedValue({ data: null, error: null });
    // single for insert result
    supabase.single.mockResolvedValue({ data: mockEvent, error: null });

    const result = await createEvent(
      {
        title: 'Test Event',
        description: 'A test event',
        start_at: '2026-08-01T10:00:00Z',
        end_at: '2026-08-01T18:00:00Z',
        pricing_type: 'free',
      },
      'user-1',
      supabase as any
    );

    expect(result).toEqual(mockEvent);
    expect(supabase.from).toHaveBeenCalledWith('events');
    expect(supabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Test Event',
        slug: 'test-event',
        organizer_id: 'user-1',
        status: 'draft',
      })
    );
  });

  it('should append timestamp when slug already exists', async () => {
    const mockEvent = {
      id: 'evt-2',
      title: 'Test Event',
      slug: 'test-event-abc123',
      status: 'draft',
      organizer_id: 'user-1',
    };

    const supabase = createMockSupabase();
    // Slug already taken
    supabase.maybeSingle.mockResolvedValue({ data: { id: 'existing' }, error: null });
    supabase.single.mockResolvedValue({ data: mockEvent, error: null });

    const result = await createEvent(
      {
        title: 'Test Event',
        description: 'desc',
        start_at: '2026-08-01T10:00:00Z',
        end_at: '2026-08-01T18:00:00Z',
        pricing_type: 'free',
      },
      'user-1',
      supabase as any
    );

    expect(result.slug).toMatch(/^test-event-/);
  });

  it('should throw when insert fails', async () => {
    const supabase = createMockSupabase();
    supabase.maybeSingle.mockResolvedValue({ data: null, error: null });
    supabase.single.mockResolvedValue({
      data: null,
      error: { message: 'constraint violation' },
    });

    await expect(
      createEvent(
        {
          title: 'Fail Event',
          description: 'desc',
          start_at: '2026-08-01T10:00:00Z',
          end_at: '2026-08-01T18:00:00Z',
          pricing_type: 'free',
        },
        'user-1',
        supabase as any
      )
    ).rejects.toThrow('Failed to create event');
  });
});

// ============================================
// getEventBySlug
// ============================================

describe('getEventBySlug', () => {
  it('should return an event when found', async () => {
    const mockEvent = { id: 'evt-1', slug: 'my-event', title: 'My Event' };
    const supabase = createMockSupabase();
    supabase.single.mockResolvedValue({ data: mockEvent, error: null });

    const result = await getEventBySlug('my-event', supabase as any);
    expect(result).toEqual(mockEvent);
  });

  it('should return null when event not found (PGRST116)', async () => {
    const supabase = createMockSupabase();
    supabase.single.mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'Not found' },
    });

    const result = await getEventBySlug('nonexistent', supabase as any);
    expect(result).toBeNull();
  });

  it('should throw on unexpected errors', async () => {
    const supabase = createMockSupabase();
    supabase.single.mockResolvedValue({
      data: null,
      error: { code: '500', message: 'Internal error' },
    });

    await expect(getEventBySlug('x', supabase as any)).rejects.toThrow('Failed to get event');
  });
});

// ============================================
// getEventById
// ============================================

describe('getEventById', () => {
  it('should return an event when found', async () => {
    const mockEvent = { id: 'evt-1', title: 'Event', organizer_id: 'user-1' };
    const supabase = createMockSupabase();
    supabase.single.mockResolvedValue({ data: mockEvent, error: null });

    const result = await getEventById('evt-1', supabase as any);
    expect(result).toEqual(mockEvent);
  });

  it('should return null when not found', async () => {
    const supabase = createMockSupabase();
    supabase.single.mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'Not found' },
    });

    const result = await getEventById('evt-x', supabase as any);
    expect(result).toBeNull();
  });
});

// ============================================
// updateEvent
// ============================================

describe('updateEvent', () => {
  it('should update an event when user is the organizer', async () => {
    const existingEvent = { id: 'evt-1', organizer_id: 'user-1', slug: 'old-slug' };
    const updatedEvent = { ...existingEvent, title: 'Updated Title' };

    const supabase = createMockSupabase();
    // getEventById call inside updateEvent
    supabase.single
      .mockResolvedValueOnce({ data: existingEvent, error: null }) // getEventById
      .mockResolvedValueOnce({ data: updatedEvent, error: null }); // update result

    const result = await updateEvent('evt-1', { title: 'Updated Title' }, 'user-1', supabase as any);
    expect(result.title).toBe('Updated Title');
  });

  it('should throw when event not found', async () => {
    const supabase = createMockSupabase();
    supabase.single.mockResolvedValue({ data: null, error: { code: 'PGRST116', message: 'Not found' } });

    await expect(
      updateEvent('evt-x', { title: 'X' }, 'user-1', supabase as any)
    ).rejects.toThrow('Event not found');
  });

  it('should throw when user is not the organizer', async () => {
    const existingEvent = { id: 'evt-1', organizer_id: 'user-1', slug: 'old-slug' };
    const supabase = createMockSupabase();
    supabase.single.mockResolvedValue({ data: existingEvent, error: null });

    await expect(
      updateEvent('evt-1', { title: 'X' }, 'user-2', supabase as any)
    ).rejects.toThrow('Unauthorized: not the event organizer');
  });

  it('should throw when new slug is already taken', async () => {
    const existingEvent = { id: 'evt-1', organizer_id: 'user-1', slug: 'old-slug' };
    const supabase = createMockSupabase();
    // getEventById
    supabase.single.mockResolvedValueOnce({ data: existingEvent, error: null });
    // slug uniqueness check
    supabase.maybeSingle.mockResolvedValue({ data: { id: 'other-event' }, error: null });

    await expect(
      updateEvent('evt-1', { slug: 'taken-slug' }, 'user-1', supabase as any)
    ).rejects.toThrow('Slug is already taken');
  });
});

// ============================================
// deleteEvent
// ============================================

describe('deleteEvent', () => {
  it('should soft-delete (set status to cancelled) when user is organizer', async () => {
    const existingEvent = { id: 'evt-1', organizer_id: 'user-1' };
    const supabase = createMockSupabase();
    // getEventById chains: from -> select -> eq -> single
    supabase.single.mockResolvedValue({ data: existingEvent, error: null });
    // deleteEvent chains: from -> update -> eq (no single/thenable needed, just needs to resolve)
    // Since eq returns the chain and the chain is thenable-like, we just need no error
    // The code does: const { error } = await supabase.from('events').update(...).eq('id', id);
    // eq returns the chain, and awaiting it resolves to the chain itself (not a promise)
    // We need eq to be awaitable and return { error: undefined }
    // Actually the code destructures { error } from the await result, so we need eq to return a resolved promise
    // But we also need single to work for getEventById. The trick: single is called first, then eq.
    // After single resolves, update().eq() is called. eq returns the chain.
    // The chain is then awaited. Since the chain is a plain object, awaiting it just returns the object.
    // So { error } = chain, and chain.error is undefined by default. This should work.

    await deleteEvent('evt-1', 'user-1', supabase as any);

    expect(supabase.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'cancelled' })
    );
  });

  it('should throw when event not found', async () => {
    const supabase = createMockSupabase();
    supabase.single.mockResolvedValue({ data: null, error: { code: 'PGRST116', message: 'Not found' } });

    await expect(deleteEvent('evt-x', 'user-1', supabase as any)).rejects.toThrow('Event not found');
  });

  it('should throw when user is not the organizer', async () => {
    const existingEvent = { id: 'evt-1', organizer_id: 'user-1' };
    const supabase = createMockSupabase();
    supabase.single.mockResolvedValue({ data: existingEvent, error: null });

    await expect(deleteEvent('evt-1', 'user-2', supabase as any)).rejects.toThrow(
      'Unauthorized: not the event organizer'
    );
  });
});

// ============================================
// listEvents
// ============================================

describe('listEvents', () => {
  it('should return paginated published events', async () => {
    const mockEvents = [
      { id: 'evt-1', title: 'Event 1', status: 'published' },
      { id: 'evt-2', title: 'Event 2', status: 'published' },
    ];

    const supabase = createMockSupabase();
    supabase.range.mockResolvedValue({ data: mockEvents, error: null, count: 2 });

    const result = await listEvents({ page: 1, limit: 10 }, supabase as any);

    expect(result.events).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.page).toBe(1);
    expect(result.total_pages).toBe(1);
  });

  it('should throw on database error', async () => {
    const supabase = createMockSupabase();
    supabase.range.mockResolvedValue({ data: null, error: { message: 'DB error' }, count: null });

    await expect(listEvents({ page: 1, limit: 10 }, supabase as any)).rejects.toThrow('Failed to list events');
  });
});

// ============================================
// listEventsByOrganizer
// ============================================

describe('listEventsByOrganizer', () => {
  it('should return events for a specific organizer', async () => {
    const mockEvents = [{ id: 'evt-1', title: 'My Event', organizer_id: 'user-1' }];
    const supabase = createMockSupabase();
    supabase.range.mockResolvedValue({ data: mockEvents, error: null, count: 1 });

    const result = await listEventsByOrganizer('user-1', { page: 1, limit: 10 }, supabase as any);

    expect(result.events).toHaveLength(1);
    expect(result.events[0].organizer_id).toBe('user-1');
  });
});

// ============================================
// checkSlugAvailability
// ============================================

describe('checkSlugAvailability', () => {
  it('should return available: true when slug is not taken', async () => {
    const supabase = createMockSupabase();
    supabase.maybeSingle.mockResolvedValue({ data: null, error: null });

    const result = await checkSlugAvailability('free-slug', supabase as any);
    expect(result.available).toBe(true);
  });

  it('should return available: false when slug is taken', async () => {
    const supabase = createMockSupabase();
    supabase.maybeSingle.mockResolvedValue({ data: { id: 'existing' }, error: null });

    const result = await checkSlugAvailability('taken-slug', supabase as any);
    expect(result.available).toBe(false);
  });
});
