import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import client, { API_BASE_URL } from '../api/client';
import { t } from '../utils/i18n';
import { trackAnalyticsEvent } from '../utils/analyticsEvents';
import { UIAlert, UIBadge, UIButton, UICard, UIField } from './ui/Primitives';

export default function AuthModal({ mode, onClose, onLoggedIn, language, initialError, notify }) {
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({
    email: '',
    password: '',
    fullName: '',
    role: 'LEARNER'
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const titleId = 'auth-modal-title';
  const emailInputRef = useRef(null);

  useEffect(() => {
    setError(initialError || '');
  }, [initialError]);

  useEffect(() => {
    emailInputRef.current?.focus();
  }, [mode]);

  useEffect(() => {
    const onEscape = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', onEscape);
    return () => document.removeEventListener('keydown', onEscape);
  }, [onClose]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const endpoint = mode === 'login' ? '/api/v1/auth/login' : '/api/v1/auth/signup';
      const payload = mode === 'login'
        ? { email: form.email, password: form.password }
        : { ...form, referralCode: searchParams.get('ref')?.trim() || undefined };

      await client.post(endpoint, payload);
      trackAnalyticsEvent(mode === 'login' ? 'auth_login_success' : 'auth_signup_success', {
        role: mode === 'signup' ? form.role : undefined,
        hasSocialProvider: false
      });
      onLoggedIn(mode);
    } catch (err) {
      const backendError = err?.response?.data?.data?.error;
      if (backendError) {
        trackAnalyticsEvent(mode === 'login' ? 'auth_login_failed' : 'auth_signup_failed', {
          reason: 'backend_error'
        });
        setError(backendError);
        notify?.({
          type: 'error',
          title: 'Authentication failed',
          message: backendError
        });
        return;
      }
      if (err?.code === 'ERR_NETWORK') {
        trackAnalyticsEvent(mode === 'login' ? 'auth_login_failed' : 'auth_signup_failed', {
          reason: 'network_error'
        });
        setError('Backend is unreachable. Start backend on http://localhost:8080 and retry.');
        notify?.({
          type: 'error',
          title: 'Server unreachable',
          message: 'Start backend on port 8080, then try again.'
        });
        return;
      }
      trackAnalyticsEvent(mode === 'login' ? 'auth_login_failed' : 'auth_signup_failed', {
        reason: 'unknown_error'
      });
      setError('Authentication failed. Verify credentials and try again.');
      notify?.({
        type: 'error',
        title: 'Could not authenticate',
        message: 'Please verify email/password and try again.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const onSocialAuth = (provider) => {
    trackAnalyticsEvent('auth_social_clicked', { provider, mode });
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
        <UIButton className="close-btn" onClick={onClose} aria-label="Close modal" variant="ghost">×</UIButton>
        <UIBadge className="auth-modal-badge" tone="accent">Skill Swapper</UIBadge>
        <h2 id={titleId} className="auth-modal-title">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
        <p className="muted auth-modal-subtitle">
          {mode === 'login'
            ? 'Sign in to continue your learning journey, manage sessions, and chat with mentors.'
            : 'Join the community and start teaching, learning, and growing with professionals.'}
        </p>

        {mode === 'signup' && (
          <div className="auth-onboarding">
            <div className="auth-onboarding-header">
              <span className="auth-onboarding-pill">Step 1 of 3</span>
              <span className="auth-onboarding-title">Set up your SkillSwap journey</span>
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
          {mode === 'signup' && (
            <UIField label="Full name" htmlFor="signup-full-name" className="auth-modal-field-group">
              <input
                id="signup-full-name"
                placeholder="Full name"
                value={form.fullName}
                onChange={(e) => setForm((s) => ({ ...s, fullName: e.target.value }))}
                disabled={submitting}
                required
              />
            </UIField>
          )}

          <UIField label="Email" htmlFor="auth-email" className="auth-modal-field-group">
            <input
              id="auth-email"
              ref={emailInputRef}
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
              disabled={submitting}
              required
            />
          </UIField>

          <UIField label="Password" htmlFor="auth-password" className="auth-modal-field-group">
            <input
              id="auth-password"
              type="password"
              placeholder="Password"
              value={form.password}
              onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))}
              disabled={submitting}
              required
            />
          </UIField>

          {mode === 'signup' && (
            <UIField label="Role" htmlFor="signup-role" className="auth-modal-field-group">
              <select id="signup-role" value={form.role} onChange={(e) => setForm((s) => ({ ...s, role: e.target.value }))} disabled={submitting}>
                <option value="LEARNER">Learner</option>
                <option value="MENTOR">Mentor</option>
              </select>
            </UIField>
          )}

          {error && <UIAlert tone="error" title="Action required" message={error} className="auth-inline-error" />}
          <UIButton type="submit" className="submit-btn auth-modal-submit-btn" disabled={submitting}>
            {submitting ? 'Please wait...' : (mode === 'login' ? t(language, 'login') : t(language, 'createAccount'))}
          </UIButton>
        </form>

        <div className="auth-divider"><span>or continue with</span></div>
        <div className="social-auth">
          <UIButton type="button" className="social-btn auth-social-btn" onClick={() => onSocialAuth('google')} variant="secondary" aria-label="Continue with Google account">
            Continue with Google
          </UIButton>
          <UIButton type="button" className="social-btn auth-social-btn" onClick={() => onSocialAuth('github')} variant="secondary" aria-label="Continue with GitHub account">
            Continue with GitHub
          </UIButton>
        </div>
      </UICard>
    </div>
  );
}
