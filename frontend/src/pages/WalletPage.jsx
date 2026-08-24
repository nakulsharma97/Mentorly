import { useEffect, useMemo, useState } from "react";
import client from "../api/client";
import HeroSection from "../components/HeroSection";
import SsIcon from "../components/ui/SsIcon";
import {
  SsStatCard,
  SsBadge,
  SsEmpty,
  SsCard,
  SsSectionHeader,
  SsActivityItem,
} from "../components/ui/SsCard";
import TrendChart from "../modules/common/dashboard/TrendChart";
import "./WalletPage.css";

const TRANSACTION_TYPES = [
  { value: "all", label: "All types" },
  { value: "EARNING", label: "Earnings" },
  { value: "WITHDRAWAL", label: "Withdrawals" },
  { value: "REFUND", label: "Refunds" },
  { value: "CREDIT", label: "Credit" },
  { value: "DEBIT", label: "Debit" },
];

const DATE_RANGES = [
  { value: "all", label: "All time" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
];

const TYPE_LABELS = {
  EARNING: "Earning",
  WITHDRAWAL: "Withdrawal",
  REFUND: "Refund",
  CREDIT: "Credit",
  DEBIT: "Debit",
};

const formatCurrency = (amount) => {
  const value = Number(amount || 0);
  return `₹${value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const formatDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(date);
};

const formatShortDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
};

const buildMonthlyTrend = (ledger = []) => {
  const now = new Date();
  const points = Array.from({ length: 6 }, (_, index) => {
    const month = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    return {
      label: month.toLocaleString(undefined, { month: "short" }),
      month: month.getMonth(),
      year: month.getFullYear(),
      value: 0,
    };
  });

  ledger.forEach((entry) => {
    const createdAt = new Date(entry.createdAt);
    if (Number.isNaN(createdAt.getTime())) {
      return;
    }
    if (entry.type !== "EARNING" && entry.type !== "CREDIT") {
      return;
    }
    const bucket = points.find(
      (point) =>
        point.month === createdAt.getMonth() &&
        point.year === createdAt.getFullYear(),
    );
    if (bucket) {
      bucket.value += Number(entry.amount || 0);
    }
  });

  return points.map(({ label, value }) => ({ label, value }));
};

const buildActivityTimeline = (ledger = []) => {
  return ledger
    .slice(0, 10)
    .map((entry) => {
      const type = entry.type;
      let icon = "payments";
      let iconBg = "var(--ss-primary-lighter)";
      let iconColor = "var(--ss-primary)";

      if (type === "EARNING" || type === "CREDIT") {
        icon = "trending-up";
        iconBg = "rgba(16, 185, 129, 0.12)";
        iconColor = "var(--ss-success)";
      } else if (type === "WITHDRAWAL" || type === "DEBIT") {
        icon = "arrow-up-right";
        iconBg = "rgba(239, 68, 68, 0.12)";
        iconColor = "var(--ss-danger)";
      } else if (type === "REFUND") {
        icon = "refresh";
        iconBg = "rgba(245, 158, 11, 0.12)";
        iconColor = "var(--ss-warning)";
      }

      return {
        id: entry.id,
        icon,
        iconBg,
        iconColor,
        text: `${entry.description || TYPE_LABELS[type] || type} — ${formatCurrency(entry.amount, entry.currency)}`,
        time: formatShortDate(entry.createdAt),
      };
    });
};

const downloadCsv = (rows, fileName) => {
  const csv = rows
    .map((row) =>
      row
        .map((value) => `"${String(value || "").replace(/"/g, '""')}"`)
        .join(","),
    )
    .join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
};

