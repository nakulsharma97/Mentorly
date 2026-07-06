import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';

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

const getDurationLabel = (startTime, endTime) => {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const diffMs = end.getTime() - start.getTime();
  if (Number.isNaN(diffMs) || diffMs <= 0) {
    return 'Duration unavailable';
  }
  const minutes = Math.round(diffMs / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours > 0 && remainingMinutes > 0) {
    return `${hours}h ${remainingMinutes}m`;
  }
  if (hours > 0) {
    return `${hours}h`;
  }
  return `${remainingMinutes}m`;
};

const parseSkills = (rawSkills) => {
  const text = String(rawSkills || '').trim();
  if (!text) {
    return [];
  }
  return [...new Set(text.split(/[\n,;|]+/).map((part) => part.trim()).filter(Boolean))].slice(0, 8);
};

export default function BookingFlowPage({ sessionId, onBookingComplete, onCancel }) {
  const [step, setStep] = useState(1);
  const [session, setSession] = useState(null);
  const [availability, setAvailability] = useState([]);
  const [wallet, setWallet] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [loadingWallet, setLoadingWallet] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingSuccessMessage, setBookingSuccessMessage] = useState('');
  const [bookingError, setBookingError] = useState('');

  const mentorSkills = useMemo(() => parseSkills(session?.mentor?.skills), [session?.mentor?.skills]);

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
      await client.post('/api/v1/bookings', { sessionId: session.id });
      setBookingSuccessMessage(
        `Booking confirmed! Your session with ${session?.mentor?.fullName || 'your mentor'} is scheduled for ${formatDateTime(session?.startTime)}.`,
      );
    } catch (error) {
      const backendError = error?.response?.data?.data?.error || error?.message || 'Booking failed.';
      setBookingError(backendError);
    } finally {
      setBookingLoading(false);
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
          <h2 style={{ marginTop: 0 }}>Review Session Details</h2>
          <div style={{ border: '1px solid var(--line)', borderRadius: 14, padding: 16, background: 'var(--card-bg)' }}>
            <h3 style={{ margin: '0 0 12px 0' }}>{session.title}</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              {session?.mentor?.profileImageUrl ? (
                <img src={session.mentor.profileImageUrl} alt={session?.mentor?.fullName || 'Mentor'} style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'var(--accent-soft)', display: 'grid', placeItems: 'center', fontWeight: 700 }}>
                  {String(session?.mentor?.fullName || 'M').charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <div style={{ fontWeight: 700 }}>{session?.mentor?.fullName || 'Mentor'}</div>
                <div style={{ color: 'var(--muted)', fontSize: 13 }}>{session.sessionType}</div>
              </div>
            </div>

            <p style={{ margin: '8px 0', color: 'var(--text)' }}>
              {formatDateTime(session.startTime)} to {formatDateTime(session.endTime)}
            </p>
            <p style={{ margin: '8px 0', color: 'var(--muted)' }}>Duration: {getDurationLabel(session.startTime, session.endTime)}</p>
            <p style={{ margin: '8px 0', color: 'var(--text)', fontWeight: 700 }}>Price: {formatCredits(session.priceAmount)}</p>

            {mentorSkills.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                {mentorSkills.map((skill) => (
                  <span
                    key={skill}
                    style={{
                      border: '1px solid var(--line)',
                      borderRadius: 999,
                      padding: '4px 10px',
                      fontSize: 12,
                      color: 'var(--muted)',
                      background: 'var(--bg)',
                    }}
                  >
                    {skill}
                  </span>
                ))}
              </div>
            )}

            {availability.length > 0 && (
              <p style={{ marginTop: 12, color: 'var(--muted)', fontSize: 13 }}>
                Mentor has {availability.filter((slot) => slot?.active).length} active availability slots.
              </p>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 18 }}>
            <button type="button" onClick={onCancel} style={{ border: '1px solid var(--line)', background: '#fff', padding: '10px 14px', borderRadius: 10 }}>
              Cancel
            </button>
            <button
              type="button"
              onClick={handleNextToPayment}
              style={{ background: 'var(--accent)', color: '#fff', border: 'none', padding: '10px 14px', borderRadius: 10 }}
            >
              Next: Confirm payment →
            </button>
          </div>
        </div>
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
              <p style={{ color: '#1f8a43', marginTop: 8 }}>✓ Sufficient balance</p>
            ) : null}
            {!loadingWallet && !hasSufficientBalance ? (
              <p style={{ color: 'var(--error)', marginTop: 8 }}>
                ✗ Insufficient balance — top up your wallet. <Link to="/wallet">Go to wallet</Link>
              </p>
            ) : null}
            {bookingError ? <p style={{ color: 'var(--error)', marginTop: 8 }}>{bookingError}</p> : null}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 18 }}>
            <button
              type="button"
              onClick={() => setStep(1)}
              style={{ border: '1px solid var(--line)', background: '#fff', padding: '10px 14px', borderRadius: 10 }}
            >
              ← Back
            </button>
            <button
              type="button"
              disabled={!hasSufficientBalance || loadingWallet}
              onClick={handleConfirmBooking}
              style={{
                background: hasSufficientBalance ? 'var(--accent)' : '#94a3b8',
                color: '#fff',
                border: 'none',
                padding: '10px 14px',
                borderRadius: 10,
                cursor: hasSufficientBalance ? 'pointer' : 'not-allowed',
              }}
            >
              Confirm Booking
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
            <div style={{ border: '1px solid #86efac', borderRadius: 14, background: '#f0fdf4', padding: 16 }}>
              <p style={{ color: '#166534', marginTop: 0 }}>{bookingSuccessMessage}</p>
              <button
                type="button"
                onClick={onBookingComplete}
                style={{ background: 'var(--accent)', color: '#fff', border: 'none', padding: '10px 14px', borderRadius: 10 }}
              >
                Go to My Sessions →
              </button>
            </div>
          ) : (
            <div style={{ border: '1px solid #fecaca', borderRadius: 14, background: '#fff1f2', padding: 16 }}>
              <p style={{ color: 'var(--error)', marginTop: 0 }}>{bookingError || 'Booking failed.'}</p>
              {String(bookingError || '').toLowerCase().includes('insufficient wallet balance') ? (
                <p style={{ marginTop: 0 }}>
                  <Link to="/wallet">Go to wallet</Link>
                </p>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setStep(2);
                  setBookingError('');
                }}
                style={{ border: '1px solid var(--line)', background: '#fff', padding: '10px 14px', borderRadius: 10 }}
              >
                Try again
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
