import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import client, {
  API_BASE_URL,
  clearAuthSessionState,
  resolveAuthResponsePayload,
} from "../api/client";
import { t } from "../utils/i18n";
import { trackAnalyticsEvent } from "../utils/analyticsEvents";
import { UIAlert, UIBadge, UIButton, UICard, UIField } from "./ui/Primitives";

export default function AuthModal({
  mode,
  onClose,
  onLoggedIn,
  language,
  initialError,
  notify,
}) {
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({
    email: "",
    password: "",
    fullName: "",
    username: "",
    role: "LEARNER",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [usernameCheck, setUsernameCheck] = useState({ checking: false, available: null, suggestion: null });
  const usernameDebounceRef = useRef(null);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const titleId = "auth-modal-title";
  const emailInputRef = useRef(null);
  const formRef = useRef(form);

  useEffect(() => {
    formRef.current = form;
  }, [form]);

  useEffect(() => {
    setError(initialError || "");
  }, [initialError]);

  useEffect(() => {
    emailInputRef.current?.focus();
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
          ? { email: currentForm.email, password: currentForm.password }
          : {
              ...currentForm,
              referralCode: searchParams.get("ref")?.trim() || undefined,
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
      const backendError = err?.response?.data?.data?.error;

      // 1) Backend returned a structured JSON error → show the real reason
      if (backendError) {
        trackAnalyticsEvent(
          mode === "login" ? "auth_login_failed" : "auth_signup_failed",
          { reason: "backend_error" },
        );
        setError(backendError);
        notify?.({ type: "error", title: "Authentication failed", message: backendError });
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
          Skill Swapper
        </UIBadge>
        <h2 id={titleId} className="auth-modal-title">
          {mode === "login" ? "Welcome back" : "Create your account"}
        </h2>
        <p className="muted auth-modal-subtitle">
          {mode === "login"
            ? "Sign in to continue your learning journey, manage sessions, and chat with mentors."
            : "Join the community and start teaching, learning, and growing with professionals."}
        </p>

        {mode === "signup" && (
          <div className="auth-onboarding">
            <div className="auth-onboarding-header">
              <span className="auth-onboarding-pill">Step 1 of 3</span>
              <span className="auth-onboarding-title">
                Set up your SkillSwap journey
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
                    onChange={(e) => {
                      const val = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "");
                      setForm((s) => ({ ...s, username: val }));
                      setUsernameCheck((prev) => ({ ...prev, checking: true, available: null }));
                      if (usernameDebounceRef.current) clearTimeout(usernameDebounceRef.current);
                      if (val.length >= 3) {
                        usernameDebounceRef.current = setTimeout(async () => {
                          try {
                            const res = await client.get("/api/v1/users/me/check-username", {
                              params: { username: val },
                            });
                            const data = res?.data?.data;
                            setUsernameCheck({
                              checking: false,
                              available: data?.available ?? false,
                              suggestion: data?.suggestion || null,
                            });
                          } catch {
                            setUsernameCheck({ checking: false, available: null, suggestion: null });
                          }
                        }, 400);
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
                    }}>
                      ✓
                    </span>
                  )}
                  {!usernameCheck.checking && usernameCheck.available === false && (
                    <span style={{
                      position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                      color: "#dc2626", fontSize: "1rem", fontWeight: 700,
                    }}>
                      ✕
                    </span>
                  )}
                </div>
                {!usernameCheck.checking && usernameCheck.available === false && (
                  <span style={{ color: "#dc2626", fontSize: "0.78rem", marginTop: 4, display: "block" }}>
                    Username already exists. Please choose another one.
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
                {form.username.length > 0 && form.username.length < 3 && (
                  <span style={{ color: "var(--muted)", fontSize: "0.78rem", marginTop: 4, display: "block" }}>
                    Username must be at least 3 characters
                  </span>
                )}
              </UIField>
            </>
          )}

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
              placeholder="Password"
              value={form.password}
              onChange={(e) =>
                setForm((s) => ({ ...s, password: e.target.value }))
              }
              disabled={submitting}
              required
            />
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
                  setForgotEmail(form.email);
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
            disabled={submitting}
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
