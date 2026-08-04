import { useEffect, useMemo, useRef, useState } from 'react';
import client from '../api/client';
import { normalizeSkills } from '../utils/skills';
import ReportModal from '../components/ReportModal';

const formatDateTime = (value) => {
  if (!value) {
    return 'TBD';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const formatCredits = (value) => {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) {
    return '0 CREDITS';
  }
  return `${amount.toFixed(2)} CREDITS`;
};



/**
 * Load the Razorpay checkout script dynamically.
 */
function loadRazorpayScript() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve(window.Razorpay);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.Razorpay) {
        resolve(window.Razorpay);
      } else {
        reject(new Error('Razorpay SDK failed to load'));
      }
    };
    script.onerror = () => reject(new Error('Failed to load Razorpay script'));
    document.body.appendChild(script);
  });
}

export default function BookingFlowPage({ sessionId, onBookingComplete, onCancel, bookingData, notify }) {
  const [step, setStep] = useState(1);
  const [session, setSession] = useState(null);
  const [, setAvailability] = useState([]);
  const [wallet, setWallet] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [loadingWallet, setLoadingWallet] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingSuccessMessage, setBookingSuccessMessage] = useState('');
  const [bookingError, setBookingError] = useState('');
  const [createdBookingId, setCreatedBookingId] = useState(null);
  const [createdPayment, setCreatedPayment] = useState(null);
  const [showReport, setShowReport] = useState(false);
  const razorpayLoadedRef = useRef(false);

  const mentorSkills = useMemo(
    () => normalizeSkills(session?.mentor?.skills, { limit: 8 }),
    [session?.mentor?.skills],
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoadingSession(true);
      setBookingError('');

      try {
        const response = await client.get(`/api/v1/sessions/${sessionId}`);
        const selected = response?.data?.data;

        if (!selected) {
          throw new Error('Session not found');
        }

        if (cancelled) {
          return;
        }

        setSession(selected);

        try {
          const availabilityResponse = await client.get(`/api/v1/users/${selected.mentor?.id}/availability`);
          if (!cancelled) {
            const slots = availabilityResponse?.data?.data || availabilityResponse?.data || [];
            setAvailability(Array.isArray(slots) ? slots : []);
          }
        } catch {
          if (!cancelled) {
            setAvailability([]);
          }
        }
      } catch (error) {
        if (!cancelled) {
          setBookingError(error?.response?.data?.data?.error || error?.message || 'Unable to load session details.');
        }
      } finally {
        if (!cancelled) {
          setLoadingSession(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const loadWalletBalance = async () => {
    setLoadingWallet(true);
    setBookingError('');
    try {
      const response = await client.get('/api/v1/wallet/balance');
      setWallet(response?.data?.data || response?.data || null);
    } catch (error) {
      setBookingError(error?.response?.data?.data?.error || 'Unable to load wallet balance.');
    } finally {
      setLoadingWallet(false);
    }
  };

  const handleNextToPayment = async () => {
    setStep(2);
    await loadWalletBalance();
  };

  const handleConfirmBooking = async () => {
    if (!session?.id) {
      return;
    }

    setStep(3);
    setBookingLoading(true);
    setBookingError('');

    try {
      // Step 1: Create the booking with user's selected date/time/duration
      const bookingPayload = {
        sessionId: session.id,
        ...(bookingData?.date && { preferredDate: bookingData.date }),
        ...(bookingData?.slot && { preferredTime: bookingData.slot }),
        ...(bookingData?.duration && { preferredDuration: Number(bookingData.duration) }),
      };
      const bookingResponse = await client.post('/api/v1/bookings', bookingPayload);
      const newBooking = bookingResponse?.data?.data;
      const bookingId = newBooking?.id;

      if (!bookingId) {
        throw new Error('Booking creation failed - no booking ID returned');
      }

      setCreatedBookingId(bookingId);
      const displayDate = bookingData?.date ? new Date(bookingData.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : formatDateTime(session?.startTime);
      setBookingSuccessMessage(
        `Booking confirmed for ${displayDate} at ${bookingData?.slot || formatDateTime(session?.startTime)}!`,
      );

      // Step 2: Create a payment order via the selected gateway (default: wallet/razorpay)
      const priceAmount = Number(session?.priceAmount || 0);
      if (priceAmount > 0) {
        try {
          const idempotencyKey = `booking_${bookingId}`;
          const paymentResponse = await client.post('/api/v1/payments/intent', {
            bookingId,
            amount: priceAmount,
            gateway: 'razorpay',
          }, {
            headers: { 'Idempotency-Key': idempotencyKey },
          });
          const payment = paymentResponse?.data?.data;
          if (payment) {
            setCreatedPayment(payment);

            // Step 3: Initiate Razorpay checkout if the gateway response has order details
            if (payment.gateway === 'razorpay' && payment.gatewayResponse?.id) {
              await initiateRazorpayCheckout(payment);
            }
          }
        } catch (paymentError) {
          const errDetail = paymentError?.response?.data?.data?.message || paymentError?.response?.data?.data?.error || paymentError?.response?.data?.message || paymentError?.message || 'Payment order creation failed';
          console.warn('[Payment] Order creation failed:', paymentError?.message);
          // Distinguish timeout errors (payment may have succeeded on gateway)
          if (paymentError?.message?.includes('timeout') || paymentError?.code === 'ECONNABORTED') {
            setBookingError('Payment is taking longer than expected. Your payment may have already been processed — please check your payment status before retrying.');
          } else {
            setBookingError(errDetail);
          }
        }
      }
    } catch (error) {
      const backendError = error?.response?.data?.data?.error || error?.message || 'Booking failed.';
      setBookingError(backendError);
      // Stay on step 2 if booking creation failed
      setStep(2);
    } finally {
      setBookingLoading(false);
    }
  };

  /**
   * Check the status of the last payment attempt to avoid double charges.
   */
  const checkPaymentStatus = async () => {
    if (!createdPayment?.id && !createdBookingId) return;
    setBookingLoading(true);
    setBookingError('');
    try {
      // Query the backend for the payment status by booking or payment ID
      const paymentId = createdPayment?.id;
      const resp = paymentId
        ? await client.get(`/api/v1/payments/${paymentId}`)
        : await client.get(`/api/v1/bookings/${createdBookingId}`);
      const result = resp?.data?.data;
      // When querying via booking endpoint, payment is nested under result.payment
      const payStatus = paymentId ? result?.status : result?.payment?.status;
      if (payStatus === 'ESCROWED' || payStatus === 'COMPLETED' || result?.paymentStatus === 'COMPLETED') {
        setBookingSuccessMessage(
          `Payment already confirmed! Your session with ${session?.mentor?.fullName || 'your mentor'} is all set.`,
        );
      } else if (payStatus === 'INITIATED' || payStatus === 'PENDING') {
        setBookingError('Payment is still being processed. You can retry or wait a moment and check again.');
      } else if (payStatus === 'FAILED' || result?.paymentStatus === 'FAILED') {
        setBookingError('Payment failed on the gateway. You can safely retry the payment below.');
      } else {
        setBookingError('No payment found for this booking. You can safely retry.');
      }
    } catch (checkError) {
      setBookingError('Could not check payment status. You can retry or contact support.');
    } finally {
      setBookingLoading(false);
    }
  };

  /**
   * Retry payment - creates a new payment intent for the existing booking.
   */
  const handleRetryPayment = async () => {
    if (!createdBookingId) return;
    setBookingLoading(true);
    setBookingError('');
    try {
      const priceAmount = Number(session?.priceAmount || 0);
      const idempotencyKey = `retry_${createdBookingId}_${Date.now()}`;
      const paymentResponse = await client.post('/api/v1/payments/intent', {
        bookingId: createdBookingId,
        amount: priceAmount,
        gateway: 'razorpay',
      }, {
        headers: { 'Idempotency-Key': idempotencyKey },
      });
      const payment = paymentResponse?.data?.data;
      if (payment) {
        setCreatedPayment(payment);
        if (payment.gateway === 'razorpay' && payment.gatewayResponse?.id) {
          await initiateRazorpayCheckout(payment);
        }
      }
    } catch (retryError) {
      const msg = retryError?.response?.data?.data?.message || retryError?.response?.data?.message || 'Retry failed. Please contact support.';
      setBookingError(msg);
    } finally {
      setBookingLoading(false);
    }
  };

  /**
   * Initiate Razorpay checkout modal.
   */
  const initiateRazorpayCheckout = async (payment) => {
    try {
      // Fail closed: never open checkout with a placeholder/test key.
      const razorpayKeyId = import.meta.env.VITE_RAZORPAY_KEY_ID || '';
      if (!razorpayKeyId || razorpayKeyId === 'rzp_test_xxxxxxxxxxxx') {
        setBookingError('Online payments are not configured yet. Please try again later or contact support.');
        return;
      }

      await loadRazorpayScript();
      razorpayLoadedRef.current = true;

      const razorpayOrderId = payment.gatewayResponse?.id;
      const amountPaise = payment.gatewayResponse?.amount || Number(payment.amount) * 100;

      const options = {
        key: razorpayKeyId,
        amount: amountPaise,
        currency: payment.gatewayResponse?.currency || 'INR',
        name: 'Skill Swapper',
        description: `Payment for ${session?.title || 'session'} with ${session?.mentor?.fullName || 'mentor'}`,
        order_id: razorpayOrderId,
        prefill: {
          name: session?.mentor?.fullName || '',
          contact: '',
          email: '',
        },
        theme: {
          color: '#0f766e',
        },
        handler: async (response) => {
          // Payment was successful - verify on the backend
          try {
            await client.post('/api/v1/payments/verify', {
              paymentId: payment.id,
              gatewayPaymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
              extraParams: {
                razorpay_order_id: response.razorpay_order_id,
              },
            });
            setBookingSuccessMessage(
              `Payment successful! Your session with ${session?.mentor?.fullName || 'your mentor'} is confirmed.`,
            );
          } catch (verifyError) {
            console.warn('Payment verification error:', verifyError?.response?.data || verifyError.message);
            setBookingSuccessMessage(
              `Booking confirmed! Payment verification pending. Your session is scheduled for ${formatDateTime(session?.startTime)}.`,
            );
          }
        },
        modal: {
          ondismiss: () => {
            // Razorpay modal dismissed by user
          },
          confirm_close: true,
        },
      };

      const rzp = new window.Razorpay(options);

      rzp.on('payment.failed', (response) => {
        setBookingError(response.error?.description || 'Payment failed. Please try again.');
      });

      rzp.open();
    } catch (error) {
      // Payment UI failed, but booking was already created
    }
  };

  const stepIndicator = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
      {[
        { id: 1, label: '1 Details' },
        { id: 2, label: '2 Payment' },
        { id: 3, label: '3 Done' },
      ].map((item, index) => {
        const completed = step > item.id;
        const current = step === item.id;
        return (
          <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                border: `2px solid ${current || completed ? 'var(--accent)' : 'var(--line)'}`,
                background: current || completed ? 'var(--accent)' : 'transparent',
                color: current || completed ? '#fff' : 'var(--muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              {completed ? '✓' : item.id}
            </div>
            <span style={{ color: current ? 'var(--text)' : 'var(--muted)', fontWeight: current ? 700 : 600, fontSize: 13 }}>
              {item.label}
            </span>
            {index < 2 && <span style={{ color: 'var(--muted)' }}>→</span>}
          </div>
        );
      })}
    </div>
  );

  const sessionPrice = Number(session?.priceAmount || 0);
  const platformFee = Number((sessionPrice * 0.1).toFixed(2));
  const total = Number((sessionPrice + platformFee).toFixed(2));
  const walletBalance = Number(wallet?.balance || 0);
  const hasSufficientBalance = walletBalance >= sessionPrice;

  return (
    <div
      style={{
        padding: 24,
        maxWidth: 820,
        margin: '20px auto',
        background: 'var(--panel)',
        border: '1px solid var(--line)',
        borderRadius: 16,
        boxShadow: '0 10px 28px rgba(15, 23, 42, 0.08)',
      }}
    >
      {stepIndicator}

      {loadingSession ? (
        <p>Loading session details...</p>
      ) : bookingError && step === 1 ? (
        <p style={{ color: 'var(--error)' }}>{bookingError}</p>
      ) : null}

      {step === 1 && session && (
        <div>
          <h2 style={{ marginTop: 0 }}>Review Your Booking</h2>
          <div style={{ border: '1px solid var(--line)', borderRadius: 14, padding: 16, background: 'var(--card-bg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              {session?.mentor?.profileImageUrl ? (
                <img src={session.mentor.profileImageUrl} alt={session?.mentor?.fullName || 'Mentor'} style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'var(--accent-soft)', display: 'grid', placeItems: 'center', fontWeight: 700 }}>
                  {String(session?.mentor?.fullName || 'M').charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <div style={{ fontWeight: 700 }}>{session?.mentor?.fullName || 'Mentor'}</div>
                <div style={{ color: 'var(--muted)', fontSize: 13 }}>{session.sessionType || '1:1 Mentoring'}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {bookingData?.date && (
                <div style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--bg)' }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>DATE</div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{new Date(bookingData.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</div>
                </div>
              )}
              {bookingData?.slot && (
                <div style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--bg)' }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>TIME</div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{bookingData.slot}</div>
                </div>
              )}
              {bookingData?.duration && (
                <div style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--bg)' }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>DURATION</div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{bookingData.duration} min</div>
                </div>
              )}
              <div style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--bg)' }}>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>PRICE</div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{formatCredits(session.priceAmount)}</div>
              </div>
            </div>

            {bookingData?.date && (
              <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 8, background: 'var(--accent-soft, rgba(15,157,138,0.06))', fontSize: 12, color: 'var(--muted)' }}>
                <span style={{ fontWeight: 700, color: 'var(--text)' }}>Session:</span> {session.title || 'Mentoring Session'} with {session?.mentor?.fullName || 'mentor'}
              </div>
            )}

            {mentorSkills.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                {mentorSkills.map((skill) => (
                  <span key={skill} style={{ border: '1px solid var(--line)', borderRadius: 999, padding: '3px 8px', fontSize: 11, color: 'var(--muted)', background: 'var(--bg)' }}>{skill}</span>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 18 }}>
            <button type="button" onClick={onCancel} style={{ border: '1px solid var(--line)', background: 'var(--card-bg, #fff)', padding: '10px 14px', borderRadius: 10 }}>
              Cancel
            </button>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => setShowReport(true)}
                style={{ border: '1px solid rgba(220,38,38,0.35)', background: 'rgba(220,38,38,0.05)', color: '#dc2626', padding: '10px 14px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
              >
                ⚑ Report session
              </button>
              <button type="button" onClick={handleNextToPayment} style={{ background: 'var(--accent)', color: 'var(--button-text, #fff)', border: 'none', padding: '10px 14px', borderRadius: 10 }}>
                Next: Confirm payment →
              </button>
            </div>
          </div>
        </div>
      )}

      {showReport && session && (
        <ReportModal
          targetType="SESSION"
          targetId={session.id}
          targetLabel={session.title}
          onClose={() => setShowReport(false)}
          notify={notify}
        />
      )}

      {step === 2 && session && (
        <div>
          <h2 style={{ marginTop: 0 }}>Confirm Payment</h2>
          <div style={{ border: '1px solid var(--line)', borderRadius: 14, padding: 16, background: 'var(--card-bg)' }}>
            <h3 style={{ margin: '0 0 10px 0' }}>{session.title}</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span>Session price</span>
              <strong>{formatCredits(sessionPrice)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, color: 'var(--muted)' }}>
              <span>Platform fee (10%)</span>
              <span>{formatCredits(platformFee)}</span>
            </div>
            <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '10px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <strong>Total</strong>
              <strong>{formatCredits(total)}</strong>
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <p style={{ margin: 0 }}>
              Current wallet balance: <strong>{loadingWallet ? 'Loading...' : formatCredits(walletBalance)}</strong>
            </p>
            {!loadingWallet && hasSufficientBalance ? (
              <p style={{ color: 'var(--success, #16a34a)', marginTop: 8 }}>✓ Sufficient balance</p>
            ) : null}
            {!loadingWallet && !hasSufficientBalance ? (
              <p style={{ color: 'var(--error)', marginTop: 8 }}>
                ✗ Insufficient balance — you can still pay via Razorpay (card/UPI/net banking).
              </p>
            ) : null}
            {bookingError ? <p style={{ color: 'var(--error)', marginTop: 8 }}>{bookingError}</p> : null}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 18 }}>
            <button
              type="button"
              onClick={() => setStep(1)}
              style={{ border: '1px solid var(--line)', background: 'var(--card-bg, #fff)', padding: '10px 14px', borderRadius: 10 }}
            >
              ← Back
            </button>
            <button
              type="button"
              disabled={loadingWallet}
              onClick={handleConfirmBooking}
              style={{
                background: 'var(--accent)',
                color: 'var(--button-text, #fff)',
                border: 'none',
                padding: '10px 14px',
                borderRadius: 10,
                cursor: 'pointer',
              }}
            >
              Confirm &amp; Pay
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <h2 style={{ marginTop: 0 }}>Booking Status</h2>
          {bookingLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="material-symbols-outlined" style={{ animation: 'spin 1s linear infinite' }}>progress_activity</span>
              <span>Processing your booking...</span>
            </div>
          ) : bookingSuccessMessage ? (
            <div style={{ border: '1px solid var(--success-border, #86efac)', borderRadius: 14, background: 'var(--success-bg, #f0fdf4)', padding: 16 }}>
              <p style={{ color: 'var(--success-text, #166534)', marginTop: 0 }}>{bookingSuccessMessage}</p>
              <button
                type="button"
                onClick={() => onBookingComplete?.({ bookingId: createdBookingId, mentorName: session?.mentor?.fullName, date: bookingData?.date, time: bookingData?.slot, duration: bookingData?.duration })}
                style={{ background: 'var(--accent)', color: 'var(--button-text, #fff)', border: 'none', padding: '10px 14px', borderRadius: 10 }}
              >
                Go to My Sessions →
              </button>
            </div>
          ) : (
            <div style={{ border: '1px solid var(--error-border, #fecaca)', borderRadius: 14, background: 'var(--error-bg, #fff1f2)', padding: 16 }}>
              <p style={{ color: 'var(--error)', marginTop: 0, marginBottom: 6 }}>{bookingError || 'Booking failed. Please try again.'}</p>

              {/* Payment retry actions row */}
              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={checkPaymentStatus}
                  disabled={bookingLoading}
                  style={{
                    border: '1px solid var(--line)',
                    background: 'var(--card-bg, #fff)',
                    padding: '8px 14px',
                    borderRadius: 10,
                    cursor: 'pointer',
                    fontSize: 13,
                  }}
                >
                  ✓ Check Payment Status
                </button>
                <button
                  type="button"
                  onClick={handleRetryPayment}
                  disabled={bookingLoading}
                  style={{
                    background: 'var(--accent)',
                    color: 'var(--button-text, #fff)',
                    border: 'none',
                    padding: '8px 14px',
                    borderRadius: 10,
                    cursor: 'pointer',
                    fontSize: 13,
                  }}
                >
                  ⟳ Retry Payment
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStep(2);
                    setBookingError('');
                  }}
                  style={{
                    border: '1px solid var(--line)',
                    background: 'var(--card-bg, #fff)',
                    padding: '8px 14px',
                    borderRadius: 10,
                    cursor: 'pointer',
                    fontSize: 13,
                  }}
                >
                  ← Go Back
                </button>
              </div>

              <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 12, marginBottom: 0 }}>
                Tip: Use "Check Payment Status" first to avoid duplicate charges. If the payment already went through, you won't need to retry.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
