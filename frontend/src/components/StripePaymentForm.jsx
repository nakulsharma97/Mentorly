import { useState } from 'react';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';

/**
 * Initialize Stripe.js once at module scope.
 * loadStripe is safe to call multiple times — it caches the instance.
 */
const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';
const stripePromise = stripePublishableKey && stripePublishableKey !== 'pk_test_xxxxxxxxxxxx'
  ? loadStripe(stripePublishableKey)
  : null;

const cardElementStyle = {
  style: {
    base: {
      fontSize: '14px',
      color: 'var(--ss-text, #1e293b)',
      fontFamily: 'inherit',
      '::placeholder': { color: 'var(--ss-text-muted, #94a3b8)' },
      padding: '10px 12px',
    },
    invalid: {
      color: '#ef4444',
      iconColor: '#ef4444',
    },
  },
};

/**
 * Inner form that uses useStripe / useElements hooks.
 * Must be rendered inside <Elements>.
 */
function StripeCardForm({ clientSecret, onPaymentSuccess, onPaymentError, disabled }) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!stripe || !elements || processing || disabled) return;

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      onPaymentError?.('Card element not found');
      return;
    }

    setProcessing(true);
    try {
      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card: cardElement },
      });

      if (error) {
        onPaymentError?.(error.message || 'Payment failed');
      } else if (paymentIntent?.status === 'succeeded') {
        onPaymentSuccess?.(paymentIntent);
      } else {
        onPaymentError?.(`Unexpected payment status: ${paymentIntent?.status}`);
      }
    } catch (err) {
      onPaymentError?.(err.message || 'Payment failed');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div
        style={{
          border: '1px solid var(--line, #e2e8f0)',
          borderRadius: 8,
          padding: '10px 12px',
          background: 'var(--card-bg, #fff)',
        }}
      >
        <CardElement options={cardElementStyle} />
      </div>
      <button
        type="submit"
        disabled={!stripe || processing || disabled}
        style={{
          background: 'var(--accent, #0f9d8a)',
          color: 'var(--button-text, #fff)',
          border: 'none',
          padding: '10px 14px',
          borderRadius: 10,
          cursor: processing ? 'wait' : 'pointer',
          fontWeight: 600,
          fontSize: 14,
          opacity: processing || disabled ? 0.7 : 1,
        }}
      >
        {processing ? 'Processing payment…' : 'Pay Now'}
      </button>
    </form>
  );
}

/**
 * Public wrapper that wraps the card form in <Elements>.
 *
 * @param {string} clientSecret - Stripe PaymentIntent client_secret
 * @param {function} onPaymentSuccess - called with the PaymentIntent object
 * @param {function} onPaymentError - called with error message string
 * @param {boolean} disabled - disable the form
 */
export default function StripePaymentForm({ clientSecret, onPaymentSuccess, onPaymentError, disabled }) {
  if (!stripePromise) {
    return (
      <div style={{ padding: 12, color: 'var(--error, #ef4444)', fontSize: 13 }}>
        Stripe is not configured. Please contact support.
      </div>
    );
  }

  if (!clientSecret) {
    return (
      <div style={{ padding: 12, color: 'var(--ss-text-muted, #94a3b8)', fontSize: 13 }}>
        Preparing payment…
      </div>
    );
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <StripeCardForm
        clientSecret={clientSecret}
        onPaymentSuccess={onPaymentSuccess}
        onPaymentError={onPaymentError}
        disabled={disabled}
      />
    </Elements>
  );
}
