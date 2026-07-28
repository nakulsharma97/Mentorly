import { useCallback, useEffect, useState } from 'react';
import client from '../api/client';
import Icon from '../modules/common/dashboard/Icon';
import './AdminOperationsPage.css';

const formatDate = (v) => {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d);
};
const STATUS_OPTIONS = ['ACTIVE', 'PENDING', 'CANCELLED', 'COMPLETED'];

const PAGE_SIZE = 20;

export default function SessionManagementPage({ notify }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [updatingId, setUpdatingId] = useState(null);
  // Detail drawer
  const [drawerSession, setDrawerSession] = useState(null);
  const [drawerData, setDrawerData] = useState(null);
  const [drawerLoading, setDrawerLoading] = useState(false);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (search.trim()) params.set('q', search.trim());
      params.set('page', String(page));
      params.set('size', String(PAGE_SIZE));
      params.set('sort', 'createdAt,desc');
      const res = await client.get(`/api/v1/admin/sessions?${params}`);
      const data = res?.data?.data;
      if (data?.content) {
        setSessions(data.content);
        setTotalPages(data.totalPages || 0);
        setTotalElements(data.totalElements || 0);
      } else {
        setSessions(Array.isArray(data) ? data : []);
      }
    } catch {
      notify?.({ type: 'error', title: 'Sessions unavailable', message: 'Could not load sessions.' });
    } finally { setLoading(false); }
  }, [notify, statusFilter, search, page]);

  useEffect(() => { setPage(0); }, [statusFilter, search]);
  useEffect(() => { loadSessions(); }, [loadSessions]);

  const cancelSession = async (sessionId) => {
    if (!window.confirm('Cancel this session? This will remove the meeting link.')) return;
    setUpdatingId(sessionId);
    try {
      await client.patch(`/api/v1/admin/sessions/${sessionId}/status`, { status: 'CANCELLED' });
      notify?.({ type: 'success', title: 'Session cancelled', message: `Session #${sessionId} cancelled.` });
      loadSessions();
    } catch (err) {
      notify?.({ type: 'error', title: 'Cancel failed', message: err?.response?.data?.data?.error || err.message });
    } finally { setUpdatingId(null); }
  };

  const openDrawer = async (session) => {
    setDrawerSession(session);
    setDrawerLoading(true);
    setDrawerData(null);
    try {
      const res = await client.get(`/api/v1/admin/sessions/${session.id}/details`);
      setDrawerData(res?.data?.data);
    } catch {
      notify?.({ type: 'error', title: 'Details unavailable', message: 'Could not load session details.' });
    } finally { setDrawerLoading(false); }
  };

  return (
    <section className="admin-page">
      <div className="admin-hero" style={{ marginBottom: 0, borderRadius: '0 0 18px 18px' }}>
        <div>
          <p className="admin-eyebrow">Administration</p>
          <h1>Session Management</h1>
          <p>View and manage all sessions. Click a row to see bookings, revenue, and learner details.</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, margin: '18px 0', flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="admin-search" style={{ flex: 1, maxWidth: 400 }}>
          <Icon name="search" />
          <input type="text" placeholder="Search by title or mentor..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') loadSessions(); }} />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px' }}>
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button type="button" className="admin-refresh-btn" onClick={loadSessions} disabled={loading}>
          {loading ? 'Loading...' : 'Search'}
        </button>
      </div>

      <div className="admin-conv-layout">
        {/* Session table */}
        <div className="admin-panel" style={{ padding: 0, marginTop: 0 }}>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th><th>Title</th><th>Mentor</th><th>Price</th>
                  <th>Status</th><th>Type</th><th>Parts</th><th>Start</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="9" style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>Loading...</td></tr>
                ) : sessions.length === 0 ? (
                  <tr><td colSpan="9"><div className="admin-empty-state"><Icon name="calendar_month" /><p>No sessions found.</p></div></td></tr>
                ) : (
                  sessions.map((s) => (
                    <tr key={s.id} onClick={() => openDrawer(s)} style={{ cursor: 'pointer' }}
                      className={drawerSession?.id === s.id ? 'is-selected' : ''}>
                      <td>#{s.id}</td>
                      <td><strong>{s.title}</strong></td>
                      <td>{s.mentorName}</td>
                      <td>{s.priceAmount?.toFixed(2)}</td>
                      <td><span className={`admin-status-pill admin-status-pill--${s.status.toLowerCase()}`}>{s.status}</span></td>
                      <td>{s.sessionType}</td>
                      <td>{s.participantCount}/{s.maxParticipants}</td>
                      <td style={{ fontSize: '0.82rem' }}>{formatDate(s.startTime)}</td>
                      <td>
                        {(s.status === 'ACTIVE' || s.status === 'PENDING') && (
                          <button type="button" className="admin-action-btn admin-action-reject"
                            disabled={updatingId === s.id}
                            onClick={(e) => { e.stopPropagation(); cancelSession(s.id); }}>
                            {updatingId === s.id ? '...' : 'Cancel'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="ap-pagination" style={{ padding: '12px 16px', borderTop: '1px solid var(--admin-border)' }}>
              <span className="ap-pagination__info" style={{ fontSize: '0.78rem', color: 'var(--admin-muted)' }}>
                {totalElements} total · Page {page + 1} of {totalPages}
              </span>
              <div className="ap-pagination__buttons" style={{ display: 'flex', gap: 4 }}>
                <button type="button" className="admin-action-btn admin-action-cancel"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  style={{ padding: '4px 10px', fontSize: '0.78rem' }}>
                  <Icon name="chevron_left" />
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const start = Math.max(0, Math.min(page - 2, totalPages - 5));
                  const p = start + i;
                  if (p >= totalPages) return null;
                  return (
                    <button key={p} type="button"
                      className={`ap-pagination__page ${page === p ? 'ap-pagination__page--active' : ''}`}
                      onClick={() => setPage(p)}
                      style={{ padding: '4px 8px', fontSize: '0.78rem' }}>
                      {p + 1}
                    </button>
                  );
                })}
                <button type="button" className="admin-action-btn admin-action-cancel"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  style={{ padding: '4px 10px', fontSize: '0.78rem' }}>
                  <Icon name="chevron_right" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Detail drawer */}
        <div className="admin-conv-messages" style={{ maxHeight: 500 }}>
          {!drawerSession ? (
            <div className="admin-empty-state"><Icon name="touch_app" /><p>Click a session to view details</p></div>
          ) : drawerLoading ? (
            <p style={{ padding: 20 }}>Loading details...</p>
          ) : drawerData ? (
            <div style={{ padding: 16 }}>
              <div className="admin-conv-messages-header" style={{ position: 'static', padding: '0 0 12px 0', background: 'transparent', border: 'none' }}>
                <h3 style={{ margin: 0 }}>{drawerData.title}</h3>
                <p className="admin-text-muted">Session #{drawerData.sessionId} &middot; {drawerData.status}</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                <div className="admin-stat" style={{ padding: 12 }}>
                  <span>Total Bookings</span>
                  <strong>{drawerData.totalBookings || 0}</strong>
                </div>
                <div className="admin-stat" style={{ padding: 12 }}>
                  <span>Total Revenue</span>
                  <strong>{Number(drawerData.totalRevenue || 0).toFixed(2)} INR</strong>
                </div>
                <div className="admin-stat" style={{ padding: 12 }}>
                  <span>Avg Rating</span>
                  <strong>{drawerData.averageRating?.toFixed(1) || '—'}</strong> <span className="material-symbols-outlined" style={{ fontSize: '1rem', color: '#FDB022', verticalAlign: 'middle' }}>star_rate</span>
                </div>
                <div className="admin-stat" style={{ padding: 12 }}>
                  <span>Price</span>
                  <strong>{Number(drawerData.price || 0).toFixed(2)} INR</strong>
                </div>
              </div>

              {/* Booking trend mini-chart (Feature 4) */}
              {drawerData.bookingTrend && drawerData.bookingTrend.length > 0 && (
                <div className="admin-panel" style={{ padding: 12, margin: '0 0 12px' }}>
                  <p style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--admin-muted)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Booking Trend (6 months)</p>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 60, padding: '4px 0' }}>
                    {drawerData.bookingTrend.map((bucket, i) => {
                      const maxVal = Math.max(...drawerData.bookingTrend.map((b) => b.value), 1);
                      const pct = Math.round((bucket.value / maxVal) * 100);
                      return (
                        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                          <div style={{
                            width: '100%', height: `${Math.max(pct, 2)}%`,
                            background: 'var(--admin-brand)', borderRadius: '4px 4px 0 0',
                            opacity: 0.7 + (pct / 100) * 0.3,
                            minHeight: 4,
                            transition: 'height 0.3s ease',
                          }} title={`${bucket.label}: ${bucket.value}`} />
                          <span style={{ fontSize: '0.6rem', color: 'var(--admin-muted)', whiteSpace: 'nowrap' }}>{bucket.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <h4 style={{ margin: '0 0 8px', fontSize: '0.9rem' }}>
                Bookings ({drawerData.totalBookings || 0})
                {drawerData.completedCount > 0 && <span style={{ fontWeight: 400, color: 'var(--admin-muted)', fontSize: '0.8rem' }}> · {drawerData.completedCount} completed</span>}
                {drawerData.cancelledCount > 0 && <span style={{ fontWeight: 400, color: '#dc2626', fontSize: '0.8rem' }}> · {drawerData.cancelledCount} cancelled</span>}
              </h4>
              <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                {(drawerData.bookings || []).length === 0 ? (
                  <div className="admin-empty-state"><Icon name="book_online" /><p>No bookings yet.</p></div>
                ) : (
                  (drawerData.bookings || []).map((b) => (
                    <div key={b.id} className="admin-msg" style={{ padding: '8px 10px' }}>
                      <div className="admin-msg-header">
                        <strong>{b?.learner?.fullName || `User #${b?.learner?.id || '?'}`}</strong>
                        <span className={`admin-status-pill admin-status-pill--${(b?.bookingStatus || '').toLowerCase()}`}>
                          {b?.bookingStatus || 'PENDING'}
                        </span>
                        {b?.paymentStatus && b.paymentStatus !== 'PENDING' && (
                          <span className="admin-text-muted" style={{ fontSize: '0.72rem' }}>{b.paymentStatus}</span>
                        )}
                      </div>
                      <p className="admin-msg-content" style={{ fontSize: '0.82rem' }}>
                        {formatDate(b?.createdAt)}
                        {b?.session?.startTime ? ` · ${formatDate(b.session.startTime)}` : ''}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="admin-empty-state"><Icon name="error" /><p>Could not load details.</p></div>
          )}
        </div>
      </div>
    </section>
  );
}
