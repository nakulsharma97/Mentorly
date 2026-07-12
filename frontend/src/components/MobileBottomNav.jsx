import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useOptionalTheme } from "../context/ThemeContext";

const BASE_CLASS =
  "flex flex-col items-center justify-center rounded-xl px-4 py-1 transition-all";
const INACTIVE_CLASS = "text-on-surface-variant hover:text-primary";
const ACTIVE_CLASS = "bg-primary/10 text-primary shadow-sm";

function navLinkClass({ isActive }) {
  return `${BASE_CLASS} ${isActive ? ACTIVE_CLASS : INACTIVE_CLASS}`;
}

export default function MobileBottomNav({ className = "" }) {
  const theme = useOptionalTheme();
  const location = useLocation();
  const roleHomePath = location.pathname.startsWith("/mentor")
    ? "/mentor/dashboard"
    : "/learner/dashboard";
  const roleMessagesPath = location.pathname.startsWith("/mentor")
    ? "/mentor/messages"
    : "/learner/messages";

  const toggleLanguage = () => {
    const next =
      (localStorage.getItem("language") || "en") === "en" ? "hi" : "en";
    localStorage.setItem("language", next);
    window.location.reload();
  };

  return (
    <nav
      className={`fixed bottom-0 z-50 w-full backdrop-blur-md md:hidden ${className}`}
      style={{ background: 'color-mix(in srgb, var(--panel, #fff) 92%, transparent)' }}
      aria-label="Mobile navigation"
    >
      <div className="flex h-20 items-center justify-around px-4 pb-safe">
        {/* Messages — universal for both roles */}
        <NavLink
          className={navLinkClass}
          to={roleMessagesPath}
        >
          <span className="material-symbols-outlined">chat</span>
          <span className="mt-1 text-[11px] font-semibold uppercase tracking-wider">
            Messages
          </span>
        </NavLink>

        {/* Resources */}
        <NavLink
          className={navLinkClass}
          to="/resources"
        >
          <span className="material-symbols-outlined">library_books</span>
          <span className="mt-1 text-[11px] font-semibold uppercase tracking-wider">
            Resources
          </span>
        </NavLink>

        {/* Schedule */}
        <NavLink
          className={navLinkClass}
          to="/sessions"
        >
          <span className="material-symbols-outlined">calendar_today</span>
          <span className="mt-1 text-[11px] font-semibold uppercase tracking-wider">
            Schedule
          </span>
        </NavLink>

        {/* Profile / Dashboard home */}
        <NavLink
          className={navLinkClass}
          to={roleHomePath}
          end
        >
          <span className="material-symbols-outlined">account_circle</span>
          <span className="mt-1 text-[11px] font-semibold uppercase tracking-wider">
            Profile
          </span>
        </NavLink>

        {/* Theme toggle */}
        <button
          type="button"
          className={`${BASE_CLASS} ${INACTIVE_CLASS}`}
          onClick={() => theme?.toggle?.()}
          aria-label="Toggle dark mode"
        >
          <span className="material-symbols-outlined">
            {theme?.isDark ? "light_mode" : "dark_mode"}
          </span>
          <span className="mt-1 text-[11px] font-semibold uppercase tracking-wider">
            Theme
          </span>
        </button>

        {/* Language toggle */}
        <button
          type="button"
          className={`${BASE_CLASS} ${INACTIVE_CLASS}`}
          onClick={toggleLanguage}
          aria-label="Switch language"
        >
          <span className="material-symbols-outlined">language</span>
          <span className="mt-1 text-[11px] font-semibold uppercase tracking-wider">
            {(localStorage.getItem("language") || "en").toUpperCase()}
          </span>
        </button>
      </div>
    </nav>
  );
}
