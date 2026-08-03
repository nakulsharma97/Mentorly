import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import client from '../api/client';
import Icon from '../modules/common/dashboard/Icon';
import StatsCard from '../modules/common/dashboard/StatsCard';
import SectionCard from '../modules/common/dashboard/SectionCard';
import TrendChart from '../modules/common/dashboard/TrendChart';
import './AdminOperationsPage.css';

const statusOptions = ['OPEN', 'IN_REVIEW', 'RESOLVED', 'REJECTED'];

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

/** Compact timestamp for list rows (e.g. "Jul 25, 2:05 PM"). */
const formatTimeShort = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

/** Two-letter initials from a participant or sender name for avatar placeholders. */
const initialsOf = (name) => {
  if (!name) return '?';
  const parts = String(name).split(/[\s&]+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((part) => part[0].toUpperCase());
  return letters.join('') || '?';
};

const TABS = [
  { key: 'overview', label: 'Overview', icon: 'dashboard' },
  { key: 'reports', label: 'Reports', icon: 'flag' },
  { key: 'conversations', label: 'Conversations', icon: 'forum' },
  { key: 'payments', label: 'Payments', icon: 'payments' },
  { key: 'referral', label: 'Referrals', icon: 'share' },
];

const PATH_TAB_MAP = {
  dashboard: 'overview',
  reports: 'reports',
  conversations: 'conversations',
  payments: 'payments',
  referral: 'referral',
};

export default function AdminOperationsPage({ notify }) {
  const location = useLocation();
  const pathSegment = location.pathname.split('/').pop();
  const [activeTab, setActiveTab] = useState(PATH_TAB_MAP[pathSegment] || 'overview');
  const [summary, setSummary] = useState(null);
  const [reports, setReports] = useState([]);
  const [reportStatus, setReportStatus] = useState('OPEN');
  const [loading, setLoading] = useState(true);

  // ── Conversations state ──
  const [convs, setConvs] = useState([]);
  const [convsLoading, setConvsLoading] = useState(false);
  const [convSearch, setConvSearch] = useState('');
  const [convSearchApplied, setConvSearchApplied] = useState(''); // debounced, used in requests
  const [convTypeFilter, setConvTypeFilter] = useState('all');
  const [selectedConv, setSelectedConv] = useState(null);
  const [convMessages, setConvMessages] = useState([]);
  const [convMessagesLoading, setConvMessagesLoading] = useState(false);
  const [convMessagesError, setConvMessagesError] = useState(false);
  // Guards against out-of-order responses: only the latest request may update state.
  const convRequestRef = useRef(0);
  const msgRequestRef = useRef(0);
  const messagesEndRef = useRef(null);

  // ── Referral state ──
  const [referralAnalytics, setReferralAnalytics] = useState(null);
  const [referralLoading, setReferralLoading] = useState(false);

  // ── Payments state ──
  const [paymentsData, setPaymentsData] = useState(null);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('');
  const [paymentGatewayFilter, setPaymentGatewayFilter] = useState('');
  const [paymentSearch, setPaymentSearch] = useState('');
  const [refundingId, setRefundingId] = useState(null);
  const [paymentExporting, setPaymentExporting] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState(null);

  // ── Loaders ──
  const loadAdminData = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryResponse, reportsResponse] = await Promise.all([
        client.get('/api/v1/admin/summary'),
        client.get(`/api/v1/admin/reports?status=${reportStatus}`)
      ]);
      setSummary(summaryResponse.data.data);
      setReports(reportsResponse.data.data || []);
    } catch {
      notify?.({
        type: 'error',
        title: 'Admin data unavailable',
        message: 'Check that you are signed in as an admin and the backend is running.'
      });
    } finally {
      setLoading(false);
    }
  }, [notify, reportStatus]);

  const loadConversations = useCallback(async () => {
    const requestId = ++convRequestRef.current;
    setConvsLoading(true);
    try {
      const params = new URLSearchParams();
      if (convTypeFilter !== 'all') params.set('type', convTypeFilter);
      if (convSearchApplied.trim()) params.set('q', convSearchApplied.trim());
      const res = await client.get(`/api/v1/admin/conversations?${params}`);
      if (requestId !== convRequestRef.current) return; // stale response — ignore
      setConvs(res?.data?.data || []);
    } catch (err) {
      if (requestId !== convRequestRef.current) return;
      const msg = err?.response?.data?.data?.error || err?.response?.data?.message || 'Could not load conversations.';
      notify?.({ type: 'error', title: 'Conversations unavailable', message: msg });
    } finally {
      if (requestId === convRequestRef.current) setConvsLoading(false);
    }
  }, [notify, convTypeFilter, convSearchApplied]);

  const loadReferralAnalytics = useCallback(async () => {
    setReferralLoading(true);
    try {
      const res = await client.get('/api/v1/admin/referral-analytics');
      setReferralAnalytics(res?.data?.data || null);
    } catch {
      notify?.({ type: 'error', title: 'Referral analytics unavailable', message: 'Could not load referral data.' });
    } finally {
      setReferralLoading(false);
    }
  }, [notify]);

  const loadPayments = useCallback(async () => {
    setPaymentsLoading(true);
    try {
      const params = new URLSearchParams();
      if (paymentStatusFilter) params.set('status', paymentStatusFilter);
      if (paymentGatewayFilter) params.set('gateway', paymentGatewayFilter);
      if (paymentSearch.trim()) params.set('q', paymentSearch.trim());
      const res = await client.get(`/api/v1/admin/payments?${params}`);
      setPaymentsData(res?.data?.data || null);
    } catch {
      notify?.({ type: 'error', title: 'Payments unavailable', message: 'Could not load payment data.' });
    } finally {
      setPaymentsLoading(false);
    }
  }, [notify, paymentStatusFilter, paymentGatewayFilter, paymentSearch]);

  useEffect(() => {
    loadAdminData();
    loadReferralAnalytics(); // Eager load for tab badge
  }, [loadAdminData, loadReferralAnalytics]);

  // Debounce the conversation search box: wait until the user stops typing
  // before triggering a request, so each keystroke does not fire an API call.
  useEffect(() => {
    const timer = setTimeout(() => setConvSearchApplied(convSearch.trim()), 350);
    return () => clearTimeout(timer);
  }, [convSearch]);

  useEffect(() => {
    if (activeTab === 'conversations') loadConversations();
  }, [activeTab, loadConversations]);

  // Keep the message panel scrolled to the latest message whenever the
  // selected conversation or its messages change.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [convMessages, convMessagesLoading, selectedConv?.id]);

  useEffect(() => {
    if (activeTab === 'referral') loadReferralAnalytics();
  }, [activeTab, loadReferralAnalytics]);

  useEffect(() => {
    if (activeTab === 'payments') loadPayments();
  }, [activeTab, loadPayments]);

  // ── Report actions ──
  const updateReportStatus = async (reportId, nextStatus) => {
    try {
      await client.patch(`/api/v1/admin/reports/${reportId}`, { status: nextStatus });
      notify?.({
        type: 'success',
        title: 'Report updated',
        message: `Report moved to ${nextStatus.toLowerCase().replace('_', ' ')}.`
      });
      loadAdminData();
    } catch {
      notify?.({
        type: 'error',
        title: 'Update failed',
        message: 'The report could not be updated.'
      });
    }
  };

  // ── Conversation actions ──
  const selectConversation = useCallback(async (conv) => {
    // Already viewing this conversation and its messages are loaded or loading.
    // If the previous load failed, allow re-clicking to retry it.
    if (selectedConv?.id === conv.id && !convMessagesError) return;
    const requestId = ++msgRequestRef.current;
    setSelectedConv(conv);
    setConvMessagesLoading(true);
    setConvMessagesError(false);
    setConvMessages([]);
    try {
      const endpoint = conv.kind === 'booking'
        ? `/api/v1/admin/conversations/booking/${conv.referenceId}/messages`
        : `/api/v1/admin/conversations/direct/${conv.referenceId}/messages`;
      const res = await client.get(endpoint);
      if (requestId !== msgRequestRef.current) return; // stale response — ignore
      setConvMessages(res?.data?.data || []);
    } catch (err) {
      if (requestId !== msgRequestRef.current) return;
      setConvMessagesError(true);
      const msg = err?.response?.data?.data?.error || err?.response?.data?.message || 'Could not load messages for this conversation.';
      notify?.({ type: 'error', title: 'Messages failed', message: msg });
    } finally {
      if (requestId === msgRequestRef.current) setConvMessagesLoading(false);
    }
  }, [notify, selectedConv, convMessagesError]);

  // ── Payment actions ──
  const handleRefund = async (paymentId) => {
    setRefundingId(paymentId);
    try {
      await client.post(`/api/v1/admin/payments/${paymentId}/refund`, { reason: 'Admin-initiated refund' });
      notify?.({ type: 'success', title: 'Payment refunded', message: `Payment #${paymentId} has been refunded.` });
      loadPayments();
    } catch (err) {
      const msg = err?.response?.data?.data?.error || err?.response?.data?.message || 'Refund failed';
      notify?.({ type: 'error', title: 'Refund failed', message: msg });
    } finally {
      setRefundingId(null);
    }
  };

  const handleCertMigration = async () => {
    setMigrating(true);
    setMigrationResult(null);
    try {
      const res = await client.post('/api/v1/admin/migrations/certificates-to-structured');
      setMigrationResult(res?.data?.data || null);
      notify?.({
        type: 'success',
        title: 'Migration complete',
        message: `${res?.data?.data?.certsCreated || 0} certifications migrated.`
      });
    } catch (err) {
      const msg = err?.response?.data?.data?.error || err?.response?.data?.message || 'Migration failed';
      notify?.({ type: 'error', title: 'Migration failed', message: msg });
    } finally {
      setMigrating(false);
    }
  };

  const handlePaymentExport = () => {
    if (!paymentsData?.payments?.length) return;
    setPaymentExporting(true);
    try {
      const rows = [
        ['ID', 'Order ID', 'Learner', 'Mentor', 'Amount', 'Currency', 'Status', 'Gateway', 'Date'],
        ...paymentsData.payments.map((p) => [
          String(p.id), p.orderId, p.learnerName, p.mentorName,
          String(p.amount), p.currency, p.status, p.gateway, formatDate(p.createdAt),
        ]),
      ];
      const csv = rows.map((r) => r.map((c) => `"${String(c || '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = `payments-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
      notify?.({ type: 'success', title: 'CSV ready', message: 'Payments exported.' });
    } catch { notify?.({ type: 'error', title: 'Export failed', message: 'Could not export payments.' }); }
    finally { setPaymentExporting(false); }
  };

  const formatNumber = (v) => Number(v || 0).toLocaleString();

  const renderReferralTab = () => (
    <section className="admin-panel">
      <div className="admin-section-heading">
        <div>
          <p className="admin-eyebrow">Referral Program</p>
          <h2>Referral Analytics</h2>
        </div>
        <button type="button" className="admin-refresh-btn" onClick={loadReferralAnalytics} disabled={referralLoading}>
          {referralLoading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {referralLoading ? (
        <p>Loading referral analytics...</p>
      ) : !referralAnalytics ? (
        <div className="admin-empty-state">
          <Icon name="share" />
          <p>No referral data available yet.</p>
        </div>
      ) : (
        <>
          <div className="admin-payment-stats" style={{ marginBottom: 18 }}>
            <StatsCard icon="group_add" label="Total Referrals"
              value={formatNumber(referralAnalytics.totalReferrals)}
              description={`${formatNumber(referralAnalytics.totalReferrers)} unique referrers`} />
            <StatsCard icon="payments" label="Credits Earned"
              value={formatNumber(referralAnalytics.totalCreditsEarned)}
              description={`${referralAnalytics.avgPerReferrer} avg per referrer`} />
            <StatsCard icon="trending_up" label="Conversion Rate"
              value={`${referralAnalytics.conversionRate}%`}
              description="Of all users have referred someone" />
            <StatsCard icon="groups" label="Users w/ Referral Code"
              value={formatNumber(referralAnalytics.usersWithReferralCode)}
              description="Total users who can refer" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 }}>
            <SectionCard title="Referral Trend (12 months)" icon="timeline">
              {referralAnalytics.referralTrend?.length > 0 ? (
                <TrendChart data={referralAnalytics.referralTrend} type="bar" height={180}
                  valueFormatter={(v) => `${v} referrals`} />
              ) : (
                <div className="admin-empty-state"><Icon name="timeline" /><p>No referral trend data yet.</p></div>
              )}
            </SectionCard>
            <SectionCard title="Top Referrers" icon="leaderboard" headerExtra={
              <span className="admin-count-badge">{referralAnalytics.topReferrers?.length || 0} users</span>
            }>
              {referralAnalytics.topReferrers?.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '4px 0' }}>
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
                    <div key={referrer.userId} className="admin-referrer-row">
                      <span className={`admin-referrer-rank${referrer.rank <= 3 ? ' admin-referrer-rank--top' : ''}`}>
                        {referrer.rank}
                      </span>
                      <span className="admin-referrer-name">
                        {referrer.name}
                      </span>
                      <span className="admin-referrer-count">
                        {referrer.referralCount}
                      </span>
                      <span className="admin-referrer-credits">
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

  // ── Render helpers ──
  const renderSummary = () => (
    <section className="admin-summary-grid" aria-label="Platform summary">
      <SummaryCard label="Users" value={summary.totalUsers} />
      <SummaryCard label="Learners" value={summary.learners} />
      <SummaryCard label="Mentors" value={summary.mentors} />
      <SummaryCard label="Open reports" value={summary.openReports} />
      <SummaryCard label="Pending verifications" value={summary.pendingMentorVerifications} />
    </section>
  );

  const renderReportsTab = () => (
    <section className="admin-panel">
      <div className="admin-section-heading">
        <div>
          <p className="admin-eyebrow">Trust and safety</p>
          <h2>Report queue</h2>
        </div>
        <label className="admin-field">
          <span>Status</span>
          <select value={reportStatus} onChange={(event) => setReportStatus(event.target.value)}>
            {statusOptions.map((item) => (
              <option key={item} value={item}>{item.replace('_', ' ')}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Reason</th>
              <th>Target</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((report) => (
              <tr key={report.id}>
                <td>
                  <strong>{report.reason}</strong>
                  <p>{report.details || 'No extra details provided.'}</p>
                </td>
                <td>{report.targetType || 'USER'} #{report.targetId || report.reported?.id}</td>
                <td>{report.status}</td>
                <td>
                  <select
                    value={report.status}
                    onChange={(event) => updateReportStatus(report.id, event.target.value)}
                  >
                    {statusOptions.map((item) => (
                      <option key={item} value={item}>{item.replace('_', ' ')}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
            {reports.length === 0 && (
              <tr><td colSpan="4">No reports in this queue.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );

  const renderVerificationsLink = () => (
    <section className="admin-panel">
      <div className="admin-section-heading">
        <div>
          <p className="admin-eyebrow">Verification</p>
          <h2>Mentor Verification Queue</h2>
        </div>
        <span className="admin-count-badge">{summary?.pendingMentorVerifications || 0} pending</span>
      </div>
      <p style={{ margin: '0 0 14px', color: '#475569', fontSize: '0.88rem', lineHeight: 1.6 }}>
        Review uploaded certificates, resumes, and experience before approving or
        rejecting mentor verification requests. Approved mentors receive a
        verified badge and are notified.
      </p>
      <Link to="/admin/verifications" className="admin-refresh-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
        <Icon name="verified" /> Open Verification Center
      </Link>
    </section>
  );

  const renderConversationsTab = () => (
    <section className="admin-panel">
      <div className="admin-section-heading">
        <div>
          <p className="admin-eyebrow">Messaging</p>
          <h2>All Conversations</h2>
        </div>
        <div className="admin-field-group">
          <select value={convTypeFilter} onChange={(e) => setConvTypeFilter(e.target.value)}>
            <option value="all">All types</option>
            <option value="booking">Booking</option>
            <option value="direct">Direct</option>
          </select>
        </div>
      </div>
      <div className="admin-conv-search">
        <Icon name="search" />
        <input type="text" placeholder="Search by name, email, title, or message..."
          value={convSearch}
          onChange={(e) => setConvSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') setConvSearchApplied(convSearch.trim()); }} />
        <button type="button" className="admin-refresh-btn" onClick={() => setConvSearchApplied(convSearch.trim())} disabled={convsLoading}>
          {convsLoading ? 'Searching...' : 'Search'}
        </button>
      </div>

      <div className="admin-conv-layout">
        <div className="admin-conv-list" aria-label="Conversation list">
          {convsLoading ? (
            <p style={{ padding: 16, color: 'var(--admin-muted)' }}>Loading conversations...</p>
          ) : convs.length === 0 ? (
            <div className="admin-conv-empty" role="status">
              <span className="admin-conv-empty-art" aria-hidden="true">
                <Icon name="forum" />
              </span>
              <h3>{convSearchApplied.trim() || convTypeFilter !== 'all' ? 'No matching conversations' : 'No conversations found'}</h3>
              <p>
                {convSearchApplied.trim() || convTypeFilter !== 'all'
                  ? 'Try a different search term or filter.'
                  : 'Conversations from bookings and direct messages will appear here.'}
              </p>
            </div>
          ) : (
            convs.map((conv) => (
              <button key={conv.id}
                className={`admin-conv-item ${selectedConv?.id === conv.id ? 'is-selected' : ''}`}
                onClick={() => selectConversation(conv)}
                aria-current={selectedConv?.id === conv.id ? 'true' : undefined}>
                <div className="admin-conv-item-avatar" aria-hidden="true">
                  {initialsOf(conv.participantName)}
                </div>
                <div className="admin-conv-item-body">
                  <div className="admin-conv-item-top">
                    <strong className="admin-conv-item-name">{conv.participantName}</strong>
                    <span className="admin-conv-item-time" title={formatDate(conv.lastActivityAt)}>
                      {formatTimeShort(conv.lastActivityAt)}
                    </span>
                  </div>
                  <div className="admin-conv-item-title">{conv.sessionTitle}</div>
                  <div className="admin-conv-item-preview">
                    {conv.lastMessagePreview || <span className="admin-text-muted">No messages yet</span>}
                  </div>
                  <div className="admin-conv-item-meta">
                    <span className={`admin-pill ${conv.kind === 'booking' ? 'admin-pill--booking' : 'admin-pill--direct'}`}>
                      {conv.kind}
                    </span>
                    <span className="admin-conv-item-status">{conv.status}</span>
                    {conv.unreadCount > 0 && (
                      <span className="admin-unread-badge" title={`${conv.unreadCount} unread`}>{conv.unreadCount}</span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        <div className="admin-conv-messages" aria-label="Conversation messages">
          {!selectedConv ? (
            <div className="admin-conv-empty">
              <span className="admin-conv-empty-art" aria-hidden="true">
                <Icon name="chat" />
              </span>
              <h3>Select a conversation</h3>
              <p>Choose a conversation from the list to read its full message history.</p>
            </div>
          ) : convMessagesLoading ? (
            <p style={{ padding: 16, color: 'var(--admin-muted)' }}>Loading messages...</p>
          ) : (
            <>
              <div className="admin-conv-messages-header">
                <h3>{selectedConv.participantName}</h3>
                <p className="admin-text-muted">{selectedConv.sessionTitle} &middot; {selectedConv.kind} conversation</p>
              </div>
              <div className="admin-conv-messages-list">
                {convMessages.length === 0 ? (
                  <div className="admin-conv-empty">
                    <span className="admin-conv-empty-art" aria-hidden="true">
                      <Icon name="mail" />
                    </span>
                    <h3>No messages yet</h3>
                    <p>This conversation has no messages so far.</p>
                  </div>
                ) : (
                  convMessages.map((msg) => (
                    <div key={msg.id} className="admin-msg">
                      <div className="admin-msg-avatar" aria-hidden="true">{initialsOf(msg.senderName)}</div>
                      <div className="admin-msg-main">
                        <div className="admin-msg-header">
                          <strong>{msg.senderName}</strong>
                          <span className="admin-text-muted">{msg.senderEmail}</span>
                          <span className="admin-msg-time" title={formatDate(msg.createdAt)}>{formatTimeShort(msg.createdAt)}</span>
                          {msg.readByRecipient && <span className="admin-read-badge" title="Read by recipient">✓✓</span>}
                        </div>
                        <p className="admin-msg-content">{msg.content}</p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );

  const renderPaymentsTab = () => (
    <section className="admin-panel">
      <div className="admin-section-heading">
        <div>
          <p className="admin-eyebrow">Finance</p>
          <h2>Payment Dashboard</h2>
        </div>
        <button type="button" className="admin-refresh-btn" onClick={loadPayments} disabled={paymentsLoading}>
          {paymentsLoading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Overview stats */}
      {paymentsData && (
        <div className="admin-payment-stats">
          <div className="admin-payment-stat">
            <span>Total Revenue</span>
            <strong>{Number(paymentsData.totalRevenue || 0).toFixed(2)} INR</strong>
          </div>
          <div className="admin-payment-stat">
            <span>Escrowed</span>
            <strong>{Number(paymentsData.totalEscrowed || 0).toFixed(2)} INR</strong>
            <small>{paymentsData.escrowedCount} payments</small>
          </div>
          <div className="admin-payment-stat">
            <span>Refunded</span>
            <strong>{Number(paymentsData.totalRefunded || 0).toFixed(2)} INR</strong>
            <small>{paymentsData.refundedCount} payments</small>
          </div>
          <div className="admin-payment-stat">
            <span>Platform Fees (10%)</span>
            <strong>{Number(paymentsData.platformFees || 0).toFixed(2)} INR</strong>
          </div>
          <div className="admin-payment-stat admin-payment-stat--warn">
            <span>Failed</span>
            <strong>{paymentsData.failedCount}</strong>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="admin-payment-filters">
        <div className="admin-search">
          <Icon name="search" />
          <input type="text" placeholder="Search by ID, order, gateway, status..."
            value={paymentSearch}
            onChange={(e) => setPaymentSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') loadPayments(); }} />
        </div>
        <select value={paymentStatusFilter} onChange={(e) => setPaymentStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="INITIATED">Initiated</option>
          <option value="ESCROWED">Escrowed</option>
          <option value="RELEASED">Released</option>
          <option value="REFUNDED">Refunded</option>
          <option value="FAILED">Failed</option>
        </select>
        <select value={paymentGatewayFilter} onChange={(e) => setPaymentGatewayFilter(e.target.value)}>
          <option value="">All gateways</option>
          <option value="razorpay">Razorpay</option>
          <option value="stripe">Stripe</option>
          <option value="paypal">PayPal</option>
          <option value="wallet">Wallet</option>
        </select>
        <button type="button" className="admin-refresh-btn" onClick={loadPayments} disabled={paymentsLoading}>
          Filter
        </button>
        <button type="button" className="admin-refresh-btn" onClick={handlePaymentExport} disabled={paymentExporting}
          style={{ background: '#059669' }}>
          <Icon name="table_chart" /> {paymentExporting ? 'Exporting...' : 'Export CSV'}
        </button>
      </div>

      {/* Payment table */}
      <div className="admin-table-wrap">
        {paymentsLoading ? (
          <p>Loading payments...</p>
        ) : !paymentsData || paymentsData.payments?.length === 0 ? (
          <div className="admin-empty-state">
            <Icon name="payments" />
            <p>No payments match the current filters.</p>
          </div>
        ) : (
          <table className="admin-table admin-payment-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Order ID</th>
                <th>Learner</th>
                <th>Mentor</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Gateway</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paymentsData.payments.map((p) => (
                <tr key={p.id}>
                  <td>#{p.id}</td>
                  <td className="admin-cell-mono">{p.orderId}</td>
                  <td>{p.learnerName}</td>
                  <td>{p.mentorName}</td>
                  <td className="admin-cell-num">{p.amount.toFixed(2)} {p.currency}</td>
                  <td>
                    <span className={`admin-status-pill admin-status-pill--${p.status.toLowerCase()}`}>
                      {p.status}
                    </span>
                  </td>
                  <td>{p.gateway}</td>
                  <td>{formatDate(p.createdAt)}</td>
                  <td>
                    {p.status === 'ESCROWED' && (
                      <button type="button"
                        className="admin-action-btn admin-action-refund"
                        disabled={refundingId === p.id}
                        onClick={() => handleRefund(p.id)}>
                        {refundingId === p.id ? '...' : 'Refund'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );

  // ── Main render ──
  if (loading && activeTab === 'overview') {
    return (
      <main className="admin-page">
        <section className="admin-hero">
          <h1>Admin operations</h1>
          <p>Loading moderation queue...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <section className="admin-hero">
        <div>
          <p className="admin-eyebrow">Operations</p>
          <h1>Admin control center</h1>
          <p>Review reports, track mentor verification, monitor conversations, and manage payments.</p>
        </div>
      </section>

      {/* Summary cards (always visible) */}
      {summary && renderSummary()}

      {/* Tabs */}
      <div className="admin-tabs" role="tablist" aria-label="Admin sections">
        {TABS.map((tab) => (
          <button key={tab.key} type="button"
            className={`admin-tab ${activeTab === tab.key ? 'admin-tab--active' : ''}`}
            onClick={() => setActiveTab(tab.key)}>
            <Icon name={tab.icon} />
            {tab.label}
            {tab.key === 'referral' && referralAnalytics && (
              <span className="admin-count-badge">{referralAnalytics.totalReferrals}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <>
          {/* ── Certification Migration Card ── */}
          <section className="admin-panel">
            <div className="admin-section-heading">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="admin-eyebrow" style={{ margin: 0 }}>
                  <Icon name="workspace_premium" /> Data Migration
                </span>
              </div>
            </div>
            <div style={{ color: '#475569', fontSize: '0.88rem', lineHeight: 1.6, marginBottom: 14 }}>
              <p style={{ margin: 0 }}>
                Migrate existing text-field certification data into structured certification entities.
                This scans all mentors who have free-text certifications and creates structured
                <code style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: 4, fontSize: '0.8rem' }}>MentorCertification</code>
                records. Users who already have structured certifications are skipped.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="admin-refresh-btn"
                onClick={handleCertMigration}
                disabled={migrating}
                style={{
                  padding: '10px 20px',
                  background: migrating ? '#94a3b8' : 'linear-gradient(135deg, #0f766e, #14b8a6)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 10,
                  fontWeight: 700,
                  cursor: migrating ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  transition: 'opacity 0.2s',
                }}
              >
                {migrating ? (
                  <>
                    <span className="material-symbols-outlined migrate-spinner">sync</span>
                    Migrating...
                  </>
                ) : (
                  <>
                    <Icon name="upload" />
                    Migrate Certifications
                  </>
                )}
              </button>

              {migrating && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#0f766e', fontSize: '0.85rem', fontWeight: 600 }}>
                  <div className="migration-progress-bar">
                    <div className="migration-progress-fill" />
                  </div>
                  Processing...
                </div>
              )}

              {migrationResult && !migrating && (
                <div style={{
                  display: 'flex', gap: 10, flexWrap: 'wrap', padding: '12px 16px',
                  background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, fontSize: '0.82rem',
                }}>
                  <span style={{ fontWeight: 700, color: '#065f46' }}>✅ Migration Complete</span>
                  <MigrationStat label="Users processed" value={migrationResult.usersProcessed} color="#0f766e" />
                  <MigrationStat label="Certs created" value={migrationResult.certsCreated} color="#059669" />
                  <MigrationStat label="Skipped (no text)" value={migrationResult.usersSkippedNoText} color="#64748b" />
                  <MigrationStat label="Skipped (already migrated)" value={migrationResult.usersSkippedAlreadyMigrated} color="#64748b" />
                  {migrationResult.parseErrors > 0 && (
                    <MigrationStat label="Parse errors" value={migrationResult.parseErrors} color="#dc2626" />
                  )}
                </div>
              )}
            </div>
          </section>

          {/* ── Referral Summary Widget ── */}
          {referralAnalytics && (
            <section className="admin-panel">
              <div className="admin-section-heading">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="admin-eyebrow" style={{ margin: 0 }}>
                    <Icon name="share" /> Referral Program
                  </span>
                  <span className="admin-count-badge">{referralAnalytics.totalReferrals} total</span>
                </div>
                <button type="button" className="admin-refresh-btn"
                  onClick={() => setActiveTab('referral')}>
                  View Details <Icon name="arrow_forward" />
                </button>
              </div>
              <div className="admin-payment-stats">
                <div className="admin-payment-stat">
                  <span>Referrals</span>
                  <strong>{formatNumber(referralAnalytics.totalReferrals)}</strong>
                  <small>{formatNumber(referralAnalytics.totalReferrers)} unique referrers</small>
                </div>
                <div className="admin-payment-stat">
                  <span>Credits Earned</span>
                  <strong>{formatNumber(referralAnalytics.totalCreditsEarned)}</strong>
                  <small>{referralAnalytics.avgPerReferrer} avg each</small>
                </div>
                <div className="admin-payment-stat">
                  <span>Conversion Rate</span>
                  <strong>{referralAnalytics.conversionRate}%</strong>
                  <small>Of all users referred someone</small>
                </div>
                <div className="admin-payment-stat">
                  <span>Users w/ Code</span>
                  <strong>{formatNumber(referralAnalytics.usersWithReferralCode)}</strong>
                  <small>Total who can refer</small>
                </div>
              </div>

              {/* Mini sparkline */}
              {referralAnalytics.referralTrend?.length > 0 && (
                <div style={{ marginTop: 4, opacity: 0.7 }}>
                  <TrendChart
                    data={referralAnalytics.referralTrend}
                    type="area"
                    height={60}
                    gradientId="refSparkline"
                    valueFormatter={(v) => `${v} referrals`}
                  />
                </div>
              )}
            </section>
          )}
          {renderReportsTab()}
          {renderVerificationsLink()}
        </>
      )}
      {activeTab === 'reports' && renderReportsTab()}
      {activeTab === 'conversations' && renderConversationsTab()}
      {activeTab === 'payments' && renderPaymentsTab()}
      {activeTab === 'referral' && renderReferralTab()}
    </main>
  );
}

function MigrationStat({ label, value, color }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{
        display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
        background: color || '#64748b',
      }} />
      <strong style={{ fontSize: '0.9rem' }}>{value}</strong>
      <span style={{ color: '#64748b' }}>{label}</span>
    </span>
  );
}

function SummaryCard({ label, value }) {
  return (
    <article className="admin-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
