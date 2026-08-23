import { useEffect, useRef, useState, useCallback } from "react";

import client, {
  API_BASE_URL,
  clearAuthSessionState,
  resolveAuthResponsePayload,
  sendVerificationOtp,
  verifyEmailAndSignup,
  resendVerificationOtp,
} from "../api/client";
import { trackAnalyticsEvent } from "../utils/analyticsEvents";
import { getApiErrorMessage } from "../utils/apiErrors";
import { UIAlert, UIBadge, UIButton, UICard, UIField } from "./ui/Primitives";
import OtpVerification from "./OtpVerification";

/**
 * Password visibility toggle button component.
 */
function PasswordToggle({ visible, onClick, disabled }) {
  return (
    <button
      type="button"
      className="password-toggle-btn"
      onClick={onClick}
      disabled={disabled}
      aria-label={visible ? "Hide password" : "Show password"}
      tabIndex={-1}
    >
      <span className="material-symbols-outlined">
        {visible ? "visibility_off" : "visibility"}
      </span>
    </button>
  );
}

/**
 * Forgot Password Modal component.
 */
function ForgotPasswordModal({ onClose, notify }) {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = async () => {
    if (!email.trim()) return;
    setSending(true);
    setError("");
    try {
      await client.post("/api/v1/auth/forgot-password", { email: email.trim() });
      setSent(true);
      notify?.({ type: "success", title: "Reset link sent", message: "Check your email for the password reset link." });
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to send reset email. Try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="auth-modal-overlay" onClick={onClose} role="presentation">
      <UICard
        className="auth-card auth-modal-card auth-forgot-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="forgot-title"
        onClick={(e) => e.stopPropagation()}
      >
        <UIButton className="close-btn" onClick={onClose} aria-label="Close" variant="ghost">
          ×
        </UIButton>
        <UIBadge className="auth-modal-badge" tone="accent">Mentorly</UIBadge>
        <h2 id="forgot-title" className="auth-modal-title">Reset Password</h2>
        <p className="muted auth-modal-subtitle">
          Enter your email and we'll send you a password reset link.
        </p>

        {sent ? (
          <div className="auth-forgot-success-state">
            <span className="material-symbols-outlined success-icon">check_circle</span>
            <p>Password reset link sent. Check your email.</p>
            <UIButton className="submit-btn auth-modal-submit-btn" onClick={onClose}>
              Back to Login
            </UIButton>
          </div>
        ) : (
          <>
            {error && <UIAlert tone="error" message={error} className="auth-inline-error" />}
            <UIField label="Email" htmlFor="forgot-email-modal" className="auth-modal-field-group">
              <input
                id="forgot-email-modal"
                ref={inputRef}
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={sending}
                required
              />
            </UIField>
            <div className="auth-forgot-modal-actions">
              <UIButton type="button" className="auth-forgot-cancel-btn" onClick={onClose} disabled={sending} variant="ghost">
                Cancel
              </UIButton>
              <UIButton
                type="button"
                className="submit-btn auth-modal-submit-btn"
                onClick={handleSend}
                disabled={!email.trim() || sending}
              >
                {sending ? "Sending..." : "Send Reset Link"}
              </UIButton>
            </div>
          </>
        )}
      </UICard>
    </div>
  );
}

export default function AuthModal({
  mode: initialMode,
  onClose,
  onLoggedIn,
  initialError,
  notify,
}) {
  // ── State ──
  const [mode, setMode] = useState(initialMode);
  const [form, setForm] = useState({
    emailOrUsername: "",
    email: "",
    password: "",
    confirmPassword: "",
    fullName: "",
    username: "",
    role: "LEARNER",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // OTP verification state
  const [otpStep, setOtpStep] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [otpEmail, setOtpEmail] = useState("");

  // Forgot password modal
  const [showForgotModal, setShowForgotModal] = useState(false);

  // Redirect notice
  const [showRedirectNotice, setShowRedirectNotice] = useState(
    () => initialMode === "login" && Boolean(localStorage.getItem("auth_post_redirect"))
  );

  // Username check
  const [usernameCheck, setUsernameCheck] = useState({ checking: false, available: null, suggestion: null });
  const usernameDebounceRef = useRef(null);
  const usernameCheckSeqRef = useRef(0);

  const titleId = "auth-modal-title";
  const emailInputRef = useRef(null);
  const loginIdInputRef = useRef(null);
  const formRef = useRef(form);

  useEffect(() => { formRef.current = form; }, [form]);
  useEffect(() => { setError(initialError || ""); }, [initialMode, initialError]);

  useEffect(() => {
    if (mode === "login") loginIdInputRef.current?.focus();
    else emailInputRef.current?.focus();
  }, [mode, otpStep]);

  useEffect(() => {
    const onEscape = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [onClose]);

  // ── Validation helpers ──
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);
  const passwordValid = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,64}$/.test(form.password);
  const passwordsMatch = form.password === form.confirmPassword;
  const usernameInvalidLength = form.username.length > 0 && form.username.length < 4;
  const signupSubmitBlocked = usernameCheck.checking || usernameCheck.available === false || usernameInvalidLength;

  // ── Signup: Step 1 → Send OTP ──
  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      // Client-side validation
      if (!emailValid) {
        setError("Please enter a valid email address.");
        return;
      }
      if (!passwordValid) {
        setError("Password must be 8–64 characters with at least one uppercase letter, one lowercase letter, and one digit.");
        return;
      }
      if (form.password !== form.confirmPassword) {
        setError("Passwords do not match.");
        return;
      }

      clearAuthSessionState();

      // Send OTP (does not create account yet)
      await sendVerificationOtp({
        email: form.email,
        fullName: form.fullName,
        username: form.username,
        password: form.password,
        role: form.role,
      });

      // Move to OTP verification step
      setOtpEmail(form.email);
      setOtpStep(true);
      trackAnalyticsEvent("auth_signup_otp_sent", { role: form.role });
    } catch (err) {
      const status = Number(err?.response?.status || 0);
      const backendError = err?.response?.data?.data?.error;
      const message = err?.response?.data?.message;

      if (status === 409) {
        setError(message || "An account with this email already exists.");
      } else if (backendError) {
        setError(getApiErrorMessage(err));
      } else if (message) {
        setError(message);
      } else if (err?.code === "ERR_NETWORK") {
        setError("Cannot connect to the server. Check your internet connection.");
      } else {
        setError("Unable to send verification email. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── OTP: Step 2 → Verify and create account ──
  const handleOtpVerify = useCallback(async (otp) => {
    setOtpLoading(true);
    setOtpError("");

    try {
      clearAuthSessionState();

      const response = await verifyEmailAndSignup({
        email: form.email,
        otp,
        fullName: form.fullName,
        username: form.username,
        password: form.password,
        role: form.role,
      });

      const authResponse = resolveAuthResponsePayload(response);
      trackAnalyticsEvent("auth_signup_success", { role: form.role });
      onLoggedIn("signup", authResponse);
    } catch (err) {
      const message = err?.response?.data?.message || "Verification failed. Please try again.";
      setOtpError(message);
      trackAnalyticsEvent("auth_signup_otp_failed", { reason: message });
    } finally {
      setOtpLoading(false);
    }
  }, [form, onLoggedIn]);

  // ── OTP: Resend ──
  const handleOtpResend = useCallback(async () => {
    try {
      await resendVerificationOtp(form.email);
      notify?.({ type: "success", title: "Code resent", message: "A new verification code has been sent." });
    } catch (err) {
      setOtpError(err?.response?.data?.message || "Failed to resend code. Please try again.");
    }
  }, [form.email, notify]);

  // ── OTP: Change email ──
  const handleOtpChangeEmail = useCallback(() => {
    setOtpStep(false);
    setOtpError("");
    setOtpEmail("");
  }, []);

  // ── Login ──
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      clearAuthSessionState();
      const response = await client.post("/api/v1/auth/login", {
        emailOrUsername: form.emailOrUsername.trim(),
        password: form.password,
      });
      const authResponse = resolveAuthResponsePayload(response.data);
      trackAnalyticsEvent("auth_login_success", { hasSocialProvider: false });
      onLoggedIn("login", authResponse);
    } catch (err) {
      const status = Number(err?.response?.status || 0);
      const message = err?.response?.data?.message;
      const backendError = err?.response?.data?.data?.error;

      if (status === 502 || status === 503) {
        setError("Backend server is not responding. Make sure the backend is running.");
      } else if (err?.code === "ERR_NETWORK") {
        setError("Cannot connect to the server. Check your internet connection.");
      } else if (backendError) {
        setError(getApiErrorMessage(err));
      } else if (message) {
        setError(message);
      } else {
        setError("Authentication failed. Verify credentials and try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── Social auth ──
  const onSocialAuth = (provider) => {
    trackAnalyticsEvent("auth_social_clicked", { provider, mode });
    window.location.href = `${API_BASE_URL}/oauth2/authorization/${provider}`;
  };

  // ── Switch mode ──
  const switchMode = () => {
    setMode(mode === "login" ? "signup" : "login");
    setError("");
    setOtpStep(false);
    setForm({
      emailOrUsername: "",
      email: "",
      password: "",
      confirmPassword: "",
      fullName: "",
      username: "",
      role: "LEARNER",
    });
  };

  // ── OTP Step ──
  if (otpStep) {
    return (
      <div className="auth-modal-overlay" onClick={onClose} role="presentation">
        <UICard
          className="auth-card auth-modal-card"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onClick={(e) => e.stopPropagation()}
        >
          <UIButton className="close-btn" onClick={onClose} aria-label="Close modal" variant="ghost">×</UIButton>
          <OtpVerification
            email={otpEmail}
            onVerify={handleOtpVerify}
            onResend={handleOtpResend}
            onChangeEmail={handleOtpChangeEmail}
            loading={otpLoading}
            error={otpError}
          />
        </UICard>
      </div>
    );
  }

  // ── Main Auth Form ──
  return (
    <div className="auth-modal-overlay" onClick={onClose} role="presentation">
      <UICard
        className="auth-card auth-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <UIButton className="close-btn" onClick={onClose} aria-label="Close modal" variant="ghost">×</UIButton>
        <UIBadge className="auth-modal-badge" tone="accent">Mentorly</UIBadge>
        <h2 id={titleId} className="auth-modal-title">
          {mode === "login" ? "Welcome back" : "Create your account"}
        </h2>
        <p className="muted auth-modal-subtitle">
          {mode === "login"
            ? "Sign in to continue your learning journey."
            : "Start learning from experienced mentors."}
        </p>

        {mode === "login" && showRedirectNotice && (
          <div className="auth-redirect-notice" role="status">
            <span className="material-symbols-outlined" aria-hidden="true">info</span>
            <p>Please sign in to view mentor profiles and book sessions.</p>
            <button type="button" className="auth-redirect-notice__dismiss" onClick={() => setShowRedirectNotice(false)} aria-label="Dismiss">×</button>
          </div>
        )}

        {mode === "signup" && (
          <div className="auth-onboarding">
            <div className="auth-onboarding-header">
              <span className="auth-onboarding-pill">Step 1 of 3</span>
              <span className="auth-onboarding-title">Set up your Mentorly journey</span>
            </div>
            <div className="auth-onboarding-steps">
              <div className="auth-onboarding-step is-active">
                <span className="material-symbols-outlined">person_add</span>
                <div><p>Create your account</p><span>You are here</span></div>
              </div>
              <div className="auth-onboarding-step">
                <span className="material-symbols-outlined">badge</span>
                <div><p>Complete your profile</p><span>Add skills and links</span></div>
              </div>
              <div className="auth-onboarding-step">
                <span className="material-symbols-outlined">explore</span>
                <div><p>Start matching</p><span>Browse mentors or sessions</span></div>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={mode === "login" ? handleLoginSubmit : handleSignupSubmit} className="auth-modal-form">
          {/* ── Signup-only fields ── */}
          {mode === "signup" && (
            <>
              <UIField label="Full name" htmlFor="signup-full-name" className="auth-modal-field-group">
                <input
                  id="signup-full-name"
                  name="fullName"
                  autoComplete="name"
                  placeholder="Full name"
                  value={form.fullName}
                  onChange={(e) => setForm((s) => ({ ...s, fullName: e.target.value }))}
                  disabled={submitting}
                  required
                />
              </UIField>

              <UIField label="Username" htmlFor="signup-username" className="auth-modal-field-group">
                <div style={{ position: "relative" }}>
                  <input
                    id="signup-username"
                    name="username"
                    autoComplete="username"
                    placeholder="Choose a unique username"
                    value={form.username}
                    maxLength={30}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 30);
                      setForm((s) => ({ ...s, username: val }));
                      usernameCheckSeqRef.current += 1;
                      setUsernameCheck((prev) => ({ ...prev, checking: true, available: null }));
                      if (usernameDebounceRef.current) clearTimeout(usernameDebounceRef.current);
                      if (val.length >= 4) {
                        usernameDebounceRef.current = setTimeout(async () => {
                          const seq = usernameCheckSeqRef.current + 1;
                          usernameCheckSeqRef.current = seq;
                          try {
                            const res = await client.get("/api/v1/users/check-username", { params: { username: val } });
                            const data = res?.data?.data;
                            if (seq !== usernameCheckSeqRef.current) return;
                            setUsernameCheck({ checking: false, available: data?.available ?? false, suggestion: data?.suggestion || null });
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
                      borderColor: usernameCheck.available === false ? "#dc2626" : usernameCheck.available === true ? "#16a34a" : undefined,
                    }}
                  />
                  {usernameCheck.checking && (
                    <span className="username-status-icon checking">Checking...</span>
                  )}
                  {!usernameCheck.checking && usernameCheck.available === true && (
                    <span className="username-status-icon available" aria-hidden="true">✅</span>
                  )}
                  {!usernameCheck.checking && usernameCheck.available === false && (
                    <span className="username-status-icon unavailable" aria-hidden="true">❌</span>
                  )}
                </div>
                {!usernameCheck.checking && usernameCheck.available === true && (
                  <span role="status" className="username-status-msg available">✅ Username available</span>
                )}
                {!usernameCheck.checking && usernameCheck.available === false && (
                  <span role="status" className="username-status-msg unavailable">
                    ❌ Username already taken
                    {usernameCheck.suggestion && (
                      <> Try: <button type="button" className="username-suggestion-btn" onClick={() => {
                        setForm((s) => ({ ...s, username: usernameCheck.suggestion }));
                        setUsernameCheck((prev) => ({ ...prev, available: true, suggestion: null }));
                      }}>{usernameCheck.suggestion}</button></>
                    )}
                  </span>
                )}
                {usernameInvalidLength && (
                  <span className="username-status-msg muted">Username must be at least 4 characters.</span>
                )}
              </UIField>
            </>
          )}

          {/* ── Email / Login ID ── */}
          {mode === "login" ? (
            <UIField label="Email or Username" htmlFor="auth-login-id" className="auth-modal-field-group">
              <input
                id="auth-login-id"
                name="emailOrUsername"
                autoComplete="username"
                ref={loginIdInputRef}
                type="text"
                placeholder="Email or username"
                value={form.emailOrUsername}
                onChange={(e) => setForm((s) => ({ ...s, emailOrUsername: e.target.value }))}
                disabled={submitting}
                required
              />
            </UIField>
          ) : (
            <UIField label="Email" htmlFor="auth-email" className="auth-modal-field-group">
              <input
                id="auth-email"
                name="email"
                autoComplete="email"
                ref={emailInputRef}
                type="email"
                placeholder="your@email.com"
                value={form.email}
                onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
                disabled={submitting}
                required
              />
            </UIField>
          )}

          {/* ── Password with visibility toggle ── */}
          <UIField label="Password" htmlFor="auth-password" className="auth-modal-field-group">
            <div className="password-input-wrapper">
              <input
                id="auth-password"
                name="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                type={showPassword ? "text" : "password"}
                aria-describedby={mode === "signup" ? "signup-password-hint" : undefined}
                placeholder="Password"
                value={form.password}
                onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))}
                disabled={submitting}
                required
              />
              <PasswordToggle visible={showPassword} onClick={() => setShowPassword(!showPassword)} disabled={submitting} />
            </div>
            {mode === "signup" && (
              <span id="signup-password-hint" className="password-hint">
                Use 8–64 characters with at least one uppercase letter, one lowercase letter, and one digit.
              </span>
            )}
          </UIField>

          {/* ── Confirm Password (signup only) ── */}
          {mode === "signup" && (
            <UIField label="Confirm Password" htmlFor="auth-confirm-password" className="auth-modal-field-group">
              <div className="password-input-wrapper">
                <input
                  id="auth-confirm-password"
                  name="confirmPassword"
                  autoComplete="new-password"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm password"
                  value={form.confirmPassword}
                  onChange={(e) => setForm((s) => ({ ...s, confirmPassword: e.target.value }))}
                  disabled={submitting}
                  required
                />
                <PasswordToggle visible={showConfirmPassword} onClick={() => setShowConfirmPassword(!showConfirmPassword)} disabled={submitting} />
              </div>
              {form.confirmPassword && !passwordsMatch && (
                <span className="password-status-msg error">Passwords do not match.</span>
              )}
              {form.confirmPassword && passwordsMatch && (
                <span className="password-status-msg success">Passwords match.</span>
              )}
            </UIField>
          )}

          {/* ── Role (signup only) ── */}
          {mode === "signup" && (
            <UIField label="I want to" htmlFor="signup-role" className="auth-modal-field-group">
              <select
                id="signup-role"
                name="role"
                value={form.role}
                onChange={(e) => setForm((s) => ({ ...s, role: e.target.value }))}
                disabled={submitting}
              >
                <option value="LEARNER">Learn from mentors</option>
                <option value="MENTOR">Teach as a mentor</option>
              </select>
            </UIField>
          )}

          {/* ── Error ── */}
          {error && <UIAlert tone="error" title="Action required" message={error} className="auth-inline-error" />}

          {/* ── Forgot Password + Remember Me ── */}
          {mode === "login" && (
            <div className="auth-forgot-row">
              <label className="remember-me-label">
                <input type="checkbox" className="remember-me-checkbox" />
                <span>Remember me</span>
              </label>
              <button type="button" className="auth-forgot-link" onClick={() => setShowForgotModal(true)}>
                Forgot password?
              </button>
            </div>
          )}

          {/* ── Submit ── */}
          <UIButton
            type="submit"
            className="submit-btn auth-modal-submit-btn"
            disabled={submitting || (mode === "signup" && signupSubmitBlocked)}
          >
            {submitting
              ? "Please wait..."
              : mode === "login"
                ? "Sign In"
                : "Create Account"}
          </UIButton>
        </form>

        {/* ── Divider ── */}
        <div className="auth-divider"><span>or continue with</span></div>

        {/* ── Social auth ── */}
        <div className="social-auth">
          <UIButton type="button" className="social-btn auth-social-btn" onClick={() => onSocialAuth("google")} variant="secondary">
            <svg width="20" height="20" viewBox="0 0 24 24" style={{ marginRight: 8 }}>
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </UIButton>
          <UIButton type="button" className="social-btn auth-social-btn" onClick={() => onSocialAuth("github")} variant="secondary">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: 8 }}>
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
            Continue with GitHub
          </UIButton>
        </div>

        {/* ── Switch mode ── */}
        <div className="auth-switch-mode">
          {mode === "login" ? (
            <p>Don't have an account? <button type="button" onClick={switchMode}>Sign up</button></p>
          ) : (
            <p>Already have an account? <button type="button" onClick={switchMode}>Sign in</button></p>
          )}
        </div>
      </UICard>

      {/* ── Forgot Password Modal ── */}
      {showForgotModal && <ForgotPasswordModal onClose={() => setShowForgotModal(false)} notify={notify} />}
    </div>
  );
}
