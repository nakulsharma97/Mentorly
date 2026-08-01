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

// Tracked security events get a dedicated icon + color so they stand out in
// the timeline. More specific actions must be matched before the generic
// substring fallback below (e.g. USER_DISABLE before USER).
const ACTION_STYLES = [
  { match: 'MENTOR_VERIFICATION', icon: 'verified_user', color: '#7c3aed' },
  { match: 'LOGIN', icon: 'login', color: '#059669' },
  { match: 'LOGOUT', icon: 'logout', color: '#64748b' },
  { match: 'USER_DISABLE', icon: 'block', color: '#dc2626' },
  { match: 'USER_ENABLE', icon: 'check_circle', color: '#16a34a' },
  { match: 'DELETE_USER', icon: 'person_off', color: '#b91c1c' },
  { match: 'DELETE_SESSION', icon: 'delete', color: '#b91c1c' },
];

const FALLBACK_ICONS = {
  REFUND: 'payments', BULK: 'group', USER: 'person', ROLE: 'badge',
  SESSION: 'calendar_month', BROADCAST: 'campaign', SETTINGS: 'settings',
  MODERATE: 'gavel', UPDATE: 'edit', DEFAULT: 'history',
};

const FALLBACK_COLORS = {
  REFUND: '#7c3aed', BULK: '#2563eb', USER: '#059669', ROLE: '#d97706',
  SESSION: '#0891b2', BROADCAST: '#dc2626', SETTINGS: '#64748b',
  MODERATE: '#b91c1c', UPDATE: '#0f766e',
};

const getActionMeta = (action) => {
  const upper = (action || '').toUpperCase();
  for (const style of ACTION_STYLES) {
    if (upper.includes(style.match)) return { icon: style.icon, color: style.color };
  }
  for (const [key, icon] of Object.entries(FALLBACK_ICONS)) {
    if (upper.includes(key)) return { icon, color: FALLBACK_COLORS[key] || '#64748b' };
  }
  return { icon: 'history', color: '#64748b' };
};

// "USER_DISABLE" → "User Disable", "MENTOR_VERIFICATION" → "Mentor Verification"
const formatAction = (action) => {
  if (!action) return 'Unknown action';
  return action.toLowerCase().split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

const QUICK_FILTERS = [
  { code: '', label: 'All activity' },
  { code: 'LOGIN', label: 'Login' },
  { code: 'LOGOUT', label: 'Logout' },
  { code: 'USER_DISABLE', label: 'User Disable' },
  { code: 'DELETE_USER', label: 'User Delete' },
  { code: 'DELETE_SESSION', label: 'Session Delete' },
  { code: 'MENTOR_VERIFICATION', label: 'Mentor Verification' },
];

const AUDIT_PAGE_SIZE = 50;

export default function AuditLogPage({ notify }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (actionFilter.trim()) params.set('action', actionFilter.trim());
      params.set('page', String(page));
      params.set('size', String(AUDIT_PAGE_SIZE));
      params.set('sort', 'createdAt,desc');
      const res = await client.get(`/api/v1/admin/audit-log?${params}`);
      const data = res?.data?.data;
      if (data?.content) {
        setLogs(data.content);
        setTotalPages(data.totalPages || 0);
        setTotalElements(data.totalElements || 0);
      } else {
        setLogs(Array.isArray(data) ? data : []);
      }
    } catch {
      notify?.({ type: 'error', title: 'Audit log unavailable', message: 'Could not load audit log.' });
    } finally { setLoading(false); }
  }, [notify, actionFilter, page]);

  useEffect(() => { setPage(0); }, [actionFilter]);
  useEffect(() => { loadLogs(); }, [loadLogs]);

  return (
    <section className="admin-page">
      <div className="admin-hero" style={{ marginBottom: 0, borderRadius: '0 0 18px 18px' }}>
        <div>
          <p className="admin-eyebrow">Monitoring</p>
          <h1>Activity Timeline</h1>
          <p>Security timeline of logins, admin actions and account events — who, what, when, and from where.</p>
        </div>
      </div>

      {/* Quick filters for the tracked security events */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '18px 0 4px' }}>
        {QUICK_FILTERS.map((f) => {
          const active = actionFilter === f.code;
          return (
            <button
              key={f.code || 'all'}
              type="button"
              onClick={() => setActionFilter(f.code)}
              style={{
                padding: '6px 14px', borderRadius: 999, border: active ? 'none' : '1px solid #e2e8f0',
                background: active ? '#7c3aed' : '#fff', color: active ? '#fff' : '#475569',
                fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                boxShadow: active ? '0 2px 8px rgba(124,58,237,0.35)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 12, margin: '14px 0', flexWrap: 'wrap', alignItems: 'center' }}>
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

      {/* Pagination info */}
      {totalPages > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, fontSize: '0.82rem', color: 'var(--admin-muted)' }}>
          <span>{totalElements} total entries</span>
          {totalPages > 1 && (
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <button type="button" className="admin-action-btn admin-action-cancel"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                style={{ padding: '4px 10px', fontSize: '0.78rem' }}>
                <Icon name="chevron_left" />
              </button>
              <span>Page {page + 1} of {totalPages}</span>
              <button type="button" className="admin-action-btn admin-action-cancel"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                style={{ padding: '4px 10px', fontSize: '0.78rem' }}>
                <Icon name="chevron_right" />
              </button>
            </div>
          )}
        </div>
      )}

      <div className="admin-list" style={{ gap: 6 }}>
        {loading ? (
          <div className="admin-panel" style={{ textAlign: 'center', color: '#94a3b8' }}>Loading timeline...</div>
        ) : logs.length === 0 ? (
          <div className="admin-empty-state"><Icon name="history" /><p>No audit log entries found.</p></div>
        ) : (
          logs.map((log) => {
            const { icon, color } = getActionMeta(log.action);
            const actor = log.adminEmail || (log.userId ? `User #${log.userId}` : 'System');
            const target = log.entityType
              ? `${log.entityType}${log.entityId ? ` #${log.entityId}` : ''}`
              : log.resource
                ? `${log.resource}${log.resourceId ? ` #${log.resourceId}` : ''}`
                : null;
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
                    <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>{formatAction(log.action)}</strong>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                      {formatRelative(log.createdAt)}
                    </span>
                  </div>

                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569' }}>
                    {log.details || 'No details'}
                  </p>

                  <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: '0.78rem', color: '#94a3b8', flexWrap: 'wrap' }}>
                    <span><Icon name="person" style={{ fontSize: '0.8rem' }} /> {actor}</span>
                    {target && (
                      <span><Icon name="tag" style={{ fontSize: '0.8rem' }} /> {target}</span>
                    )}
                    {log.ipAddress && log.ipAddress !== 'unknown' && (
                      <span><Icon name="public" style={{ fontSize: '0.8rem' }} /> {log.ipAddress}</span>
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
