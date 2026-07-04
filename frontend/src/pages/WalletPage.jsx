import { useEffect, useMemo, useState } from "react";
import client from "../api/client";
import Icon from "../modules/common/dashboard/Icon";
import SectionCard from "../modules/common/dashboard/SectionCard";
import StatsCard from "../modules/common/dashboard/StatsCard";
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

const formatDateTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Just now";
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
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
  const payoutEntries = ledger
    .filter((entry) => entry.type === "WITHDRAWAL" || entry.type === "DEBIT")
    .slice(0, 5);

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

  const pageTitle =
    profile?.role === "MENTOR" ? "Earnings dashboard" : "Payments dashboard";

  return (
    <main className="wallet-page wallet-dashboard">
      <section className="wallet-hero md-hero">
        <div className="md-hero__body">
          <p className="md-hero__eyebrow">{pageTitle}</p>
          <h1 className="md-hero__title">Premium wallet insights</h1>
          <p className="md-hero__sub">
            Monitor your earnings, payouts, and payouts pipeline with a modern
            financial dashboard built on live wallet data.
          </p>
          <div className="md-hero__actions">
            <button
              className="md-btn md-btn--primary"
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <Icon name="refresh" />
              {refreshing ? "Refreshing…" : "Refresh data"}
            </button>
            <button
              className="md-btn md-btn--ghost"
              type="button"
              onClick={handleExport}
              disabled={exporting}
            >
              <Icon name="download" />
              {exporting ? "Exporting…" : "Export ledger"}
            </button>
          </div>
        </div>

        <div className="md-hero__aside">
          <div className="md-hero-glass">
            <p className="md-hero-glass__label">Available balance</p>
            <p className="md-hero-glass__value">
              {loading
                ? "Loading…"
                : formatCurrency(balance?.balance, balance?.currency)}
            </p>
            <p className="md-hero-glass__desc">
              Funds available to withdraw or reinvest.
            </p>
          </div>
          <div className="md-hero-glass">
            <p className="md-hero-glass__label">Recent payout activity</p>
            <p className="md-hero-glass__value">
              {loading
                ? "Loading…"
                : formatCurrency(metrics.payouts, balance?.currency)}
            </p>
            <p className="md-hero-glass__desc">
              Total payouts recorded in your wallet history.
            </p>
          </div>
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

          <div className="wallet-payout-list">
            <div className="wallet-payout-list__head">
              <span>Recent payout entries</span>
              <span>{payoutEntries.length} shown</span>
            </div>
            {payoutEntries.length === 0 ? (
              <p className="wallet-empty-state">
                No payout entries exist yet. Complete sessions to generate
                wallet payouts.
              </p>
            ) : (
              payoutEntries.map((entry) => (
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
              ))
            )}
          </div>
        </section>
      )}
    </main>
  );
}
