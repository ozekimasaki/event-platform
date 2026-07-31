import { describe, it, expect } from 'vitest';
import { paymentIntentSchema } from './payment.js';
import { registrationSchema } from './registration.js';

describe('paymentIntentSchema', () => {
  it('should accept valid input', () => {
    const input = {
      registration_id: '550e8400-e29b-41d4-a716-446655440000',
      amount: 5000,
      currency: 'jpy',
    };

    const result = paymentIntentSchema.parse(input);
    expect(result.registration_id).toBe(input.registration_id);
    expect(result.amount).toBe(5000);
    expect(result.currency).toBe('jpy');
  });

  it('should apply default currency when omitted', () => {
    const input = {
      registration_id: '550e8400-e29b-41d4-a716-446655440000',
      amount: 1000,
    };

    const result = paymentIntentSchema.parse(input);
    expect(result.currency).toBe('usd');
  });

  it('should reject invalid UUID for registration_id (negative case)', () => {
    const input = {
      registration_id: 'not-a-uuid',
      amount: 5000,
      currency: 'usd',
    };

    expect(() => paymentIntentSchema.parse(input)).toThrow();
  });

  it('should reject negative amount (negative case)', () => {
    const input = {
      registration_id: '550e8400-e29b-41d4-a716-446655440000',
      amount: -100,
      currency: 'usd',
    };

    expect(() => paymentIntentSchema.parse(input)).toThrow();
  });

  it('should reject non-integer amount (negative case)', () => {
    const input = {
      registration_id: '550e8400-e29b-41d4-a716-446655440000',
      amount: 99.5,
      currency: 'usd',
    };

    expect(() => paymentIntentSchema.parse(input)).toThrow();
  });

  it('should reject currency with wrong length (negative case)', () => {
    const input = {
      registration_id: '550e8400-e29b-41d4-a716-446655440000',
      amount: 1000,
      currency: 'us',
    };

    expect(() => paymentIntentSchema.parse(input)).toThrow();
  });
});

describe('registrationSchema', () => {
  it('should accept valid input with all fields', () => {
    const input = {
      ticket_id: '550e8400-e29b-41d4-a716-446655440000',
      custom_fields: { dietary: 'vegetarian', tshirt: 'L' },
    };

    const result = registrationSchema.parse(input);
    expect(result.ticket_id).toBe(input.ticket_id);
    expect(result.custom_fields).toEqual(input.custom_fields);
  });

  it('should accept empty object (all fields optional)', () => {
    const result = registrationSchema.parse({});
    expect(result.ticket_id).toBeUndefined();
    expect(result.custom_fields).toBeUndefined();
  });

  it('should reject invalid UUID for ticket_id (negative case)', () => {
    const input = {
      ticket_id: 'invalid-uuid-format',
    };

    expect(() => registrationSchema.parse(input)).toThrow();
  });
});
