import { useEffect, useRef, useState } from "react";

import client, {
  API_BASE_URL,
  clearAuthSessionState,
  resolveAuthResponsePayload,
} from "../api/client";
import { t } from "../utils/i18n";
import { trackAnalyticsEvent } from "../utils/analyticsEvents";
import { getApiErrorMessage } from "../utils/apiErrors";
import { UIAlert, UIBadge, UIButton, UICard, UIField } from "./ui/Primitives";

export default function AuthModal({
  mode,
  onClose,
  onLoggedIn,
  language,
  initialError,
  notify,
}) {
  const [form, setForm] = useState({
    // Login credential — either an email address or a username.
    emailOrUsername: "",
    // Signup-only fields.
    email: "",
    password: "",
    fullName: "",
    username: "",
    role: "LEARNER",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Shown when the user was bounced here from a protected page (e.g. a mentor
  // profile) so they understand why they need to sign in.
  const [showRedirectNotice, setShowRedirectNotice] = useState(
    () =>
      mode === "login" &&
      Boolean(localStorage.getItem("auth_post_redirect")),
  );
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [usernameCheck, setUsernameCheck] = useState({ checking: false, available: null, suggestion: null });
  const usernameDebounceRef = useRef(null);
  // Monotonic sequence guard: a slow availability response must never
  // overwrite the result of a newer check for a different username
  // (out-of-order responses). Each keystroke bumps the counter, so a stale
  // in-flight response is dropped when its sequence no longer matches.
  const usernameCheckSeqRef = useRef(0);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const titleId = "auth-modal-title";

  // Client-side signup guard: never submit a username that is being checked,
  // is already taken, or is too short. The backend remains the source of
  // truth (it re-validates and returns 409 on race conditions), but blocking
  // the submit here prevents a wasted round-trip and a jarring error flash.
  const usernameInvalidLength =
    form.username.length > 0 && form.username.length < 4;
  const signupSubmitBlocked =
    usernameCheck.checking ||
    usernameCheck.available === false ||
    usernameInvalidLength;
  const emailInputRef = useRef(null);
  const loginIdInputRef = useRef(null);
  const formRef = useRef(form);

  useEffect(() => {
    formRef.current = form;
  }, [form]);

  useEffect(() => {
    setError(initialError || "");
  }, [initialError]);

  useEffect(() => {
    if (mode === "login") {
      loginIdInputRef.current?.focus();
    } else {
      emailInputRef.current?.focus();
    }
  }, [mode]);

  useEffect(() => {
    const onEscape = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [onClose]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const endpoint =
        mode === "login" ? "/api/v1/auth/login" : "/api/v1/auth/signup";
      const currentForm = formRef.current;
      const payload =
        mode === "login"
          ? {
              emailOrUsername: currentForm.emailOrUsername.trim(),
              password: currentForm.password,
            }
          : {
              ...currentForm,
            };

      // Clear any stale auth state (Authorization header, localStorage tokens,
      // cookies) before making the login/signup request. This prevents old
      // tokens/cookies from interfering with the new authentication, which
      // could otherwise cause syncCurrentUser to fetch the wrong user profile
      // after login.
      clearAuthSessionState();

      const response = await client.post(endpoint, payload);
      const authResponse = resolveAuthResponsePayload(response.data);
      trackAnalyticsEvent(
        mode === "login" ? "auth_login_success" : "auth_signup_success",
        {
          role: mode === "signup" ? currentForm.role : undefined,
          hasSocialProvider: false,
        },
      );
      onLoggedIn(mode, authResponse);
    } catch (err) {
      const status = Number(err?.response?.status || 0);
      const responseData = err?.response?.data?.data;
      const backendError = responseData?.error;
      const validationErrors = responseData?.errors;
      const hasStructuredError =
        Boolean(backendError) ||
        (validationErrors && typeof validationErrors === "object"
          && Object.keys(validationErrors).length > 0);

      // 1) Backend returned a structured JSON error (either a single `error`
      //    message or field-level `errors` from validation) → show the real
      //    reason instead of a cryptic "Backend returned 400"
      if (hasStructuredError) {
        const reason = getApiErrorMessage(err);
        trackAnalyticsEvent(
          mode === "login" ? "auth_login_failed" : "auth_signup_failed",
          { reason: backendError ? "backend_error" : "validation_error" },
        );
        setError(reason);
        notify?.({ type: "error", title: "Authentication failed", message: reason });
        return;
      }

      // 2) Proxy error (502/503) — backend is unreachable through the Vite proxy
      if (status === 502 || status === 503) {
        trackAnalyticsEvent(
          mode === "login" ? "auth_login_failed" : "auth_signup_failed",
          { reason: "proxy_error" },
        );
        setError("Backend server is not responding. Make sure the backend is running on port 8080 and refresh.");
        notify?.({ type: "error", title: "Backend unreachable", message: "Start the backend (mvn spring-boot:run) and hard refresh (Ctrl+Shift+R)." });
        return;
      }

      // 3) Frontend cannot reach the server at all
      if (err?.code === "ERR_NETWORK") {
        trackAnalyticsEvent(
          mode === "login" ? "auth_login_failed" : "auth_signup_failed",
          { reason: "network_error" },
        );
        setError("Cannot connect to the server. Check your internet connection and ensure the backend is running.");
        notify?.({ type: "error", title: "Server unreachable", message: "Start backend on port 8080, then try again." });
        return;
      }

      // 4) Backend rejected the request but error format is unrecognised
      if (status >= 400) {
        const httpError = err?.response?.statusText || `HTTP ${status}`;
        trackAnalyticsEvent(
          mode === "login" ? "auth_login_failed" : "auth_signup_failed",
          { reason: `http_${status}` },
        );
        setError(`Server error (${httpError}). Please try again.`);
        notify?.({ type: "error", title: "Request failed", message: `Backend returned ${status}. Check the server logs.` });
        return;
      }

      // 5) Catch-all for unexpected errors
      trackAnalyticsEvent(
        mode === "login" ? "auth_login_failed" : "auth_signup_failed",
        { reason: "unknown_error" },
      );
      setError("Authentication failed. Verify credentials and try again.");
      notify?.({ type: "error", title: "Could not authenticate", message: "Please verify email/password and try again." });
    } finally {
      setSubmitting(false);
    }
  };

  const onSocialAuth = (provider) => {
    trackAnalyticsEvent("auth_social_clicked", { provider, mode });
    window.location.href = `${API_BASE_URL}/oauth2/authorization/${provider}`;
  };

  return (
    <div className="auth-modal-overlay" onClick={onClose} role="presentation">
      <UICard
        className="auth-card auth-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <UIButton
          className="close-btn"
          onClick={onClose}
          aria-label="Close modal"
          variant="ghost"
        >
          ×
        </UIButton>
        <UIBadge className="auth-modal-badge" tone="accent">
          Mentorly
        </UIBadge>
        <h2 id={titleId} className="auth-modal-title">
          {mode === "login" ? "Welcome back" : "Create your account"}
        </h2>
        <p className="muted auth-modal-subtitle">
          {mode === "login"
            ? "Sign in to continue your learning journey, manage sessions, and chat with mentors."
            : "Join the community and start teaching, learning, and growing with professionals."}
        </p>

        {mode === "login" && showRedirectNotice && (
          <div className="auth-redirect-notice" role="status">
            <span
              className="material-symbols-outlined"
              aria-hidden="true"
            >
              info
            </span>
            <p>Please sign in to view mentor profiles and book sessions.</p>
            <button
              type="button"
              className="auth-redirect-notice__dismiss"
              onClick={() => setShowRedirectNotice(false)}
              aria-label="Dismiss notice"
            >
              ×
            </button>
          </div>
        )}

        {mode === "signup" && (
          <div className="auth-onboarding">
            <div className="auth-onboarding-header">
              <span className="auth-onboarding-pill">Step 1 of 3</span>
              <span className="auth-onboarding-title">
                Set up your Mentorly journey
              </span>
            </div>
            <div className="auth-onboarding-steps">
              <div className="auth-onboarding-step is-active">
                <span className="material-symbols-outlined">person_add</span>
                <div>
                  <p>Create your account</p>
                  <span>You are here</span>
                </div>
              </div>
              <div className="auth-onboarding-step">
                <span className="material-symbols-outlined">badge</span>
                <div>
                  <p>Complete your profile</p>
                  <span>Add skills and links</span>
                </div>
              </div>
              <div className="auth-onboarding-step">
                <span className="material-symbols-outlined">explore</span>
                <div>
                  <p>Start matching</p>
                  <span>Browse mentors or sessions</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={onSubmit} className="auth-modal-form">
          {mode === "signup" && (
            <>
              <UIField
                label="Full name"
                htmlFor="signup-full-name"
                className="auth-modal-field-group"
              >
                <input
                  id="signup-full-name"
                  name="fullName"
                  autoComplete="name"
                  placeholder="Full name"
                  value={form.fullName}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, fullName: e.target.value }))
                  }
                  disabled={submitting}
                  required
                />
              </UIField>

              <UIField
                label="Username"
                htmlFor="signup-username"
                className="auth-modal-field-group"
              >
                <div style={{ position: "relative" }}>
                  <input
                    id="signup-username"
                    name="username"
                    autoComplete="username"
                    placeholder="Choose a unique username"
                    value={form.username}
                    maxLength={30}
                    onChange={(e) => {
                      // Allow A-Z a-z 0-9 _ . - only (display case is preserved).
                      const val = e.target.value.replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 30);
                      setForm((s) => ({ ...s, username: val }));
                      // Invalidate any in-flight check for a previous value.
                      usernameCheckSeqRef.current += 1;
                      setUsernameCheck((prev) => ({ ...prev, checking: true, available: null }));
                      if (usernameDebounceRef.current) clearTimeout(usernameDebounceRef.current);
                      if (val.length >= 4) {
                        // Debounced (500ms) real-time availability check — never spam the server.
                        usernameDebounceRef.current = setTimeout(async () => {
                          const seq = usernameCheckSeqRef.current + 1;
                          usernameCheckSeqRef.current = seq;
                          try {
                            const res = await client.get("/api/v1/users/check-username", {
                              params: { username: val },
                            });
                            const data = res?.data?.data;
                            // Drop stale responses (the field changed while
                            // this request was in flight).
                            if (seq !== usernameCheckSeqRef.current) return;
                            setUsernameCheck({
                              checking: false,
                              available: data?.available ?? false,
                              suggestion: data?.suggestion || null,
                            });
                          } catch {
                            if (seq !== usernameCheckSeqRef.current) return;
                            setUsernameCheck({ checking: false, available: null, suggestion: null });
                          }
                        }, 500);
                      } else {
                        setUsernameCheck({ checking: false, available: null, suggestion: null });
                      }
                    }}
                    disabled={submitting}
                    required
                    style={{
                      paddingRight: 40,
                      borderColor: usernameCheck.available === false ? "#dc2626" :
                                    usernameCheck.available === true ? "#16a34a" : undefined,
                    }}
                  />
                  {usernameCheck.checking && (
                    <span style={{
                      position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                      color: "var(--muted)", fontSize: "0.75rem",
                    }}>
                      Checking...
                    </span>
                  )}
                  {!usernameCheck.checking && usernameCheck.available === true && (
                    <span style={{
                      position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                      color: "#16a34a", fontSize: "1rem", fontWeight: 700,
                    }} aria-hidden="true">
                      ✅
                    </span>
                  )}
                  {!usernameCheck.checking && usernameCheck.available === false && (
                    <span style={{
                      position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                      color: "#dc2626", fontSize: "1rem", fontWeight: 700,
                    }} aria-hidden="true">
                      ❌
                    </span>
                  )}
                </div>
                {!usernameCheck.checking && usernameCheck.available === true && (
                  <span role="status" style={{ color: "#16a34a", fontSize: "0.78rem", marginTop: 4, display: "block" }}>
                    ✅ Username available
                  </span>
                )}
                {!usernameCheck.checking && usernameCheck.available === false && (
                  <span role="status" style={{ color: "#dc2626", fontSize: "0.78rem", marginTop: 4, display: "block" }}>
                    ❌ Username already taken
                    {usernameCheck.suggestion && (
                      <>
                        {" "}Try:{" "}
                        <button
                          type="button"
                          style={{
                            background: "none", border: "none", color: "var(--brand)",
                            cursor: "pointer", fontWeight: 600, fontSize: "0.78rem",
                            padding: 0, textDecoration: "underline",
                          }}
                          onClick={() => {
                            setForm((s) => ({ ...s, username: usernameCheck.suggestion }));
                            setUsernameCheck((prev) => ({ ...prev, available: true, suggestion: null }));
                          }}
                        >
                          {usernameCheck.suggestion}
                        </button>
                      </>
                    )}
                  </span>
                )}
                {usernameInvalidLength && (
                  <span style={{ color: "var(--muted)", fontSize: "0.78rem", marginTop: 4, display: "block" }}>
                    Username must be at least 4 characters. Letters, numbers, and . _ - only.
                  </span>
                )}
              </UIField>
            </>
          )}

          {mode === "login" ? (
            <UIField
              label="Email or Username"
              htmlFor="auth-login-id"
              className="auth-modal-field-group"
            >
              <input
                id="auth-login-id"
                name="emailOrUsername"
                autoComplete="username"
                ref={loginIdInputRef}
                type="text"
                placeholder="Email or username"
                value={form.emailOrUsername}
                onChange={(e) =>
                  setForm((s) => ({ ...s, emailOrUsername: e.target.value }))
                }
                disabled={submitting}
                required
              />
            </UIField>
          ) : (
            <UIField
              label="Email"
              htmlFor="auth-email"
              className="auth-modal-field-group"
            >
              <input
                id="auth-email"
                name="email"
                autoComplete="email"
                ref={emailInputRef}
                type="email"
                placeholder="Email"
                value={form.email}
                onChange={(e) =>
                  setForm((s) => ({ ...s, email: e.target.value }))
                }
                disabled={submitting}
                required
              />
            </UIField>
          )}

          <UIField
            label="Password"
            htmlFor="auth-password"
            className="auth-modal-field-group"
          >
            <input
              id="auth-password"
              name="password"
              autoComplete="current-password"
              type="password"
              aria-describedby={mode === "signup" ? "signup-password-hint" : undefined}
              placeholder="Password"
              value={form.password}
              onChange={(e) =>
                setForm((s) => ({ ...s, password: e.target.value }))
              }
              disabled={submitting}
              required
            />
            {mode === "signup" && (
              <span
                id="signup-password-hint"
                style={{
                  display: "block",
                  fontSize: "0.75rem",
                  color: "var(--muted)",
                  marginTop: 4,
                  lineHeight: 1.4,
                }}
              >
                Use 8–64 characters with at least one uppercase letter, one
                lowercase letter, and one digit.
              </span>
            )}
          </UIField>

          {mode === "signup" && (
            <UIField
              label="Role"
              htmlFor="signup-role"
              className="auth-modal-field-group"
            >
              <select
                id="signup-role"
                name="role"
                value={form.role}
                onChange={(e) =>
                  setForm((s) => ({ ...s, role: e.target.value }))
                }
                disabled={submitting}
              >
                <option value="LEARNER">Learner</option>
                <option value="MENTOR">Mentor</option>
              </select>
            </UIField>
          )}

          {error && (
            <UIAlert
              tone="error"
              title="Action required"
              message={error}
              className="auth-inline-error"
            />
          )}
          {mode === "login" && (
            <div className="auth-forgot-row">
              <button
                type="button"
                className="auth-forgot-link"
                onClick={(e) => {
                  e.preventDefault();
                  // Prefill the reset form with whatever was typed — an email
                  // address, or the username (which the user will need to
                  // replace with their email to receive the reset link).
                  const typed = form.emailOrUsername.trim() || form.email.trim();
                  setForgotEmail(typed.includes("@") ? typed : "");
                  setShowForgotPassword(true);
                  setForgotSent(false);
                  setError("");
                }}
              >
                Forgot password?
              </button>
            </div>
          )}
          <UIButton
            type="submit"
            className="submit-btn auth-modal-submit-btn"
            disabled={submitting || (mode === "signup" && signupSubmitBlocked)}
          >
            {submitting
              ? "Please wait..."
              : mode === "login"
                ? t(language, "login")
                : t(language, "createAccount")}
          </UIButton>
        </form>

        {showForgotPassword && (
          <div className="auth-forgot-section">
            <div className="auth-forgot-header">
              <h3>Reset Password</h3>
              <p>Enter your email to receive a password reset link.</p>
            </div>
            {forgotSent ? (
              <div className="auth-forgot-success">
                <span className="material-symbols-outlined">check_circle</span>
                <p>If this email is registered, a reset link has been sent. Check your inbox.</p>
                <button
                  type="button"
                  className="auth-forgot-back-btn"
                  onClick={() => setShowForgotPassword(false)}
                >
                  Back to login
                </button>
              </div>
            ) : (
              <>
                <div className="auth-forgot-input-row">
                  <label htmlFor="forgot-email-input" className="sr-only">Email for password reset</label>
                  <input
                    id="forgot-email-input"
                    type="email"
                    placeholder="Your email address"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    disabled={forgotSubmitting}
                    className="auth-forgot-input"
                  />
                </div>
                <div className="auth-forgot-actions">
                  <button
                    type="button"
                    className="auth-forgot-cancel-btn"
                    onClick={() => setShowForgotPassword(false)}
                    disabled={forgotSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="auth-forgot-submit-btn"
                    disabled={!forgotEmail.trim() || forgotSubmitting}
                    onClick={async () => {
                      setForgotSubmitting(true);
                      setError("");
                      try {
                        await client.post("/api/v1/auth/forgot-password", { email: forgotEmail.trim() });
                        setForgotSent(true);
                      } catch (err) {
                        setError(err?.response?.data?.message || "Failed to send reset email. Try again.");
                      } finally {
                        setForgotSubmitting(false);
                      }
                    }}
                  >
                    {forgotSubmitting ? "Sending..." : "Send Reset Link"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        <div className="auth-divider">
          <span>or continue with</span>
        </div>
        <div className="social-auth">
          <UIButton
            type="button"
            className="social-btn auth-social-btn"
            onClick={() => onSocialAuth("google")}
            variant="secondary"
            aria-label="Continue with Google account"
          >
            Continue with Google
          </UIButton>
          <UIButton
            type="button"
            className="social-btn auth-social-btn"
            onClick={() => onSocialAuth("github")}
            variant="secondary"
            aria-label="Continue with GitHub account"
          >
            Continue with GitHub
          </UIButton>
        </div>
      </UICard>
    </div>
  );
}
