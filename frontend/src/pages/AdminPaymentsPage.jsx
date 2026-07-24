import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import client from '../api/client';
import Icon from '../modules/common/dashboard/Icon';
import SectionCard from '../modules/common/dashboard/SectionCard';
import TrendChart from '../modules/common/dashboard/TrendChart';
import './AdminOperationsPage.css';
import './AdminPaymentsPage.css';

/* Stable empty array reference to avoid creating a new [] on every render */
const EMPTY_ARRAY = [];

/* ── Helpers ── */

const formatCurrency = (v, c = 'INR') => {
  const n = Number(v || 0);
  if (c === 'CREDITS') return `${n.toFixed(2)} credits`;
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: c }).format(n);
};

const formatDate = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return new Intl.DateTimeFormat(undefined, {
    month: 'short', day: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(d);
};

const formatShortDate = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: '2-digit', year: 'numeric' }).format(d);
};

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'INITIATED', label: 'Initiated' },
  { value: 'ESCROWED', label: 'Escrowed' },
  { value: 'RELEASED', label: 'Released' },
  { value: 'REFUNDED', label: 'Refunded' },
  { value: 'FAILED', label: 'Failed' },
];

const GATEWAY_OPTIONS = [
  { value: '', label: 'All gateways' },
  { value: 'razorpay', label: 'Razorpay' },
  { value: 'stripe', label: 'Stripe' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'wallet', label: 'Wallet' },
];

const DATE_RANGE_OPTIONS = [
  { value: 'all', label: 'All time' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
];

const PAGE_SIZE = 25;

/* ── Download helpers ── */

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadCsv(rows, fileName) {
  const csv = rows
    .map((row) => row.map((c) => `"${String(c || '').replace(/"/g, '""')}"`).join(','))
    .join('\r\n');
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), fileName);
}

function downloadJson(data, fileName) {
  downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), fileName);
}



