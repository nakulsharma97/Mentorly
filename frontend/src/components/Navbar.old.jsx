import { useEffect, useState } from "react";
import { t } from "../utils/i18n";
import { NavLink, useLocation, Link } from "react-router-dom";
import { UIBadge } from "./ui/Primitives";
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
  onLanguageChange,
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
      ? "Admin"
      : profile?.role === "MENTOR"
        ? "Mentor"
        : "Learner";

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const linkFor = (segment) => {
    const normalized = segment.startsWith("/") ? segment : `/${segment}`;
    if (isLoggedIn && normalized === "/home") {
      return "/home";
    }
    if (isLoggedIn && normalized === "/sessions") {
      return "/sessions";
    }
    if (isLoggedIn && normalized === "/teach") {
      return "/teach";
    }
    if (isLoggedIn && normalized === "/messages") {
      return "/messages";
    }
    if (isLoggedIn && normalized === "/wallet") {
      return "/wallet";
    }
    if (isLoggedIn && normalized === "/mentors") {
      return "/mentors";
    }
    return normalized;
  };

  const navClassName = ({ isActive }) =>
    isActive ? "nav-link nav-link-active" : "nav-link";

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
      className={`fixed inset-x-0 top-4 z-50 rounded-[18px] bg-white/95 shadow-[0_20px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl transition-all duration-300 ${scrolled ? "shadow-[0_24px_60px_rgba(15,23,42,0.1)] bg-white/100" : ""}`}
      aria-label="Site navigation"
    >
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-4 sm:py-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-600 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(16,185,129,0.16)]">
            SS
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              SkillSwap
            </p>
            <p className="truncate text-sm font-semibold text-slate-950">
              Mentor dashboard
            </p>
          </div>
        </div>

        <button
          className="inline-flex h-8 w-8 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 md:hidden"
          type="button"
          aria-label="Toggle navigation menu"
          aria-expanded={menuOpen}
          aria-controls="primary-nav-panel"
          onClick={() => setMenuOpen((prev) => !prev)}
        >
          <span className="h-0.5 w-5 rounded-full bg-slate-700" />
          <span className="h-0.5 w-5 rounded-full bg-slate-700" />
          <span className="h-0.5 w-5 rounded-full bg-slate-700" />
        </button>

        <div
          id="primary-nav-panel"
          className={`absolute inset-x-4 top-full mt-2 rounded-3xl bg-white/95 p-3 shadow-xl shadow-slate-900/5 backdrop-blur-xl transition-all duration-200 ${menuOpen ? "opacity-100 visible" : "pointer-events-none opacity-0 invisible"} md:static md:top-auto md:mt-0 md:flex md:items-center md:gap-2 md:bg-transparent md:p-0 md:shadow-none md:opacity-100 md:visible md:pointer-events-auto`}
        >
          {isLoggedIn ? (
            <>
              <div
                className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3"
                role="list"
                aria-label="Main navigation links"
              >
                {navItems.map((item) => (
                  <NavLink
                    key={item.path}
                    to={linkFor(item.path)}
                    className={({ isActive }) =>
                      `inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
                        isActive
                          ? "bg-slate-950 text-white shadow-sm shadow-slate-950/10"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      }`
                    }
                    role="listitem"
                    onClick={() => setMenuOpen(false)}
                  >
                    {item.icon && (
                      <span className="material-symbols-outlined text-base text-slate-500">
                        {item.icon}
                      </span>
                    )}
                    {item.label}
                  </NavLink>
                ))}
              </div>

              <div className="flex flex-col gap-2 pt-3 md:flex-row md:items-center md:gap-2 md:pt-0">
                <Link
                  className="inline-flex items-center justify-center rounded-full bg-slate-950 px-3 py-1.5 text-sm font-semibold text-white shadow-sm shadow-slate-950/10 transition hover:bg-slate-800"
                  to={
                    profile?.role === "ADMIN"
                      ? linkFor("/admin")
                      : profile?.role === "MENTOR"
                        ? linkFor("/teach")
                        : linkFor("/mentors")
                  }
                  onClick={() => setMenuOpen(false)}
                >
                  {profile?.role === "ADMIN"
                    ? "Review Queue"
                    : profile?.role === "MENTOR"
                      ? "Manage Sessions"
                      : "Find Mentor"}
                </Link>

                <div className="flex items-center gap-2 md:gap-3">
                  <button
                    className="relative inline-flex h-8 w-8 items-center justify-center rounded-2xl border border-slate-200/80 bg-white text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                    onClick={onOpenNotifications}
                    title="Notifications"
                    aria-label={`Notifications${unreadNotifications > 0 ? ` (${unreadNotifications} unread)` : ""}`}
                    type="button"
                  >
                    <span className="material-symbols-outlined text-base">
                      notifications
                    </span>
                    {unreadNotifications > 0 && (
                      <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-semibold text-white">
                        {unreadNotifications > 99 ? "99+" : unreadNotifications}
                      </span>
                    )}
                  </button>

                  <DarkModeToggle className="inline-flex h-8 w-8 items-center justify-center rounded-2xl border border-slate-200/80 bg-white text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50" />

                  <button
                    className="inline-flex h-8 w-8 items-center justify-center rounded-2xl border border-slate-200/80 bg-white text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                    onClick={onOpenProfile}
                    title={avatarSource}
                    aria-label={avatarSource}
                    type="button"
                  >
                    {profileImageUrl ? (
                      <OptimizedImage
                        src={profileImageUrl}
                        alt={avatarSource}
                        className="h-full w-full rounded-2xl object-cover"
                      />
                    ) : (
                      <span className="text-sm font-semibold text-slate-950">
                        {profileInitial}
                      </span>
                    )}
                  </button>

                  <button
                    className="inline-flex h-8 items-center justify-center rounded-full bg-slate-50 px-3 py-1 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                    onClick={onLogout}
                    type="button"
                  >
                    {t(language, "logout")}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-2">
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200/80 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  EN
                </span>
              </div>

              <div className="flex items-center gap-2">
                <DarkModeToggle />
                <button
                  className={
                    authMode === "login"
                      ? "rounded-full bg-slate-950 px-3 py-1 text-sm font-semibold text-white transition hover:bg-slate-800"
                      : "rounded-full border border-slate-200/80 bg-white px-3 py-1 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  }
                  onClick={() => onSelectAuthMode("login")}
                  type="button"
                >
                  {t(language, "login")}
                </button>
                <button
                  className={
                    authMode === "signup"
                      ? "rounded-full bg-slate-950 px-3 py-1 text-sm font-semibold text-white transition hover:bg-slate-800"
                      : "rounded-full border border-slate-200/80 bg-white px-3 py-1 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  }
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
      <span aria-hidden="true" className="material-symbols-outlined text-base">
        {isDark ? "light_mode" : "dark_mode"}
      </span>
    </button>
  );
}
