import { useEffect, useMemo, useState } from "react";
import client from "../api/client";
import Icon from "../modules/common/dashboard/Icon";
import SsIcon from "../components/ui/SsIcon";
import { SsStatCard } from "../components/ui/SsCard";
import StatsCard from "../modules/common/dashboard/StatsCard";
import SectionCard from "../modules/common/dashboard/SectionCard";
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

const TYPE_STYLES = {
  EARNING: "positive",
  CREDIT: "positive",
  REFUND: "neutral",
  WITHDRAWAL: "negative",
  DEBIT: "negative",
};

const formatCurrency = (amount, currency = "CREDITS") => {
  const value = Number(amount || 0);
  if (currency === "CREDITS") {
    return `${value.toFixed(2)} credits`;
  }
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  }).format(value);
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

      return [
        entry.description,
        entry.type,
        entry.referenceType,
        entry.referenceId,
      ]
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
        const cutoff = Date.now() - Number(payoutDateRange) * 24 * 60 * 60 * 1000;
        const createdAt = new Date(entry.createdAt).getTime();
        if (Number.isNaN(createdAt) || createdAt < cutoff) return false;
      }
      if (!query) return true;
      return [entry.description, entry.type, entry.referenceType]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(query));
    });
  }, [ledger, payoutSearch, payoutDateRange]);

  const payoutTotalPages = Math.max(1, Math.ceil(allPayoutEntries.length / PAYOUT_PAGE_SIZE));
  const safePayoutPage = Math.min(payoutPage, payoutTotalPages - 1);
  const paginatedPayouts = allPayoutEntries.slice(
    safePayoutPage * PAYOUT_PAGE_SIZE,
    (safePayoutPage + 1) * PAYOUT_PAGE_SIZE,
  );

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
      notify?.({ type: "error", title: "Invalid amount", message: "Please enter a valid withdrawal amount." });
      return;
    }
    const balanceNum = Number(balance?.balance || 0);
    if (amount > balanceNum) {
      notify?.({ type: "error", title: "Insufficient balance", message: `Your balance is ${balanceNum.toFixed(2)} credits.` });
      return;
    }
    if (amount < 10) {
      notify?.({ type: "error", title: "Minimum amount", message: "Minimum withdrawal amount is 10.00 credits." });
      return;
    }
    setWithdrawProcessing(true);
    try {
      const res = await client.post("/api/v1/wallet/withdraw", {
        amount,
        description: `Withdrawal via ${withdrawMethod === "bank" ? "Bank Transfer" : withdrawMethod === "paypal" ? "PayPal" : "UPI"}`,
        paymentMethod: withdrawMethod === "bank" ? "Bank Transfer" : withdrawMethod === "paypal" ? "PayPal" : "UPI",
      });
      const entry = res?.data?.data;
      setLedger((prev) => [entry, ...prev]);
      setBalance((prev) => ({ ...prev, balance: entry?.balanceAfter ?? prev?.balance }));
      setWithdrawAmount("");
      notify?.({ type: "success", title: "Withdrawal processed", message: `${amount.toFixed(2)} credits withdrawal has been recorded.` });
    } catch (err) {
      const detail = err?.response?.data?.data?.message || err?.response?.data?.data?.error || err?.response?.data?.message || err?.message || "Withdrawal failed";
      notify?.({ type: "error", title: "Withdrawal failed", message: detail });
    } finally {
      setWithdrawProcessing(false);
    }
  };

  const pageTitle =
    profile?.role === "MENTOR" ? "Earnings" : "Payments";

  return (
    <main className="ss-page">
      {/* Unified Hero Section — light theme, consistent with all mentor pages */}
      <section className="ss-hero">
        <div className="ss-hero__content">
          <div className="ss-hero__badge">
            <SsIcon name="wallet" size={14} />
            {pageTitle} dashboard
          </div>
          <h1 className="ss-hero__title">
            {profile?.role === "MENTOR" ? "Earnings & Wallet" : "Payments & Credits"}
          </h1>
          <p className="ss-hero__desc">
            Track your earnings, withdrawals, and balance history with a modern financial dashboard.
          </p>
          <div className="ss-hero__actions">
            <button
              className="ss-btn ss-btn--primary"
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <SsIcon name="refresh" size={18} />
              {refreshing ? "Refreshing…" : "Refresh data"}
            </button>
            <button
              className="ss-btn ss-btn--secondary"
              type="button"
              onClick={handleExport}
              disabled={exporting}
            >
              <SsIcon name="download" size={18} />
              {exporting ? "Exporting…" : "Export ledger"}
            </button>
          </div>

          {/* Quick Balance Cards in Hero */}
          <div className="ss-hero__quick-stats" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
            <div className="ss-hero__qs-item">
              <p className="ss-hero__qs-label">Available Balance</p>
              <p className="ss-hero__qs-value" style={{ fontSize: "1.25rem" }}>
                {loading ? "..." : formatCurrency(balance?.balance, balance?.currency)}
              </p>
            </div>
            <div className="ss-hero__qs-item">
              <p className="ss-hero__qs-label">Total Payouts</p>
              <p className="ss-hero__qs-value" style={{ fontSize: "1.25rem" }}>
                {loading ? "..." : formatCurrency(metrics.payouts, balance?.currency)}
              </p>
            </div>
          </div>
        </div>

        <div className="ss-hero__illustration">
          <SsIcon name="wallet" size={160} />
        </div>
      </section>

      <div className="wallet-tabs" role="tablist" aria-label="Wallet sections">
        {[
          { key: "overview", label: "Overview" },
          { key: "transactions", label: "Transactions" },
          { key: "payouts", label: "Payouts" },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`wallet-tab ${activeTab === tab.key ? "wallet-tab--active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <>
          <section className="wallet-card-grid">
            <StatsCard
              icon="account_balance_wallet"
              label="Available balance"
              value={
                loading
                  ? "Loading…"
                  : formatCurrency(balance?.balance, balance?.currency)
              }
              description="Wallet balance ready for payout."
            />
            <StatsCard
              icon="payments"
              label="Total earnings"
              value={formatCurrency(metrics.earnings, balance?.currency)}
              description="Revenue from completed sessions."
            />
            <StatsCard
              icon="account_balance"
              label="Total payouts"
              value={formatCurrency(metrics.payouts, balance?.currency)}
              description="Withdrawals and outgoing payments."
            />
            <StatsCard
              icon="refund"
              label="Total refunds"
              value={formatCurrency(metrics.refunds, balance?.currency)}
              description="Returned credits and session refunds."
            />
          </section>

          <section className="wallet-panel wallet-overview-panel">
            <SectionCard
              title="Earnings trend"
              icon="trending_up"
              action="View all transactions"
              onAction={() => setActiveTab("transactions")}
            >
              <TrendChart
                data={trendData}
                type="area"
                gradientId="walletTrend"
              />
            </SectionCard>
          </section>
        </>
      )}

      {activeTab !== "payouts" && (
        <section className="wallet-panel wallet-transactions-panel">
          <div className="wallet-panel__head">
            <div>
              <p className="wallet-eyebrow">Transactions</p>
              <h2>Recent wallet activity</h2>
            </div>
            <div className="wallet-panel__actions">
              <div className="wallet-search">
                <Icon name="search" />
                <input
                  type="search"
                  placeholder="Search description, type, reference..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <select
                className="wallet-filter"
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
              >
                {TRANSACTION_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                className="wallet-filter"
                value={dateRange}
                onChange={(event) => setDateRange(event.target.value)}
              >
                {DATE_RANGES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="wallet-table-wrap">
            <table className="mp-table wallet-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Type</th>
                  <th className="wallet-amount-col">Amount</th>
                  <th className="wallet-balance-col">Balance</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="5" className="wallet-loading">
                      Loading wallet transactions...
                    </td>
                  </tr>
                ) : recentTransactions.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="wallet-empty-state">
                      No matching transactions found. Adjust the filters or
                      refresh the page.
                    </td>
                  </tr>
                ) : (
                  recentTransactions.map((entry) => (
                    <tr key={entry.id}>
                      <td>{formatDate(entry.createdAt)}</td>
                      <td>
                        <strong>{entry.description}</strong>
                        <div className="wallet-row-meta">
                          {entry.referenceType || entry.type}
                        </div>
                      </td>
                      <td>
                        <span
                          className={`wallet-pill wallet-pill--${TYPE_STYLES[entry.type] || "neutral"}`}
                        >
                          {TYPE_LABELS[entry.type] || entry.type}
                        </span>
                      </td>
                      <td className="wallet-amount-col">
                        {formatCurrency(entry.amount, entry.currency)}
                      </td>
                      <td className="wallet-balance-col">
                        {formatCurrency(entry.balanceAfter, entry.currency)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeTab === "payouts" && (
        <section className="wallet-panel wallet-payouts-panel">
          <div className="wallet-panel__head">
            <div>
              <p className="wallet-eyebrow">Payouts</p>
              <h2>Withdrawals and payouts</h2>
            </div>
            <button
              type="button"
              className="md-btn md-btn--ghost"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <Icon name="refresh" />
              Refresh
            </button>
          </div>

          <div className="wallet-payout-summary">
            <div className="wallet-payout-card">
              <span>Total payouts</span>
              <strong>
                {formatCurrency(metrics.payouts, balance?.currency)}
              </strong>
            </div>
            <div className="wallet-payout-card">
              <span>Active payout requests</span>
              <strong>{metrics.payoutCount}</strong>
            </div>
            <div className="wallet-payout-card">
              <span>Refunds handled</span>
              <strong>
                {formatCurrency(metrics.refunds, balance?.currency)}
              </strong>
            </div>
          </div>

          {/* ── Withdrawal Form ── */}
          <div className="wallet-withdraw-card">
            <div className="wallet-withdraw-card__head">
              <Icon name="account_balance_wallet" />
              <div>
                <strong>Request a withdrawal</strong>
                <span>Minimum 10.00 credits. Your balance: {loading ? "..." : formatCurrency(balance?.balance, balance?.currency)}</span>
              </div>
            </div>
            <div className="wallet-withdraw-card__form">
              <div className="wallet-withdraw-card__amount-row">
                <div className="wallet-withdraw-card__input-wrapper">
                  <span className="wallet-withdraw-card__currency">CR</span>
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
                  onClick={() => setWithdrawAmount(String(Number(balance?.balance || 0).toFixed(2)))}
                  disabled={withdrawProcessing}
                >
                  Max
                </button>
              </div>
              <div className="wallet-withdraw-card__method-row">
                {[
                  { value: "bank", label: "Bank Transfer", icon: "account_balance" },
                  { value: "paypal", label: "PayPal", icon: "payments" },
                  { value: "upi", label: "UPI", icon: "smartphone" },
                ].map((method) => (
                  <button
                    key={method.value}
                    type="button"
                    className={`wallet-withdraw-card__method ${withdrawMethod === method.value ? "wallet-withdraw-card__method--active" : ""}`}
                    onClick={() => setWithdrawMethod(method.value)}
                    disabled={withdrawProcessing}
                  >
                    <Icon name={method.icon} />
                    {method.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="md-btn md-btn--primary wallet-withdraw-card__submit"
                onClick={handleWithdraw}
                disabled={withdrawProcessing || !withdrawAmount || Number(withdrawAmount) <= 0}
              >
                {withdrawProcessing ? "Processing..." : `Withdraw ${withdrawAmount ? Number(withdrawAmount).toFixed(2) : "0.00"} credits`}
              </button>
            </div>
          </div>

          {/* ── Payout search & filters ── */}
          <div className="wallet-panel__head" style={{ marginTop: 16 }}>
            <div className="wallet-panel__actions">
              <div className="wallet-search">
                <Icon name="search" />
                <input
                  type="search"
                  placeholder="Search payout entries..."
                  value={payoutSearch}
                  onChange={(e) => { setPayoutSearch(e.target.value); setPayoutPage(0); }}
                />
              </div>
              <select
                className="wallet-filter"
                value={payoutDateRange}
                onChange={(e) => { setPayoutDateRange(e.target.value); setPayoutPage(0); }}
              >
                {DATE_RANGES.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="wallet-payout-list">
            <div className="wallet-payout-list__head">
              <span>Payout entries</span>
              <span>{allPayoutEntries.length} total</span>
            </div>
            {allPayoutEntries.length === 0 ? (
              <p className="wallet-empty-state">
                {payoutSearch || payoutDateRange !== "all"
                  ? "No payout entries match your search. Try adjusting the filters."
                  : "No payout entries exist yet. Complete sessions to generate wallet payouts."}
              </p>
            ) : (
              <>
                {paginatedPayouts.map((entry) => (
                  <div className="wallet-payout-row" key={entry.id}>
                    <div>
                      <strong>
                        {formatCurrency(entry.amount, entry.currency)}
                      </strong>
                      <span>{formatDate(entry.createdAt)}</span>
                    </div>
                    <span
                      className={`wallet-pill wallet-pill--${TYPE_STYLES[entry.type] || "neutral"}`}
                    >
                      {TYPE_LABELS[entry.type] || entry.type}
                    </span>
                  </div>
                ))}
                {/* ── Pagination bar ── */}
                {allPayoutEntries.length > PAYOUT_PAGE_SIZE && (
                  <div className="mp-pagination" style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 12,
                    padding: "12px 0",
                    borderTop: "1px solid var(--ss-border, #e5e7eb)",
                    marginTop: 8,
                  }}>
                    <button
                      className="md-btn md-btn--outline md-btn--sm"
                      type="button"
                      disabled={safePayoutPage <= 0}
                      onClick={() => setPayoutPage((p) => Math.max(0, p - 1))}
                    >
                      Previous
                    </button>
                    <span style={{ fontSize: "0.82rem", color: "var(--ss-text-secondary, #6b7280)" }}>
                      Page {safePayoutPage + 1} of {payoutTotalPages}
                    </span>
                    <button
                      className="md-btn md-btn--outline md-btn--sm"
                      type="button"
                      disabled={safePayoutPage >= payoutTotalPages - 1}
                      onClick={() => setPayoutPage((p) => Math.min(payoutTotalPages - 1, p + 1))}
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