function generateReceiptHtml(payment) {
  const statusColor =
    payment.status === 'RELEASED' ? '#059669' :
    payment.status === 'REFUNDED' ? '#7c3aed' :
    payment.status === 'ESCROWED' ? '#2563eb' :
    payment.status === 'FAILED' ? '#dc2626' : '#92400e';
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Receipt #${payment.id}</title>
<style>
  body { font-family: 'Inter', -apple-system, sans-serif; max-width: 640px; margin: 40px auto; padding: 0 20px; color: #0f172a; }
  .receipt { border: 1px solid #e2e8f0; border-radius: 16px; padding: 32px; box-shadow: 0 8px 32px rgba(0,0,0,0.06); }
  .receipt__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #f1f5f9; }
  .receipt__brand { font-size: 1.2rem; font-weight: 800; color: #0f766e; }
  .receipt__status { display: inline-flex; padding: 4px 10px; border-radius: 999px; font-size: 0.72rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; background: ${statusColor}15; color: ${statusColor}; }
  .receipt__title { font-size: 1.5rem; font-weight: 800; margin: 0 0 4px; }
  .receipt__sub { color: #64748b; font-size: 0.85rem; margin: 0 0 20px; }
  .receipt__grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
  .receipt__field { padding: 8px 0; }
  .receipt__field-label { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #94a3b8; margin-bottom: 2px; }
  .receipt__field-value { font-size: 0.95rem; font-weight: 600; }
  .receipt__amount { text-align: center; padding: 20px; background: #f8fafc; border-radius: 12px; margin-bottom: 16px; }
  .receipt__amount-value { font-size: 2.2rem; font-weight: 900; color: #0f172a; }
  .receipt__amount-label { font-size: 0.78rem; color: #64748b; }
  .receipt__footer { text-align: center; font-size: 0.75rem; color: #94a3b8; margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; }
  .receipt__divider { height: 1px; background: #e2e8f0; margin: 16px 0; }
</style></head>
<body>
<div class="receipt">
  <div class="receipt__header">
    <div class="receipt__brand">SkillSwap</div>
    <span class="receipt__status">${payment.status}</span>
  </div>
  <h1 class="receipt__title">Payment Receipt</h1>
  <p class="receipt__sub">Receipt #${payment.id} · ${formatDate(payment.createdAt)}</p>
  <div class="receipt__amount">
    <div class="receipt__amount-value">${formatCurrency(payment.amount, payment.currency)}</div>
    <div class="receipt__amount-label">Total Amount</div>
  </div>
  <div class="receipt__grid">
    <div class="receipt__field">
      <div class="receipt__field-label">Order ID</div>
      <div class="receipt__field-value">${payment.orderId || '—'}</div>
    </div>
    <div class="receipt__field">
      <div class="receipt__field-label">Payment ID</div>
      <div class="receipt__field-value">${payment.paymentId || '—'}</div>
    </div>
    <div class="receipt__field">
      <div class="receipt__field-label">Learner</div>
      <div class="receipt__field-value">${payment.learnerName || 'Unknown'}</div>
    </div>
    <div class="receipt__field">
      <div class="receipt__field-label">Mentor</div>
      <div class="receipt__field-value">${payment.mentorName || 'Unknown'}</div>
    </div>
    <div class="receipt__field">
      <div class="receipt__field-label">Gateway</div>
      <div class="receipt__field-value">${payment.gateway || '—'}</div>
    </div>
    <div class="receipt__field">
      <div class="receipt__field-label">Session</div>
      <div class="receipt__field-value">#${payment.sessionId || '—'}</div>
    </div>
  </div>
  <div class="receipt__divider"></div>
  <div class="receipt__footer">
    SkillSwap Platform · Generated ${new Date().toLocaleString()}<br>
    This is a computer-generated receipt.
  </div>
</div>
</body></html>`;
}

/* ── Main Component ── */

export default function AdminPaymentsPage({ notify }) {
  /* ── State ── */
  const [paymentsData, setPaymentsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [gatewayFilter, setGatewayFilter] = useState('');
  const [dateRange, setDateRange] = useState('all');
  const [page, setPage] = useState(0);
  const [actionLoading, setActionLoading] = useState(null); // 'refund-id' | 'payout-id' | 'bulk' | 'receipt-id'
  const [exporting, setExporting] = useState({ csv: false, json: false });
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // all | escrowed | released | refunded | failed
  const [payoutModal, setPayoutModal] = useState(null); // payment object or null
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutProcessing, setPayoutProcessing] = useState(false);
  const searchRef = useRef(null);

  /* ── Data Loading ── */
  const loadPayments = useCallback(async (pageOverride) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (gatewayFilter) params.set('gateway', gatewayFilter);
      if (search.trim()) params.set('q', search.trim());
      const p = pageOverride != null ? pageOverride : page;
      params.set('page', String(p));
      params.set('size', String(PAGE_SIZE));
      params.set('sort', 'createdAt,desc');
      const res = await client.get(`/api/v1/admin/payments?${params}`);
      setPaymentsData(res?.data?.data || null);
    } catch {
      notify?.({ type: 'error', title: 'Payments unavailable', message: 'Could not load payment data. Ensure you are logged in as admin.' });
    } finally {
      setLoading(false);
    }
  }, [notify, statusFilter, gatewayFilter, search, page]);

  useEffect(() => { setPage(0); }, [statusFilter, gatewayFilter, search]);
  useEffect(() => { loadPayments(); }, [loadPayments]);

  /* ── Derived data ── */
  const allPayments = paymentsData?.payments || EMPTY_ARRAY;
  const totalRevenue = Number(paymentsData?.totalRevenue || 0);
  const totalEscrowed = Number(paymentsData?.totalEscrowed || 0);
  const totalRefunded = Number(paymentsData?.totalRefunded || 0);
  const platformFees = Number(paymentsData?.platformFees || 0);
  const escrowedCount = Number(paymentsData?.escrowedCount || 0);
  const refundedCount = Number(paymentsData?.refundedCount || 0);
  const failedCount = Number(paymentsData?.failedCount || 0);

  const filteredPayments = useMemo(() => {
    let list = allPayments;

    // Client-side date filter (backend doesn't support date range)
    if (dateRange !== 'all') {
      const cutoff = Date.now() - Number(dateRange) * 24 * 60 * 60 * 1000;
      list = list.filter((p) => {
        const d = new Date(p.createdAt).getTime();
        return !Number.isNaN(d) && d >= cutoff;
      });
    }

    // Tab filter
    if (activeTab === 'escrowed') list = list.filter((p) => p.status === 'ESCROWED');
    else if (activeTab === 'released') list = list.filter((p) => p.status === 'RELEASED');
    else if (activeTab === 'refunded') list = list.filter((p) => p.status === 'REFUNDED');
    else if (activeTab === 'failed') list = list.filter((p) => p.status === 'FAILED');

    return list;
  }, [allPayments, dateRange, activeTab]);

  const totalPages = Math.max(1, Math.ceil(filteredPayments.length / PAGE_SIZE));
  const pagedPayments = filteredPayments.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  /* ── Chart data ── */
  const revenueTrend = useMemo(() => {
    const released = allPayments.filter((p) => p.status === 'RELEASED');
    const buckets = new Map();
    released.forEach((p) => {
      const d = new Date(p.createdAt);
      if (Number.isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      buckets.set(key, (buckets.get(key) || 0) + Number(p.amount || 0));
    });
    // Fill last 12 months
    const now = new Date();
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`;
      months.push({
        label: m.toLocaleString(undefined, { month: 'short' }),
        value: Math.round((buckets.get(key) || 0) * 100) / 100,
      });
    }
    return months;
  }, [allPayments]);

  const escrowedVsReleased = useMemo(() => {
    let escrowed = 0;
    let released = 0;
    allPayments.forEach((p) => {
      const amt = Number(p.amount || 0);
      if (p.status === 'ESCROWED') escrowed += amt;
      else if (p.status === 'RELEASED') released += amt;
    });
    const total = escrowed + released || 1;
    return {
      escrowed: Math.round(escrowed * 100) / 100,
      released: Math.round(released * 100) / 100,
      escrowedPct: Math.round((escrowed / total) * 100),
      releasedPct: Math.round((released / total) * 100),
      total: Math.round(total * 100) / 100,
    };
  }, [allPayments]);

  const gatewayBreakdown = useMemo(() => {
    const counts = new Map();
    allPayments.forEach((p) => {
      const gw = p.gateway || 'unknown';
      counts.set(gw, (counts.get(gw) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([gateway, count]) => ({ gateway, count, pct: Math.round((count / Math.max(allPayments.length, 1)) * 100) }))
      .sort((a, b) => b.count - a.count);
  }, [allPayments]);

  const gatewayRevenue = useMemo(() => {
    const rev = new Map();
    allPayments.forEach((p) => {
      const gw = p.gateway || 'unknown';
      if (p.status === 'RELEASED' || p.status === 'ESCROWED') {
        rev.set(gw, (rev.get(gw) || 0) + Number(p.amount || 0));
      }
    });
    return Array.from(rev.entries())
      .map(([gateway, amount]) => ({ gateway, amount: Math.round(amount * 100) / 100 }))
      .sort((a, b) => b.amount - a.amount);
  }, [allPayments]);

  /* ── Selection ── */
  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setSelectAll(false);
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedIds(new Set());
      setSelectAll(false);
    } else {
      setSelectedIds(new Set(pagedPayments.map((p) => p.id)));
      setSelectAll(true);
    }
  };

  useEffect(() => {
    setSelectedIds(new Set());
    setSelectAll(false);
  }, [activeTab, statusFilter, gatewayFilter, search, dateRange, page]);

  const selectedPayments = useMemo(
    () => allPayments.filter((p) => selectedIds.has(p.id)),
    [allPayments, selectedIds],
  );
  const selectedEscrowed = selectedPayments.filter((p) => p.status === 'ESCROWED');

  /* ── Actions ── */
  const handleRefund = async (paymentId) => {
    setActionLoading(`refund-${paymentId}`);
    try {
      await client.post(`/api/v1/admin/payments/${paymentId}/refund`, { reason: 'Admin-initiated refund' });
      notify?.({ type: 'success', title: 'Refund processed', message: `Payment #${paymentId} has been refunded.` });
      loadPayments();
    } catch (err) {
      const msg = err?.response?.data?.data?.error || err?.response?.data?.message || 'Refund failed';
      notify?.({ type: 'error', title: 'Refund failed', message: msg });
    } finally {
      setActionLoading(null);
    }
  };

  const handleBulkRefund = async () => {
    if (selectedEscrowed.length === 0) {
      notify?.({ type: 'error', title: 'No refundable payments', message: 'Only escrowed payments can be refunded. Select escrowed payments first.' });
      return;
    }
    if (!window.confirm(`Refund ${selectedEscrowed.length} payment(s) totalling ${formatCurrency(selectedEscrowed.reduce((s, p) => s + Number(p.amount || 0), 0))}?`)) return;
    setActionLoading('bulk');
    let success = 0;
    let failed = 0;
    for (const p of selectedEscrowed) {
      try {
        await client.post(`/api/v1/admin/payments/${p.id}/refund`, { reason: 'Bulk admin refund' });
        success++;
      } catch { failed++; }
    }
    notify?.({
      type: failed === 0 ? 'success' : 'warning',
      title: 'Bulk refund complete',
      message: `${success} refunded, ${failed} failed.`,
    });
    setSelectedIds(new Set());
    setSelectAll(false);
    setActionLoading(null);
    loadPayments();
  };

  const handleDownloadReceipt = (payment) => {
    const html = generateReceiptHtml(payment);
    downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8;' }), `receipt-${payment.id}.html`);
    notify?.({ type: 'success', title: 'Receipt downloaded', message: `Receipt #${payment.id} saved as HTML.` });
  };

  /* ── Payout Management ── */
  const handleOpenPayout = (payment) => {
    setPayoutModal(payment);
    setPayoutAmount(String(Number(payment.amount || 0).toFixed(2)));
  };

  const handleProcessPayout = async () => {
    if (!payoutModal) return;
    const amt = Number(payoutAmount);
    if (!amt || amt <= 0) {
      notify?.({ type: 'error', title: 'Invalid amount', message: 'Enter a valid payout amount.' });
      return;
    }
    setPayoutProcessing(true);
    try {
      await client.post(`/api/v1/admin/payments/${payoutModal.id}/release`);
      const fee = Math.round(amt * 0.10 * 100) / 100;
      const payoutNet = amt - fee;
      notify?.({
        type: 'success',
        title: 'Payout processed',
        message: `${formatCurrency(payoutNet)} released to mentor. Fee: ${formatCurrency(fee)}`,
      });
      setPayoutModal(null);
      loadPayments();
    } catch (err) {
      const msg = err?.response?.data?.data?.error || err?.response?.data?.message || 'Payout failed';
      notify?.({ type: 'error', title: 'Payout failed', message: msg });
    } finally {
      setPayoutProcessing(false);
    }
  };

  /* ── Export ── */
  const handleExportCsv = () => {
    setExporting((prev) => ({ ...prev, csv: true }));
    try {
      const rows = [
        ['ID', 'Order ID', 'Payment ID', 'Learner', 'Mentor', 'Session', 'Amount', 'Currency', 'Status', 'Gateway', 'Date'],
        ...filteredPayments.map((p) => [
          String(p.id), p.orderId, p.paymentId || '',
          p.learnerName, p.mentorName, String(p.sessionId || ''),
          String(p.amount), p.currency, p.status, p.gateway, formatDate(p.createdAt),
        ]),
      ];
      downloadCsv(rows, `payments-${new Date().toISOString().slice(0, 10)}.csv`);
      notify?.({ type: 'success', title: 'CSV ready', message: `${filteredPayments.length} payments exported.` });
    } catch {
      notify?.({ type: 'error', title: 'Export failed', message: 'Could not generate CSV.' });
    } finally { setExporting((prev) => ({ ...prev, csv: false })); }
  };

  const handleExportJson = () => {
    setExporting((prev) => ({ ...prev, json: true }));
    try {
      downloadJson(filteredPayments, `payments-${new Date().toISOString().slice(0, 10)}.json`);
      notify?.({ type: 'success', title: 'JSON ready', message: `${filteredPayments.length} payments exported.` });
    } catch {
      notify?.({ type: 'error', title: 'Export failed', message: 'Could not generate JSON.' });
    } finally { setExporting((prev) => ({ ...prev, json: false })); }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { loadPayments(); }
  };

  /* ── Custom Chart Components ── */

  /** SVG donut chart showing escrowed vs released ratio */
  const DonutChart = ({ data, size = 140 }) => {
    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2 - 12;
    const strokeW = 22;
    const circ = 2 * Math.PI * r;
    const escrowedArc = (data.escrowedPct / 100) * circ;
    const releasedArc = (data.releasedPct / 100) * circ;
    return (
      <div className="ap-donut">
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label="Payment status ratio">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--admin-border)" strokeWidth={strokeW} />
          {data.releasedPct > 0 && (
            <circle
              cx={cx} cy={cy} r={r} fill="none" stroke="#059669" strokeWidth={strokeW}
              strokeDasharray={`${releasedArc} ${circ - releasedArc}`}
              strokeDashoffset={0}
              transform={`rotate(-90 ${cx} ${cy})`}
              style={{ transition: 'stroke-dasharray 0.6s ease' }}
            >
              <title>Released: {formatCurrency(data.released)}</title>
            </circle>
          )}
          {data.escrowedPct > 0 && (
            <circle
              cx={cx} cy={cy} r={r} fill="none" stroke="#2563eb" strokeWidth={strokeW}
              strokeDasharray={`${escrowedArc} ${circ - escrowedArc}`}
              strokeDashoffset={-releasedArc}
              transform={`rotate(-90 ${cx} ${cy})`}
              style={{ transition: 'stroke-dasharray 0.6s ease' }}
            >
              <title>Escrowed: {formatCurrency(data.escrowed)}</title>
            </circle>
          )}
          <text x={cx} y={cy - 6} textAnchor="middle" fontSize="11" fontWeight="800" fill="var(--admin-text)">
            {formatCurrency(data.total)}
          </text>
          <text x={cx} y={cy + 12} textAnchor="middle" fontSize="8" fill="var(--admin-muted)">
            {data.releasedPct}% released
          </text>
        </svg>
        <div className="ap-donut__legend">
          <div className="ap-donut__legend-item">
            <span className="ap-donut__swatch ap-donut__swatch--released" />
            <span>Released</span>
            <strong>{formatCurrency(data.released)}</strong>
          </div>
          <div className="ap-donut__legend-item">
            <span className="ap-donut__swatch ap-donut__swatch--escrowed" />
            <span>Escrowed</span>
            <strong>{formatCurrency(data.escrowed)}</strong>
          </div>
        </div>
      </div>
    );
  };

  /** Horizontal bar chart showing gateway usage */
  const GatewayChart = ({ data }) => {
    const maxCount = Math.max(...data.map((d) => d.count), 1);
    return (
      <div className="ap-gateway-chart">
        <div className="ap-gateway-chart__list">
          {data.map((item) => {
            const rev = gatewayRevenue.find((r) => r.gateway === item.gateway);
            const barW = Math.max(8, (item.count / maxCount) * 100);
            return (
              <div key={item.gateway} className="ap-gateway-chart__row">
                <div className="ap-gateway-chart__label">
                  <span className="ap-gateway-chart__name">{item.gateway}</span>
                  <span className="ap-gateway-chart__pct">{item.pct}%</span>
                </div>
                <div className="ap-gateway-chart__bar-track">
                  <div
                    className="ap-gateway-chart__bar"
                    style={{ width: `${barW}%` }}
                  >
                    <div className="ap-gateway-chart__bar-count">{item.count} payments</div>
                  </div>
                </div>
                {rev && (
                  <div className="ap-gateway-chart__rev">
                    {formatCurrency(rev.amount)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {data.length === 0 && (
          <div className="admin-empty-state" style={{ padding: '20px 10px' }}>
            <Icon name="account_balance" />
            <p>No gateway data available.</p>
          </div>
        )}
      </div>
    );
  };

  /* ── Render helpers ── */
  const renderStats = () => (
    <div className="admin-payment-stats">
      <div className="admin-payment-stat">
        <span>Total Revenue</span>
        <strong>{formatCurrency(totalRevenue)}</strong>
        <small>All released payments</small>
      </div>
      <div className="admin-payment-stat">
        <span>Escrowed</span>
        <strong>{formatCurrency(totalEscrowed)}</strong>
        <small>{escrowedCount} payments awaiting release</small>
      </div>
      <div className="admin-payment-stat">
        <span>Refunded</span>
        <strong>{formatCurrency(totalRefunded)}</strong>
        <small>{refundedCount} payments returned</small>
      </div>
      <div className="admin-payment-stat">
        <span>Platform Fees (10%)</span>
        <strong>{formatCurrency(platformFees)}</strong>
        <small>Collected from released payments</small>
      </div>
      <div className="admin-payment-stat admin-payment-stat--warn">
        <span>Failed</span>
        <strong>{failedCount}</strong>
        <small>Payments that did not complete</small>
      </div>
    </div>
  );

  const renderTabs = () => (
    <div className="admin-tabs" role="tablist" aria-label="Payment filter">
      {[
        { key: 'all', label: 'All Payments', count: allPayments.length },
        { key: 'escrowed', label: 'Escrowed', count: allPayments.filter((p) => p.status === 'ESCROWED').length },
        { key: 'released', label: 'Released', count: allPayments.filter((p) => p.status === 'RELEASED').length },
        { key: 'refunded', label: 'Refunded', count: allPayments.filter((p) => p.status === 'REFUNDED').length },
        { key: 'failed', label: 'Failed', count: allPayments.filter((p) => p.status === 'FAILED').length },
      ].map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={`admin-tab ${activeTab === tab.key ? 'admin-tab--active' : ''}`}
          onClick={() => { setActiveTab(tab.key); setPage(0); }}
        >
          {tab.label}
          {tab.count > 0 && <span className="admin-count-badge">{tab.count}</span>}
        </button>
      ))}
    </div>
  );

  const renderFilters = () => (
    <div className="ap-filters">
      <div className="ap-search">
        <Icon name="search" />
        <input
          ref={searchRef}
          type="text"
          placeholder="Search by ID, order, gateway, name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>
      <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}>
        {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <select value={gatewayFilter} onChange={(e) => { setGatewayFilter(e.target.value); setPage(0); }}>
        {GATEWAY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <select value={dateRange} onChange={(e) => setDateRange(e.target.value)}>
        {DATE_RANGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <button type="button" className="admin-refresh-btn" onClick={() => loadPayments()} disabled={loading}>
        <Icon name="search" /> Filter
      </button>
    </div>
  );

  const renderBulkActions = () => {
    if (selectedIds.size === 0) return null;
    return (
      <div className="ap-bulk-bar">
        <span className="ap-bulk-bar__count">
          <Icon name="checklist" /> {selectedIds.size} selected
          {selectedEscrowed.length > 0 && ` (${selectedEscrowed.length} refundable)`}
        </span>
        <div className="ap-bulk-bar__actions">
          {selectedEscrowed.length > 0 && (
            <button
              type="button"
              className="admin-action-btn admin-action-reject"
              disabled={actionLoading === 'bulk'}
              onClick={handleBulkRefund}
            >
              {actionLoading === 'bulk' ? 'Refunding...' : `Refund ${selectedEscrowed.length}`}
            </button>
          )}
          <button
            type="button"
            className="admin-action-btn admin-action-cancel"
            onClick={() => { setSelectedIds(new Set()); setSelectAll(false); }}
          >
            Clear selection
          </button>
        </div>
      </div>
    );
  };

  const renderTable = () => {
    if (loading) {
      return (
        <div className="admin-table-wrap">
          <div className="ap-loading">
            <div className="ap-loading-spinner" />
            <span>Loading payments...</span>
          </div>
        </div>
      );
    }

    if (pagedPayments.length === 0) {
      return (
        <div className="admin-table-wrap">
          <div className="admin-empty-state">
            <Icon name="payments" />
            <p>No payments match the current filters.</p>
            <button type="button" className="admin-refresh-btn" onClick={() => { setSearch(''); setStatusFilter(''); setGatewayFilter(''); setDateRange('all'); setActiveTab('all'); }}>
              Clear filters
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="admin-table-wrap">
        <table className="admin-table ap-table">
          <thead>
            <tr>
              <th style={{ width: 40 }}>
                <input type="checkbox" checked={selectAll} onChange={toggleSelectAll} />
              </th>
              <th>ID</th>
              <th>Order</th>
              <th>Learner</th>
              <th>Mentor</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Gateway</th>
              <th>Date</th>
              <th style={{ width: 200 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pagedPayments.map((p) => {
              const isActionLoading = actionLoading === `refund-${p.id}` || actionLoading === `payout-${p.id}`;
              return (
                <tr key={p.id} className={selectedIds.has(p.id) ? 'ap-row--selected' : ''}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(p.id)}
                      onChange={() => toggleSelect(p.id)}
                    />
                  </td>
                  <td className="ap-cell-id">#{p.id}</td>
                  <td className="ap-cell-mono">{p.orderId}</td>
                  <td>{p.learnerName}</td>
                  <td>{p.mentorName}</td>
                  <td className="ap-cell-num">{formatCurrency(p.amount, p.currency)}</td>
                  <td>
                    <span className={`admin-status-pill admin-status-pill--${p.status.toLowerCase()}`}>
                      {p.status}
                    </span>
                  </td>
                  <td>{p.gateway}</td>
                  <td className="ap-cell-date">{formatShortDate(p.createdAt)}</td>
                  <td>
                    <div className="ap-actions">
                      {/* Refund (escrowed only) */}
                      {p.status === 'ESCROWED' && (
                        <>
                          <button
                            type="button"
                            className="admin-action-btn admin-action-refund"
                            disabled={isActionLoading}
                            onClick={() => handleRefund(p.id)}
                            title="Refund payment"
                          >
                            {actionLoading === `refund-${p.id}` ? '...' : 'Refund'}
                          </button>
                          <button
                            type="button"
                            className="ap-btn ap-btn--payout"
                            disabled={isActionLoading}
                            onClick={() => handleOpenPayout(p)}
                            title="Release payout to mentor"
                          >
                            Payout
                          </button>
                        </>
                      )}
                      {/* Receipt download (any payment) */}
                      <button
                        type="button"
                        className="ap-btn ap-btn--receipt"
                        onClick={() => handleDownloadReceipt(p)}
                        title="Download receipt"
                      >
                        <Icon name="receipt_long" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const renderPagination = () => {
    if (filteredPayments.length <= PAGE_SIZE) return null;
    return (
      <div className="ap-pagination">
        <span className="ap-pagination__info">
          Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filteredPayments.length)} of {filteredPayments.length}
        </span>
        <div className="ap-pagination__buttons">
          <button
            type="button"
            className="admin-action-btn admin-action-cancel"
            disabled={page === 0}
            onClick={() => setPage((prev) => Math.max(0, prev - 1))}
          >
            <Icon name="chevron_left" /> Prev
          </button>
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
            // Show pages around current
            const start = Math.max(0, Math.min(page - 3, totalPages - 7));
            const p = start + i;
            if (p >= totalPages) return null;
            return (
              <button
                key={p}
                type="button"
                className={`ap-pagination__page ${page === p ? 'ap-pagination__page--active' : ''}`}
                onClick={() => setPage(p)}
              >
                {p + 1}
              </button>
            );
          })}
          <button
            type="button"
            className="admin-action-btn admin-action-cancel"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((prev) => Math.min(totalPages - 1, prev + 1))}
          >
            Next <Icon name="chevron_right" />
          </button>
        </div>
      </div>
    );
  };

  const renderExportBar = () => (
    <div className="ap-export-bar">
      <span className="ap-export-bar__label"><Icon name="download" /> Export</span>
      <button
        type="button"
        className="admin-refresh-btn"
        onClick={handleExportCsv}
        disabled={exporting.csv || filteredPayments.length === 0}
        style={{ background: '#059669' }}
      >
        {exporting.csv ? 'Exporting...' : 'CSV'}
      </button>
      <button
        type="button"
        className="admin-refresh-btn"
        onClick={handleExportJson}
        disabled={exporting.json || filteredPayments.length === 0}
        style={{ background: '#2563eb' }}
      >
        {exporting.json ? 'Exporting...' : 'JSON'}
      </button>
      <span className="ap-export-bar__count">{filteredPayments.length} payments loaded</span>
    </div>
  );

  /* ── Payout Modal ── */
  const renderPayoutModal = () => {
    if (!payoutModal) return null;
    const fee = Math.round(Number(payoutAmount || 0) * 0.10 * 100) / 100;
    const net = Math.round((Number(payoutAmount || 0) - fee) * 100) / 100;
    return (
      <div className="ap-modal-overlay" onClick={() => !payoutProcessing && setPayoutModal(null)}>
        <div className="ap-modal" onClick={(e) => e.stopPropagation()}>
          <div className="ap-modal__head">
            <h3><Icon name="account_balance" /> Release Payout</h3>
            <button type="button" className="ap-modal__close" onClick={() => setPayoutModal(null)} disabled={payoutProcessing}>
              <Icon name="close" />
            </button>
          </div>
          <div className="ap-modal__body">
            <div className="ap-modal__detail">
              <span>Payment</span>
              <strong>#{payoutModal.id} · {payoutModal.orderId}</strong>
            </div>
            <div className="ap-modal__detail">
              <span>Mentor</span>
              <strong>{payoutModal.mentorName}</strong>
            </div>
            <div className="ap-modal__detail">
              <span>Amount</span>
              <strong>{formatCurrency(payoutModal.amount, payoutModal.currency)}</strong>
            </div>

            <div className="ap-modal__divider" />

            <label className="ap-modal__label">Payout Amount (edit to adjust)</label>
            <div className="ap-modal__input-row">
              <input
                type="number"
                className="ap-modal__input"
                value={payoutAmount}
                onChange={(e) => setPayoutAmount(e.target.value)}
                disabled={payoutProcessing}
                step="0.01"
                min="0"
              />
              <button
                type="button"
                className="admin-action-btn admin-action-cancel ap-modal__max"
                onClick={() => setPayoutAmount(String(Number(payoutModal.amount || 0).toFixed(2)))}
                disabled={payoutProcessing}
              >
                Max
              </button>
            </div>

            <div className="ap-modal__breakdown">
              <div className="ap-modal__breakdown-row">
                <span>Gross Amount</span>
                <strong>{formatCurrency(Number(payoutAmount || 0))}</strong>
              </div>
              <div className="ap-modal__breakdown-row">
                <span>Platform Fee (10%)</span>
                <strong style={{ color: '#dc2626' }}>−{formatCurrency(fee)}</strong>
              </div>
              <div className="ap-modal__breakdown-row ap-modal__breakdown-row--total">
                <span>Net to Mentor</span>
                <strong style={{ color: '#059669' }}>{formatCurrency(net)}</strong>
              </div>
            </div>
          </div>
          <div className="ap-modal__actions">
            <button
              type="button"
              className="admin-action-btn admin-action-cancel"
              onClick={() => setPayoutModal(null)}
              disabled={payoutProcessing}
            >
              Cancel
            </button>
            <button
              type="button"
              className="admin-action-btn admin-action-approve"
              onClick={handleProcessPayout}
              disabled={payoutProcessing || !payoutAmount || Number(payoutAmount) <= 0}
            >
              {payoutProcessing ? 'Processing...' : `Release ${formatCurrency(net)}`}
            </button>
          </div>
        </div>
      </div>
    );
  };

  /* ── Main Render ── */
  return (
    <main className="admin-page">
      {/* Hero */}
      <section className="admin-hero">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <p className="admin-eyebrow">Finance</p>
            <h1>Payment Management</h1>
            <p>Monitor, refund, and release payments across the platform. Search payments, process bulk refunds, download receipts, and manage mentor payouts.</p>
          </div>
          <button
            type="button"
            className="admin-refresh-btn"
            onClick={() => loadPayments()}
            disabled={loading}
            style={{ background: '#fff', color: '#0f172a', borderColor: '#fff' }}
          >
            <Icon name="refresh" /> {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </section>

      {/* Stats */}
      {paymentsData && renderStats()}

      {/* Charts Section */}
      {paymentsData && allPayments.length > 0 && (
        <div className="ap-charts-grid">
          <SectionCard title="Revenue Trend" icon="trending_up" headerExtra={
            <span className="admin-count-badge">{revenueTrend.filter((m) => m.value > 0).length} months</span>
          }>
            <TrendChart
              data={revenueTrend}
              type="area"
              height={160}
              gradientId="apRevenueGrad"
              valueFormatter={(v) => formatCurrency(v)}
            />
          </SectionCard>

          <SectionCard title="Escrowed vs Released" icon="account_balance">
            <DonutChart data={escrowedVsReleased} />
          </SectionCard>

          <SectionCard title="Gateway Breakdown" icon="account_balance">
            <GatewayChart data={gatewayBreakdown} />
          </SectionCard>
        </div>
      )}

      {/* Tabs */}
      {renderTabs()}

      {/* Filters */}
      {renderFilters()}

      {/* Bulk actions */}
      {renderBulkActions()}

      {/* Export bar */}
      {renderExportBar()}

      {/* Table */}
      {renderTable()}

      {/* Pagination */}
      {renderPagination()}

      {/* Payout Modal */}
      {renderPayoutModal()}
    </main>
  );
}
