import { useCallback, useEffect, useState } from "react";
import client from "../api/client";
import { getApiErrorMessage } from "../utils/apiErrors";
import "./ProfessionalProfilePage.css";

const SETTINGS = [
  { key: "bookingUpdates", label: "Booking updates", desc: "Get notified when a learner books or cancels a session." },
  { key: "sessionAnnouncements", label: "Session announcements", desc: "Receive announcements about upcoming sessions and schedule changes." },
  { key: "reviewAlerts", label: "Review alerts", desc: "Be notified when a learner leaves a review or rating." },
  { key: "certificationAlerts", label: "Certification alerts", desc: "Get notified when your certifications are issued or updated." },
  { key: "emailEnabled", label: "Email notifications", desc: "Receive notification emails in addition to in-app alerts." },
];

function unwrap(payload) {
  if (payload && typeof payload === "object" && "data" in payload && "message" in payload) {
    return payload.data;
  }
  return payload;
}

export default function MentorSettingsPage({ notify }) {
  const [settings, setSettings] = useState({
    emailEnabled: true,
    bookingUpdates: true,
    sessionAnnouncements: true,
    reviewAlerts: true,
    certificationAlerts: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [dirty, setDirty] = useState(false);

  const fetchPreferences = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await client.get("/api/v1/notifications/preferences");
      const data = unwrap(response.data);
      if (data) {
        setSettings({
          emailEnabled: data.emailEnabled ?? true,
          bookingUpdates: data.bookingUpdates ?? true,
          sessionAnnouncements: data.sessionAnnouncements ?? true,
          reviewAlerts: data.reviewAlerts ?? true,
          certificationAlerts: data.certificationAlerts ?? true,
        });
      }
      setDirty(false);
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not load notification preferences."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  const toggleSetting = (key) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await client.put("/api/v1/notifications/preferences", settings);
      notify?.({ type: "success", title: "Settings saved", message: "Notification preferences updated." });
      setDirty(false);
    } catch (err) {
      notify?.({ type: "error", title: "Save failed", message: getApiErrorMessage(err, "Could not save preferences.") });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="pp-shell">
        <div className="pp-settings-loading">
          <div className="pp-settings-loading__spinner" />
          <p>Loading settings…</p>
        </div>
      </div>
    );
  }

  if (error && !dirty) {
    return (
      <div className="pp-shell">
        <div className="pp-settings-error">
          <h2>Could not load settings</h2>
          <p>{error}</p>
          <button type="button" className="pp-btn pp-btn--primary" onClick={fetchPreferences}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pp-shell">
      {/* Hero */}
      <section className="pp-hero">
        <div className="pp-hero__bg" />
        <div className="pp-hero__body">
          <div className="pp-hero__left">
            <div className="pp-hero__eyebrow">
              <span className="pp-hero__eyebrow-dot" />
              SETTINGS
            </div>
            <div className="pp-hero__info">
              <div className="pp-hero__text">
                <h1 className="pp-hero__name">Notification Preferences</h1>
                <p className="pp-hero__subtitle">
                  Control which notifications you receive and how they&apos;re delivered.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Settings card */}
      <div className="pp-content">
        <div className="pp-card">
          <div className="pp-card__head">
            <h3 className="pp-card__title">
              <span className="material-symbols-outlined">notifications</span>
              Notification Preferences
            </h3>
            <p className="pp-card__subtitle">
              Toggle individual notification channels. Changes are saved to your account.
            </p>
          </div>
          <div className="pp-card__body">
            <div className="pp-settings-list">
              {SETTINGS.map((setting) => (
                <label key={setting.key} className="pp-setting-row">
                  <div className="pp-setting-row__info">
                    <span className="pp-setting-row__label">{setting.label}</span>
                    <span className="pp-setting-row__desc">{setting.desc}</span>
                  </div>
                  <div className="pp-setting-row__toggle">
                    <input
                      type="checkbox"
                      checked={settings[setting.key] ?? false}
                      onChange={() => toggleSetting(setting.key)}
                      className="pp-toggle-input"
                    />
                    <span className={`pp-toggle-track${settings[setting.key] ? " is-on" : ""}`}>
                      <span className="pp-toggle-thumb" />
                    </span>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Save bar */}
        {dirty && (
          <div className="pp-save-bar">
            <span className="pp-save-bar__text">You have unsaved changes</span>
            <div className="pp-save-bar__actions">
              <button
                type="button"
                className="pp-btn pp-btn--ghost pp-btn--sm"
                onClick={fetchPreferences}
                disabled={saving}
              >
                Discard
              </button>
              <button
                type="button"
                className="pp-btn pp-btn--primary pp-btn--sm"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Inline styles for the toggle component */}
      <style>{`
        .pp-settings-loading,
        .pp-settings-error {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 80px 24px;
          text-align: center;
          gap: 12px;
        }
        .pp-settings-loading__spinner {
          width: 32px;
          height: 32px;
          border: 3px solid var(--notif-border, #e9ecf0);
          border-top-color: var(--notif-accent, #0f766e);
          border-radius: 50%;
          animation: pp-spin 0.7s linear infinite;
        }
        @keyframes pp-spin {
          to { transform: rotate(360deg); }
        }
        .pp-settings-list {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .pp-setting-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 14px 0;
          border-bottom: 1px solid var(--notif-border, #e9ecf0);
          cursor: pointer;
        }
        .pp-setting-row:last-child {
          border-bottom: none;
        }
        .pp-setting-row__info {
          flex: 1;
          min-width: 0;
        }
        .pp-setting-row__label {
          display: block;
          font-size: 0.9rem;
          font-weight: 650;
          color: var(--notif-text, #0d1117);
        }
        .pp-setting-row__desc {
          display: block;
          font-size: 0.78rem;
          color: var(--notif-muted, #6b7280);
          margin-top: 2px;
          line-height: 1.4;
        }
        .pp-setting-row__toggle {
          position: relative;
          flex-shrink: 0;
        }
        .pp-toggle-input {
          position: absolute;
          opacity: 0;
          width: 0;
          height: 0;
          pointer-events: none;
        }
        .pp-toggle-track {
          display: block;
          width: 42px;
          height: 24px;
          border-radius: 999px;
          background: #d1d5db;
          transition: background 0.25s ease;
          position: relative;
          cursor: pointer;
        }
        .pp-toggle-track.is-on {
          background: #0f766e;
        }
        .pp-toggle-thumb {
          position: absolute;
          top: 3px;
          left: 3px;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #fff;
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
          transition: transform 0.25s ease;
        }
        .pp-toggle-track.is-on .pp-toggle-thumb {
          transform: translateX(18px);
        }
      `}</style>
    </div>
  );
}
