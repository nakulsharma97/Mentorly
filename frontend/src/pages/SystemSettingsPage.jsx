import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import client from "../api/client";
import { getApiErrorMessage as errorMessage } from "../utils/apiErrors";
import Icon from "../modules/common/dashboard/Icon";
import HeroSection from "../components/HeroSection";
import "./AdminOperationsPage.css";
import "./SystemSettingsPage.css";
import "../modules/admin/ui/admin-ui.css";

/* ── Helpers ───────────────────────────────────────────────────── */

const unwrap = (res) => res?.data?.data;

const SECTION_ICONS = {
  general: "settings",
  registration: "person_add",
  security: "security",
  notifications: "notifications_active",
  payments: "payments",
  sessions: "calendar_month",
  ai: "smart_toy",
  moderation: "gavel",
  email: "mail",
  features: "toggle_on",
  appearance: "palette",
  maintenance: "build",
};

const TYPE_META = {
  boolean: { icon: "toggle_on", hint: "Toggle" },
  number: { icon: "pin", hint: "Number" },
  email: { icon: "mail", hint: "Email" },
  select: { icon: "arrow_drop_down_circle", hint: "Select" },
  text: { icon: "text_fields", hint: "Text" },
};

/* ── Main page ─────────────────────────────────────────────────── */

