import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import client from '../api/client';
import Icon from '../modules/common/dashboard/Icon';
import StatsCard from '../modules/common/dashboard/StatsCard';
import SectionCard from '../modules/common/dashboard/SectionCard';
import TrendChart from '../modules/common/dashboard/TrendChart';
import './AdminOperationsPage.css';

const statusOptions = ['OPEN', 'IN_REVIEW', 'RESOLVED', 'DISMISSED'];

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

const getMentorSkills = (skills) => {
  if (Array.isArray(skills)) {
    return skills.map((item) => String(item || '').trim()).filter(Boolean);
  }
  return String(skills || '')
    .split(/[\n,;|]+/)
    .map((item) => item.trim())
    .filter(Boolean);
};

const TABS = [
  { key: 'overview', label: 'Overview', icon: 'dashboard' },
  { key: 'reports', label: 'Reports', icon: 'flag' },
  { key: 'verifications', label: 'Mentor Verifications', icon: 'verified' },
  { key: 'conversations', label: 'Conversations', icon: 'forum' },
  { key: 'payments', label: 'Payments', icon: 'payments' },
  { key: 'referral', label: 'Referrals', icon: 'share' },
];

const PATH_TAB_MAP = {
  dashboard: 'overview',
  reports: 'reports',
  verifications: 'verifications',
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
  const [verifications, setVerifications] = useState([]);
  const [reportStatus, setReportStatus] = useState('OPEN');
  const [loading, setLoading] = useState(true);
  const [verificationLoading, setVerificationLoading] = useState(true);
  const [verificationUpdatingId, setVerificationUpdatingId] = useState(null);
  const [activeRejectId, setActiveRejectId] = useState(null);
  const [rejectReasonById, setRejectReasonById] = useState({});
  const [rejectErrorById, setRejectErrorById] = useState({});

  // ── Conversations state ──
  const [convs, setConvs] = useState([]);
  const [convsLoading, setConvsLoading] = useState(false);
  const [convSearch, setConvSearch] = useState('');
  const [convTypeFilter, setConvTypeFilter] = useState('all');
  const [selectedConv, setSelectedConv] = useState(null);
  const [convMessages, setConvMessages] = useState([]);
  const [convMessagesLoading, setConvMessagesLoading] = useState(false);

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

  // ── Loaders ──
  const loadVerificationQueue = useCallback(async () => {
    setVerificationLoading(true);
    try {
      const verificationResponse = await client.get('/api/v1/verification/mentor/requests?status=PENDING');
      const queue = verificationResponse?.data?.data || verificationResponse?.data || [];
      setVerifications(Array.isArray(queue) ? queue : []);
    } catch {
      notify?.({
        type: 'error',
        title: 'Verification queue unavailable',
        message: 'Could not load mentor verification requests.'
      });
    } finally {
      setVerificationLoading(false);
    }
  }, [notify]);

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
    setConvsLoading(true);
    try {
      const params = new URLSearchParams();
      if (convTypeFilter !== 'all') params.set('type', convTypeFilter);
      if (convSearch.trim()) params.set('q', convSearch.trim());
      const res = await client.get(`/api/v1/admin/conversations?${params}`);
      setConvs(res?.data?.data || []);
    } catch {
      notify?.({ type: 'error', title: 'Conversations unavailable', message: 'Could not load conversations.' });
    } finally {
      setConvsLoading(false);
    }
  }, [notify, convTypeFilter, convSearch]);

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

  useEffect(() => {
    loadVerificationQueue();
  }, [loadVerificationQueue]);

  useEffect(() => {
    if (activeTab === 'conversations') loadConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'referral') loadReferralAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'payments') loadPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // ── Verification actions ──
  const approveVerification = async (item) => {
    setVerificationUpdatingId(item.id);
    try {
      await client.patch(`/api/v1/verification/mentor/requests/${item.id}`, {
        status: 'APPROVED',
        reviewNote: 'Approved by admin'
      });
      setVerifications((prev) => prev.filter((request) => request.id !== item.id));
      notify?.({
        type: 'success',
        title: 'Mentor approved',
        message: `Mentor ${item?.mentor?.fullName || item?.mentor?.email || item.id} approved successfully`
      });
    } catch (error) {
      notify?.({
        type: 'error',
        title: 'Approval failed',
        message: error?.response?.data?.data?.error || error?.response?.data?.message || 'Failed to approve mentor verification.'
      });
    } finally {
      setVerificationUpdatingId(null);
    }
  };

  const startReject = (itemId) => {
    setActiveRejectId(itemId);
    setRejectReasonById((prev) => ({ ...prev, [itemId]: prev[itemId] || '' }));
    setRejectErrorById((prev) => ({ ...prev, [itemId]: '' }));
  };

  const cancelReject = (itemId) => {
    setActiveRejectId((prev) => (prev === itemId ? null : prev));
    setRejectErrorById((prev) => ({ ...prev, [itemId]: '' }));
  };

  const submitRejection = async (item) => {
    const reason = String(rejectReasonById[item.id] || '').trim();
    if (!reason) {
      setRejectErrorById((prev) => ({ ...prev, [item.id]: 'Rejection reason is required.' }));
      return;
    }
    setVerificationUpdatingId(item.id);
    try {
      await client.patch(`/api/v1/verification/mentor/requests/${item.id}`, {
        status: 'REJECTED',
        reviewNote: reason
      });
      setVerifications((prev) => prev.filter((request) => request.id !== item.id));
      setActiveRejectId((prev) => (prev === item.id ? null : prev));
      notify?.({
        type: 'success',
        title: 'Mentor rejected',
        message: `Mentor ${item?.mentor?.fullName || item?.mentor?.email || item.id} verification rejected`
      });
    } catch (error) {
      notify?.({
        type: 'error',
        title: 'Rejection failed',
        message: error?.response?.data?.data?.error || error?.response?.data?.message || 'Failed to reject mentor verification.'
      });
    } finally {
      setVerificationUpdatingId(null);
    }
  };

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
  const selectConversation = async (conv) => {
    setSelectedConv(conv);
    setConvMessagesLoading(true);
    setConvMessages([]);
    try {
      const endpoint = conv.kind === 'booking'
        ? `/api/v1/admin/conversations/booking/${conv.referenceId}/messages`
        : `/api/v1/admin/conversations/direct/${conv.referenceId}/messages`;
      const res = await client.get(endpoint);
      setConvMessages(res?.data?.data || []);
    } catch {
      notify?.({ type: 'error', title: 'Messages failed', message: 'Could not load messages for this conversation.' });
    } finally {
      setConvMessagesLoading(false);
    }
  };

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

  const renderVerificationsTab = () => (
    <section className="admin-panel">
      <div className="admin-section-heading">
        <div>
          <p className="admin-eyebrow">Verification</p>
          <h2>Mentor Verification Queue <span className="admin-count-badge">{verifications.length} pending</span></h2>
        </div>
        <button type="button" className="admin-refresh-btn" onClick={loadVerificationQueue}
          disabled={verificationLoading || Boolean(verificationUpdatingId)}>
          {verificationLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>
      <div className="admin-list">
        {verificationLoading && <p>Loading pending verification requests...</p>}
        {!verificationLoading && verifications.map((item) => {
          const skills = getMentorSkills(item?.mentor?.skills);
          const isUpdating = verificationUpdatingId === item.id;
          const isRejectOpen = activeRejectId === item.id;
          return (
            <article className="admin-card admin-verification-card" key={item.id}>
              <div className="admin-verification-header">
                <h3>{item?.mentor?.fullName || `Mentor #${item?.mentor?.id || item.id}`}</h3>
                <span className="admin-status">{item.status}</span>
              </div>
              <p className="admin-verification-meta"><strong>Email:</strong> {item?.mentor?.email || 'Not provided'}</p>
              <p className="admin-verification-meta"><strong>Skills:</strong> {skills.length ? skills.join(', ') : 'No skills listed'}</p>
              <p className="admin-verification-meta"><strong>Document type:</strong> {item.documentType || 'Unknown'}</p>
              <p className="admin-verification-meta"><strong>Document:</strong> <a href={item.documentUrl} target="_blank" rel="noreferrer">View Document</a></p>
              <p className="admin-verification-meta"><strong>Submitted:</strong> {formatDate(item.createdAt)}</p>
              <div className="admin-verification-actions">
                <button type="button" className="admin-action-btn admin-action-approve" disabled={isUpdating} onClick={() => approveVerification(item)}>Approve</button>
                <button type="button" className="admin-action-btn admin-action-reject" disabled={isUpdating} onClick={() => startReject(item.id)}>Reject</button>
              </div>
              {isRejectOpen && (
                <div className="admin-reject-form">
                  <label htmlFor={`rejection-reason-${item.id}`}>Rejection reason (required)</label>
                  <input id={`rejection-reason-${item.id}`} type="text"
                    value={rejectReasonById[item.id] || ''}
                    onChange={(event) => {
                      setRejectReasonById((prev) => ({ ...prev, [item.id]: event.target.value }));
                      setRejectErrorById((prev) => ({ ...prev, [item.id]: '' }));
                    }}
                    placeholder="Explain why this request is being rejected" />
                  {rejectErrorById[item.id] && <p className="admin-reject-error">{rejectErrorById[item.id]}</p>}
                  <div className="admin-reject-actions">
                    <button type="button" className="admin-action-btn admin-action-reject" disabled={isUpdating} onClick={() => submitRejection(item)}>Submit Rejection</button>
                    <button type="button" className="admin-action-btn admin-action-cancel" disabled={isUpdating} onClick={() => cancelReject(item.id)}>Cancel</button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
        {!verificationLoading && verifications.length === 0 && <p>No pending verification requests</p>}
      </div>
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
        <input type="text" placeholder="Search conversations by participant, title, or message..."
          value={convSearch}
          onChange={(e) => setConvSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') loadConversations(); }} />
        <button type="button" className="admin-refresh-btn" onClick={loadConversations} disabled={convsLoading}>
          {convsLoading ? 'Searching...' : 'Search'}
        </button>
      </div>

      <div className="admin-conv-layout">
        <div className="admin-conv-list">
          {convsLoading ? (
            <p>Loading conversations...</p>
          ) : convs.length === 0 ? (
            <div className="admin-empty-state">
              <Icon name="forum" />
              <p>No conversations found. Try a different search or filter.</p>
            </div>
          ) : (
            convs.map((conv) => (
              <button key={conv.id}
                className={`admin-conv-item ${selectedConv?.id === conv.id ? 'is-selected' : ''}`}
                onClick={() => selectConversation(conv)}>
                <div className="admin-conv-item-top">
                  <strong>{conv.participantName}</strong>
                  <span className={`admin-pill ${conv.kind === 'booking' ? 'admin-pill--booking' : 'admin-pill--direct'}`}>
                    {conv.kind}
                  </span>
                </div>
                <div className="admin-conv-item-title">{conv.sessionTitle}</div>
                <div className="admin-conv-item-preview">
                  {conv.lastMessagePreview || <span className="admin-text-muted">No messages yet</span>}
                </div>
                <div className="admin-conv-item-meta">
                  <span>{conv.status}</span>
                  <span>{formatDate(conv.lastActivityAt)}</span>
                </div>
              </button>
            ))
          )}
        </div>

        <div className="admin-conv-messages">
          {!selectedConv ? (
            <div className="admin-empty-state">
              <Icon name="chat" />
              <p>Select a conversation to view messages</p>
            </div>
          ) : convMessagesLoading ? (
            <p>Loading messages...</p>
          ) : (
            <>
              <div className="admin-conv-messages-header">
                <h3>{selectedConv.participantName}</h3>
                <p className="admin-text-muted">{selectedConv.sessionTitle} &middot; {selectedConv.kind} conversation</p>
              </div>
              <div className="admin-conv-messages-list">
                {convMessages.length === 0 ? (
                  <div className="admin-empty-state">
                    <Icon name="chat" />
                    <p>No messages in this conversation yet.</p>
                  </div>
                ) : (
                  convMessages.map((msg) => (
                    <div key={msg.id} className="admin-msg">
                      <div className="admin-msg-header">
                        <strong>{msg.senderName}</strong>
                        <span>{msg.senderEmail}</span>
                        <span className="admin-text-muted">{formatDate(msg.createdAt)}</span>
                        {msg.readByRecipient && <span className="admin-read-badge" title="Read">✓✓</span>}
                      </div>
                      <p className="admin-msg-content">{msg.content}</p>
                    </div>
                  ))
                )}
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
          {renderVerificationsTab()}
        </>
      )}
      {activeTab === 'reports' && renderReportsTab()}
      {activeTab === 'verifications' && renderVerificationsTab()}
      {activeTab === 'conversations' && renderConversationsTab()}
      {activeTab === 'payments' && renderPaymentsTab()}
      {activeTab === 'referral' && renderReferralTab()}
    </main>
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
