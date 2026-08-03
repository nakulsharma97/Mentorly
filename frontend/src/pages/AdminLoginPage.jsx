import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import client, {
  clearAuthSessionState,
  resolveAuthResponsePayload,
} from "../api/client";
import { trackAnalyticsEvent } from "../utils/analyticsEvents";
import { getApiErrorMessage } from "../utils/apiErrors";
import { UIAlert, UIBadge, UIButton, UICard, UIField } from "../components/ui/Primitives";
import "./AdminLoginPage.css";

/**
 * Dedicated Admin login page at /admin/login.
 *
 * Reuses the exact same authentication mechanism as the regular auth modal
 * (POST /api/v1/auth/login + persistAuthSession + syncCurrentUser), but:
 *   - Only allows accounts with role ADMIN to proceed.
 *   - On success the shared onLoggedIn handler redirects to /admin/dashboard.
 *   - Learners/Mentors are rejected with a clear message and no session is
 *     persisted (so their account is never activated from this portal).
 */
export default function AdminLoginPage({ onLoggedIn, notify }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const emailInputRef = useRef(null);
  const titleId = "admin-login-title";

  useEffect(() => {
    emailInputRef.current?.focus();
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      // Clear any stale auth state (old tokens/cookies) before authenticating,
      // mirroring the regular auth modal flow.
      clearAuthSessionState();

      const response = await client.post("/api/v1/auth/login", {
        email: email.trim(),
        password,
      });
      const authResponse = resolveAuthResponsePayload(response.data);

      const role = authResponse?.role;
      if (role && role !== "ADMIN") {
        clearAuthSessionState();
        trackAnalyticsEvent("auth_login_failed", {
          reason: "non_admin_on_admin_portal",
          role,
        });
        const msg =
          "This portal is restricted to SkillSwap administrators. Learners and mentors should sign in from the main login page.";
        setError(msg);
        notify?.({ type: "error", title: "Access restricted", message: msg });
        return;
      }

      // The admin portal always lands admins on /admin/dashboard. Clear any
      // stale auth_post_redirect (e.g. a learner previously bounced to /login)
      // so the shared onLoggedIn handler never sends an admin to a non-admin
      // dashboard after signing in here.
      localStorage.removeItem("auth_post_redirect");

      trackAnalyticsEvent("auth_login_success", {
        role: "ADMIN",
        source: "admin_login_page",
      });
      onLoggedIn("login", authResponse);
    } catch (err) {
      const status = Number(err?.response?.status || 0);
      const responseData = err?.response?.data?.data;
      const backendError = responseData?.error;
      const validationErrors = responseData?.errors;
      const hasStructuredError =
        Boolean(backendError) ||
        (validationErrors && typeof validationErrors === "object"
          && Object.keys(validationErrors).length > 0);

      if (hasStructuredError) {
        const reason = getApiErrorMessage(err);
        trackAnalyticsEvent("auth_login_failed", {
          reason: backendError ? "backend_error" : "validation_error",
        });
        setError(reason);
        notify?.({ type: "error", title: "Authentication failed", message: reason });
        return;
      }

      if (status === 502 || status === 503) {
        trackAnalyticsEvent("auth_login_failed", { reason: "proxy_error" });
        setError("Backend server is not responding. Make sure the backend is running on port 8080 and refresh.");
        notify?.({ type: "error", title: "Backend unreachable", message: "Start the backend (mvn spring-boot:run) and hard refresh (Ctrl+Shift+R)." });
        return;
      }

      if (err?.code === "ERR_NETWORK") {
        trackAnalyticsEvent("auth_login_failed", { reason: "network_error" });
        setError("Cannot connect to the server. Check your internet connection and ensure the backend is running.");
        notify?.({ type: "error", title: "Server unreachable", message: "Start backend on port 8080, then try again." });
        return;
      }

      if (status >= 400) {
        const httpError = err?.response?.statusText || `HTTP ${status}`;
        trackAnalyticsEvent("auth_login_failed", { reason: `http_${status}` });
        setError(`Server error (${httpError}). Please try again.`);
        notify?.({ type: "error", title: "Request failed", message: `Backend returned ${status}. Check the server logs.` });
        return;
      }

      trackAnalyticsEvent("auth_login_failed", { reason: "unknown_error" });
      setError("Authentication failed. Verify credentials and try again.");
      notify?.({ type: "error", title: "Could not authenticate", message: "Please verify email/password and try again." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="admin-login-page">
      <div className="admin-login-shell">
        <UICard
          className="admin-login-card"
          as="section"
          aria-labelledby={titleId}
        >
          <UIBadge className="admin-login-badge" tone="accent">
            <span className="material-symbols-outlined" aria-hidden="true">
              admin_panel_settings
            </span>
            SkillSwap Admin
          </UIBadge>
          <h2 id={titleId} className="admin-login-title">
            Admin Portal
          </h2>
          <p className="admin-login-subtitle">
            Restricted access — administrators only. Sign in to manage users,
            sessions, payments, and platform settings.
          </p>

          <form onSubmit={onSubmit} className="admin-login-form">
            <UIField
              label="Email"
              htmlFor="admin-login-email"
              className="admin-login-field-group"
            >
              <input
                id="admin-login-email"
                name="email"
                type="email"
                autoComplete="email"
                ref={emailInputRef}
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
                required
              />
            </UIField>

            <UIField
              label="Password"
              htmlFor="admin-login-password"
              className="admin-login-field-group"
            >
              <input
                id="admin-login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
                required
              />
            </UIField>

            {error && (
              <UIAlert
                tone="error"
                title="Action required"
                message={error}
                className="admin-login-error"
              />
            )}

            <UIButton
              type="submit"
              className="admin-login-submit"
              disabled={submitting}
            >
              {submitting ? "Signing in..." : "Sign in to Admin"}
            </UIButton>
          </form>

          <div className="admin-login-back">
            <Link to="/login" className="admin-login-back-link">
              ← Back to main login
            </Link>
          </div>
        </UICard>
      </div>
    </div>
  );
}