export default function WalletPage({ profile, notify }) {
  const [balance, setBalance] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateRange, setDateRange] = useState("30");
  const [activeTab, setActiveTab] = useState("overview");
  const [exporting, setExporting] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawMethod, setWithdrawMethod] = useState("bank");
  const [withdrawProcessing, setWithdrawProcessing] = useState(false);
  const [payoutPage, setPayoutPage] = useState(0);
  const [payoutSearch, setPayoutSearch] = useState("");
  const [payoutDateRange, setPayoutDateRange] = useState("all");
  const PAYOUT_PAGE_SIZE = 8;
  const [connectStatus, setConnectStatus] = useState(null);
  const [connectLoading, setConnectLoading] = useState(true);
  const [onboardingLoading, setOnboardingLoading] = useState(false);

  // Fetch wallet data
  useEffect(() => {
    let mounted = true;

    const loadWallet = async () => {
      setLoading(true);
      try {
        const [balanceResponse, ledgerResponse] = await Promise.all([
          client.get("/api/v1/wallet/balance"),
          client.get("/api/v1/wallet/ledger"),
        ]);
        if (!mounted) {
          return;
        }
        setBalance(balanceResponse.data.data);
        setLedger(ledgerResponse.data.data || []);
      } catch (error) {
        notify?.({
          type: "error",
          title: "Wallet unavailable",
          message:
            "Unable to load wallet data. Start the backend and sign in again.",
        });
      } finally {
        if (mounted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };

    loadWallet();
    return () => {
      mounted = false;
    };
  }, [notify]);

  // Fetch Stripe Connect status (mentor only)
  useEffect(() => {
    if (profile?.role !== "MENTOR") {
      setConnectLoading(false);
      return;
    }
    let mounted = true;
    const loadConnectStatus = async () => {
      try {
        const res = await client.get("/api/v1/mentor/connect/status");
        if (mounted) setConnectStatus(res?.data?.data || null);
      } catch {
        // Not onboarded yet — that's fine
        if (mounted) setConnectStatus(null);
      } finally {
        if (mounted) setConnectLoading(false);
      }
    };
    loadConnectStatus();
    return () => { mounted = false; };
  }, [profile?.role]);

  // Handle onboarding redirect return
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("onboarding") === "complete") {
      // Refresh connect status after returning from Stripe
      client.get("/api/v1/mentor/connect/status")
        .then((res) => setConnectStatus(res?.data?.data || null))
        .catch(() => {});
      // Clean up URL
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const handleStartOnboarding = async () => {
    setOnboardingLoading(true);
    try {
      const res = await client.post("/api/v1/mentor/connect/onboard");
      const url = res?.data?.data?.url;
      if (url) {
        window.location.href = url;
      }
    } catch (err) {
      const detail = err?.response?.data?.data?.message || err?.response?.data?.message || "Failed to start onboarding";
      notify?.({ type: "error", title: "Onboarding failed", message: detail });
    } finally {
      setOnboardingLoading(false);
    }
  };

  const metrics = useMemo(() => {
    return ledger.reduce(
      (acc, entry) => {
        const amount = Number(entry.amount || 0);
        const type = entry.type;
        if (amount >= 0) {
          acc.incoming += amount;
        } else {
          acc.outgoing += Math.abs(amount);
        }

        if (type === "EARNING" || type === "CREDIT") {
          acc.earnings += amount;
        }
        if (type === "WITHDRAWAL" || type === "DEBIT") {
          acc.payouts += Math.abs(amount);
        }
        if (type === "REFUND") {
          acc.refunds += Math.abs(amount);
        }

        if (type === "WITHDRAWAL" || type === "DEBIT") {
          acc.payoutCount += 1;
        }
        return acc;
      },
      {
        earnings: 0,
        payouts: 0,
        refunds: 0,
        incoming: 0,
        outgoing: 0,
        payoutCount: 0,
      },
    );
  }, [ledger]);

  const trendData = useMemo(() => buildMonthlyTrend(ledger), [ledger]);
  const activityItems = useMemo(() => buildActivityTimeline(ledger), [ledger]);

  const filteredLedger = useMemo(() => {
    const query = search.trim().toLowerCase();
    return ledger.filter((entry) => {
      if (typeFilter !== "all" && entry.type !== typeFilter) {
        return false;
      }

      if (dateRange !== "all") {
        const cutoff = Date.now() - Number(dateRange) * 24 * 60 * 60 * 1000;
        const createdAt = new Date(entry.createdAt).getTime();
        if (Number.isNaN(createdAt) || createdAt < cutoff) {
          return false;
        }
      }

      if (!query) {
        return true;
      }

      return [entry.description, entry.type, entry.referenceType, entry.referenceId]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [ledger, search, typeFilter, dateRange]);

  const recentTransactions = filteredLedger.slice(0, 12);

  // Payout-specific filtered list with pagination
  const allPayoutEntries = useMemo(() => {
    const query = payoutSearch.trim().toLowerCase();
    return ledger.filter((entry) => {
      if (entry.type !== "WITHDRAWAL" && entry.type !== "DEBIT") return false;
      if (payoutDateRange !== "all") {
        const cutoff =
          Date.now() - Number(payoutDateRange) * 24 * 60 * 60 * 1000;
        const createdAt = new Date(entry.createdAt).getTime();
        if (Number.isNaN(createdAt) || createdAt < cutoff) return false;
      }
      if (!query) return true;
      return [entry.description, entry.type, entry.referenceType]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(query));
    });
  }, [ledger, payoutSearch, payoutDateRange]);

  const payoutTotalPages = Math.max(
    1,
    Math.ceil(allPayoutEntries.length / PAYOUT_PAGE_SIZE),
  );
  const safePayoutPage = Math.min(payoutPage, payoutTotalPages - 1);
  const paginatedPayouts = allPayoutEntries.slice(
    safePayoutPage * PAYOUT_PAGE_SIZE,
    (safePayoutPage + 1) * PAYOUT_PAGE_SIZE,
  );

  const isMentor = profile?.role === "MENTOR";
  const payoutsEnabled = isMentor && connectStatus?.payoutsEnabled === true;
  const onboardingPending = isMentor && connectStatus && !connectStatus.payoutsEnabled;

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const [balanceResponse, ledgerResponse] = await Promise.all([
        client.get("/api/v1/wallet/balance"),
        client.get("/api/v1/wallet/ledger"),
      ]);
      setBalance(balanceResponse.data.data);
      setLedger(ledgerResponse.data.data || []);
      notify?.({
        type: "success",
        title: "Wallet refreshed",
        message: "Latest earnings and transactions are now visible.",
      });
    } catch {
      notify?.({
        type: "error",
        title: "Refresh failed",
        message: "Unable to refresh wallet data right now.",
      });
    } finally {
      setRefreshing(false);
    }
  };

  const handleExport = () => {
    setExporting(true);
    try {
      const header = ["Date", "Type", "Description", "Amount", "Balance after"];
      const rows = [header].concat(
        filteredLedger.map((entry) => [
          formatDate(entry.createdAt),
          TYPE_LABELS[entry.type] || entry.type,
          entry.description,
          formatCurrency(entry.amount, entry.currency),
          formatCurrency(entry.balanceAfter, entry.currency),
        ]),
      );
      downloadCsv(rows, "wallet-transactions.csv");
      notify?.({
        type: "success",
        title: "Export ready",
        message: "Your transaction data has been downloaded.",
      });
    } catch {
      notify?.({
        type: "error",
        title: "Export failed",
        message: "Unable to export wallet data right now.",
      });
    } finally {
      setExporting(false);
    }
  };

  const handleWithdraw = async () => {
    const amount = Number(withdrawAmount);
    if (!amount || amount <= 0) {
      notify?.({
        type: "error",
        title: "Invalid amount",
        message: "Please enter a valid withdrawal amount.",
      });
      return;
    }
    const balanceNum = Number(balance?.balance || 0);
    if (amount > balanceNum) {
      notify?.({
        type: "error",
        title: "Insufficient balance",
        message: `Your balance is ${formatCurrency(balanceNum)}.`,
      });
      return;
    }
    if (amount < 10) {
      notify?.({
        type: "error",
        title: "Minimum amount",
        message: "Minimum withdrawal amount is ₹10.00.",
      });
      return;
    }
    setWithdrawProcessing(true);
    try {
      const res = await client.post("/api/v1/wallet/withdraw", {
        amount,
        description: `Withdrawal via ${withdrawMethod === "bank" ? "Bank Transfer" : withdrawMethod === "paypal" ? "PayPal" : "UPI"}`,
        paymentMethod:
          withdrawMethod === "bank"
            ? "Bank Transfer"
            : withdrawMethod === "paypal"
              ? "PayPal"
              : "UPI",
      });
      const entry = res?.data?.data;
      setLedger((prev) => [entry, ...prev]);
      setBalance((prev) => ({
        ...prev,
        balance: entry?.balanceAfter ?? prev?.balance,
      }));
      setWithdrawAmount("");
      notify?.({
        type: "success",
        title: "Withdrawal processed",
        message: `${formatCurrency(amount)} withdrawal has been recorded.`,
      });
    } catch (err) {
      const detail =
        err?.response?.data?.data?.message ||
        err?.response?.data?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        "Withdrawal failed";
      notify?.({
        type: "error",
        title: "Withdrawal failed",
        message: detail,
      });
    } finally {
      setWithdrawProcessing(false);
    }
  };

  const pageTitle = profile?.role === "MENTOR" ? "Earnings" : "Payments";

  return (
    <main className="ss-page wallet-page">
      {/* ═══════════════════ HERO — Unified Design System ═══════════════════ */}
      <HeroSection
        className="hero-section--compact"
        badge={
          <>
            <SsIcon name="wallet" size={14} />
            {pageTitle} dashboard
          </>
        }
        title={
          profile?.role === "MENTOR" ? "Earnings & Wallet" : "Payments & Wallet"
        }
        subtitle="Track your earnings, withdrawals, and balance history."
        secondaryButton={
          <button
            className="hero-section__btn hero-section__btn--secondary"
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <SsIcon name="refresh" size={16} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        }
        primaryButton={
          <button
            className="hero-section__btn hero-section__btn--primary"
            type="button"
            onClick={handleExport}
            disabled={exporting}
          >
            <SsIcon name="download" size={16} />
            {exporting ? "Exporting…" : "Export"}
          </button>
        }
        floatingCards={
          <div className="hero-section__watermark" aria-hidden="true">
            <SsIcon name="wallet" size={96} />
          </div>
        }
      >
        {/* Compact quick stats inside hero */}
        <div className="hero-section__stats-strip">
          <div className="hero-section__stats-item">
            <span className="hero-section__stats-item__label">Available Balance</span>
            <span className="hero-section__stats-item__value">
              {loading
                ? "..."
                : formatCurrency(balance?.balance)}
            </span>
          </div>
          <div className="hero-section__stats-divider" />
          <div className="hero-section__stats-item">
            <span className="hero-section__stats-item__label">Total Earnings</span>
            <span className="hero-section__stats-item__value">
              {loading
                ? "..."
                : formatCurrency(metrics.earnings)}
            </span>
          </div>
          <div className="hero-section__stats-divider" />
          <div className="hero-section__stats-item">
            <span className="hero-section__stats-item__label">Total Payouts</span>
            <span className="hero-section__stats-item__value">
              {loading
                ? "..."
                : formatCurrency(metrics.payouts)}
            </span>
          </div>
          <div className="hero-section__stats-divider" />
          <div className="hero-section__stats-item">
            <span className="hero-section__stats-item__label">Refunds</span>
            <span className="hero-section__stats-item__value">
              {loading
                ? "..."
                : formatCurrency(metrics.refunds)}
            </span>
          </div>
        </div>
      </HeroSection>

      {/* ═══════════════════ TABS ═══════════════════ */}
      <div className="ss-tabs wallet-tabs">
        {[
          { key: "overview", label: "Overview", icon: "grid_view" },
          { key: "transactions", label: "Transactions", icon: "list" },
          { key: "payouts", label: "Payouts", icon: "arrow-up-right" },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`ss-tab ${activeTab === tab.key ? "ss-tab--active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            <SsIcon name={tab.icon} size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══════════════════ OVERVIEW TAB ═══════════════════ */}
      {activeTab === "overview" && (
        <>
          {/* ── Stat Cards ── */}
          <section>
            <div className="ss-stats-grid wallet-stats-grid">
              <SsStatCard
                icon="wallet"
                label="Available Balance"
                value={
                  loading
                    ? "Loading…"
                    : formatCurrency(balance?.balance)
                }
                desc="Wallet balance ready for payout"
              />
              <SsStatCard
                icon="trending-up"
                label="Total Earnings"
                value={formatCurrency(metrics.earnings)}
                desc="Revenue from completed sessions"
              />
              <SsStatCard
                icon="arrow-up-right"
                label="Total Payouts"
                value={formatCurrency(metrics.payouts)}
                desc="Withdrawals and outgoing payments"
              />
              <SsStatCard
                icon="refresh"
                label="Total Refunds"
                value={formatCurrency(metrics.refunds)}
                desc="Refunds and session paybacks"
              />
            </div>
          </section>

          {/* ── Monthly Earnings Chart + Activity Timeline ── */}
          <div className="wallet-overview-grid">
            <SsCard title="Earnings Trend (Last 6 Months)">
              {trendData.some((d) => d.value > 0) ? (
                <TrendChart
                  data={trendData}
                  type="area"
                  gradientId="walletTrend"
                />
              ) : (
                <div className="wallet-chart-empty">
                  <SsIcon
                    name="trending-up"
                    size={32}
                    style={{ color: "var(--ss-text-muted)", marginBottom: 8 }}
                  />
                  <p>No earnings data yet. Complete sessions to see your revenue trend.</p>
                </div>
              )}
            </SsCard>

            <SsCard title="Wallet Activity">
              {activityItems.length > 0 ? (
                <div className="ss-activity">
                  {activityItems.map((item) => (
                    <SsActivityItem
                      key={item.id}
                      icon={item.icon}
                      iconBg={item.iconBg}
                      iconColor={item.iconColor}
                      text={item.text}
                      time={item.time}
                    />
                  ))}
                </div>
              ) : (
                <div className="wallet-chart-empty">
                  <SsIcon
                    name="clock"
                    size={32}
                    style={{ color: "var(--ss-text-muted)", marginBottom: 8 }}
                  />
                  <p>No activity recorded yet. Start mentoring to track your earnings.</p>
                </div>
              )}
            </SsCard>
          </div>

          {/* ── Recent Transactions ── */}
          <section>
            <SsSectionHeader
              title="Recent Transactions"
              subtitle="Your most recent wallet activity"
              actions={
                <button
                  className="ss-btn ss-btn--ghost ss-btn--sm"
                  type="button"
                  onClick={() => setActiveTab("transactions")}
                >
                  View All
                  <SsIcon name="chevron-right" size={16} />
                </button>
              }
            />
            <div className="ss-table-wrap">
              <table className="ss-table wallet-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Type</th>
                    <th style={{ textAlign: "right" }}>Amount</th>
                    <th style={{ textAlign: "right" }}>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="5">
                        <div className="wallet-empty-inline">
                          <SsIcon name="loader" size={20} />
                          <span>Loading transactions…</span>
                        </div>
                      </td>
                    </tr>
                  ) : recentTransactions.length === 0 ? (
                    <tr>
                      <td colSpan="5">
                        <div className="wallet-empty-inline">
                          <SsIcon name="mail" size={20} />
                          <span>No transactions match your filters.</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    recentTransactions.map((entry) => {
                      const s = entry.type;
                      const badgeCls =
                        s === "EARNING" || s === "CREDIT"
                          ? "success"
                          : s === "WITHDRAWAL" || s === "DEBIT"
                            ? "danger"
                            : "neutral";
                      return (
                        <tr key={entry.id}>
                          <td>{formatDate(entry.createdAt)}</td>
                          <td>
                            <strong>{entry.description || "—"}</strong>
                            <div className="wallet-row-meta">
                              {entry.referenceType || entry.type}
                            </div>
                          </td>
                          <td>
                            <SsBadge status={badgeCls}>
                              {TYPE_LABELS[entry.type] || entry.type}
                            </SsBadge>
                          </td>
                          <td style={{ textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                            {formatCurrency(entry.amount, entry.currency)}
                          </td>
                          <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                            {formatCurrency(entry.balanceAfter, entry.currency)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* ── Recent Payout Requests ── */}
          <section>
            <SsSectionHeader
              title="Recent Payout Requests"
              subtitle="Your latest withdrawal activity"
              actions={
                <button
                  className="ss-btn ss-btn--ghost ss-btn--sm"
                  type="button"
                  onClick={() => setActiveTab("payouts")}
                >
                  Manage Payouts
                  <SsIcon name="chevron-right" size={16} />
                </button>
              }
            />
            {allPayoutEntries.length > 0 ? (
              <div className="ss-table-wrap">
                <table className="ss-table wallet-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Description</th>
                      <th>Type</th>
                      <th style={{ textAlign: "right" }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allPayoutEntries.slice(0, 5).map((entry) => (
                      <tr key={entry.id}>
                        <td>{formatDate(entry.createdAt)}</td>
                        <td>{entry.description || "Withdrawal"}</td>
                        <td>
                          <SsBadge status="danger">
                            {TYPE_LABELS[entry.type] || entry.type}
                          </SsBadge>
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "var(--ss-danger)" }}>
                          -{formatCurrency(Math.abs(entry.amount), entry.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <SsEmpty
                icon="mail"
                title="No payout requests yet"
                desc="Withdrawals you make will appear here. Complete sessions to start earning."
              />
            )}
          </section>
        </>
      )}

      {/* ═══════════════════ TRANSACTIONS TAB ═══════════════════ */}
      {activeTab === "transactions" && (
        <section>
          <SsSectionHeader
            title="All Transactions"
            subtitle={loading ? "Loading…" : `${filteredLedger.length} entries`}
            actions={
              <div className="wallet-panel__actions" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <div className="ss-search wallet-search">
                  <SsIcon name="search" size={18} />
                  <input
                    type="search"
                    placeholder="Search description, type..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <select
                  className="wallet-filter"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                >
                  {TRANSACTION_TYPES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <select
                  className="wallet-filter"
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                >
                  {DATE_RANGES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <button
                  className="ss-btn ss-btn--secondary ss-btn--sm"
                  type="button"
                  onClick={handleExport}
                  disabled={exporting}
                >
                  <SsIcon name="download" size={16} />
                  Export
                </button>
              </div>
            }
          />

          <div className="ss-table-wrap">
            <table className="ss-table wallet-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Type</th>
                  <th style={{ textAlign: "right" }}>Amount</th>
                  <th style={{ textAlign: "right" }}>Balance</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="5">
                      <div className="wallet-empty-inline">
                        <SsIcon name="loader" size={20} />
                        <span>Loading transactions…</span>
                      </div>
                    </td>
                  </tr>
                ) : recentTransactions.length === 0 ? (
                  <tr>
                    <td colSpan="5">
                      <SsEmpty
                        icon="mail"
                        title="No transactions found"
                        desc={
                          search || typeFilter !== "all" || dateRange !== "all"
                            ? "No transactions match your filters. Try adjusting them."
                            : "Your wallet is empty. Complete sessions to start earning."
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  recentTransactions.map((entry) => {
                    const s = entry.type;
                    const badgeCls =
                      s === "EARNING" || s === "CREDIT"
                        ? "success"
                        : s === "WITHDRAWAL" || s === "DEBIT"
                          ? "danger"
                          : "neutral";
                    return (
                      <tr key={entry.id}>
                        <td>{formatDate(entry.createdAt)}</td>
                        <td>
                          <strong>{entry.description || "—"}</strong>
                          <div className="wallet-row-meta">
                            {entry.referenceType || entry.type}
                          </div>
                        </td>
                        <td>
                          <SsBadge status={badgeCls}>
                            {TYPE_LABELS[entry.type] || entry.type}
                          </SsBadge>
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                          {formatCurrency(entry.amount, entry.currency)}
                        </td>
                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                          {formatCurrency(entry.balanceAfter, entry.currency)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ═══════════════════ PAYOUTS TAB ═══════════════════ */}
      {activeTab === "payouts" && (
        <section>
          <SsSectionHeader
            title="Payouts & Withdrawals"
            subtitle="Manage your withdrawals and view payout history"
          />

          {/* ── Payout Stats Cards ── */}
          <div className="ss-stats-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", marginBottom: 24 }}>
            <SsStatCard
              icon="arrow-up-right"
              label="Total Payouts"
              value={formatCurrency(metrics.payouts)}
              desc="All time withdrawals"
            />
            <SsStatCard
              icon="clock"
              label="Active Requests"
              value={metrics.payoutCount}
              desc="Pending payout entries"
            />
            <SsStatCard
              icon="refresh"
              label="Refunds Handled"
              value={formatCurrency(metrics.refunds)}
              desc="Returned to learners"
            />
          </div>

          {/* ── Payout Setup Banner (mentor only) ── */}
          {isMentor && (
            <div className="wallet-connect-banner" style={{
              padding: '20px 24px',
              borderRadius: 'var(--ss-card-radius)',
              border: payoutsEnabled ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(245,158,11,0.3)',
              background: payoutsEnabled ? 'rgba(16,185,129,0.06)' : 'rgba(245,158,11,0.06)',
              marginBottom: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              flexWrap: 'wrap',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <SsIcon name={payoutsEnabled ? 'check_circle' : 'warning'} size={22} style={{ color: payoutsEnabled ? 'var(--ss-success)' : 'var(--ss-warning)', flexShrink: 0 }} />
                <div>
                  <strong style={{ fontSize: 'var(--ss-font-base)', color: 'var(--ss-text)' }}>
                    {payoutsEnabled ? 'Payouts Enabled' : 'Complete Verification to Enable Payouts'}
                  </strong>
                  <p style={{ margin: 0, fontSize: 'var(--ss-font-sm)', color: 'var(--ss-text-muted)' }}>
                    {payoutsEnabled
                      ? 'Your Stripe Connect account is verified. You can withdraw funds to your bank account.'
                      : 'Set up your Stripe Connect account to receive real payouts directly to your bank account.'}
                  </p>
                </div>
              </div>
              {!payoutsEnabled && (
                <button
                  type="button"
                  className="ss-btn ss-btn--primary ss-btn--sm"
                  onClick={handleStartOnboarding}
                  disabled={onboardingLoading}
                >
                  <SsIcon name="account_balance" size={16} />
                  {onboardingLoading ? 'Redirecting…' : 'Set Up Payouts'}
                </button>
              )}
            </div>
          )}

          {/* ── Withdrawal Card ── */}
          <div className="wallet-withdraw-card">
            <div className="wallet-withdraw-card__head">
              <div className="wallet-withdraw-card__head-icon">
                <SsIcon name="wallet" size={28} />
              </div>
              <div>
                <strong>Request a Withdrawal</strong>
                <span>
                  Minimum ₹10.00 · Balance:{" "}                  {loading
                  ? "..."
                  : formatCurrency(balance?.balance)}
                </span>
              </div>
            </div>
            <div className="wallet-withdraw-card__form">
              <div className="wallet-withdraw-card__amount-row">
                <div className="wallet-withdraw-card__input-wrapper">
                  <span className="wallet-withdraw-card__currency">₹</span>
                  <input
                    type="number"
                    className="wallet-withdraw-card__input"
                    placeholder="0.00"
                    min="10"
                    step="0.01"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    disabled={withdrawProcessing}
                  />
                </div>
                <button
                  type="button"
                  className="wallet-withdraw-card__max"
                  onClick={() =>
                    setWithdrawAmount(
                      String(Number(balance?.balance || 0).toFixed(2)),
                    )
                  }
                  disabled={withdrawProcessing}
                >
                  Max
                </button>
              </div>
              <div className="wallet-withdraw-card__method-row">
                {[
                  { value: "bank", label: "Bank Transfer", icon: "wallet" },
                  { value: "paypal", label: "PayPal", icon: "payments" },
                  { value: "upi", label: "UPI", icon: "zap" },
                ].map((method) => (
                  <button
                    key={method.value}
                    type="button"
                    className={`wallet-withdraw-card__method ${withdrawMethod === method.value ? "wallet-withdraw-card__method--active" : ""}`}
                    onClick={() => setWithdrawMethod(method.value)}
                    disabled={withdrawProcessing}
                  >
                    <SsIcon name={method.icon} size={18} />
                    {method.label}
                  </button>
                ))}
              </div>
              {isMentor && !payoutsEnabled ? (
                <div style={{ padding: '12px 16px', borderRadius: 'var(--ss-radius)', background: 'var(--ss-bg)', color: 'var(--ss-text-muted)', fontSize: 'var(--ss-font-sm)', textAlign: 'center' }}>
                  Complete your payout account setup above before withdrawing.
                </div>
              ) : (
                <button
                  type="button"
                  className="ss-btn ss-btn--primary wallet-withdraw-card__submit"
                  onClick={handleWithdraw}
                  disabled={
                    withdrawProcessing || !withdrawAmount || Number(withdrawAmount) <= 0
                  }
                >
                  {withdrawProcessing
                    ? "Processing..."
                    : `Withdraw ${withdrawAmount ? formatCurrency(Number(withdrawAmount)) : "₹0.00"}`}
                </button>
              )}
            </div>
          </div>

          {/* ── Payout Filters ── */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
              marginBottom: 16,
            }}
          >
            <div className="ss-search wallet-search" style={{ flex: 1, maxWidth: 320 }}>
              <SsIcon name="search" size={18} />
              <input
                type="search"
                placeholder="Search payout entries..."
                value={payoutSearch}
                onChange={(e) => {
                  setPayoutSearch(e.target.value);
                  setPayoutPage(0);
                }}
              />
            </div>
            <select
              className="wallet-filter"
              value={payoutDateRange}
              onChange={(e) => {
                setPayoutDateRange(e.target.value);
                setPayoutPage(0);
              }}
            >
              {DATE_RANGES.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* ── Payout List ── */}
          {allPayoutEntries.length === 0 ? (
            <SsEmpty
              icon="mail"
              title="No payout entries"
              desc={
                payoutSearch || payoutDateRange !== "all"
                  ? "No payout entries match your search. Try adjusting the filters."
                  : "No payout entries exist yet. Complete sessions to generate payouts."
              }
            />
          ) : (
            <div className="ss-card wallet-payout-list">
              <div className="wallet-payout-list__head">
                <span>Payout Entries</span>
                <span>{allPayoutEntries.length} total</span>
              </div>
              {paginatedPayouts.map((entry) => (
                <div className="wallet-payout-row" key={entry.id}>
                  <div className="wallet-payout-row__info">
                    <strong>
                      {formatCurrency(Math.abs(entry.amount), entry.currency)}
                    </strong>
                    <span>{entry.description || "Withdrawal"}</span>
                  </div>
                  <div className="wallet-payout-row__right">
                    <span className="wallet-payout-row__date">
                      {formatDate(entry.createdAt)}
                    </span>
                    <SsBadge status="danger">
                      {TYPE_LABELS[entry.type] || entry.type}
                    </SsBadge>
                  </div>
                </div>
              ))}

              {/* Pagination */}
              {allPayoutEntries.length > PAYOUT_PAGE_SIZE && (
                <div className="wallet-pagination">
                  <button
                    className="ss-btn ss-btn--secondary ss-btn--sm"
                    type="button"
                    disabled={safePayoutPage <= 0}
                    onClick={() => setPayoutPage((p) => Math.max(0, p - 1))}
                  >
                    <SsIcon name="chevron-left" size={16} />
                    Previous
                  </button>
                  <span className="wallet-pagination__info">
                    Page {safePayoutPage + 1} of {payoutTotalPages}
                  </span>
                  <button
                    className="ss-btn ss-btn--secondary ss-btn--sm"
                    type="button"
                    disabled={safePayoutPage >= payoutTotalPages - 1}
                    onClick={() =>
                      setPayoutPage((p) => Math.min(payoutTotalPages - 1, p + 1))
                    }
                  >
                    Next
                    <SsIcon name="chevron-right" size={16} />
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
