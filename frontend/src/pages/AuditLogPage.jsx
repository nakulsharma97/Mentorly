import { useCallback, useEffect, useState } from 'react';
import client from '../api/client';
import Icon from '../modules/common/dashboard/Icon';
import './AdminOperationsPage.css';

const formatDate = (v) => {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(d);
};

const formatRelative = (v) => {
  if (!v) return '';
  const diff = Date.now() - new Date(v).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(v);
};

const ACTION_ICONS = {
  REFUND: 'payments', BULK: 'group', USER: 'person', ROLE: 'badge',
  SESSION: 'calendar_month', BROADCAST: 'campaign', SETTINGS: 'settings',
  MODERATE: 'gavel', UPDATE: 'edit', DEFAULT: 'history',
};

const ACTION_COLORS = {
  REFUND: '#7c3aed', BULK: '#2563eb', USER: '#059669', ROLE: '#d97706',
  SESSION: '#0891b2', BROADCAST: '#dc2626', SETTINGS: '#64748b',
  MODERATE: '#b91c1c', UPDATE: '#0f766e',
};

const getActionMeta = (action) => {
  const upper = (action || '').toUpperCase();
  for (const [key, icon] of Object.entries(ACTION_ICONS)) {
    if (upper.includes(key)) return { icon, color: ACTION_COLORS[key] || '#64748b' };
  }
  return { icon: 'history', color: '#64748b' };
};

export default function AuditLogPage({ notify }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (actionFilter.trim()) params.set('action', actionFilter.trim());
      const res = await client.get(`/api/v1/admin/audit-log?${params}`);
      setLogs(res?.data?.data || []);
    } catch {
      notify?.({ type: 'error', title: 'Audit log unavailable', message: 'Could not load audit log.' });
    } finally { setLoading(false); }
  }, [notify, actionFilter]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  return (
    <section className="admin-page">
      <div className="admin-hero" style={{ marginBottom: 0, borderRadius: '0 0 18px 18px' }}>
        <div>
          <p className="admin-eyebrow">Monitoring</p>
          <h1>Activity Timeline</h1>
          <p>Visual timeline of all admin actions for security and compliance.</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, margin: '18px 0', flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="admin-search" style={{ flex: 1, maxWidth: 400 }}>
          <Icon name="search" />
          <input type="text" placeholder="Filter by action, admin, or entity..."
            value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') loadLogs(); }} />
        </div>
        <button type="button" className="admin-refresh-btn" onClick={loadLogs} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      <div className="admin-list" style={{ gap: 6 }}>
        {loading ? (
          <div className="admin-panel" style={{ textAlign: 'center', color: '#94a3b8' }}>Loading timeline...</div>
        ) : logs.length === 0 ? (
          <div className="admin-empty-state"><Icon name="history" /><p>No audit log entries found.</p></div>
        ) : (
          logs.map((log) => {
            const { icon, color } = getActionMeta(log.action);
            return (
              <div key={log.id} className="admin-msg" style={{
                display: 'flex', gap: 12, alignItems: 'flex-start', padding: '14px 16px',
                position: 'relative',
                borderLeft: `3px solid ${color}`,
              }}>
                {/* Timeline dot */}
                <div style={{
                  width: 32, height: 32, borderRadius: 999, background: `${color}18`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color, flexShrink: 0,
                }}>
                  <Icon name={icon} style={{ fontSize: '1rem' }} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                    <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>{log.action}</strong>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                      {formatRelative(log.createdAt)}
                    </span>
                  </div>

                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569' }}>
                    {log.details || 'No details'}
                  </p>

                  <div style={{ display: 'flex', gap: 10, marginTop: 6, fontSize: '0.78rem', color: '#94a3b8' }}>
                    <span><Icon name="person" style={{ fontSize: '0.8rem' }} /> {log.adminEmail}</span>
                    {log.entityType && (
                      <span><Icon name="tag" style={{ fontSize: '0.8rem' }} /> {log.entityType}#{log.entityId || ''}</span>
                    )}
                    <span><Icon name="schedule" style={{ fontSize: '0.8rem' }} /> {formatDate(log.createdAt)}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
