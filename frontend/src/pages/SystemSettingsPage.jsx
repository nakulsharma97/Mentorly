import { useCallback, useEffect, useState } from 'react';
import client from '../api/client';
import Icon from '../modules/common/dashboard/Icon';
import './AdminOperationsPage.css';

const SETTING_LABELS = {
  platform_fee_percent: 'Platform Fee (%)',
  min_withdrawal_amount: 'Min Withdrawal Amount (credits)',
  max_session_participants: 'Max Session Participants',
  maintenance_mode: 'Maintenance Mode',
  new_registrations_enabled: 'New Registrations Enabled',
  mentor_verification_required: 'Mentor Verification Required',
};

const SETTING_DESCRIPTIONS = {
  platform_fee_percent: 'Percentage deducted from mentor payouts as platform fee.',
  min_withdrawal_amount: 'Minimum credits a user can withdraw from their wallet.',
  max_session_participants: 'Default maximum participants per session.',
  maintenance_mode: 'When enabled, only admins can access the platform.',
  new_registrations_enabled: 'Allow new users to sign up.',
  mentor_verification_required: 'Require mentors to submit verification documents.',
};

const NOTIF_PREFS = {
  new_user_signups: 'Notify when new users sign up',
  reports_filed: 'Notify when a report is filed',
  failed_payments: 'Notify when a payment fails',
  mentor_verifications: 'Notify when a mentor verification is pending',
  daily_summary: 'Receive a daily summary email',
  new_bookings: 'Notify when a new booking is created',
};

const REPORT_FREQ_OPTIONS = [
  { value: 'none', label: 'Disabled' },
  { value: 'weekly', label: 'Weekly (Mondays at 7 AM)' },
  { value: 'monthly', label: 'Monthly (1st at 7 AM)' },
];

