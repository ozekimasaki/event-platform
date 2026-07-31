import React, { useState } from 'react';
import { loadStripe, type StripeElementsOptions } from '@stripe/stripe-js';
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';

// ============================================
// TYPES
// ============================================

interface StripePaymentProps {
  clientSecret: string;
  amount: number;
  currency: string;
  publishableKey: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

// ============================================
// CARD FORM (inner component using Elements)
// ============================================

interface CardFormProps {
  clientSecret: string;
  amount: number;
  currency: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

const CardForm: React.FC<CardFormProps> = ({
  clientSecret,
  amount,
  currency,
  onSuccess,
  onError,
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    const { error } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: {
        card: elements.getElement(CardElement)!,
      },
    });

    if (error) {
      setErrorMessage(error.message ?? 'Payment failed');
      onError?.(error.message ?? 'Payment failed');
    } else {
      onSuccess?.();
    }

    setIsProcessing(false);
  };

  const formatAmount = (amt: number, cur: string): string => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: cur.toUpperCase(),
    }).format(amt / 100);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="text-sm text-text-secondary mb-1">
        支払金額: <span className="font-semibold text-text-primary">{formatAmount(amount, currency)}</span>
      </div>

      <div
        className="p-3 border rounded-sm bg-surface-base"
        style={{ borderColor: 'var(--color-border-default)' }}
      >
        <CardElement
          options={{
            style: {
              base: {
                fontSize: '16px',
                color: 'var(--color-text-primary)',
                '::placeholder': {
                  color: 'var(--color-text-secondary)',
                },
              },
              invalid: {
                color: 'var(--color-danger)',
              },
            },
          }}
        />
      </div>

      {errorMessage && (
        <p className="text-sm text-danger" role="alert">
          {errorMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={isProcessing}
        className="w-full px-4 py-3 text-base font-medium text-white bg-accent-blue rounded-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
      >
        {isProcessing ? '処理中...' : '支払う'}
      </button>
    </form>
  );
};

// ============================================
// STRIPE PAYMENT WRAPPER
// ============================================

const StripePayment: React.FC<StripePaymentProps> = ({
  clientSecret,
  amount,
  currency,
  publishableKey,
  onSuccess,
  onError,
}) => {
  const stripePromise = loadStripe(publishableKey);

  const options: StripeElementsOptions = {
    clientSecret,
  };

  return (
    <Elements stripe={stripePromise} options={options}>
      <CardForm
        clientSecret={clientSecret}
        amount={amount}
        currency={currency}
        onSuccess={onSuccess}
        onError={onError}
      />
    </Elements>
  );
};

export default StripePayment;
