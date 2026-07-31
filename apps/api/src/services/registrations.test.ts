import { describe, it, expect, vi } from 'vitest';
import { registerForEvent, cancelRegistration } from './registrations.js';

const createMockSupabase = () => {
  const chain: Record<string, any> = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.select = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn();
  chain.maybeSingle = vi.fn();
  return chain;
};

describe('registerForEvent', () => {
  it('should register a user for a published event with capacity', async () => {
    const mockEvent = {
      id: 'evt-1',
      slug: 'test-event',
      status: 'published',
      capacity: 100,
    };
    const mockRegistration = {
      id: 'reg-1',
      event_id: 'evt-1',
      user_id: 'user-1',
      status: 'confirmed',
      qr_token: 'token-abc',
    };

    const supabase = createMockSupabase();
    // First call: get event by slug
    supabase.single
      .mockResolvedValueOnce({ data: mockEvent, error: null })
      // Third call: create registration
      .mockResolvedValueOnce({ data: mockRegistration, error: null });
    // Second call: count registrations (head: true returns count)
    supabase.in.mockResolvedValue({ data: null, count: 5, error: null });

    const result = await registerForEvent(
      'test-event',
      'user-1',
      {},
      supabase as any
    );

    expect(result.registration).toEqual(mockRegistration);
    expect(result.event).toEqual(mockEvent);
    expect(result.is_waitlisted).toBe(false);
  });

  it('should throw when event is not found (negative case)', async () => {
    const supabase = createMockSupabase();
    supabase.single.mockResolvedValue({
      data: null,
      error: { message: 'Not found', code: 'PGRST116' },
    });

    await expect(
      registerForEvent('nonexistent', 'user-1', {}, supabase as any)
    ).rejects.toThrow('Event not found');
  });

  it('should throw when event is not published (negative case)', async () => {
    const draftEvent = {
      id: 'evt-2',
      slug: 'draft-event',
      status: 'draft',
      capacity: 50,
    };

    const supabase = createMockSupabase();
    supabase.single.mockResolvedValue({ data: draftEvent, error: null });

    await expect(
      registerForEvent('draft-event', 'user-1', {}, supabase as any)
    ).rejects.toThrow('Event is not accepting registrations');
  });
});

describe('cancelRegistration', () => {
  it('should throw when user is not the owner (negative case)', async () => {
    const mockRegistration = {
      id: 'reg-1',
      user_id: 'owner-user',
      event_id: 'evt-1',
      status: 'confirmed',
    };

    const supabase = createMockSupabase();
    supabase.single.mockResolvedValue({ data: mockRegistration, error: null });

    await expect(
      cancelRegistration('reg-1', 'different-user', supabase as any)
    ).rejects.toThrow('Unauthorized: not the registration owner');
  });

  it('should throw when registration is already cancelled (negative case)', async () => {
    const mockRegistration = {
      id: 'reg-1',
      user_id: 'user-1',
      event_id: 'evt-1',
      status: 'cancelled',
    };

    const supabase = createMockSupabase();
    supabase.single.mockResolvedValue({ data: mockRegistration, error: null });

    await expect(
      cancelRegistration('reg-1', 'user-1', supabase as any)
    ).rejects.toThrow('Registration is already cancelled');
  });
});