export default function SystemSettingsPage({ notify }) {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState({});
  const [notifLoading, setNotifLoading] = useState(true);
  const [notifSaving, setNotifSaving] = useState(false);
  // Scheduled report state
  const [reportFreq, setReportFreq] = useState('none');
  const [reportFreqLoading, setReportFreqLoading] = useState(true);
  const [reportFreqSaving, setReportFreqSaving] = useState(false);

  const loadReportSchedule = useCallback(async () => {
    setReportFreqLoading(true);
    try {
      const res = await client.get('/api/v1/admin/report-schedule');
      setReportFreq(res?.data?.data?.frequency || 'none');
    } catch { /* use default */ }
    finally { setReportFreqLoading(false); }
  }, []);

  useEffect(() => { loadReportSchedule(); }, [loadReportSchedule]);

  const handleReportFreqChange = async (freq) => {
    setReportFreq(freq);
    setReportFreqSaving(true);
    try {
      await client.put('/api/v1/admin/report-schedule', { frequency: freq });
      notify?.({ type: 'success', title: 'Report schedule saved', message: `Dashboard reports set to ${freq}.` });
    } catch {
      notify?.({ type: 'error', title: 'Update failed', message: 'Could not update report schedule.' });
      loadReportSchedule();
    } finally { setReportFreqSaving(false); }
  };

  const handleSendTestNotif = async () => {
    try {
      await client.post('/api/v1/admin/notifications/send-test');
      notify?.({ type: 'success', title: 'Test notification sent', message: 'Check your email inbox.' });
    } catch (err) {
      notify?.({ type: 'error', title: 'Send failed', message: err?.response?.data?.data?.error || err.message });
    }
  };

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await client.get('/api/v1/admin/settings');
      setSettings(res?.data?.data || {});
    } catch {
      notify?.({ type: 'error', title: 'Settings unavailable', message: 'Could not load platform settings.' });
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const loadNotifPrefs = useCallback(async () => {
    setNotifLoading(true);
    try {
      const res = await client.get('/api/v1/admin/notification-preferences');
      setNotifPrefs(res?.data?.data || {});
    } catch { /* prefs may not be available */ }
    finally { setNotifLoading(false); }
  }, []);

  useEffect(() => { loadNotifPrefs(); }, [loadNotifPrefs]);

  const handleNotifToggle = async (key, value) => {
    const updated = { ...notifPrefs, [key]: value };
    setNotifPrefs(updated);
    setNotifSaving(true);
    try {
      await client.put('/api/v1/admin/notification-preferences', updated);
      notify?.({ type: 'success', title: 'Preference saved', message: `${NOTIF_PREFS[key] || key} updated.` });
    } catch {
      setNotifPrefs(notifPrefs); // revert on error
      notify?.({ type: 'error', title: 'Update failed', message: 'Could not save notification preference.' });
    } finally {
      setNotifSaving(false);
    }
  };

  const handleChange = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await client.put('/api/v1/admin/settings', settings);
      setDirty(false);
      notify?.({ type: 'success', title: 'Settings saved', message: 'Platform settings updated successfully.' });
    } catch (err) {
      notify?.({ type: 'error', title: 'Save failed', message: err?.response?.data?.data?.error || err.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <section className="admin-page">
        <div className="admin-hero" style={{ marginBottom: 0, borderRadius: '0 0 18px 18px' }}>
          <h1>Platform Settings</h1>
          <p>Loading settings...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="admin-page">
      <div className="admin-hero" style={{ marginBottom: 0, borderRadius: '0 0 18px 18px' }}>
        <div>
          <p className="admin-eyebrow">Configuration</p>
          <h1>Platform Settings</h1>
          <p>Configure platform-wide settings and feature flags. Changes take effect immediately.</p>
        </div>
      </div>

      {/* Notification Preferences */}
      <div className="admin-panel" style={{ marginTop: 18 }}>
        <div className="admin-section-heading">
          <div>
            <p className="admin-eyebrow">Notifications</p>
            <h2>Admin Notification Preferences</h2>
          </div>
          {notifSaving && <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>Saving...</span>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {notifLoading ? (
            <p style={{ color: '#94a3b8' }}>Loading preferences...</p>
          ) : (
            Object.entries(NOTIF_PREFS).map(([key, label]) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '8px 0', borderBottom: '1px solid var(--admin-border)' }}>
                <input type="checkbox" checked={!!notifPrefs[key]}
                  onChange={(e) => handleNotifToggle(key, e.target.checked)}
                  disabled={notifSaving} />
                <div>
                  <strong style={{ fontSize: '0.9rem', display: 'block', color: 'var(--admin-text)' }}>{label}</strong>
                </div>
              </label>
            ))
          )}
        </div>
      </div>

      {/* Scheduled Reports */}
      <div className="admin-panel" style={{ marginTop: 18 }}>
        <div className="admin-section-heading">
          <div>
            <p className="admin-eyebrow">Automation</p>
            <h2>Scheduled Dashboard Reports</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--admin-muted)', margin: '4px 0 0' }}>
              Generate and email a PDF dashboard report to all admins on a recurring schedule.
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {reportFreqLoading ? (
            <p style={{ color: 'var(--admin-muted)', fontSize: '0.85rem' }}>Loading schedule...</p>
          ) : (
            <>
              <label style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--admin-text)' }}>
                Frequency:
              </label>
              <select value={reportFreq}
                onChange={(e) => handleReportFreqChange(e.target.value)}
                disabled={reportFreqSaving}
                style={{ border: '1px solid var(--admin-input-border)', borderRadius: 8, padding: '8px 12px', color: 'var(--admin-input-text)', background: 'var(--admin-input-bg)' }}>
                {REPORT_FREQ_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {reportFreqSaving && <span style={{ fontSize: '0.82rem', color: 'var(--admin-muted)' }}>Saving...</span>}
            </>
          )}
        </div>
      </div>

      {/* Test Notification */}
      <div className="admin-panel" style={{ marginTop: 18 }}>
        <div className="admin-section-heading">
          <div>
            <p className="admin-eyebrow">Email</p>
            <h2>Admin Email Notifications</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--admin-muted)', margin: '4px 0 0' }}>
              Send a test notification to verify your email configuration.
            </p>
          </div>
        </div>
        <button type="button" className="admin-refresh-btn" onClick={handleSendTestNotif}
          style={{ background: '#7c3aed', borderColor: '#6d28d9' }}>
          <Icon name="mail" /> Send Test Email
        </button>
      </div>

      {/* Platform Settings */}
      <div className="admin-panel" style={{ marginTop: 18 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {Object.entries(SETTING_LABELS).map(([key, label]) => {
            const value = settings[key] ?? '';
            const desc = SETTING_DESCRIPTIONS[key] || '';
            const isBool = value === 'true' || value === 'false';

            return (
              <div key={key} style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: 16 }}>
                <label style={{ display: 'block', fontWeight: 700, marginBottom: 4, color: '#0f172a' }}>
                  {label}
                </label>
                <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '0 0 8px' }}>{desc}</p>
                {isBool ? (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input type="checkbox" checked={value === 'true'}
                      onChange={(e) => handleChange(key, e.target.checked ? 'true' : 'false')} />
                    <span style={{ fontSize: '0.9rem' }}>Enabled</span>
                  </label>
                ) : (
                  <input type={key.includes('percent') || key.includes('amount') ? 'number' : 'text'}
                    value={value}
                    onChange={(e) => handleChange(key, e.target.value)}
                    style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', width: '100%', maxWidth: 300 }} />
                )}
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
          <button type="button" className="admin-refresh-btn" onClick={handleSave} disabled={saving || !dirty}
            style={{ padding: '10px 20px' }}>
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
          <button type="button"
            style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 20px', background: '#fff', cursor: 'pointer', fontWeight: 700 }}
            onClick={loadSettings} disabled={saving}>
            Reset
          </button>
          {dirty && <span style={{ color: '#d97706', fontSize: '0.85rem', alignSelf: 'center' }}>Unsaved changes</span>}
        </div>
      </div>
    </section>
  );
}
