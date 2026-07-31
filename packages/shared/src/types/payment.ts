// Payment Status
export type PaymentStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded';

// Payment
export interface Payment {
  id: string;
  registration_id: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  payment_method: string;
  stripe_payment_intent_id?: string;
  created_at: string;
  updated_at: string;
}

// Create Payment Input
export interface CreatePaymentInput {
  registration_id: string;
  amount: number;
  currency: string;
  payment_method: string;
}
