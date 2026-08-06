import { useEffect, useRef, useState } from "react";
import client from "../api/client";
import { getApiErrorMessage } from "../utils/apiErrors";

const USERNAME_PATTERN = /^[A-Za-z0-9._-]{4,30}$/;
const HAS_ALPHANUMERIC = /[A-Za-z0-9]/;

/**
 * UsernameSettingsCard — lets a signed-in user change their unique public
 * username (@handle). Mirrors the signup UX:
 *   - 500ms debounced real-time availability check (never spams the server)
 *   - green ✅ "Username available" / red ❌ "Username already taken"
 *   - case-insensitive uniqueness (Nakul == nakul)
 *   - "This username is already taken" is prevented before save
 *   - the backend PUT /api/v1/users/me/username is the source of truth
 *
 * Renders with the shared `mp-*` settings-page styling so it fits both the
 * learner and mentor settings pages.
 */
export default function UsernameSettingsCard({ profile, notify, onProfileUpdated }) {
  const currentUsername = profile?.username || "";
  const [username, setUsername] = useState(currentUsername);
  const [check, setCheck] = useState({ checking: false, available: null, suggestion: null });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const debounceRef = useRef(null);
  // Monotonic sequence guard: a slow availability response must never
  // overwrite the result of a newer check for a different username
  // (out-of-order responses). Bumped on every value change, so a stale
  // in-flight response is dropped when its sequence no longer matches.
  const checkSeqRef = useRef(0);

  const trimmed = username.trim();
  const lower = trimmed.toLowerCase();
  const hasChanged = lower !== currentUsername.toLowerCase();
  const isValidFormat = USERNAME_PATTERN.test(trimmed) && HAS_ALPHANUMERIC.test(trimmed);
  const canSave =
    hasChanged && isValidFormat && !check.checking && check.available !== false && !saving;

  // Real-time availability check, debounced 500ms.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (trimmed.length < 4 || !hasChanged) {
      // Invalidate any in-flight check for a previous value.
      checkSeqRef.current += 1;
      setCheck({ checking: false, available: null, suggestion: null });
      return undefined;
    }
    setCheck((prev) => ({ ...prev, checking: true, available: null }));
    debounceRef.current = setTimeout(async () => {
      const seq = checkSeqRef.current + 1;
      checkSeqRef.current = seq;
      try {
        const res = await client.get("/api/v1/users/check-username", {
          params: { username: trimmed },
        });
        const data = res?.data?.data;
        // Drop stale responses (the value changed while this request was in flight).
        if (seq !== checkSeqRef.current) return;
        setCheck({
          checking: false,
          available: data?.available ?? false,
          suggestion: data?.suggestion || null,
        });
      } catch {
        if (seq !== checkSeqRef.current) return;
        setCheck({ checking: false, available: null, suggestion: null });
      }
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [trimmed, lower, hasChanged]);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const response = await client.put("/api/v1/users/me/username", {
        username: trimmed,
      });
      const updated = response?.data?.data;
      // Keep the input in sync even if the global profile refresh lags.
      setUsername(updated?.username ?? trimmed);
      setCheck({ checking: false, available: null, suggestion: null });
      onProfileUpdated?.(updated);
      notify?.({
        type: "success",
        title: "Username updated",
        message: `Your username is now @${trimmed}.`,
      });
    } catch (err) {
      const message = getApiErrorMessage(err, "Could not update username.");
      setError(message);
      notify?.({ type: "error", title: "Update failed", message });
    } finally {
      setSaving(false);
    }
  };

  const inputBorder =
    error
      ? "#dc2626"
      : check.available === false
        ? "#dc2626"
        : check.available === true
          ? "#16a34a"
          : undefined;

  return (
    <div className="mp-card">
      <div className="mp-section__head">
        <div className="mp-section__title">
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 22, color: "var(--mp-primary)" }}
            aria-hidden="true"
          >
            alternate_email
          </span>
          Username
        </div>
      </div>
      <p
        style={{
          margin: "-8px 0 18px",
          fontSize: "0.88rem",
          color: "var(--mp-text-secondary)",
          lineHeight: 1.6,
        }}
      >
        Your unique public handle. Others find you with{" "}
        <strong>@{currentUsername}</strong>. Usernames are unique
        case-insensitively — “Nakul” and “nakul” are the same handle.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label htmlFor="settings-username" style={{ fontSize: "0.82rem", fontWeight: 600 }}>
          Username
        </label>
        <div style={{ position: "relative" }}>
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--mp-text-secondary)",
              fontWeight: 600,
            }}
          >
            @
          </span>
          <input
            id="settings-username"
            name="username"
            autoComplete="username"
            maxLength={30}
            value={username}
            onChange={(e) => {
              const val = e.target.value.replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 30);
              setUsername(val);
              setError("");
            }}
            disabled={saving}
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "11px 40px 11px 30px",
              borderRadius: 10,
              border: `1px solid ${inputBorder || "var(--mp-border, #d1d5db)"}`,
              background: "var(--mp-surface, #fff)",
              color: "var(--mp-text, inherit)",
              fontSize: "0.95rem",
              outline: "none",
              transition: "border-color 0.15s ease",
            }}
          />
          {check.checking && (
            <span
              style={{
                position: "absolute",
                right: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--mp-text-secondary)",
                fontSize: "0.72rem",
              }}
            >
              Checking…
            </span>
          )}
          {!check.checking && check.available === true && (
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                right: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: "#16a34a",
                fontSize: "1rem",
              }}
            >
              ✅
            </span>
          )}
          {!check.checking && check.available === false && (
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                right: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: "#dc2626",
                fontSize: "1rem",
              }}
            >
              ❌
            </span>
          )}
        </div>

        {!check.checking && check.available === true && hasChanged && (
          <span style={{ color: "#16a34a", fontSize: "0.78rem" }}>✅ Username available</span>
        )}
        {!check.checking && check.available === false && (
          <span style={{ color: "#dc2626", fontSize: "0.78rem" }}>
            ❌ Username already taken
            {check.suggestion && (
              <>
                {" "}
                Try:{" "}
                <button
                  type="button"
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--mp-primary)",
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: "0.78rem",
                    padding: 0,
                    textDecoration: "underline",
                  }}
                  onClick={() => {
                    setUsername(check.suggestion);
                    setCheck((prev) => ({ ...prev, available: true, suggestion: null }));
                  }}
                >
                  {check.suggestion}
                </button>
              </>
            )}
          </span>
        )}
        {trimmed.length > 0 && trimmed.length < 4 && (
          <span style={{ color: "var(--mp-text-secondary)", fontSize: "0.78rem" }}>
            Username must be at least 4 characters. Letters, numbers, and . _ - only.
          </span>
        )}
        {error && (
          <span style={{ color: "#dc2626", fontSize: "0.78rem" }}>{error}</span>
        )}
      </div>

      <div style={{ marginTop: 16 }}>
        <button
          type="button"
          className="mp-btn mp-btn--primary mp-btn--sm"
          onClick={handleSave}
          disabled={!canSave}
        >
          {saving ? (
            <>
              <span className="mp-spinner mp-spinner--sm" /> Saving…
            </>
          ) : (
            <>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>save</span>
              Save Username
            </>
          )}
        </button>
      </div>
    </div>
  );
}
