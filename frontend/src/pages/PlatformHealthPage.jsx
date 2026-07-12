import { useCallback, useEffect, useState } from 'react';
import client from '../api/client';
import Icon from '../modules/common/dashboard/Icon';
import './AdminOperationsPage.css';

export default function PlatformHealthPage({ notify }) {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const loadHealth = useCallback(async () => {
    try {
      const res = await client.get('/api/v1/admin/health');
      setHealth(res?.data?.data);
    } catch {
      notify?.({ type: 'error', title: 'Health unavailable', message: 'Could not load health data.' });
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => { loadHealth(); }, [loadHealth]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(loadHealth, 15000);
    return () => clearInterval(interval);
  }, [autoRefresh, loadHealth]);

  if (loading) {
    return (
      <section className="admin-page">
        <div className="admin-hero" style={{ marginBottom: 0, borderRadius: '0 0 18px 18px' }}>
          <p className="admin-eyebrow">Monitoring</p>
          <h1>Platform Health</h1>
          <p>Loading health metrics...</p>
        </div>
      </section>
    );
  }

  const h = health || {};
  const statusColor = h.status === 'healthy' ? '#16a34a' : h.status === 'degraded' ? '#d97706' : '#dc2626';

  const metrics = [
    { icon: 'check_circle', label: 'System Status', value: (h.status || 'unknown').toUpperCase(), color: statusColor },
    { icon: 'schedule', label: 'Uptime', value: h.uptime || 'Unknown', color: '#0f766e' },
    { icon: 'memory', label: 'Memory Usage', value: h.memoryUsage || '—', color: h.memoryUsagePercent > 80 ? '#dc2626' : '#0f766e', sub: `${h.memoryUsagePercent || 0}%` },
    { icon: 'error_outline', label: 'Errors (24h)', value: String(h.errors24h || 0), color: h.errors24h > 10 ? '#dc2626' : '#16a34a' },
    { icon: 'people', label: 'Total Users', value: String(h.totalUsers || 0), color: '#2563eb' },
    { icon: 'book_online', label: 'Total Bookings', value: String(h.totalBookings || 0), color: '#7c3aed' },
    { icon: 'flag', label: 'Pending Reports', value: String(h.pendingReports || 0), color: h.pendingReports > 5 ? '#d97706' : '#16a34a' },
    { icon: 'access_time', label: 'Server Time', value: h.serverTime ? new Date(h.serverTime).toLocaleString() : '—', color: '#64748b' },
  ];

  return (
    <section className="admin-page">
      <div className="admin-hero" style={{ marginBottom: 0, borderRadius: '0 0 18px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <p className="admin-eyebrow">Monitoring</p>
            <h1>Platform Health</h1>
            <p>Real-time system health metrics, uptime, and error tracking at a glance.</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', cursor: 'pointer', color: '#fff' }}>
              <input type="checkbox" checked={autoRefresh} onChange={() => setAutoRefresh((v) => !v)} />
              Auto-refresh (15s)
            </label>
            <button type="button" className="admin-refresh-btn" onClick={loadHealth} style={{ background: '#fff', color: '#0f172a', borderColor: '#fff' }}>
              <Icon name="refresh" /> Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="admin-summary-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        {metrics.map((m) => (
          <div key={m.label} className="admin-stat" style={{ borderLeft: `4px solid ${m.color}` }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name={m.icon} /> {m.label}
            </span>
            <strong style={{ color: m.color }}>{m.value}</strong>
            {m.sub && <small style={{ color: '#94a3b8', display: 'block', marginTop: 4 }}>{m.sub}</small>}
          </div>
        ))}
      </div>

      {/* Memory usage bar */}
      <div className="admin-panel">
        <div className="admin-section-heading">
          <h3 style={{ margin: 0, fontSize: '1rem' }}>Memory Usage</h3>
          <span style={{ fontWeight: 700, color: h.memoryUsagePercent > 80 ? '#dc2626' : '#0f766e' }}>
            {h.memoryUsagePercent || 0}%
          </span>
        </div>
        <div style={{ height: 12, background: '#e2e8f0', borderRadius: 999, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${Math.min(100, h.memoryUsagePercent || 0)}%`,
            background: h.memoryUsagePercent > 80
              ? 'linear-gradient(90deg, #d97706, #dc2626)'
              : 'linear-gradient(90deg, #16a34a, #0f766e)',
            borderRadius: 999,
            transition: 'width 0.5s ease',
          }} />
        </div>
      </div>
    </section>
  );
}
