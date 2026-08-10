import { lazy, Suspense, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import LazyLoadingFallback from "./components/LazyLoadingFallback";
import AppRoutes from "./components/AppRoutes";
import AuthModal from "./components/AuthModal";
import Navbar from "./components/Navbar";
import ToastCenter from "./components/ToastCenter";
import OfflineStatusBanner from "./components/OfflineStatusBanner";
import { ThemeProvider } from "./context/ThemeContext";
import { clearAuthSessionState, persistAuthSession } from "./api/client";
import { createPerformanceReporter, initGlobalMonitoring } from "./utils/monitoring";
import { roleRoot } from "./modules/common/routeUtils";
import { useAuthProfile } from "./hooks/useAuth";
import { useToasts } from "./hooks/useToasts";
import { prefetchWorkspacePages } from "./modules/common/routePrefetch";
import {
  clearOnboardingDismissal,
  isProfileComplete,
  PROFILE_ONBOARDING_PATH,
} from "./modules/common/profileCompletion";

const MaintenancePage = lazy(() => import("./pages/MaintenancePage"));

export default function App() {
  const { toasts, notify, dismissToast } = useToasts();
  const auth = useAuthProfile({ notify });
  const [language, setLanguage] = useState(
    localStorage.getItem("language") || "en",
  );
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname;
  const routeFallback = <LazyLoadingFallback label="Loading page" />;
  // The onboarding page renders its own minimal top bar (brand + logout), so
  // the full global navbar (with dashboard links) is hidden while onboarding.
  // Workspace pages (learner/mentor/admin) render their own topbar — the
  // global navbar must not appear there, otherwise its notification bell
  // (which navigates) would clash with the workspace bell (which opens the
  // shared NotificationCenter dropdown).
  const shouldShowGlobalNavbar =
    pathname !== "/" &&
    !pathname.startsWith(PROFILE_ONBOARDING_PATH) &&
    !pathname.startsWith("/learner") &&
    !pathname.startsWith("/mentor") &&
    !pathname.startsWith("/admin");

  useEffect(() => {
    initGlobalMonitoring();
  }, []);

  // Warm the code-split chunks for the most common workspace pages at idle so
  // the first navigation to them renders instantly instead of waiting for the
  // lazy chunk to load/transform on the critical path.
  useEffect(() => {
    if (!auth.isLoggedIn) return undefined;
    prefetchWorkspacePages(auth.profile?.role);
    return undefined;
  }, [auth.isLoggedIn, auth.profile?.role]);

  useEffect(() => {
    const stopRouteTiming = createPerformanceReporter("route.transition", {
      path: pathname,
    });
    return () => stopRouteTiming();
  }, [pathname]);

  // Offline detection
  useEffect(() => {
    const onOffline = () => {
      notify({
        type: "warning",
        title: "You are offline",
        message: "Some actions may fail until your internet connection is restored.",
        persistent: true,
      });
    };
    const onOnline = () => {
      notify({
        type: "success",
        title: "Connection restored",
        message: "You are back online.",
      });
    };
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, [notify]);

  // Scroll to top and focus management
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  }, [pathname]);

  useEffect(() => {
    const focusTarget = document.getElementById("route-content");
    if (focusTarget) focusTarget.focus();
  }, [pathname]);

  const handleLanguageChange = (value) => {
    localStorage.setItem("language", value);
    setLanguage(value);
  };

  // Shared post-login handler — used by both the regular AuthModal and the
  // dedicated AdminLoginPage (/admin/login). Persists the auth session, syncs
  // the current user profile, then redirects to the role home (for ADMIN this
  // is /admin/dashboard).
  const handleAuthenticated = async (loggedMode, authResponse) => {
    auth.setAuthMode(null);
    auth.setOauthError("");
    // Bump the sync generation so any in-flight stale syncCurrentUser
    // call (e.g. from the mount effect) is discarded.
    auth.bumpSyncGeneration();
    const nextToken = persistAuthSession(authResponse);
    if (!nextToken) {
      notify({
        type: "error",
        title: "Authentication failed",
        message: "No access token was returned by the server.",
      });
      return;
    }
    try {
      const user = await auth.syncCurrentUser();
      if (!user?.id) throw new Error("Profile initialization failed");
      notify({
        type: "success",
        title: loggedMode === "signup" ? "Account created" : "Welcome back",
        message: "Authentication successful. Loading your dashboard.",
      });
      // Mandatory onboarding: incomplete mentors/learners go straight to the
      // Complete Profile page — no dashboard, no other page. A fresh login
      // never inherits a previous session's onboarding dismissal.
      if (user?.role !== "ADMIN" && !isProfileComplete(user)) {
        clearOnboardingDismissal();
        localStorage.removeItem("auth_post_redirect");
        navigate(PROFILE_ONBOARDING_PATH, { replace: true });
        return;
      }
      const post = localStorage.getItem("auth_post_redirect");
      if (post) {
        // A protected page (e.g. a mentor profile) saved the destination
        // before bouncing here. The route-protection effect in useAuth
        // consumes this key and navigates to it once the profile state
        // settles — that guarantees the redirect is honored instead of being
        // overridden by the effect's own /login → role-dashboard bounce.
        return;
      }
      navigate(roleRoot(user.role), { replace: true });
    } catch (error) {
      console.error("Post-login profile initialization failed", error);
      clearAuthSessionState();
      notify({
        type: "error",
        title: "Authentication failed",
        message: "We could not load your profile. Please try again.",
      });
      navigate("/login", { replace: true });
    }
  };

  return (
    <ThemeProvider>
      <div className="app-shell">
        <a className="skip-link" href="#route-content">
          Skip to main content
        </a>

        <OfflineStatusBanner />

        {/* Global navbar */}
        {shouldShowGlobalNavbar ? (
          <Navbar
            isLoggedIn={auth.isLoggedIn}
            profile={auth.profile}
            onOpenProfile={() => navigate(roleRoot(auth.profile?.role))}
            onOpenNotifications={() =>
              navigate(
                auth.profile?.role === "ADMIN"
                  ? "/admin/notification-center"
                  : auth.profile?.role === "MENTOR"
                    ? "/mentor/messages"
                    : "/learner/messages",
              )
            }
            onLogout={auth.handleLogout}
            authMode={auth.authMode}
            onSelectAuthMode={auth.handleSelectAuthMode}
            language={language}
            onLanguageChange={handleLanguageChange}
            unreadNotifications={auth.unreadNotifications}
          />
        ) : null}

        {/* Maintenance mode banner */}
        {auth.maintenanceMode && auth.profile?.role !== "ADMIN" && (
          <Suspense fallback={<LazyLoadingFallback label="" />}>
            <MaintenancePage isAdmin={false} />
          </Suspense>
        )}

        {auth.maintenanceMode && auth.profile?.role === "ADMIN" && (
          <section
            role="alert"
            aria-live="assertive"
            style={{
              background: "linear-gradient(135deg, #f59e0b, #d97706)",
              color: "#fff",
              padding: "10px 20px",
              textAlign: "center",
              fontWeight: 700,
              fontSize: "0.9rem",
              fontFamily: "'Inter', sans-serif",
            }}
          >
            <span aria-hidden="true">🔧</span> Maintenance mode is active — only administrators can access the platform.
            Go to{' '}
            <a
              href="/admin/settings"
              style={{ color: "#fff", textDecoration: "underline", fontWeight: 800 }}
            >
              Settings
            </a>{' '}
            to disable it.
          </section>
        )}

        {auth.maintenanceMode && auth.profile?.role !== "ADMIN" ? null : (
          <div
            id="route-content"
            style={{ padding: 0, margin: 0 }}
            tabIndex={-1}
          >
            <AppRoutes
              isLoggedIn={auth.isLoggedIn}
              profile={auth.profile}
              profileChecked={auth.profileChecked}
              needsProfileSetup={auth.needsProfileSetup}
              handleLogout={auth.handleLogout}
              handleSelectAuthMode={auth.handleSelectAuthMode}
              onLoggedIn={handleAuthenticated}
              notify={notify}
              language={language}
              onLanguageChange={handleLanguageChange}
              setProfile={auth.setProfile}
              setProfileChecked={auth.setProfileChecked}
              unreadNotifications={auth.unreadNotifications}
              setUnreadNotifications={auth.setUnreadNotifications}
              routeFallback={routeFallback}
            />
          </div>
        )}

        {/* Authentication Modal */}
        {!auth.isLoggedIn && auth.authMode && (
          <AuthModal
            mode={auth.authMode}
            onClose={() => {
              // User abandoned the sign-in modal — drop any pending
              // post-login redirect so a stale destination can never hijack
              // a later, unrelated login.
              localStorage.removeItem("auth_post_redirect");
              auth.setAuthMode(null);
              navigate("/");
            }}
            language={language}
            initialError={auth.oauthError}
            notify={notify}
            onLoggedIn={handleAuthenticated}
          />
        )}

        <ToastCenter toasts={toasts} onDismiss={dismissToast} />
      </div>
    </ThemeProvider>
  );
}
