import { useState, useEffect } from "react";
import HeroSection from "../components/HeroSection";
import UsernameSettingsCard from "../components/UsernameSettingsCard";
import { useDocumentTitle, apiPut, useNotificationsData } from "./learner-utils";
import "../modules/mentor/mentor-pages.css";

export default function LearnerSettingsPage({ profile, notify, onProfileUpdated }) {
  useDocumentTitle("Settings");
  const [refreshKey, setRefreshKey] = useState(0);
  const { loading, data, error } = useNotificationsData(refreshKey);
  const [localPrefs, setLocalPrefs] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data?.preferences) {
      setLocalPrefs({ ...data.preferences });
      setDirty(false);
    }
  }, [data]);

  if (loading) {
    return (
      <div className="md-page" style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div className="mp-settings-loading">
          <div className="mp-spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
          <p className="mp-settings-loading__text">Loading settings…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="md-page" style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div className="md-empty" style={{ margin: "48px auto", maxWidth: 420 }}>
          <div className="md-empty__icon">
            <span className="material-symbols-outlined">error_outline</span>
          </div>
          <h3 className="md-empty__title">Could not load settings</h3>
          <p className="md-empty__desc">{error}</p>
          <button type="button" className="mp-btn mp-btn--primary" onClick={() => setRefreshKey((v) => v + 1)}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>refresh</span>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const toggleSetting = (key) => {
    setLocalPrefs((prev) => {
      if (!prev) return prev;
      return { ...prev, [key]: !prev[key] };
    });
    setDirty(true);
  };

  const handleSave = async () => {
    if (!localPrefs) return;
    setSaving(true);
    try {
      await apiPut("/api/v1/notifications/preferences", localPrefs);
      setDirty(false);
    } catch (err) {
      window.console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="md-page" style={{ maxWidth: 1200, margin: "0 auto" }}>
      <HeroSection
        className="hero-section--compact"
        badge={
          <>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>tune</span>
            Settings
          </>
        }
        title="Notification Preferences"
        subtitle="Control your notification channels and how you receive updates from mentors and the platform."
        illustration={
          <div className="hero-section__watermark" aria-hidden="true">
            <span className="material-symbols-outlined">settings</span>
          </div>
        }
      />

      <div style={{ marginTop: 20 }}>
        <UsernameSettingsCard
          profile={profile}
          notify={notify}
          onProfileUpdated={onProfileUpdated}
        />
      </div>

      <div style={{ marginTop: 20 }}>
        {localPrefs ? (
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
              {Object.entries(localPrefs).map(([key, value]) => (
                <label key={key} className="mp-setting-row">
                  <div className="mp-setting-row__info">
                    <span className="mp-setting-row__label">
                      {key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}
                    </span>
                    <span className="mp-setting-row__desc">
                      {key === "emailEnabled" ? "Receive notification emails in addition to in-app alerts."
                        : key === "bookingUpdates" ? "Get notified when a booking or cancellation occurs."
                        : key === "sessionAnnouncements" ? "Receive announcements about upcoming sessions."
                        : key === "reviewAlerts" ? "Be notified when a review or rating is left."
                        : key === "certificationAlerts" ? "Get notified when certifications are issued."
                        : "Toggle this notification setting."}
                    </span>
                  </div>
                  <div className="mp-setting-row__toggle">
                    <div className={`mp-settings-toggle${value ? " mp-settings-toggle--on" : ""}`}>
                      <input
                        type="checkbox"
                        checked={Boolean(value)}
                        onChange={() => toggleSetting(key)}
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
        ) : (
          <div className="mp-card">
            <div className="md-empty" style={{ border: "none", padding: "32px 0" }}>
              <div className="md-empty__icon">
                <span className="material-symbols-outlined">notifications_off</span>
              </div>
              <h3 className="md-empty__title">No preferences found</h3>
              <p className="md-empty__desc">
                Notification preferences are not available for this account.
              </p>
            </div>
          </div>
        )}

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
                onClick={() => {
                  setLocalPrefs(data?.preferences ? { ...data.preferences } : null);
                  setDirty(false);
                }}
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
