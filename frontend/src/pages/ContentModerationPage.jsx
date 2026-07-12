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

const STATUS_OPTIONS = ['OPEN', 'IN_REVIEW', 'RESOLVED', 'DISMISSED'];

export default function ContentModerationPage({ notify }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('OPEN');
  const [updatingId, setUpdatingId] = useState(null);
  const [noteById, setNoteById] = useState({});

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await client.get(`/api/v1/admin/flagged-content?status=${statusFilter}`);
      setItems(res?.data?.data || []);
    } catch {
      notify?.({ type: 'error', title: 'Failed to load', message: 'Could not load flagged content.' });
    } finally {
      setLoading(false);
    }
  }, [notify, statusFilter]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const updateStatus = async (itemId, newStatus) => {
    setUpdatingId(itemId);
    try {
      const note = noteById[itemId] || '';
      await client.patch(`/api/v1/admin/flagged-content/${itemId}`, { status: newStatus, note });
      notify?.({ type: 'success', title: 'Updated', message: `Content #${itemId} moved to ${newStatus}.` });
      loadItems();
    } catch (err) {
      notify?.({ type: 'error', title: 'Update failed', message: err?.response?.data?.data?.error || err.message });
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <section className="admin-page">
      <div className="admin-hero" style={{ marginBottom: 0, borderRadius: '0 0 18px 18px' }}>
        <div>
          <p className="admin-eyebrow">Moderation</p>
          <h1>Flagged Content Queue</h1>
          <p>Review user reports, take moderation action, and keep the platform safe.</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, margin: '18px 0', flexWrap: 'wrap', alignItems: 'center' }}>
        <label className="admin-field">
          <span>Status</span>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        </label>
        <button type="button" className="admin-refresh-btn" onClick={loadItems} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      <div className="admin-list">
        {loading ? (
          <p>Loading flagged content...</p>
        ) : items.length === 0 ? (
          <div className="admin-empty-state" style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 40 }}>
            <Icon name="verified" />
            <p>No flagged content in this queue.</p>
          </div>
        ) : (
          items.map((item) => {
            const isUpdating = updatingId === item.id;
            return (
              <article className="admin-card admin-verification-card" key={item.id}>
                <div className="admin-verification-header">
                  <h3>Report #{item.id}</h3>
                  <span className={`admin-status-pill admin-status-pill--${item.status?.toLowerCase() || 'open'}`}>
                    {item.status}
                  </span>
                </div>
                <p className="admin-verification-meta">
                  <strong>Reason:</strong> {item.reason}
                </p>
                <p className="admin-verification-meta">
                  <strong>Reported by:</strong> {item.reporter?.fullName || item.reporter?.email || `User #${item.reporter?.id}`}
                </p>
                <p className="admin-verification-meta">
                  <strong>Target:</strong> {item.targetType || 'USER'} #{item.targetId || item.reported?.id}
                </p>
                <p className="admin-verification-meta">
                  <strong>Reported user:</strong> {item.reported?.fullName || item.reported?.email || `User #${item.reported?.id}`}
                </p>
                {item.details && (
                  <p className="admin-verification-meta">
                    <strong>Details:</strong> {item.details}
                  </p>
                )}
                <p className="admin-verification-meta">
                  <strong>Submitted:</strong> {formatDate(item.createdAt)}
                </p>

                <div style={{ marginTop: 12 }}>
                  <label style={{ display: 'block', fontWeight: 700, marginBottom: 4, color: '#334155', fontSize: '0.85rem' }}>
                    Moderation Note
                  </label>
                  <input type="text"
                    value={noteById[item.id] || ''}
                    onChange={(e) => setNoteById((prev) => ({ ...prev, [item.id]: e.target.value }))}
                    placeholder="Add a moderation note..."
                    style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px', width: '100%', marginBottom: 8 }} />
                </div>

                <div className="admin-verification-actions">
                  <button type="button" className="admin-action-btn admin-action-approve"
                    disabled={isUpdating}
                    onClick={() => updateStatus(item.id, 'RESOLVED')}>
                    {isUpdating ? '...' : 'Resolve'}
                  </button>
                  <button type="button"
                    style={{ background: '#f59e0b', borderColor: '#d97706', color: '#fff', ...inlineBtnStyle }}
                    disabled={isUpdating}
                    onClick={() => updateStatus(item.id, 'IN_REVIEW')}>
                    Flag for Review
                  </button>
                  <button type="button" className="admin-action-btn admin-action-reject"
                    disabled={isUpdating}
                    onClick={() => updateStatus(item.id, 'DISMISSED')}>
                    Dismiss
                  </button>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}

const inlineBtnStyle = {
  border: '1px solid transparent',
  borderRadius: 8,
  cursor: 'pointer',
  fontWeight: 700,
  padding: '8px 12px',
};