export default function SystemSettingsPage({ notify }) {
  const [catalog, setCatalog] = useState([]); // [{ id, label, description, fields: [] }]
  const [values, setValues] = useState({}); // flat key -> current value
  const [notifPrefs, setNotifPrefs] = useState({});
  const [prefsBaseline, setPrefsBaseline] = useState({}); // as loaded from server
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(() => new Set(["general", "security", "maintenance"]));
  const [confirmReset, setConfirmReset] = useState(null); // { type: 'section'|'all', category }
  const [busyAction, setBusyAction] = useState("");

  const lastErrorRef = useRef(null);
  const notifyOnce = useCallback((type, title, message) => {
    const key = `${title}|${message}`;
    const now = Date.now();
    const last = lastErrorRef.current;
    if (last && last.key === key && now - last.ts < 2500) return;
    lastErrorRef.current = { key, ts: now };
    notify?.({ type, title, message });
  }, [notify]);

  /* ── Loaders ─────────────────────────────────────────────────── */

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [catalogRes, valuesRes, prefsRes] = await Promise.all([
        client.get("/api/v1/admin/settings/catalog"),
        client.get("/api/v1/admin/settings"),
        client.get("/api/v1/admin/notification-preferences"),
      ]);
      setCatalog(unwrap(catalogRes) || []);
      setValues(unwrap(valuesRes) || {});
      const prefs = unwrap(prefsRes) || {};
      setNotifPrefs(prefs);
      setPrefsBaseline(prefs);
      setDirty(false);
    } catch (err) {
      notifyOnce("error", "Settings unavailable", errorMessage(err, "Could not load platform settings."));
    } finally {
      setLoading(false);
    }
  }, [notifyOnce]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  /* ── Local edits ──────────────────────────────────────────────── */

  const handleFieldChange = (key, value) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleNotifToggle = (key, value) => {
    setNotifPrefs((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  /* ── Saves ───────────────────────────────────────────────────── */

  const handleSave = async () => {
    setSaving(true);
    try {
      // Only send keys whose value changed — the backend audits each change.
      const changed = {};
      Object.entries(values).forEach(([k, v]) => {
        if (!catalog.some((c) => c.fields.some((f) => f.key === k))) return;
        const baseline = catalog
          .flatMap((c) => c.fields)
          .find((f) => f.key === k)?.value;
        if (String(v) !== String(baseline ?? "")) changed[k] = String(v);
      });

      let savedAny = false;
      let noOp = false;
      if (Object.keys(changed).length > 0) {
        const res = await client.put("/api/v1/admin/settings", { settings: changed });
        const data = unwrap(res);
        setValues(data || values);
        // Refresh the catalog field baselines from the response so change
        // detection compares against the saved state (not the mount-time one) —
        // otherwise reverting a setting to its original value would be dropped.
        setCatalog((prev) => prev.map((c) => ({
          ...c,
          fields: c.fields.map((f) => ({
            ...f,
            value: data && data[f.key] !== undefined ? String(data[f.key]) : f.value,
          })),
        })));
        // The backend short-circuits when every submitted value already matches
        // the stored value — surface that as an info toast, not a success one.
        if (res?.data?.message === "No settings changed") noOp = true;
        else savedAny = true;
      }

      // Persist notification preferences through their dedicated endpoint.
      const prefsChanged = {};
      Object.entries(notifPrefs).forEach(([k, v]) => {
        const baseline = prefsBaseline[k];
        if (baseline === undefined || baseline !== v) prefsChanged[k] = v;
      });
      if (Object.keys(prefsChanged).length > 0) {
        const res = await client.put("/api/v1/admin/notification-preferences", prefsChanged);
        const newPrefs = unwrap(res);
        setNotifPrefs((prev) => ({ ...prev, ...newPrefs }));
        // Same baseline refresh as above — keep the saved state as the reference.
        setPrefsBaseline((prev) => ({ ...prev, ...newPrefs }));
        savedAny = true;
      }

      if (noOp && !savedAny) {
        notify?.({ type: "info", title: "No changes", message: "Values already match the saved configuration." });
        setDirty(false);
      } else if (savedAny) {
        notify?.({ type: "success", title: "Settings saved", message: "Platform configuration updated." });
        setDirty(false);
      } else {
        notify?.({ type: "info", title: "No changes", message: "Nothing to save — values are unchanged." });
        setDirty(false);
      }
    } catch (err) {
      notifyOnce("error", "Save failed", errorMessage(err, "Could not save platform settings."));
    } finally {
      setSaving(false);
    }
  };

  /* ── Reset ───────────────────────────────────────────────────── */

  const runReset = async () => {
    if (!confirmReset) return;
    const { type, category } = confirmReset;
    setBusyAction(type === "all" ? "reset-all" : `reset-${category}`);
    try {
      if (type === "all") {
        await client.post("/api/v1/admin/settings/reset-all");
        notify?.({ type: "success", title: "Settings reset", message: "All platform settings restored to defaults." });
      } else {
        await client.post("/api/v1/admin/settings/reset-section", { category });
        notify?.({ type: "success", title: "Section reset", message: "Section restored to default values." });
      }
      setConfirmReset(null);
      await loadAll();
    } catch (err) {
      notifyOnce("error", "Reset failed", errorMessage(err, "Could not reset settings."));
    } finally {
      setBusyAction("");
    }
  };

  /* ── Maintenance actions ─────────────────────────────────────── */

  const downloadBlob = (blob, fileName) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = async () => {
    setBusyAction("export");
    try {
      const res = await client.get("/api/v1/admin/settings/export", { responseType: "blob" });
      downloadBlob(res.data, "skillswap-settings.csv");
      notify?.({ type: "success", title: "Export ready", message: "Settings exported as CSV." });
    } catch (err) {
      notifyOnce("error", "Export failed", errorMessage(err, "Could not export settings."));
    } finally {
      setBusyAction("");
    }
  };

  const handleDownloadLogs = async () => {
    setBusyAction("logs");
    try {
      const res = await client.get("/api/v1/admin/settings/logs", { params: { limit: 500 } });
      const rows = unwrap(res) || [];
      const lines = rows.map((l) => `[${l.timestamp}] [${l.level}] ${l.service}: ${l.message}`).join("\n");
      downloadBlob(new Blob([lines], { type: "text/plain" }), "skillswap-system.log");
      notify?.({ type: "success", title: "Logs downloaded", message: `${rows.length} log entries exported.` });
    } catch (err) {
      notifyOnce("error", "Logs failed", errorMessage(err, "Could not download system logs."));
    } finally {
      setBusyAction("");
    }
  };

  const handleClearCache = async () => {
    setBusyAction("cache");
    try {
      await client.post("/api/v1/admin/settings/clear-cache");
      notify?.({ type: "success", title: "Cache cleared", message: "Settings cache invalidated." });
    } catch (err) {
      notifyOnce("error", "Cache clear failed", errorMessage(err, "Could not clear the settings cache."));
    } finally {
      setBusyAction("");
    }
  };

  const handleSendTestEmail = async () => {
    setBusyAction("email");
    try {
      await client.post("/api/v1/admin/notifications/send-test");
      notify?.({ type: "success", title: "Test email sent", message: "Check your email inbox." });
    } catch (err) {
      notifyOnce("error", "Send failed", errorMessage(err, "Could not send the test email."));
    } finally {
      setBusyAction("");
    }
  };

  /* ── Derived render data ─────────────────────────────────────── */

  const searchTerm = search.trim().toLowerCase();

  const filteredCatalog = useMemo(() => {
    if (!searchTerm) return catalog;
    return catalog
      .map((category) => ({
        ...category,
        fields: category.fields.filter((f) =>
          f.label.toLowerCase().includes(searchTerm)
            || f.key.toLowerCase().includes(searchTerm)
            || (f.description || "").toLowerCase().includes(searchTerm)
            || category.label.toLowerCase().includes(searchTerm)),
      }))
      .filter((category) => category.fields.length > 0);
  }, [catalog, searchTerm]);

  const totalSettings = useMemo(
    () => catalog.reduce((sum, c) => sum + c.fields.length, 0),
    [catalog],
  );

  const toggleSection = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /* ── Render ──────────────────────────────────────────────────── */

  if (loading) {
    return (
      <section className="admin-page">
        <HeroSection
          badge="Configuration"
          title="Platform Configuration Center"
          subtitle="Loading configuration…"
          illustration={
            <div className="hero-section__watermark" aria-hidden="true">
              <span className="material-symbols-outlined">tune</span>
            </div>
          }
        />
        <div className="ss-skeleton-grid">
          {[0, 1, 2].map((i) => (
            <div key={i} className="ss-skeleton-card" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="admin-page">
      <HeroSection
        badge="Super Admin"
        title="Platform Configuration Center"
        subtitle={`${totalSettings} settings across ${catalog.length} categories. Changes are audited and apply immediately.`}
        illustration={
          <div className="hero-section__watermark" aria-hidden="true">
            <span className="material-symbols-outlined">settings</span>
          </div>
        }
      />

      {/* Sticky toolbar */}
      <div className="ss-toolbar">
        <div className="ss-search">
          <Icon name="search" />
          <input
            type="search"
            placeholder="Search settings, categories, keywords…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button type="button" className="ss-search__clear" onClick={() => setSearch("")} aria-label="Clear search">
              <Icon name="close" />
            </button>
          )}
        </div>
        <div className="ss-toolbar__actions">
          <button
            type="button"
            className="ss-btn ss-btn--ghost"
            onClick={() => setConfirmReset({ type: "all", category: null })}
            disabled={saving || Boolean(busyAction)}
          >
            <Icon name="restart_alt" /> Reset All
          </button>
          <button
            type="button"
            className="ss-btn ss-btn--primary"
            onClick={handleSave}
            disabled={saving || !dirty || Boolean(busyAction)}
          >
            <Icon name="save" /> {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>

      {searchTerm && (
        <div className="ss-search-hint">
          Showing matches for “{search}” — {filteredCatalog.reduce((sum, c) => sum + c.fields.length, 0)} setting(s).
        </div>
      )}

      {filteredCatalog.length === 0 ? (
        <div className="ss-empty">
          <Icon name="search_off" />
          <h3>No settings found</h3>
          <p>Try a different search term.</p>
        </div>
      ) : (
        <div className="ss-sections">
          {filteredCatalog.map((category) => {
            const isOpen = expanded.has(category.id);
            const notifSection = category.id === "notifications";
            return (
              <div key={category.id} className="ss-section">
                <button
                  type="button"
                  className="ss-section__header"
                  onClick={() => toggleSection(category.id)}
                  aria-expanded={isOpen}
                >
                  <span className="ss-section__icon"><Icon name={SECTION_ICONS[category.id] || "tune"} /></span>
                  <span className="ss-section__title">
                    <strong>{category.label}</strong>
                    <small>{category.description}</small>
                  </span>
                  <span className="ss-section__count">{notifSection ? Object.keys(notifPrefs).length : category.fields.length} items</span>
                  <span className="ss-section__chevron"><Icon name={isOpen ? "expand_less" : "expand_more"} /></span>
                </button>

                {isOpen && (
                  <div className="ss-section__body">
                    {notifSection ? (
                      <div className="ss-field-list">
                        {Object.entries(notifPrefs).map(([key, value]) => (
                          <div key={key} className="ss-field ss-field--row">
                            <div className="ss-field__info">
                              <strong>{humanizePrefKey(key)}</strong>
                            </div>
                            <ToggleSwitch
                              checked={Boolean(value)}
                              onChange={(v) => handleNotifToggle(key, v)}
                              disabled={saving || Boolean(busyAction)}
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="ss-field-list">
                        {category.fields.map((field) => (
                          <FieldControl
                            key={field.key}
                            field={field}
                            value={values[field.key] ?? field.value ?? ""}
                            onChange={(v) => handleFieldChange(field.key, v)}
                            disabled={saving || Boolean(busyAction)}
                          />
                        ))}
                      </div>
                    )}

                    {!notifSection && (
                      <div className="ss-section__footer">
                        <button
                          type="button"
                          className="ss-btn ss-btn--ghost ss-btn--sm"
                          onClick={() => setConfirmReset({ type: "section", category: category.id })}
                          disabled={saving || Boolean(busyAction)}
                        >
                          <Icon name="restart_alt" /> Reset section
                        </button>
                      </div>
                    )}

                    {category.id === "maintenance" && (
                      <div className="ss-maintenance-actions">
                        <button type="button" className="ss-btn ss-btn--outline" onClick={handleSendTestEmail} disabled={Boolean(busyAction)}>
                          <Icon name="mail" /> {busyAction === "email" ? "Sending…" : "Send test email"}
                        </button>
                        <button type="button" className="ss-btn ss-btn--outline" onClick={handleExportCsv} disabled={Boolean(busyAction)}>
                          <Icon name="download" /> {busyAction === "export" ? "Exporting…" : "Export settings (CSV)"}
                        </button>
                        <button type="button" className="ss-btn ss-btn--outline" onClick={handleDownloadLogs} disabled={Boolean(busyAction)}>
                          <Icon name="description" /> {busyAction === "logs" ? "Downloading…" : "Download logs"}
                        </button>
                        <button type="button" className="ss-btn ss-btn--outline" onClick={handleClearCache} disabled={Boolean(busyAction)}>
                          <Icon name="cleaning_services" /> {busyAction === "cache" ? "Clearing…" : "Clear cache"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Reset confirmation dialog */}
      {confirmReset && (
        <div className="ss-modal-overlay" role="presentation">
          <div className="ss-modal" role="dialog" aria-modal="true" aria-labelledby="ss-modal-title">
            <span className="ss-modal__icon"><Icon name="warning" /></span>
            <h3 id="ss-modal-title">
              {confirmReset.type === "all" ? "Reset all settings?" : "Reset this section?"}
            </h3>
            <p>
              {confirmReset.type === "all"
                ? "Every platform setting will be restored to its catalog default. Changes are audited. This cannot be undone."
                : `The “${catalog.find((c) => c.id === confirmReset.category)?.label || confirmReset.category}” section will be restored to its default values. Changes are audited.`}
            </p>
            <div className="ss-modal__actions">
              <button type="button" className="ss-btn ss-btn--ghost" onClick={() => setConfirmReset(null)} disabled={Boolean(busyAction)}>
                Cancel
              </button>
              <button type="button" className="ss-btn ss-btn--danger" onClick={runReset} disabled={Boolean(busyAction)}>
                {busyAction ? "Resetting…" : "Confirm reset"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/* ── Sub-components ────────────────────────────────────────────── */

function ToggleSwitch({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={`ss-toggle${checked ? " ss-toggle--on" : ""}`}
      onClick={() => onChange(!checked)}
      disabled={disabled}
    >
      <span className="ss-toggle__track"><span className="ss-toggle__thumb" /></span>
    </button>
  );
}

function FieldControl({ field, value, onChange, disabled }) {
  const meta = TYPE_META[field.type] || TYPE_META.text;
  const isBoolean = field.type === "boolean";

  if (isBoolean) {
    return (
      <div className="ss-field ss-field--row">
        <div className="ss-field__info">
          <strong>{field.label}</strong>
          {field.description && <p>{field.description}</p>}
        </div>
        <ToggleSwitch checked={value === "true" || value === true} onChange={(v) => onChange(v ? "true" : "false")} disabled={disabled} />
      </div>
    );
  }

  const isSelect = field.type === "select" || (field.options && field.options.length > 0);

  return (
    <div className="ss-field">
      <div className="ss-field__info">
        <strong>{field.label}</strong>
        {field.description && <p>{field.description}</p>}
        <small className="ss-field__type"><Icon name={meta.icon} /> {meta.hint}</small>
      </div>
      {isSelect ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="ss-input ss-input--select"
        >
          {(field.options || []).map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      ) : (
        <input
          type={field.type === "number" ? "number" : field.type === "email" ? "email" : "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="ss-input"
        />
      )}
    </div>
  );
}

function humanizePrefKey(key) {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
