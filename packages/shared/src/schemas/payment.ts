import { z } from 'zod';

export const paymentIntentSchema = z.object({
  registration_id: z.string().uuid(),
  amount: z.number().int().positive(),
  currency: z.string().length(3).default('usd'),
});

export type PaymentIntentInput = z.infer<typeof paymentIntentSchema>;
