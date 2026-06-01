import { useEffect, useMemo, useState } from 'react';
import client from '../api/client';
import './WalletPage.css';

const formatMoney = (amount, currency = 'CREDITS') => {
  const value = Number(amount || 0);
  if (currency === 'CREDITS') {
    return `${value.toFixed(2)} credits`;
  }
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currency || 'USD'
  }).format(value);
};

const formatDateTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Just now';
  }
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

export default function WalletPage({ profile, notify }) {
  const [balance, setBalance] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [walletAddress, setWalletAddress] = useState(profile?.walletAddress || '');
  const [loading, setLoading] = useState(true);
  const [savingWallet, setSavingWallet] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadWallet = async () => {
      setLoading(true);
      try {
        const [balanceResponse, ledgerResponse] = await Promise.all([
          client.get('/api/v1/wallet/balance'),
          client.get('/api/v1/wallet/ledger')
        ]);
        if (!mounted) {
          return;
        }
        setBalance(balanceResponse.data.data);
        setLedger(ledgerResponse.data.data || []);
      } catch {
        notify?.({
          type: 'error',
          title: 'Wallet unavailable',
          message: 'Start the backend and sign in again to load wallet data.'
        });
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadWallet();
    return () => {
      mounted = false;
    };
  }, [notify]);

  const totals = useMemo(() => {
    return ledger.reduce((acc, entry) => {
      const amount = Number(entry.amount || 0);
      if (amount >= 0) {
        acc.incoming += amount;
      } else {
        acc.outgoing += Math.abs(amount);
      }
      return acc;
    }, { incoming: 0, outgoing: 0 });
  }, [ledger]);

  const saveWalletAddress = async (event) => {
    event.preventDefault();
    setSavingWallet(true);
    try {
      await client.put('/api/v1/users/me/wallet', { walletAddress });
      notify?.({
        type: 'success',
        title: 'Wallet saved',
        message: 'Your wallet address was updated.'
      });
    } catch {
      notify?.({
        type: 'error',
        title: 'Wallet not saved',
        message: 'Use a valid wallet address and try again.'
      });
    } finally {
      setSavingWallet(false);
    }
  };

  return (
    <main className="wallet-page">
      <section className="wallet-hero">
        <p className="wallet-eyebrow">{profile?.role === 'MENTOR' ? 'Earnings' : 'Payments'}</p>
        <h1>Wallet and ledger</h1>
        <p>Track credits, earnings, refunds, withdrawals, and the wallet address connected to your account.</p>
      </section>

      <section className="wallet-grid" aria-label="Wallet summary">
        <article className="wallet-stat">
          <span>Current balance</span>
          <strong>{loading ? 'Loading...' : formatMoney(balance?.balance, balance?.currency)}</strong>
        </article>
        <article className="wallet-stat">
          <span>Incoming</span>
          <strong>{formatMoney(totals.incoming, balance?.currency)}</strong>
        </article>
        <article className="wallet-stat">
          <span>Outgoing</span>
          <strong>{formatMoney(totals.outgoing, balance?.currency)}</strong>
        </article>
      </section>

      <section className="wallet-panel">
        <div>
          <p className="wallet-eyebrow">Account</p>
          <h2>Connected wallet</h2>
        </div>
        <form className="wallet-form" onSubmit={saveWalletAddress}>
          <label>
            <span>Wallet address</span>
            <input
              value={walletAddress}
              onChange={(event) => setWalletAddress(event.target.value)}
              placeholder="0x..."
            />
          </label>
          <button type="submit" disabled={savingWallet}>
            {savingWallet ? 'Saving...' : 'Save wallet'}
          </button>
        </form>
      </section>

      <section className="wallet-panel">
        <div>
          <p className="wallet-eyebrow">History</p>
          <h2>Ledger</h2>
        </div>
        <div className="wallet-ledger">
          {ledger.map((entry) => (
            <article className="wallet-ledger-row" key={entry.id}>
              <div>
                <strong>{entry.description}</strong>
                <span>{entry.type} • {formatDateTime(entry.createdAt)}</span>
              </div>
              <div className={Number(entry.amount) >= 0 ? 'wallet-amount positive' : 'wallet-amount negative'}>
                {formatMoney(entry.amount, entry.currency)}
              </div>
            </article>
          ))}
          {!loading && ledger.length === 0 && (
            <p className="wallet-empty">No wallet transactions yet. Book or complete sessions to generate ledger entries.</p>
          )}
        </div>
      </section>
    </main>
  );
}
