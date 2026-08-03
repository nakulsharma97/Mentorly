import { useEffect, useState } from "react";
import { t } from "../utils/i18n";
import { NavLink, useLocation } from "react-router";
import { useOptionalTheme } from "../context/ThemeContext";
import OptimizedImage from "./OptimizedImage";

export default function Navbar({
  isLoggedIn,
  profile,
  onOpenProfile,
  onOpenNotifications,
  onLogout,
  authMode,
  onSelectAuthMode,
  language,
  unreadNotifications = 0,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  const fullName = String(profile?.fullName || "").trim();
  const email = String(profile?.email || "").trim();
  const avatarSource = fullName || email || "User";
  const profileInitial = avatarSource.charAt(0).toUpperCase();
  const profileImageUrl = String(profile?.profileImageUrl || "").trim();
  const roleLabel =
    profile?.role === "ADMIN"
      ? "Admin workspace"
      : profile?.role === "MENTOR"
        ? "Mentor hub"
        : "Learner hub";

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const roleRootPath = (role) => {
    if (role === "ADMIN") {
      return "/admin";
    }
    if (role === "MENTOR") {
      return "/mentor/dashboard";
    }
    return "/learner/dashboard";
  };

  const linkFor = (segment) => {
    const normalized = segment.startsWith("/") ? segment : `/${segment}`;
    if (isLoggedIn && normalized === "/home") {
      return roleRootPath(profile?.role);
    }
    if (isLoggedIn && normalized === "/sessions") {
      return profile?.role === "MENTOR" ? "/mentor/teach" : "/learner/sessions";
    }
    if (isLoggedIn && normalized === "/teach") {
      return "/mentor/teach";
    }
    if (isLoggedIn && normalized === "/messages") {
      return profile?.role === "MENTOR"
        ? "/mentor/messages"
        : "/learner/messages";
    }
    if (isLoggedIn && normalized === "/wallet") {
      return profile?.role === "MENTOR" ? "/mentor/wallet" : "/learner/wallet";
    }
    if (isLoggedIn && normalized === "/mentors") {
      return "/learner/mentors";
    }
    return normalized;
  };

  const navItems = isLoggedIn
    ? profile?.role === "ADMIN"
      ? [
          { path: "/home", label: "Dashboard", icon: "home" },
          { path: "/admin", label: "Admin", icon: "admin_panel_settings" },
          { path: "/messages", label: "Messages", icon: "chat" },
          { path: "/wallet", label: "Wallet", icon: "account_balance_wallet" },
        ]
      : profile?.role === "MENTOR"
        ? [
            { path: "/home", label: "Mentor Hub", icon: "home" },
            {
              path: "/teach",
              label: "Manage Sessions",
              icon: "video_camera_front",
            },
            { path: "/messages", label: "Messages", icon: "chat" },
            { path: "/wallet", label: "Earnings", icon: "payments" },
          ]
        : [
            { path: "/home", label: "Dashboard", icon: "home" },
            { path: "/mentors", label: "Browse Mentors", icon: "search" },
            { path: "/messages", label: "Messages", icon: "chat" },
            {
              path: "/wallet",
              label: "Payments",
              icon: "account_balance_wallet",
            },
          ]
    : [];

  return (
    <nav
      className={`site-navbar${scrolled ? " scrolled" : ""}`}
      aria-label="Site navigation"
    >
      <div className="site-navbar-inner">
        <div className="site-navbar-brand">
          <span className="site-navbar-logo">SS</span>
          <div className="site-navbar-brand-text">
            <p className="site-navbar-brand-label">SkillSwap</p>
            <p className="site-navbar-brand-title">{roleLabel} dashboard</p>
          </div>
        </div>

        <button
          className="site-navbar-hamburger"
          type="button"
          aria-label="Toggle navigation menu"
          aria-expanded={menuOpen}
          aria-controls="primary-nav-panel"
          onClick={() => setMenuOpen((prev) => !prev)}
        >
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>

        <div
          id="primary-nav-panel"
          className={`site-navbar-panel${menuOpen ? " open" : ""}`}
        >
          {isLoggedIn ? (
            <>
              <div
                className="site-navbar-links"
                role="list"
                aria-label="Main navigation links"
              >
                {navItems.map((item) => (
                  <NavLink
                    key={item.path}
                    to={linkFor(item.path)}
                    className={({ isActive }) =>
                      `site-navbar-link${isActive ? " active" : ""}`
                    }
                    role="listitem"
                    onClick={() => setMenuOpen(false)}
                  >
                    {item.icon && (
                      <span className="material-symbols-outlined">
                        {item.icon}
                      </span>
                    )}
                    {item.label}
                  </NavLink>
                ))}
              </div>

              <div className="site-navbar-actions">
                <div
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <button
                    className="site-navbar-icon-btn"
                    onClick={onOpenNotifications}
                    title="Notifications"
                    aria-label={`Notifications${unreadNotifications > 0 ? ` (${unreadNotifications} unread)` : ""}`}
                    type="button"
                  >
                    <span className="material-symbols-outlined">
                      notifications
                    </span>
                    {unreadNotifications > 0 && (
                      <span className="site-navbar-notif-badge">
                        {unreadNotifications > 99 ? "99+" : unreadNotifications}
                      </span>
                    )}
                  </button>

                  <DarkModeToggle className="site-navbar-icon-btn" />

                  <button
                    className="site-navbar-avatar"
                    onClick={onOpenProfile}
                    title={avatarSource}
                    aria-label={avatarSource}
                    type="button"
                  >
                    {profileImageUrl ? (
                      <OptimizedImage
                        src={profileImageUrl}
                        alt={avatarSource}
                        className="site-navbar-avatar-img"
                      />
                    ) : (
                      <span className="site-navbar-avatar-initial">
                        {profileInitial}
                      </span>
                    )}
                  </button>

                  <button
                    className="site-navbar-logout"
                    onClick={onLogout}
                    type="button"
                  >
                    {t(language, "logout")}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "8px" }}
              className="site-navbar-actions"
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <DarkModeToggle className="site-navbar-icon-btn" />
                <button
                  className={`site-navbar-auth-btn${authMode === "login" ? " active" : ""}`}
                  onClick={() => onSelectAuthMode("login")}
                  type="button"
                >
                  {t(language, "login")}
                </button>
                <button
                  className={`site-navbar-auth-btn${authMode === "signup" ? " active" : ""}`}
                  onClick={() => onSelectAuthMode("signup")}
                  type="button"
                >
                  {t(language, "signup")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

function DarkModeToggle({ className }) {
  const theme = useOptionalTheme();
  if (!theme) {
    return null;
  }

  const { isDark, toggle } = theme;
  return (
    <button
      className={className}
      onClick={toggle}
      title={isDark ? "Light mode" : "Dark mode"}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      type="button"
    >
      <span aria-hidden="true" className="material-symbols-outlined">
        {isDark ? "light_mode" : "dark_mode"}
      </span>
    </button>
  );
}

