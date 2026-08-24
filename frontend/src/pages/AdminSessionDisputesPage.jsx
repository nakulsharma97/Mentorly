import { useCallback, useEffect, useMemo, useState } from 'react';
import client from '../api/client';
import HeroSection from '../components/HeroSection';
import {
  AuBadge,
  AuButton,
  AuEmpty,
  AuTable,
} from '../modules/admin/ui';
import './AdminPaymentsPage.css';

/* Stable empty array reference */
const EMPTY_ARRAY = [];

/* ── Helpers ── */

const formatDate = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return new Intl.DateTimeFormat(undefined, {
    month: 'short', day: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(d);
};

const STATUS_COLORS = {
  DISPUTED: { bg: '#fef2f2', text: '#991b1b', border: '#fecaca' },
  REVIEW_REQUIRED: { bg: '#fffbeb', text: '#92400e', border: '#fde68a' },
  AWAITING_CONFIRMATION: { bg: '#f0f9ff', text: '#1e40af', border: '#bfdbfe' },
};

/* ══════════════════════════════════════════════════════════════════════ */

export default function AdminSessionDisputesPage({ notify }) {
  const [bookings, setBookings] = useState(EMPTY_ARRAY);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [evidence, setEvidence] = useState(null);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [resolving, setResolving] = useState(false);

  /* ── Load bookings with completion issues ── */
  const loadBookings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await client.get('/api/v1/bookings', { params: { size: 200 } });
      const all = res?.data?.data?.content || EMPTY_ARRAY;
      // Filter to bookings with active completion issues
      const disputed = all.filter((b) => {
        const status = b.completionReviewStatus;
        return status === 'DISPUTED' || status === 'REVIEW_REQUIRED' || status === 'AWAITING_CONFIRMATION';
      });
      setBookings(disputed);
    } catch (err) {
      notify?.({ type: 'error', title: 'Failed to load bookings', message: err?.message });
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => { loadBookings(); }, [loadBookings]);

  /* ── Load evidence for selected booking ── */
  const loadEvidence = useCallback(async (bookingId) => {
    setEvidenceLoading(true);
    setEvidence(null);
    try {
      const res = await client.get(`/api/v1/admin/bookings/${bookingId}/completion-evidence`);
      setEvidence(res?.data?.data || null);
    } catch (err) {
      notify?.({ type: 'error', title: 'Failed to load evidence', message: err?.message });
    } finally {
      setEvidenceLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    if (selectedBooking) {
      loadEvidence(selectedBooking.id);
    }
  }, [selectedBooking, loadEvidence]);

  /* ── Resolve completion ── */
  const resolveCompletion = async (action, adminNote = '') => {
    if (!selectedBooking || resolving) return;
    setResolving(true);
    try {
      await client.post(`/api/v1/admin/bookings/${selectedBooking.id}/resolve-completion`, {
        action,
        adminNote: adminNote || undefined,
      });
      notify?.({
        type: 'success',
        title: 'Session resolved',
        message: `Session has been resolved with action: ${action}`,
      });
      setSelectedBooking(null);
      setEvidence(null);
      loadBookings();
    } catch (err) {
      const msg = err?.response?.data?.data?.message || err?.response?.data?.message || 'Resolution failed.';
      notify?.({ type: 'error', title: 'Resolution failed', message: msg });
    } finally {
      setResolving(false);
    }
  };

  /* ── Stats ── */
  const stats = useMemo(() => {
    const disputed = bookings.filter((b) => b.completionReviewStatus === 'DISPUTED').length;
    const reviewRequired = bookings.filter((b) => b.completionReviewStatus === 'REVIEW_REQUIRED').length;
    const awaiting = bookings.filter((b) => b.completionReviewStatus === 'AWAITING_CONFIRMATION').length;
    return { disputed, reviewRequired, awaiting, total: bookings.length };
  }, [bookings]);

  return (
    <main className="ss-page admin-payments-page">
      <HeroSection
        className="hero-section--compact"
        badge="Session Disputes"
        title="Completion Disputes"
        subtitle="Review and resolve session completion disputes"
      >
        <div className="hero-section__stats-strip">
          <div className="hero-section__stats-item">
            <span className="hero-section__stats-item__label">Disputed</span>
            <span className="hero-section__stats-item__value" style={{ color: '#ef4444' }}>{stats.disputed}</span>
          </div>
          <div className="hero-section__stats-divider" />
          <div className="hero-section__stats-item">
            <span className="hero-section__stats-item__label">Under Review</span>
            <span className="hero-section__stats-item__value" style={{ color: '#f59e0b' }}>{stats.reviewRequired}</span>
          </div>
          <div className="hero-section__stats-divider" />
          <div className="hero-section__stats-item">
            <span className="hero-section__stats-item__label">Awaiting</span>
            <span className="hero-section__stats-item__value" style={{ color: '#3b82f6' }}>{stats.awaiting}</span>
          </div>
        </div>
      </HeroSection>

      {/* ── Bookings List ── */}
      <section className="ss-card" style={{ marginBottom: 24 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--ss-border-light)' }}>
          <h3 style={{ margin: 0, fontSize: 'var(--ss-font-base)', fontWeight: 700 }}>
            Bookings Requiring Attention ({bookings.length})
          </h3>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--ss-text-muted)' }}>
            Loading bookings...
          </div>
        ) : bookings.length === 0 ? (
          <AuEmpty icon="check_circle" title="No disputes" desc="All sessions are progressing normally." />
        ) : (
          <AuTable
            columns={[
              { key: 'id', label: 'ID', width: 60 },
              { key: 'session', label: 'Session' },
              { key: 'learner', label: 'Learner' },
              { key: 'mentor', label: 'Mentor' },
              { key: 'status', label: 'Status', width: 120 },
              { key: 'actions', label: '', width: 100 },
            ]}
            rows={bookings.map((b) => ({
              id: b.id,
              session: b.session?.title || `Session #${b.session?.id || '?'}`,
              learner: b.learner?.fullName || '—',
              mentor: b.session?.mentor?.fullName || '—',
              status: (
                <span
                  style={{
                    display: 'inline-block',
                    padding: '2px 8px',
                    borderRadius: 12,
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    background: STATUS_COLORS[b.completionReviewStatus]?.bg || '#f3f4f6',
                    color: STATUS_COLORS[b.completionReviewStatus]?.text || '#374151',
                    border: `1px solid ${STATUS_COLORS[b.completionReviewStatus]?.border || '#e5e7eb'}`,
                  }}
                >
                  {b.completionReviewStatus?.replace(/_/g, ' ') || '—'}
                </span>
              ),
              actions: (
                <AuButton
                  size="sm"
                  onClick={() => setSelectedBooking(b)}
                >
                  Review
                </AuButton>
              ),
            }))}
          />
        )}
      </section>

      {/* ── Evidence Panel ── */}
      {selectedBooking && (
        <section className="ss-card" style={{ marginBottom: 24 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--ss-border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: 'var(--ss-font-base)', fontWeight: 700 }}>
              Booking #{selectedBooking.id} — Evidence
            </h3>
            <AuButton size="sm" variant="ghost" onClick={() => { setSelectedBooking(null); setEvidence(null); }}>
              Close
            </AuButton>
          </div>

          {evidenceLoading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--ss-text-muted)' }}>
              Loading evidence...
            </div>
          ) : evidence ? (
            <div style={{ padding: 20 }}>
              {/* Session Info */}
              <div style={{ marginBottom: 20 }}>
                <h4 style={{ margin: '0 0 8px', fontSize: '0.875rem', fontWeight: 600 }}>Session Details</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                  <div>
                    <span style={{ color: 'var(--ss-text-muted)', fontSize: '0.75rem' }}>Title</span>
                    <p style={{ margin: 0, fontWeight: 600 }}>{evidence.sessionTitle}</p>
                  </div>
                  <div>
                    <span style={{ color: 'var(--ss-text-muted)', fontSize: '0.75rem' }}>Scheduled Start</span>
                    <p style={{ margin: 0 }}>{formatDate(evidence.scheduledStartTime)}</p>
                  </div>
                  <div>
                    <span style={{ color: 'var(--ss-text-muted)', fontSize: '0.75rem' }}>Scheduled End</span>
                    <p style={{ margin: 0 }}>{formatDate(evidence.scheduledEndTime)}</p>
                  </div>
                </div>
              </div>

              {/* Join Link Signals */}
              <div style={{ marginBottom: 20 }}>
                <h4 style={{ margin: '0 0 8px', fontSize: '0.875rem', fontWeight: 600 }}>Join Link Signals</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div style={{ padding: 12, background: evidence.learnerNeverRequestedJoinLink ? '#fef2f2' : '#f0fdf4', borderRadius: 8, border: `1px solid ${evidence.learnerNeverRequestedJoinLink ? '#fecaca' : '#bbf7d0'}` }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--ss-text-muted)' }}>Learner</span>
                    <p style={{ margin: '4px 0 0', fontWeight: 600 }}>
                      {evidence.learnerNeverRequestedJoinLink ? (
                        <span style={{ color: '#dc2626' }}>Never requested join link</span>
                      ) : (
                        <span style={{ color: '#16a34a' }}>Requested at {formatDate(evidence.learnerJoinLinkRequestedAt)}</span>
                      )}
                    </p>
                  </div>
                  <div style={{ padding: 12, background: evidence.mentorNeverRequestedJoinLink ? '#fef2f2' : '#f0fdf4', borderRadius: 8, border: `1px solid ${evidence.mentorNeverRequestedJoinLink ? '#fecaca' : '#bbf7d0'}` }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--ss-text-muted)' }}>Mentor</span>
                    <p style={{ margin: '4px 0 0', fontWeight: 600 }}>
                      {evidence.mentorNeverRequestedJoinLink ? (
                        <span style={{ color: '#dc2626' }}>Never requested join link</span>
                      ) : (
                        <span style={{ color: '#16a34a' }}>Requested at {formatDate(evidence.mentorJoinLinkRequestedAt)}</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Confirmation Status */}
              <div style={{ marginBottom: 20 }}>
                <h4 style={{ margin: '0 0 8px', fontSize: '0.875rem', fontWeight: 600 }}>Confirmation Status</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div style={{ padding: 12, background: '#f9fafb', borderRadius: 8 }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--ss-text-muted)' }}>Learner ({evidence.learnerName})</span>
                    <p style={{ margin: '4px 0 0', fontWeight: 600 }}>
                      {evidence.learnerConfirmationStatus}
                      {evidence.learnerConfirmedAt && <span style={{ fontSize: '0.75rem', color: 'var(--ss-text-muted)', marginLeft: 8 }}>{formatDate(evidence.learnerConfirmedAt)}</span>}
                    </p>
                    {evidence.learnerDisputeReason && (
                      <p style={{ margin: '4px 0 0', fontSize: '0.875rem', color: '#dc2626', fontStyle: 'italic' }}>
                        "{evidence.learnerDisputeReason}"
                      </p>
                    )}
                  </div>
                  <div style={{ padding: 12, background: '#f9fafb', borderRadius: 8 }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--ss-text-muted)' }}>Mentor ({evidence.mentorName})</span>
                    <p style={{ margin: '4px 0 0', fontWeight: 600 }}>
                      {evidence.mentorConfirmationStatus}
                      {evidence.mentorConfirmedAt && <span style={{ fontSize: '0.75rem', color: 'var(--ss-text-muted)', marginLeft: 8 }}>{formatDate(evidence.mentorConfirmedAt)}</span>}
                    </p>
                    {evidence.mentorDisputeReason && (
                      <p style={{ margin: '4px 0 0', fontSize: '0.875rem', color: '#dc2626', fontStyle: 'italic' }}>
                        "{evidence.mentorDisputeReason}"
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Historical Dispute Counts */}
              <div style={{ marginBottom: 20 }}>
                <h4 style={{ margin: '0 0 8px', fontSize: '0.875rem', fontWeight: 600 }}>Historical Disputes</h4>
                <div style={{ display: 'flex', gap: 24 }}>
                  <div>
                    <span style={{ color: 'var(--ss-text-muted)', fontSize: '0.75rem' }}>Learner past disputes</span>
                    <p style={{ margin: '4px 0 0', fontWeight: 700, fontSize: '1.25rem' }}>{evidence.learnerPastDisputeCount}</p>
                  </div>
                  <div>
                    <span style={{ color: 'var(--ss-text-muted)', fontSize: '0.75rem' }}>Mentor past disputes</span>
                    <p style={{ margin: '4px 0 0', fontWeight: 700, fontSize: '1.25rem' }}>{evidence.mentorPastDisputeCount}</p>
                  </div>
                </div>
              </div>

              {/* Chat Messages During Session */}
              {evidence.sessionChatMessages?.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <h4 style={{ margin: '0 0 8px', fontSize: '0.875rem', fontWeight: 600 }}>
                    Chat During Session ({evidence.sessionChatMessages.length} messages)
                  </h4>
                  <div style={{ maxHeight: 300, overflow: 'auto', border: '1px solid var(--ss-border)', borderRadius: 8, padding: 12 }}>
                    {evidence.sessionChatMessages.map((msg) => (
                      <div key={msg.id} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid var(--ss-border-light)' }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{msg.senderName}</span>
                          <AuBadge status={msg.senderRole === 'MENTOR' ? 'info' : 'neutral'}>{msg.senderRole}</AuBadge>
                          <span style={{ color: 'var(--ss-text-muted)', fontSize: '0.75rem' }}>{formatDate(msg.sentAt)}</span>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.875rem' }}>{msg.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Resolution Actions */}
              <div style={{ borderTop: '1px solid var(--ss-border-light)', paddingTop: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <AuButton
                  variant="primary"
                  onClick={() => resolveCompletion('RELEASE_TO_MENTOR')}
                  disabled={resolving}
                >
                  {resolving ? 'Resolving...' : 'Release to Mentor'}
                </AuButton>
                <AuButton
                  variant="danger"
                  onClick={() => {
                    const reason = window.prompt('Refund reason (optional):', 'Admin refund after dispute');
                    if (reason !== null) resolveCompletion('REFUND_LEARNER', reason);
                  }}
                  disabled={resolving}
                >
                  {resolving ? 'Resolving...' : 'Refund Learner'}
                </AuButton>
                <AuButton
                  variant="ghost"
                  onClick={() => resolveCompletion('REQUEST_MORE_INFO')}
                  disabled={resolving}
                >
                  {resolving ? 'Resolving...' : 'Request More Info'}
                </AuButton>
              </div>
            </div>
          ) : (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--ss-text-muted)' }}>
              Select a booking to view evidence
            </div>
          )}
        </section>
      )}
    </main>
  );
}
