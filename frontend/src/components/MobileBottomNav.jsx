import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useOptionalTheme } from "../context/ThemeContext";

export default function MobileBottomNav({ className = "" }) {
  const theme = useOptionalTheme();
  const location = useLocation();
  const roleHomePath = location.pathname.startsWith("/mentor")
    ? "/mentor/dashboard"
    : "/learner/dashboard";

  const toggleLanguage = () => {
    const next =
      (localStorage.getItem("language") || "en") === "en" ? "hi" : "en";
    localStorage.setItem("language", next);
    window.location.reload();
  };

  return (
    <nav
      className={`fixed bottom-0 z-50 w-full bg-white/90 backdrop-blur-md md:hidden ${className}`}
      aria-label="Mobile navigation"
    >
      <div className="flex h-20 items-center justify-around px-4 pb-safe">
        <Link
          className="flex flex-col items-center justify-center rounded-xl px-4 py-1 text-on-surface-variant transition-all hover:text-primary"
          to="/teach"
        >
          <span className="material-symbols-outlined">school</span>
          <span className="mt-1 text-[11px] font-semibold uppercase tracking-wider">
            Teach
          </span>
        </Link>

        <Link
          className="flex flex-col items-center justify-center rounded-xl bg-surface-container-low px-4 py-1 text-primary transition-all"
          to="/resources"
        >
          <span className="material-symbols-outlined">library_books</span>
          <span className="mt-1 text-[11px] font-semibold uppercase tracking-wider">
            Resources
          </span>
        </Link>

        <Link
          className="flex flex-col items-center justify-center rounded-xl px-4 py-1 text-on-surface-variant transition-all hover:text-primary"
          to="/sessions"
        >
          <span className="material-symbols-outlined">calendar_today</span>
          <span className="mt-1 text-[11px] font-semibold uppercase tracking-wider">
            Schedule
          </span>
        </Link>

        <Link
          className="flex flex-col items-center justify-center rounded-xl px-4 py-1 text-on-surface-variant transition-all hover:text-primary"
          to={roleHomePath}
        >
          <span className="material-symbols-outlined">account_circle</span>
          <span className="mt-1 text-[11px] font-semibold uppercase tracking-wider">
            Profile
          </span>
        </Link>

        <button
          type="button"
          className="flex flex-col items-center justify-center rounded-xl px-4 py-1 text-on-surface-variant transition-all"
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

        <button
          type="button"
          className="flex flex-col items-center justify-center rounded-xl px-4 py-1 text-on-surface-variant transition-all"
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
