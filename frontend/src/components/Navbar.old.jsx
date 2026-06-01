import { useEffect, useState } from 'react';
import './SearchNav.css';
import { t } from '../utils/i18n';
import { NavLink, useLocation, Link } from 'react-router-dom';
import { UIBadge } from './ui/Primitives';
import { useOptionalTheme } from '../context/ThemeContext';
import OptimizedImage from './OptimizedImage';

export default function Navbar({ isLoggedIn, profile, onOpenProfile, onOpenNotifications, onLogout, authMode, onSelectAuthMode, language, onLanguageChange, unreadNotifications = 0 }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  const fullName = String(profile?.fullName || '').trim();
  const email = String(profile?.email || '').trim();
  const avatarSource = fullName || email || 'User';
  const profileInitial = avatarSource.charAt(0).toUpperCase();
  const profileImageUrl = String(profile?.profileImageUrl || '').trim();
  const roleLabel = profile?.role === 'ADMIN' ? 'Admin' : profile?.role === 'MENTOR' ? 'Mentor' : 'Learner';

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const linkFor = (segment) => {
    const normalized = segment.startsWith('/') ? segment : `/${segment}`;
    if (isLoggedIn && normalized === '/home') {
      return '/home';
    }
    if (isLoggedIn && normalized === '/sessions') {
      return '/sessions';
    }
    if (isLoggedIn && normalized === '/teach') {
      return '/teach';
    }
    if (isLoggedIn && normalized === '/messages') {
      return '/messages';
    }
    if (isLoggedIn && normalized === '/wallet') {
      return '/wallet';
    }
    if (isLoggedIn && normalized === '/mentors') {
      return '/mentors';
    }
    return normalized;
  };

  const navClassName = ({ isActive }) => (isActive ? 'nav-link nav-link-active' : 'nav-link');

  const navItems = isLoggedIn
    ? profile?.role === 'ADMIN'
      ? [
        { path: '/home', label: 'Dashboard', icon: 'home' },
        { path: '/admin', label: 'Admin', icon: 'admin_panel_settings' },
        { path: '/messages', label: 'Messages', icon: 'chat' },
        { path: '/wallet', label: 'Wallet', icon: 'account_balance_wallet' }
      ]
      : profile?.role === 'MENTOR'
      ? [
        { path: '/home', label: 'Mentor Hub', icon: 'home' },
        { path: '/teach', label: 'Manage Sessions', icon: 'video_camera_front' },
        { path: '/messages', label: 'Messages', icon: 'chat' },
        { path: '/wallet', label: 'Earnings', icon: 'payments' }
      ]
      : [
        { path: '/home', label: 'Dashboard', icon: 'home' },
        { path: '/mentors', label: 'Browse Mentors', icon: 'search' },
        { path: '/messages', label: 'Messages', icon: 'chat' },
        { path: '/wallet', label: 'Payments', icon: 'account_balance_wallet' }
      ]
    : [];

  return (
    <nav className={`top-nav${scrolled ? ' scrolled' : ''}`} aria-label="Site navigation">
      <div className="top-nav-inner">
        <div className="brand-block">
          <span className="brand-dot" />
          <div>
            <h1>SkillSwap</h1>
            <p>Teach. Learn. Earn.</p>
          </div>
          {isLoggedIn && (
            <UIBadge
              tone={profile?.role === 'MENTOR' ? 'mentor' : 'learner'}
              className={profile?.role === 'MENTOR' ? 'role-chip role-chip-mentor' : 'role-chip role-chip-learner'}
            >
              {roleLabel}
            </UIBadge>
          )}
        </div>

        {isLoggedIn && (
          <button
            className="nav-menu-btn"
            type="button"
            aria-label="Toggle navigation menu"
            aria-expanded={menuOpen}
            aria-controls="primary-nav-panel"
            onClick={() => setMenuOpen((prev) => !prev)}
          >
            <span />
            <span />
            <span />
          </button>
        )}

        <div id="primary-nav-panel" className={menuOpen ? `nav-primary ${isLoggedIn ? '' : 'nav-primary-public'} nav-primary-open`.trim() : `nav-primary ${isLoggedIn ? '' : 'nav-primary-public'}`.trim()}>
          {isLoggedIn ? (
            <>
              <div className="nav-links" role="list" aria-label="Main navigation links">
                {navItems.map((item) => (
                  <NavLink
                    key={item.path}
                    to={linkFor(item.path)}
                    className={navClassName}
                    role="listitem"
                    onClick={() => setMenuOpen(false)}
                  >
                    {item.icon && (
                      <span className="material-symbols-outlined nav-link-icon" aria-hidden="true">{item.icon}</span>
                    )}
                    {item.label}
                  </NavLink>
                ))}
              </div>

              <div className="nav-actions">
                <Link
                  className="auth-nav-btn nav-primary-cta"
                  to={profile?.role === 'ADMIN' ? linkFor('/admin') : profile?.role === 'MENTOR' ? linkFor('/teach') : linkFor('/mentors')}
                  onClick={() => setMenuOpen(false)}
                >
                  {profile?.role === 'ADMIN' ? 'Review Queue' : profile?.role === 'MENTOR' ? 'Manage Sessions' : 'Find Mentor'}
                </Link>
                <div className="logged-in-actions">
                  <button
                    className="notification-btn"
                    onClick={onOpenNotifications}
                    title="Notifications"
                    aria-label={`Notifications${unreadNotifications > 0 ? ` (${unreadNotifications} unread)` : ''}`}
                    type="button"
                  >
                    <span aria-hidden="true" className="material-symbols-outlined">notifications</span>
                    {unreadNotifications > 0 && (
                      <span className="notification-badge">{unreadNotifications > 99 ? '99+' : unreadNotifications}</span>
                    )}
                  </button>
                    <DarkModeToggle />
                  <button
                    className="profile-avatar"
                    onClick={onOpenProfile}
                    title={avatarSource}
                    aria-label={avatarSource}
                    type="button"
                  >
                    {profileImageUrl ? (
                      <OptimizedImage src={profileImageUrl} alt={avatarSource} className="profile-avatar-image" />
                    ) : (
                      profileInitial
                    )}
                  </button>
                  <button
                    className="auth-nav-btn"
                    onClick={onLogout}
                    type="button"
                  >
                    {t(language, 'logout')}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="nav-actions">
              <select
                className="lang-switch"
                value={language}
                onChange={(e) => onLanguageChange(e.target.value)}
                aria-label="Language switch"
              >
                <option value="en">EN</option>
                <option value="hi">HI</option>
              </select>

              <DarkModeToggle />

              <div className="auth-nav-toggle" role="group" aria-label="Authentication actions">
                <button
                  className={authMode === 'login' ? 'auth-nav-btn active' : 'auth-nav-btn'}
                  onClick={() => onSelectAuthMode('login')}
                  type="button"
                >
                  {t(language, 'login')}
                </button>
                <button
                  className={authMode === 'signup' ? 'auth-nav-btn active' : 'auth-nav-btn'}
                  onClick={() => onSelectAuthMode('signup')}
                  type="button"
                >
                  {t(language, 'signup')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

  function DarkModeToggle() {
    const theme = useOptionalTheme();
    if (!theme) {
      return null;
    }

    const { isDark, toggle } = theme;
    return (
      <button
        className="dark-mode-btn"
        onClick={toggle}
        title={isDark ? 'Light mode' : 'Dark mode'}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        type="button"
      >
        <span aria-hidden="true" className="material-symbols-outlined">
          {isDark ? 'light_mode' : 'dark_mode'}
        </span>
      </button>
    );
  }
