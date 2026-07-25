import { useCallback, useEffect, useState } from "react";
import client from "../api/client";
import { getApiErrorMessage } from "../utils/apiErrors";
import "../modules/mentor/mentor-pages.css";

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
      <div className="md-page mp-animate" style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 20px 48px" }}>
        <div className="mp-settings-loading">
          <div className="mp-spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
          <p className="mp-settings-loading__text">Loading settings…</p>
        </div>
      </div>
    );
  }

  if (error && !dirty) {
    return (
      <div className="md-page mp-animate" style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 20px 48px" }}>
        <div className="md-empty" style={{ margin: "48px auto", maxWidth: 420 }}>
          <div className="md-empty__icon">
            <span className="material-symbols-outlined">error_outline</span>
          </div>
          <h3 className="md-empty__title">Could not load settings</h3>
          <p className="md-empty__desc">{error}</p>
          <button type="button" className="mp-btn mp-btn--primary" onClick={fetchPreferences}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>refresh</span>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="md-page" style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 20px 48px" }}>
      {/* ===== Premium Hero ===== */}
      <section className="mp-hero">
        <div className="mp-hero__watermark">
          <span className="material-symbols-outlined" style={{ fontSize: 78 }}>notifications_active</span>
        </div>
        <div className="mp-hero__content">
          <div className="mp-hero__eyebrow">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>tune</span>
            SETTINGS
          </div>
          <h1>Notification Preferences</h1>
          <p className="mp-hero__sub">
            Control which notifications you receive and how they&apos;re delivered.
          </p>
        </div>
      </section>

      {/* ===== Settings Card ===== */}
      <div style={{ marginTop: 20 }}>
        <div className="mp-card">
          <div className="mp-section__head">
            <div className="mp-section__title">
              <span className="material-symbols-outlined" style={{ fontSize: 22, color: "var(--mp-primary)" }}>notifications</span>
              Notification Preferences
            </div>
          </div>
          <p style={{ margin: "-8px 0 18px", fontSize: "0.88rem", color: "var(--mp-text-secondary)", lineHeight: 1.6 }}>
            Toggle individual notification channels. Changes are saved to your account.
          </p>
          <div className="mp-settings-list mp-animate-stagger">
            {SETTINGS.map((setting) => (
              <label key={setting.key} className="mp-setting-row">
                <div className="mp-setting-row__info">
                  <span className="mp-setting-row__label">{setting.label}</span>
                  <span className="mp-setting-row__desc">{setting.desc}</span>
                </div>
                <div className="mp-setting-row__toggle">
                  <div className={`mp-settings-toggle${settings[setting.key] ? " mp-settings-toggle--on" : ""}`}>
                    <input
                      type="checkbox"
                      checked={settings[setting.key] ?? false}
                      onChange={() => toggleSetting(setting.key)}
                      className="mp-settings-toggle__input"
                    />
                    <span className="mp-settings-toggle__track">
                      <span className="mp-settings-toggle__thumb" />
                    </span>
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* ===== Save Bar ===== */}
        {dirty && (
          <div className="mp-save-bar">
            <div className="mp-save-bar__body">
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: "var(--mp-warning)" }}>edit_note</span>
              <span className="mp-save-bar__text">You have unsaved changes</span>
            </div>
            <div className="mp-save-bar__actions">
              <button
                type="button"
                className="mp-btn mp-btn--ghost mp-btn--sm"
                onClick={fetchPreferences}
                disabled={saving}
              >
                Discard
              </button>
              <button
                type="button"
                className="mp-btn mp-btn--primary mp-btn--sm"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <span className="mp-spinner mp-spinner--sm" />
                    Saving…
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>save</span>
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
