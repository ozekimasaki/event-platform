import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPaymentRecord, getEventPayments } from './payments.js';

// Mock Stripe module (not used directly in these tests but imported by the module)
vi.mock('stripe', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      paymentIntents: { create: vi.fn() },
      webhooks: { constructEvent: vi.fn() },
    })),
  };
});

const createMockSupabase = () => {
  const chain: Record<string, any> = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.select = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn();
  chain.order = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  return chain;
};

describe('createPaymentRecord', () => {
  it('should create a payment record and return it', async () => {
    const mockPayment = {
      id: 'pay-123',
      registration_id: 'reg-123',
      amount: 5000,
      currency: 'usd',
      status: 'pending',
      payment_method: 'stripe',
      stripe_payment_intent_id: 'pi_123',
    };

    const supabase = createMockSupabase();
    supabase.single.mockResolvedValue({ data: mockPayment, error: null });

    const result = await createPaymentRecord(
      {
        registration_id: 'reg-123',
        amount: 5000,
        currency: 'usd',
        stripe_payment_intent_id: 'pi_123',
      },
      supabase as any
    );

    expect(result).toEqual(mockPayment);
    expect(supabase.from).toHaveBeenCalledWith('payments');
    expect(supabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        registration_id: 'reg-123',
        amount: 5000,
        status: 'pending',
      })
    );
  });

  it('should throw when supabase returns an error (negative case)', async () => {
    const supabase = createMockSupabase();
    supabase.single.mockResolvedValue({
      data: null,
      error: { message: 'duplicate key value violates unique constraint' },
    });

    await expect(
      createPaymentRecord(
        {
          registration_id: 'reg-123',
          amount: 5000,
          currency: 'usd',
          stripe_payment_intent_id: 'pi_dup',
        },
        supabase as any
      )
    ).rejects.toThrow('Failed to create payment record');
  });
});

describe('getEventPayments', () => {
  it('should return payments filtered by event_id via registration', async () => {
    const rows = [
      { id: 'p1', amount: 1000, registration: { event_id: 'evt-1' } },
      { id: 'p2', amount: 2000, registration: { event_id: 'evt-2' } },
      { id: 'p3', amount: 3000, registration: { event_id: 'evt-1' } },
    ];

    const supabase = createMockSupabase();
    // order() returns the chain, and the final await resolves via thenable
    supabase.order.mockResolvedValue({ data: rows, error: null });

    const result = await getEventPayments('evt-1', supabase as any);

    expect(result).toHaveLength(2);
    expect(result.map((r: any) => r.id)).toEqual(['p1', 'p3']);
  });

  it('should throw when supabase returns an error (negative case)', async () => {
    const supabase = createMockSupabase();
    supabase.order.mockResolvedValue({
      data: null,
      error: { message: 'relation does not exist' },
    });

    await expect(getEventPayments('evt-1', supabase as any)).rejects.toThrow(
      'Failed to get payments'
    );
  });
});
