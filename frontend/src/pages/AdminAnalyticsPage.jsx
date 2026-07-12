import { useCallback, useEffect, useMemo, useState } from 'react';
import client from '../api/client';
import Icon from '../modules/common/dashboard/Icon';
import StatsCard from '../modules/common/dashboard/StatsCard';
import SectionCard from '../modules/common/dashboard/SectionCard';
import TrendChart from '../modules/common/dashboard/TrendChart';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import './AdminOperationsPage.css';
import './WalletPage.css';

const formatCurrency = (v) => {
  const n = Number(v || 0);
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n.toFixed(0)}`;
};

const formatNumber = (v) => Number(v || 0).toLocaleString();

export default function AdminAnalyticsPage({ notify }) {
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [referralAnalytics, setReferralAnalytics] = useState(null);
  const [referralLoading, setReferralLoading] = useState(false);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState({ csv: false, pdf: false });
  const [months, setMonths] = useState(6);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const loadDashboard = useCallback(async (monthOverride) => {
    setLoading(true);
    setError(null);
    try {
      const m = monthOverride != null ? monthOverride : months;
      const res = await client.get(`/api/v1/admin/dashboard?months=${m}`);
      setDashboard(res?.data?.data || null);
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to load dashboard data';
      setError(msg);
      notify?.({ type: 'error', title: 'Dashboard unavailable', message: msg });
    } finally {
      setLoading(false);
    }
  }, [notify, months]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => loadDashboard(), 30000);
    return () => clearInterval(interval);    }, [autoRefresh, loadDashboard]);

  const loadReferralAnalytics = useCallback(async () => {
    setReferralLoading(true);
    try {
      const res = await client.get('/api/v1/admin/referral-analytics');
      setReferralAnalytics(res?.data?.data || null);
    } catch (err) {
      console.warn('Failed to load referral analytics:', err);
    } finally {
      setReferralLoading(false);
    }
  }, []);

  useEffect(() => { loadReferralAnalytics(); }, [loadReferralAnalytics]);

  const handleRangeChange = (m) => {
    setMonths(m);
    loadDashboard(m);
  };

  // Loading state
  if (loading) {
    return (
      <section className="admin-page">
        <div className="admin-hero" style={{ marginBottom: 0, borderRadius: '0 0 18px 18px' }}>
          <p className="admin-eyebrow">Analytics</p>
          <h1>Platform Dashboard</h1>
          <p>Loading dashboard data...</p>
        </div>
        <div className="admin-panel" style={{ marginTop: 18, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {[1, 2, 3, 4].map((k) => (
            <div key={k} style={{ flex: '1 1 200px', height: 100, background: '#f1f5f9', borderRadius: 12, animation: 'pulse 1.5s infinite' }} />
          ))}
        </div>
      </section>
    );
  }

  if (error && !dashboard) {
    return (
      <section className="admin-page">
        <div className="admin-hero" style={{ marginBottom: 0, borderRadius: '0 0 18px 18px' }}>
          <p className="admin-eyebrow">Analytics</p>
          <h1>Platform Dashboard</h1>
          <p>Could not load dashboard data. Start the backend and ensure you are signed in as an admin.</p>
          <button type="button" className="admin-refresh-btn" onClick={loadDashboard} style={{ marginTop: 12 }}>
            <Icon name="refresh" /> Retry
          </button>
        </div>
      </section>
    );
  }

  const health = dashboard?.health || {};
  const signupTrend = dashboard?.signupTrend || [];
  const revenueTrend = dashboard?.revenueTrend || [];
  const sessionTrend = dashboard?.sessionTrend || [];
  const lastMonthRevenue = revenueTrend.length > 0 ? revenueTrend[revenueTrend.length - 1]?.value || 0 : 0;
  const prevMonthRevenue = revenueTrend.length > 1 ? revenueTrend[revenueTrend.length - 2]?.value || 0 : 0;
  const revenueDelta = prevMonthRevenue > 0 ? Math.round(((lastMonthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100) : 0;
  const lastMonthSignups = signupTrend.length > 0 ? signupTrend[signupTrend.length - 1]?.value || 0 : 0;
  const prevMonthSignups = signupTrend.length > 1 ? signupTrend[signupTrend.length - 2]?.value || 0 : 0;
  const signupDelta = prevMonthSignups > 0 ? Math.round(((lastMonthSignups - prevMonthSignups) / prevMonthSignups) * 100) : 0;

  // ── Export helpers ──

  const csvRows = useMemo(() => {
    const h = health || {};
    const rows = [
      ['Admin Dashboard Export', new Date().toISOString().slice(0, 10)],
      [],
      ['Platform Health Metrics'],
      ['Metric', 'Value'],
      ['Total Users', String(h.totalUsers)],
      ['Total Mentors', String(h.totalMentors)],
      ['Total Learners', String(h.totalLearners)],
      ['Active Users (7d)', String(h.activeUsers7d)],
      ['Joined Today', String(h.joinedToday)],
      ['Joined This Week', String(h.joinedThisWeek)],
      ['Total Bookings', String(h.totalBookings)],
      ['Completed Sessions', String(h.completedSessions)],
      ['Completion Rate (%)', String(h.completionRate)],
      ['Mentor Ratio (%)', String(h.mentorRatio)],
      ['Platform Fees', String(h.platformFees)],
      ['Total Released Amount', String(h.totalReleasedAmount)],
      [],
      ['Monthly Trends'],
      ['Month', 'Signups', 'Revenue', 'Completed Sessions'],
    ];
    const months = Math.max(signupTrend.length, revenueTrend.length, sessionTrend.length);
    for (let i = 0; i < months; i++) {
      rows.push([
        signupTrend[i]?.label || revenueTrend[i]?.label || sessionTrend[i]?.label || '',
        String(signupTrend[i]?.value || 0),
        String(revenueTrend[i]?.value || 0),
        String(sessionTrend[i]?.value || 0),
      ]);
    }
    return rows;
  }, [health, signupTrend, revenueTrend, sessionTrend]);

  const downloadCsv = (rows, fileName) => {
    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell || '').replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = useCallback(() => {
    setExporting((prev) => ({ ...prev, csv: true }));
    try {
      downloadCsv(csvRows, `admin-dashboard-${new Date().toISOString().slice(0, 10)}.csv`);
      notify?.({ type: 'success', title: 'CSV ready', message: 'Dashboard data downloaded as CSV.' });
    } catch {
      notify?.({ type: 'error', title: 'Export failed', message: 'Could not generate CSV.' });
    } finally {
      setExporting((prev) => ({ ...prev, csv: false }));
    }
  }, [csvRows, notify]);

  const handleExportPdf = useCallback(() => {
    setExporting((prev) => ({ ...prev, pdf: true }));
    try {
      const h = health || {};
      const doc = new jsPDF({ orientation: 'portrait' });
      doc.setFontSize(18);
      doc.text('Admin Dashboard', 14, 16);
      doc.setFontSize(9);
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 24);

      // Health metrics table
      const healthBody = [
        ['Total Users', String(h.totalUsers)],
        ['Total Mentors', String(h.totalMentors)],
        ['Total Learners', String(h.totalLearners)],
        ['Active Users (7d)', String(h.activeUsers7d)],
        ['Joined Today', String(h.joinedToday)],
        ['Joined This Week', String(h.joinedThisWeek)],
        ['Total Bookings', String(h.totalBookings)],
        ['Completed Sessions', String(h.completedSessions)],
        ['Completion Rate', `${h.completionRate || 0}%`],
        ['Platform Fees', `₹${Number(h.platformFees || 0).toFixed(2)}`],
        ['Total Released', `₹${Number(h.totalReleasedAmount || 0).toFixed(2)}`],
      ];

      doc.autoTable({
        startY: 30,
        head: [['Platform Health Metrics', 'Value']],
        body: healthBody,
        styles: { fontSize: 9 },
        headStyles: { fillColor: [15, 118, 110] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      });

      // Monthly trends table
      const months = Math.max(signupTrend.length, revenueTrend.length, sessionTrend.length);
      const trendBody = [];
      for (let i = 0; i < months; i++) {
        trendBody.push([
          signupTrend[i]?.label || revenueTrend[i]?.label || sessionTrend[i]?.label || '',
          String(Math.round(signupTrend[i]?.value || 0)),
          `₹${Number(revenueTrend[i]?.value || 0).toFixed(2)}`,
          String(Math.round(sessionTrend[i]?.value || 0)),
        ]);
      }

      const lastTableY = doc.lastAutoTable?.finalY || 40;
      doc.autoTable({
        startY: lastTableY + 14,
        head: [['Month', 'Signups', 'Revenue', 'Completed Sessions']],
        body: trendBody,
        styles: { fontSize: 9 },
        headStyles: { fillColor: [15, 118, 110] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      });

      doc.save(`admin-dashboard-${new Date().toISOString().slice(0, 10)}.pdf`);
      notify?.({ type: 'success', title: 'PDF ready', message: 'Dashboard report downloaded as PDF.' });
    } catch {
      notify?.({ type: 'error', title: 'Export failed', message: 'Could not generate PDF.' });
    } finally {
      setExporting((prev) => ({ ...prev, pdf: false }));
    }
  }, [health, signupTrend, revenueTrend, sessionTrend, notify]);

  return (
    <section className="admin-page">
      {/* ── Hero ── */}
      <div className="admin-hero" style={{ marginBottom: 0, borderRadius: '0 0 18px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <p className="admin-eyebrow">Analytics</p>
            <h1>Platform Dashboard</h1>
            <p>Real-time platform metrics, trends, and business intelligence at a glance.</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.12)', borderRadius: 8, padding: 2 }}>
              {[3, 6, 12, 24].map((m) => (
                <button key={m} type="button" onClick={() => handleRangeChange(m)}
                  style={{
                    padding: '5px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                    fontSize: '0.78rem', fontWeight: 700,
                    background: months === m ? '#fff' : 'transparent',
                    color: months === m ? '#0f172a' : 'rgba(255,255,255,0.85)',
                    transition: 'all 0.2s',
                  }}>
                  {m}mo
                </button>
              ))}
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', cursor: 'pointer', color: 'rgba(255,255,255,0.85)' }}>
              <input type="checkbox" checked={autoRefresh} onChange={() => setAutoRefresh((v) => !v)} />
              Auto
            </label>
            <button type="button" className="admin-refresh-btn" onClick={() => { loadDashboard(); loadReferralAnalytics(); }} style={{ background: '#fff', color: '#0f172a', borderColor: '#fff' }}>
              <Icon name="refresh" /> Refresh
            </button>
          </div>
        </div>
      </div>

      {/* ── Row 1: Health Metrics (4 StatsCards) ── */}
      <div className="wallet-card-grid" style={{ marginTop: 18 }}>
        <StatsCard
          icon="groups"
          label="Active Users (7d)"
          value={formatNumber(health.activeUsers7d)}
          delta={Math.round((health.activeUsers7d / Math.max(health.totalUsers, 1)) * 100)}
          description={`Out of ${formatNumber(health.totalUsers)} total users`}
        />
        <StatsCard
          icon="check_circle"
          label="Completion Rate"
          value={`${health.completionRate || 0}%`}
          delta={Math.round(health.completionRate || 0)}
          description={`${formatNumber(health.completedSessions)} completed sessions`}
        />
        <StatsCard
          icon="person_add"
          label="New Users (Today)"
          value={formatNumber(health.joinedToday)}
          delta={signupDelta}
          description={`${formatNumber(health.joinedThisWeek)} joined this week`}
        />
        <StatsCard
          icon="trending_up"
          label="Platform Fees"
          value={formatCurrency(health.platformFees)}
          delta={revenueDelta}
          description={`From ${formatCurrency(health.totalReleasedAmount)} released`}
        />
      </div>

      {/* ── Row 2: Signups + Revenue Charts ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 }}>
        <SectionCard title="Signup Trend (6 months)" icon="person_add" action="View Users" actionTo="/admin/users">
          {signupTrend.length > 0 ? (
            <TrendChart data={signupTrend} type="bar" height={180} valueFormatter={(v) => `${v} users`} />
          ) : (
            <div className="admin-empty-state"><Icon name="person_add" /><p>No signup data yet.</p></div>
          )}
        </SectionCard>
        <SectionCard title="Revenue Trend (6 months)" icon="payments" action="View Payments" actionTo="/admin/payments">
          {revenueTrend.length > 0 ? (
            <TrendChart data={revenueTrend} type="area" height={180} gradientId="adminRevenue"
              valueFormatter={(v) => formatCurrency(v)} />
          ) : (
            <div className="admin-empty-state"><Icon name="payments" /><p>No revenue data yet.</p></div>
          )}
        </SectionCard>
      </div>

      {/* ── Row 3: Sessions + User Breakdown ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 }}>
        <SectionCard title="Completed Sessions (6 months)" icon="calendar_month" action="View Sessions" actionTo="/admin/sessions">
          {sessionTrend.length > 0 ? (
            <TrendChart data={sessionTrend} type="bar" height={180} valueFormatter={(v) => `${v} sessions`} />
          ) : (
            <div className="admin-empty-state"><Icon name="calendar_month" /><p>No session data yet.</p></div>
          )}
        </SectionCard>
        <SectionCard title="Platform Overview" icon="dashboard" headerExtra={
          <span className="admin-count-badge">{health.mentorRatio || 0}% mentors</span>
        }>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 0' }}>
            <MetricRow label="Total Users" value={formatNumber(health.totalUsers)} icon="people" />
            <MetricRow label="Learners" value={formatNumber(health.totalLearners)} icon="school" />
            <MetricRow label="Mentors" value={formatNumber(health.totalMentors)} icon="verified" />
            <MetricRow label="Total Bookings" value={formatNumber(health.totalBookings)} icon="book_online" />
            <MetricRow label="Completed Sessions" value={formatNumber(health.completedSessions)} icon="check_circle" />
            <MetricRow label="Total Released" value={formatCurrency(health.totalReleasedAmount)} icon="payments" />
          </div>
        </SectionCard>
      </div>

      {/* ── Quick actions ── */}
      <div className="admin-panel" style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="auto_awesome" />
          <span style={{ fontWeight: 700, color: '#0f172a' }}>Quick Actions</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="admin-refresh-btn" onClick={loadDashboard}>
            <Icon name="refresh" /> Refresh
          </button>
          <button type="button" className="admin-refresh-btn" onClick={handleExportCsv} disabled={exporting.csv} style={{ background: '#059669' }}>
            <Icon name="table_chart" /> {exporting.csv ? 'Exporting…' : 'Export CSV'}
          </button>
          <button type="button" className="admin-refresh-btn" onClick={handleExportPdf} disabled={exporting.pdf} style={{ background: '#b91c1c' }}>
            <Icon name="picture_as_pdf" /> {exporting.pdf ? 'Exporting…' : 'Export PDF'}
          </button>
        </div>
      </div>

      {/* ── REFERRAL ANALYTICS ── */}
      {referralAnalytics && (
        <>
          <div className="admin-section-divider">
            <span className="admin-section-divider__line" />
            <span className="admin-section-divider__label"><Icon name="share" /> Referral Analytics</span>
            <span className="admin-section-divider__line" />
          </div>

          <div className="wallet-card-grid">
            <StatsCard
              icon="group_add"
              label="Total Referrals"
              value={formatNumber(referralAnalytics.totalReferrals)}
              description={`${formatNumber(referralAnalytics.totalReferrers)} unique referrers`}
            />
            <StatsCard
              icon="payments"
              label="Total Credits Earned"
              value={formatNumber(referralAnalytics.totalCreditsEarned)}
              description={`${referralAnalytics.avgPerReferrer} avg per referrer`}
            />
            <StatsCard
              icon="trending_up"
              label="Conversion Rate"
              value={`${referralAnalytics.conversionRate}%`}
              description={`Of all users have referred someone`}
            />
            <StatsCard
              icon="groups"
              label="Users with Referral Code"
              value={formatNumber(referralAnalytics.usersWithReferralCode)}
              description={`Total users who can refer`}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 }}>
            <SectionCard title="Referral Trend" icon="timeline">
              {referralAnalytics.referralTrend?.length > 0 ? (
                <TrendChart data={referralAnalytics.referralTrend} type="bar" height={180} valueFormatter={(v) => `${v} referrals`} />
              ) : (
                <div className="admin-empty-state"><Icon name="timeline" /><p>No referral data yet.</p></div>
              )}
            </SectionCard>
            <SectionCard title="Top Referrers" icon="leaderboard" headerExtra={
              <span className="admin-count-badge">{referralAnalytics.topReferrers?.length || 0} users</span>
            }>
              {referralAnalytics.topReferrers?.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 0' }}>
                  <div style={{
                    display: 'grid', gridTemplateColumns: '32px 1fr 80px 80px', gap: 8,
                    padding: '6px 8px', fontSize: '0.72rem', fontWeight: 700,
                    color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em',
                  }}>
                    <span>#</span>
                    <span>Name</span>
                    <span style={{ textAlign: 'right' }}>Referrals</span>
                    <span style={{ textAlign: 'right' }}>Credits</span>
                  </div>
                  {referralAnalytics.topReferrers.map((referrer) => (
                    <div key={referrer.userId} style={{
                      display: 'grid', gridTemplateColumns: '32px 1fr 80px 80px', gap: 8,
                      alignItems: 'center', padding: '8px 8px', borderRadius: 8,
                      background: referrer.rank <= 3 ? 'rgba(251,191,36,0.06)' : 'transparent',
                      borderBottom: '1px solid #f1f5f9',
                    }}>
                      <span style={{
                        width: 26, height: 26, borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.75rem', fontWeight: 800,
                        background: referrer.rank === 1 ? '#fbbf24' : referrer.rank === 2 ? '#c0c0c0' : referrer.rank === 3 ? '#cd7f32' : '#f1f5f9',
                        color: referrer.rank <= 3 ? '#1e293b' : '#64748b',
                      }}>
                        {referrer.rank}
                      </span>
                      <span style={{ fontWeight: 600, fontSize: '0.88rem', color: '#0f172a' }}>
                        {referrer.name}
                      </span>
                      <span style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.9rem', color: '#059669' }}>
                        {referrer.referralCount}
                      </span>
                      <span style={{ textAlign: 'right', fontWeight: 600, fontSize: '0.85rem', color: '#475569' }}>
                        {formatNumber(referrer.creditsEarned)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="admin-empty-state"><Icon name="group_add" /><p>No referrers yet.</p></div>
              )}
            </SectionCard>
          </div>
        </>
      )}
    </section>
  );
}

function MetricRow({ label, value, icon }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#475569', fontSize: '0.9rem' }}>
        <Icon name={icon} /> {label}
      </div>
      <strong style={{ color: '#0f172a', fontSize: '0.95rem' }}>{value}</strong>
    </div>
  );
}
