import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import AuthPage from "./pages/AuthPage";
import TestChecklistPage from "./pages/TestChecklistPage";
import LazyLoadingFallback from "./components/LazyLoadingFallback";
import RouteErrorBoundary from "./components/RouteErrorBoundary";
import LearnerLayout from "./modules/learner/layouts/LearnerLayout";
import MentorLayout from "./modules/mentor/layouts/MentorLayout";
import RoleGuard from "./modules/common/RoleGuard";
const LearnerDashboard = lazy(() => import("./pages/LearnerDashboard"));
const MentorDashboard = lazy(() => import("./pages/MentorDashboard"));
const MentorStudentsPage = lazy(() => import("./pages/MentorStudentsPage"));
const MentorCalendarPage = lazy(() => import("./pages/MentorCalendarPage"));
const MentorReviewsPage = lazy(() => import("./pages/MentorReviewsPage"));
const RoleGuide = lazy(() => import("./pages/RoleGuide"));
const AnalyticsPage = lazy(() => import("./pages/AnalyticsPage"));
const ResourcesPage = lazy(() => import("./pages/ResourcesPage"));
const TeachingPage = lazy(() => import("./pages/TeachingPage"));
const ProfileSetup = lazy(() => import("./pages/ProfileSetup"));
const MentorProfilePage = lazy(() => import("./pages/MentorProfilePage"));
const ProfessionalProfilePage = lazy(
  () => import("./pages/ProfessionalProfilePage"),
);
const MessagesPage = lazy(() => import("./pages/MessagesPage"));
const AdminOperationsPage = lazy(() => import("./pages/AdminOperationsPage"));
const WalletPage = lazy(() => import("./pages/WalletPage"));
const AdminLayout = lazy(() => import("./modules/admin/layouts/AdminLayout"));
const UserManagementPage = lazy(() => import("./pages/UserManagementPage"));
const SessionManagementPage = lazy(() => import("./pages/SessionManagementPage"));
const AdminAnalyticsPage = lazy(() => import("./pages/AdminAnalyticsPage"));
const NotificationBroadcastPage = lazy(() => import("./pages/NotificationBroadcastPage"));
const SystemSettingsPage = lazy(() => import("./pages/SystemSettingsPage"));
const AuditLogPage = lazy(() => import("./pages/AuditLogPage"));
const ContentModerationPage = lazy(() => import("./pages/ContentModerationPage"));
const PlatformHealthPage = lazy(() => import("./pages/PlatformHealthPage"));
const AdminApiDocsPage = lazy(() => import("./pages/AdminApiDocsPage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));
// Premium learner workspace pages (rendered inside LearnerLayout)
const LearnerMentorsPage = lazy(() => import("./pages/LearnerMentorsPage"));
const LearnerSkillsPage = lazy(() => import("./pages/LearnerSkillsPage"));
const LearnerLearningPage = lazy(() => import("./pages/LearnerLearningPage"));
const LearnerSessionsPage = lazy(() => import("./pages/LearnerSessionsPage"));
const LearnerCertificatesPage = lazy(
  () => import("./pages/LearnerCertificatesPage"),
);
const LearnerMessagesPage = lazy(() => import("./pages/LearnerMessagesPage"));
const LearnerSavedMentorsPage = lazy(
  () => import("./pages/LearnerSavedMentorsPage"),
);
const LearnerPathPage = lazy(() => import("./pages/LearnerPathPage"));
const LearnerAchievementsPage = lazy(
  () => import("./pages/LearnerAchievementsPage"),
);
const LearnerProfilePage = lazy(() => import("./pages/LearnerProfilePage"));
const LearnerSettingsPage = lazy(() => import("./pages/LearnerSettingsPage"));
const LearnerNotificationsPage = lazy(
  () => import("./pages/LearnerNotificationsPage"),
);
import AuthModal from "./components/AuthModal";
import Navbar from "./components/Navbar";
import ToastCenter from "./components/ToastCenter";
import OfflineStatusBanner from "./components/OfflineStatusBanner";
import { ThemeProvider } from "./context/ThemeContext";
import client, {
  clearAuthSessionState,
  extractJwtUserId,
  getActiveAuthToken,
  persistAuthSession,
} from "./api/client";
import {
  createPerformanceReporter,
  initGlobalMonitoring,
} from "./utils/monitoring";
import { isPublicPath, roleRoot } from "./modules/common/routeUtils";

const isProfileComplete = (profile) => {
  if (!profile) {
    return false;
  }
  if (typeof profile.profileCompletionPercent === "number") {
    return profile.profileCompletionPercent >= 100;
  }
  return Boolean(
    String(profile.skills || "").trim() &&
    String(profile.aboutMe || "").trim() &&
    String(profile.githubUrl || "").trim() &&
    String(profile.linkedinUrl || "").trim(),
  );
};

function RedirectToMentorProfessionalProfile() {
  const { section } = useParams();
  return <Navigate to={`/mentor/professional-profile/${section}`} replace />;
}

export default function App() {
  const [authMode, setAuthMode] = useState(null);
  const [oauthError, setOauthError] = useState("");
  const [language, setLanguage] = useState(
    localStorage.getItem("language") || "en",
  );
  const [profile, setProfile] = useState(null);
  const [profileChecked, setProfileChecked] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [toasts, setToasts] = useState([]);
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname;
  const routeTransitionKey = `${pathname}${location.search}`;
  const routeFallback = <LazyLoadingFallback label="Loading page" />;
  const shouldShowGlobalNavbar =
    pathname !== "/" &&
    !pathname.startsWith("/learner") &&
    !pathname.startsWith("/mentor");

  useEffect(() => {
    initGlobalMonitoring();
  }, []);

  useEffect(() => {
    const stopRouteTiming = createPerformanceReporter("route.transition", {
      path: pathname,
    });

    return () => {
      stopRouteTiming();
    };
  }, [pathname]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return undefined;
    }

    let isMounted = true;

    const registerServiceWorker = async () => {
      try {
        await navigator.serviceWorker.register("/service-worker.js", {
          scope: "/",
        });
      } catch {
        if (isMounted) {
          return;
        }
      }
    };

    if (document.readyState === "complete") {
      registerServiceWorker();
    } else {
      window.addEventListener("load", registerServiceWorker, { once: true });
    }

    return () => {
      isMounted = false;
      window.removeEventListener("load", registerServiceWorker);
    };
  }, []);

  const resetProfileState = useCallback(() => {
    setProfile(null);
    setProfileChecked(false);
    setUnreadNotifications(0);
  }, []);

  const syncCurrentUser = useCallback(async () => {
    resetProfileState();
    const activeToken = getActiveAuthToken();
    if (!activeToken) {
      // No local token found. Try relying on cookie-based auth (HttpOnly cookies)
      // by attempting to fetch the current user. The dev server proxies /api
      // and axios is configured with `withCredentials: true`, so this request
      // will send any HttpOnly auth cookies the backend set. If that succeeds,
      // we can treat the user as logged in even without a token in localStorage.
      try {
        const maybe = await client.get("/api/v1/users/me");
        const maybeProfile = maybe?.data?.data || null;
        if (maybeProfile?.id) {
          setProfile(maybeProfile);
          setProfileChecked(true);
          return maybeProfile;
        }
      } catch {
        // ignore and fall through to clearing session state below
      }

      clearAuthSessionState();
      setProfile(null);
      setProfileChecked(true);
      return null;
    }

    const tokenUserId = extractJwtUserId(activeToken);
    if (tokenUserId == null) {
      clearAuthSessionState();
      setProfile(null);
      setProfileChecked(true);
      return null;
    }

    try {
      const response = await client.get("/api/v1/users/me");
      const nextProfile = response?.data?.data || null;
      if (!nextProfile?.id) {
        clearAuthSessionState();
        setProfile(null);
        setProfileChecked(true);
        return null;
      }

      const profileUserId = Number(nextProfile.id);
      if (!Number.isFinite(profileUserId) || profileUserId !== tokenUserId) {
        clearAuthSessionState();
        setProfile(null);
        setProfileChecked(true);
        return null;
      }

      setProfile(nextProfile);
      setProfileChecked(true);
      return nextProfile;
    } catch (err) {
      const status = Number(err?.response?.status || 0);
      if (status === 401 || status === 403) {
        clearAuthSessionState();
        setProfile(null);
        setProfileChecked(true);
        return null;
      }

      try {
        await client.post("/api/v1/auth/refresh");
        const retry = await client.get("/api/v1/users/me");
        const refreshedProfile = retry?.data?.data || null;
        if (!refreshedProfile?.id) {
          clearAuthSessionState();
          setProfile(null);
          setProfileChecked(true);
          return null;
        }

        const refreshedUserId = Number(refreshedProfile.id);
        if (
          !Number.isFinite(refreshedUserId) ||
          refreshedUserId !== tokenUserId
        ) {
          clearAuthSessionState();
          setProfile(null);
          setProfileChecked(true);
          return null;
        }

        setProfile(refreshedProfile);
        setProfileChecked(true);
        return refreshedProfile;
      } catch (refreshError) {
        try {
          await client.post("/api/v1/auth/logout");
        } catch (logoutError) {
          console.debug("Logout cleanup failed", logoutError);
        }
        clearAuthSessionState();
        setProfile(null);
        setProfileChecked(true);
        console.debug("Logout cleanup failed", refreshError);
        return null;
      }
    }
  }, [resetProfileState]);

  const isLoggedIn = Boolean(profile);
  const needsProfileSetup =
    isLoggedIn &&
    profileChecked &&
    profile?.role !== "ADMIN" &&
    !isProfileComplete(profile);

  useEffect(() => {
    let isMounted = true;
    setProfileChecked(false);

    const timeoutId = window.setTimeout(() => {
      if (isMounted) {
        setProfileChecked(true);
      }
    }, 7000);

    syncCurrentUser().finally(() => {
      if (isMounted) {
        window.clearTimeout(timeoutId);
      }
    });

    return () => {
      isMounted = false;
      window.clearTimeout(timeoutId);
    };
  }, [syncCurrentUser]);

  const notify = useCallback((toast) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const normalizedToast = {
      id,
      duration: toast?.persistent ? 12000 : 4200,
      persistent: false,
      ...toast,
    };
    setToasts((prev) => [...prev, normalizedToast]);
  }, []);

  const dismissToast = (id) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  };

  useEffect(() => {
    if (!isLoggedIn) {
      setUnreadNotifications(0);
      return;
    }

    let isMounted = true;
    client
      .get("/api/v1/notifications/unread-count")
      .then((response) => {
        if (!isMounted) {
          return;
        }
        setUnreadNotifications(Number(response?.data?.data || 0));
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn) {
      return undefined;
    }

    let isMounted = true;

    const fetchUnreadCount = async () => {
      try {
        const response = await client.get("/api/v1/notifications/unread-count");
        if (isMounted) {
          setUnreadNotifications(Number(response?.data?.data || 0));
        }
      } catch {
        if (isMounted) {
          setUnreadNotifications(0);
        }
      }
    };

    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 15000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isLoggedIn]);

  useEffect(() => {
    const onOffline = () => {
      notify({
        type: "warning",
        title: "You are offline",
        message:
          "Some actions may fail until your internet connection is restored.",
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

  useEffect(() => {
    if (!isLoggedIn) {
      return undefined;
    }

    let isMounted = true;

    const pingActivity = async () => {
      try {
        await client.post("/api/v1/users/me/ping");
      } catch {
        if (!isMounted) {
          return;
        }
      }
    };

    pingActivity();
    const intervalId = setInterval(pingActivity, 60000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [isLoggedIn]);

  useEffect(() => {
    if (pathname !== "/oauth/callback") {
      return;
    }

    const params = new URLSearchParams(location.search);
    if (params.get("error")) {
      setOauthError("OAuth login failed. Please try again.");
      setAuthMode("login");
      navigate("/login", { replace: true });
      return;
    }

    if (!profileChecked) {
      return;
    }

    if (isLoggedIn) {
      setAuthMode(null);
      setOauthError("");
      const post = localStorage.getItem("auth_post_redirect");
      if (post) {
        localStorage.removeItem("auth_post_redirect");
        navigate(post, { replace: true });
      } else {
        navigate(roleRoot(profile?.role), { replace: true });
      }
      return;
    }

    setOauthError("OAuth login failed. Please try again.");
    setAuthMode("login");
    navigate("/login", { replace: true });
  }, [
    isLoggedIn,
    location.search,
    navigate,
    pathname,
    profileChecked,
    profile?.role,
  ]);

  useEffect(() => {
    if (pathname === "/login") {
      setAuthMode("login");
      return;
    }
    if (pathname === "/signup") {
      setAuthMode("signup");
      return;
    }
    setAuthMode(null);
  }, [pathname]);

  useEffect(() => {
    if (!profileChecked) {
      return;
    }

    if (!isLoggedIn) {
      const isPublicMentorProfile = pathname.startsWith("/mentors/");
      if (
        pathname !== "/oauth/callback" &&
        !isPublicPath(pathname) &&
        !isPublicMentorProfile
      ) {
        navigate("/", { replace: true });
      }
      return;
    }

    if (
      !needsProfileSetup &&
      (pathname === "/" || pathname === "/login" || pathname === "/signup")
    ) {
      navigate(roleRoot(profile?.role), { replace: true });
    }
  }, [
    isLoggedIn,
    needsProfileSetup,
    pathname,
    profileChecked,
    navigate,
    profile,
  ]);

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
    if (focusTarget) {
      focusTarget.focus();
    }
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await client.post("/api/v1/auth/logout");
    } catch {
      // Clear the local UI state even if the server call fails.
    }
    clearAuthSessionState();
    setProfile(null);
    setProfileChecked(true);
    setUnreadNotifications(0);
    setAuthMode(null);
    notify({
      type: "info",
      title: "Logged out",
      message: "You have been signed out successfully.",
    });
    navigate("/", { replace: true });
  };

  const handleSelectAuthMode = (mode) => {
    setOauthError("");
    setAuthMode(mode);
    navigate(mode === "login" ? "/login" : "/signup");
  };

  const handleLanguageChange = (value) => {
    localStorage.setItem("language", value);
    setLanguage(value);
  };

  return (
    <ThemeProvider>
      <div className="app-shell">
        <a className="skip-link" href="#route-content">
          Skip to main content
        </a>

        <OfflineStatusBanner />
        {/* Global navbar (rendered here for desktop headers). */}
        {shouldShowGlobalNavbar ? (
          <Navbar
            isLoggedIn={isLoggedIn}
            profile={profile}
            onOpenProfile={() => navigate(roleRoot(profile?.role))}
            onOpenNotifications={() =>
              navigate(
                profile?.role === "MENTOR"
                  ? "/mentor/messages"
                  : "/learner/messages",
              )
            }
            onLogout={handleLogout}
            authMode={authMode}
            onSelectAuthMode={handleSelectAuthMode}
            language={language}
            onLanguageChange={handleLanguageChange}
            unreadNotifications={unreadNotifications}
          />
        ) : null}

        <div
          key={routeTransitionKey}
          id="route-content"
          style={{ padding: 0, margin: 0 }}
          tabIndex={-1}
          role="main"
          aria-label="Primary content"
        >
          <Routes>
            {!isLoggedIn ? (
              <>
                <Route
                  path="/"
                  element={
                    <AuthPage
                      onSelectSignup={() => handleSelectAuthMode("signup")}
                      onSelectLogin={() => handleSelectAuthMode("login")}
                      language={language}
                      onLanguageChange={handleLanguageChange}
                    />
                  }
                />
                <Route path="/test-checklist" element={<TestChecklistPage />} />
                <Route
                  path="/login"
                  element={
                    <AuthPage
                      onSelectSignup={() => handleSelectAuthMode("signup")}
                      onSelectLogin={() => handleSelectAuthMode("login")}
                      language={language}
                      onLanguageChange={handleLanguageChange}
                    />
                  }
                />
                <Route
                  path="/signup"
                  element={
                    <AuthPage
                      onSelectSignup={() => handleSelectAuthMode("signup")}
                      onSelectLogin={() => handleSelectAuthMode("login")}
                      language={language}
                      onLanguageChange={handleLanguageChange}
                    />
                  }
                />
                <Route
                  path="/mentors/:mentorId"
                  element={
                    <RouteErrorBoundary key="public-mentor-profile">
                      <Suspense fallback={routeFallback}>
                        <main>
                          <MentorProfilePage
                            isLoggedIn={false}
                            onRequireLogin={() => handleSelectAuthMode("login")}
                            notify={notify}
                          />
                        </main>
                      </Suspense>
                    </RouteErrorBoundary>
                  }
                />
                <Route
                  path="/resources"
                  element={
                    <RouteErrorBoundary key="public-resources">
                      <Suspense fallback={routeFallback}>
                        <ResourcesPage />
                      </Suspense>
                    </RouteErrorBoundary>
                  }
                />
                <Route
                  path="/teach"
                  element={
                    profile?.role === "MENTOR" ? (
                      <RouteErrorBoundary key="public-teach">
                        <Suspense fallback={routeFallback}>
                          <TeachingPage />
                        </Suspense>
                      </RouteErrorBoundary>
                    ) : (
                      <Navigate to="/sessions" replace />
                    )
                  }
                />
                <Route
                  path="*"
                  element={
                    <RouteErrorBoundary key="public-not-found">
                      <Suspense fallback={routeFallback}>
                        <NotFoundPage isLoggedIn={false} />
                      </Suspense>
                    </RouteErrorBoundary>
                  }
                />
              </>
            ) : !profileChecked ? (
              <Route
                path="*"
                element={
                  <main>
                    <div className="auth-card">
                      <h2>Loading your profile...</h2>
                    </div>
                  </main>
                }
              />
            ) : (
              <>
                <Route
                  path="/profile-setup"
                  element={
                    <RouteErrorBoundary key="profile-setup">
                      <Suspense fallback={routeFallback}>
                        <ProfileSetup
                          initialProfile={profile}
                          notify={notify}
                          onProfileUpdated={(updatedProfile) => {
                            setProfile(updatedProfile);
                          }}
                          onCompleted={(updatedProfile) => {
                            setProfile(updatedProfile);
                            setProfileChecked(true);
                            notify({
                              type: "success",
                              title: "Profile completed",
                              message:
                                "You can now browse mentors and start booking sessions.",
                            });
                            navigate(
                              roleRoot(updatedProfile?.role || profile?.role),
                              {
                                replace: true,
                              },
                            );
                          }}
                          onLogout={handleLogout}
                          language={language}
                        />
                      </Suspense>
                    </RouteErrorBoundary>
                  }
                />
                <Route
                  path="/"
                  element={<Navigate to={roleRoot(profile?.role)} replace />}
                />
                <Route
                  path="/home"
                  element={<Navigate to={roleRoot(profile?.role)} replace />}
                />
                <Route
                  path="/learner"
                  element={
                    <RoleGuard profile={profile} allowedRoles={["LEARNER"]}>
                      <LearnerLayout
                        profile={profile}
                        onLogout={handleLogout}
                        language={language}
                        onLanguageChange={handleLanguageChange}
                        unreadNotifications={unreadNotifications}
                      />
                    </RoleGuard>
                  }
                >
                  <Route
                    index
                    element={<Navigate to="/learner/dashboard" replace />}
                  />
                  <Route
                    path="dashboard"
                    element={
                      <RouteErrorBoundary key="learner-dashboard">
                        <Suspense fallback={routeFallback}>
                          <LearnerDashboard
                            profile={profile}
                            onLogout={handleLogout}
                          />
                        </Suspense>
                      </RouteErrorBoundary>
                    }
                  />
                  <Route
                    path="mentors"
                    element={
                      <RouteErrorBoundary key="learner-mentors">
                        <Suspense fallback={routeFallback}>
                          <LearnerMentorsPage />
                        </Suspense>
                      </RouteErrorBoundary>
                    }
                  />
                  <Route
                    path="skills"
                    element={
                      <RouteErrorBoundary key="learner-skills">
                        <Suspense fallback={routeFallback}>
                          <LearnerSkillsPage />
                        </Suspense>
                      </RouteErrorBoundary>
                    }
                  />
                  <Route
                    path="learning"
                    element={
                      <RouteErrorBoundary key="learner-learning">
                        <Suspense fallback={routeFallback}>
                          <LearnerLearningPage />
                        </Suspense>
                      </RouteErrorBoundary>
                    }
                  />
                  <Route
                    path="sessions"
                    element={
                      <RouteErrorBoundary key="learner-sessions">
                        <Suspense fallback={routeFallback}>
                          <LearnerSessionsPage />
                        </Suspense>
                      </RouteErrorBoundary>
                    }
                  />
                  <Route
                    path="certificates"
                    element={
                      <RouteErrorBoundary key="learner-certificates">
                        <Suspense fallback={routeFallback}>
                          <LearnerCertificatesPage />
                        </Suspense>
                      </RouteErrorBoundary>
                    }
                  />
                  <Route
                    path="messages"
                    element={
                      <RouteErrorBoundary key="learner-messages">
                        <Suspense fallback={routeFallback}>
                          <LearnerMessagesPage profile={profile} />
                        </Suspense>
                      </RouteErrorBoundary>
                    }
                  />
                  <Route
                    path="messages/:conversationId"
                    element={
                      <RouteErrorBoundary key="learner-messages-conversation">
                        <Suspense fallback={routeFallback}>
                          <LearnerMessagesPage profile={profile} />
                        </Suspense>
                      </RouteErrorBoundary>
                    }
                  />
                  <Route
                    path="saved"
                    element={
                      <RouteErrorBoundary key="learner-saved">
                        <Suspense fallback={routeFallback}>
                          <LearnerSavedMentorsPage />
                        </Suspense>
                      </RouteErrorBoundary>
                    }
                  />
                  <Route
                    path="path"
                    element={
                      <RouteErrorBoundary key="learner-path">
                        <Suspense fallback={routeFallback}>
                          <LearnerPathPage />
                        </Suspense>
                      </RouteErrorBoundary>
                    }
                  />
                  <Route
                    path="achievements"
                    element={
                      <RouteErrorBoundary key="learner-achievements">
                        <Suspense fallback={routeFallback}>
                          <LearnerAchievementsPage />
                        </Suspense>
                      </RouteErrorBoundary>
                    }
                  />
                  <Route
                    path="notifications"
                    element={
                      <RouteErrorBoundary key="learner-notifications">
                        <Suspense fallback={routeFallback}>
                          <LearnerNotificationsPage />
                        </Suspense>
                      </RouteErrorBoundary>
                    }
                  />
                  <Route
                    path="profile"
                    element={
                      <RouteErrorBoundary key="learner-profile">
                        <Suspense fallback={routeFallback}>
                          <LearnerProfilePage profile={profile} />
                        </Suspense>
                      </RouteErrorBoundary>
                    }
                  />
                  <Route
                    path="settings"
                    element={
                      <RouteErrorBoundary key="learner-settings">
                        <Suspense fallback={routeFallback}>
                          <LearnerSettingsPage profile={profile} />
                        </Suspense>
                      </RouteErrorBoundary>
                    }
                  />
                  <Route
                    path="resources"
                    element={
                      <RouteErrorBoundary key="learner-resources">
                        <Suspense fallback={routeFallback}>
                          <ResourcesPage />
                        </Suspense>
                      </RouteErrorBoundary>
                    }
                  />
                  <Route
                    path="wallet"
                    element={
                      <RouteErrorBoundary key="learner-wallet">
                        <Suspense fallback={routeFallback}>
                          <WalletPage profile={profile} notify={notify} />
                        </Suspense>
                      </RouteErrorBoundary>
                    }
                  />
                  <Route
                    path="*"
                    element={<Navigate to="/learner/dashboard" replace />}
                  />
                </Route>
                <Route
                  path="/mentor"
                  element={
                    <RoleGuard profile={profile} allowedRoles={["MENTOR"]}>
                      <MentorLayout
                        profile={profile}
                        onLogout={handleLogout}
                        language={language}
                        onLanguageChange={handleLanguageChange}
                        unreadNotifications={unreadNotifications}
                      />
                    </RoleGuard>
                  }
                >
                  <Route
                    index
                    element={<Navigate to="/mentor/dashboard" replace />}
                  />
                  <Route
                    path="dashboard"
                    element={
                      <RouteErrorBoundary key="mentor-dashboard">
                        <Suspense fallback={routeFallback}>
                          <MentorDashboard
                            profile={profile}
                            onLogout={handleLogout}
                          />
                        </Suspense>
                      </RouteErrorBoundary>
                    }
                  />
                  <Route
                    path="teach"
                    element={
                      <RouteErrorBoundary key="mentor-teach">
                        <Suspense fallback={routeFallback}>
                          <TeachingPage notify={notify} />
                        </Suspense>
                      </RouteErrorBoundary>
                    }
                  />
                  <Route
                    path="students"
                    element={
                      <RouteErrorBoundary key="mentor-students">
                        <Suspense fallback={routeFallback}>
                          <MentorStudentsPage
                            profile={profile}
                            notify={notify}
                          />
                        </Suspense>
                      </RouteErrorBoundary>
                    }
                  />
                  <Route
                    path="calendar"
                    element={
                      <RouteErrorBoundary key="mentor-calendar">
                        <Suspense fallback={routeFallback}>
                          <MentorCalendarPage
                            profile={profile}
                            notify={notify}
                          />
                        </Suspense>
                      </RouteErrorBoundary>
                    }
                  />
                  <Route
                    path="analytics"
                    element={
                      <RouteErrorBoundary key="mentor-analytics">
                        <Suspense fallback={routeFallback}>
                          <AnalyticsPage profile={profile} />
                        </Suspense>
                      </RouteErrorBoundary>
                    }
                  />
                  <Route
                    path="reviews"
                    element={
                      <RouteErrorBoundary key="mentor-reviews">
                        <Suspense fallback={routeFallback}>
                          <MentorReviewsPage
                            profile={profile}
                            notify={notify}
                          />
                        </Suspense>
                      </RouteErrorBoundary>
                    }
                  />
                  <Route
                    path="messages"
                    element={
                      <RouteErrorBoundary key="mentor-messages">
                        <Suspense fallback={routeFallback}>
                          <MessagesPage
                            profile={profile}
                            notify={notify}
                            onLogout={handleLogout}
                          />
                        </Suspense>
                      </RouteErrorBoundary>
                    }
                  />
                  <Route
                    path="wallet"
                    element={
                      <RouteErrorBoundary key="mentor-wallet">
                        <Suspense fallback={routeFallback}>
                          <WalletPage profile={profile} notify={notify} />
                        </Suspense>
                      </RouteErrorBoundary>
                    }
                  />
                  <Route
                    path="professional-profile"
                    element={
                      <RouteErrorBoundary key="mentor-professional-profile">
                        <Suspense fallback={routeFallback}>
                          <ProfessionalProfilePage
                            profile={profile}
                            notify={notify}
                          />
                        </Suspense>
                      </RouteErrorBoundary>
                    }
                  />
                  <Route
                    path="*"
                    element={<Navigate to="/mentor/dashboard" replace />}
                  />
                </Route>
                <Route
                  path="/role-guide"
                  element={
                    <RouteErrorBoundary key="role-guide">
                      <Suspense fallback={routeFallback}>
                        <RoleGuide />
                      </Suspense>
                    </RouteErrorBoundary>
                  }
                />
                <Route
                  path="/sessions"
                  element={
                    <Navigate
                      to={
                        profile?.role === "MENTOR"
                          ? "/mentor/teach"
                          : "/learner/sessions"
                      }
                      replace
                    />
                  }
                />
                <Route
                  path="/resources"
                  element={<Navigate to="/learner/resources" replace />}
                />
                <Route
                  path="/teach"
                  element={<Navigate to="/mentor/teach" replace />}
                />
                <Route
                  path="/mentors"
                  element={<Navigate to="/learner/mentors" replace />}
                />
                <Route
                  path="/professional-profile"
                  element={
                    <Navigate to="/mentor/professional-profile" replace />
                  }
                />
                <Route
                  path="/professional-profile/:section"
                  element={<RedirectToMentorProfessionalProfile />}
                />
                <Route
                  path="/wallet"
                  element={
                    <Navigate
                      to={
                        profile?.role === "MENTOR"
                          ? "/mentor/wallet"
                          : "/learner/wallet"
                      }
                      replace
                    />
                  }
                />
                <Route
                  path="/analytics"
                  element={<Navigate to="/mentor/analytics" replace />}
                />
                <Route
                  path="/messages"
                  element={
                    <Navigate
                      to={
                        profile?.role === "MENTOR"
                          ? "/mentor/messages"
                          : "/learner/messages"
                      }
                      replace
                    />
                  }
                />
                <Route
                  path="/sessions/:roadmapId"
                  element={
                    <Navigate
                      to={
                        profile?.role === "MENTOR"
                          ? "/mentor/teach"
                          : "/learner/sessions"
                      }
                      replace
                    />
                  }
                />
                <Route
                  path="/mentors/:mentorId"
                  element={
                    <RouteErrorBoundary key="mentor-profile">
                      <Suspense fallback={routeFallback}>
                        <MentorProfilePage isLoggedIn={true} notify={notify} />
                      </Suspense>
                    </RouteErrorBoundary>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    profile?.role === "ADMIN" ? (
                      <RoleGuard profile={profile} allowedRoles={["ADMIN"]}>
                        <Suspense fallback={routeFallback}>
                          <AdminLayout
                            profile={profile}
                            onLogout={handleLogout}
                            unreadNotifications={unreadNotifications}
                          />
                        </Suspense>
                      </RoleGuard>
                    ) : (
                      <Navigate to={roleRoot(profile?.role)} replace />
                    )
                  }
                >
                  <Route index element={<Navigate to="/admin/dashboard" replace />} />
                  <Route path="dashboard" element={
                    <RouteErrorBoundary key="admin-dashboard">
                      <Suspense fallback={routeFallback}>
                        <AdminOperationsPage notify={notify} />
                      </Suspense>
                    </RouteErrorBoundary>
                  } />
                  <Route path="users" element={
                    <RouteErrorBoundary key="admin-users">
                      <Suspense fallback={routeFallback}>
                        <UserManagementPage notify={notify} />
                      </Suspense>
                    </RouteErrorBoundary>
                  } />
                  <Route path="sessions" element={
                    <RouteErrorBoundary key="admin-sessions">
                      <Suspense fallback={routeFallback}>
                        <SessionManagementPage notify={notify} />
                      </Suspense>
                    </RouteErrorBoundary>
                  } />
                  <Route path="analytics" element={
                    <RouteErrorBoundary key="admin-analytics">
                      <Suspense fallback={routeFallback}>
                        <AdminAnalyticsPage notify={notify} />
                      </Suspense>
                    </RouteErrorBoundary>
                  } />
                  <Route path="notifications" element={
                    <RouteErrorBoundary key="admin-notifications">
                      <Suspense fallback={routeFallback}>
                        <NotificationBroadcastPage notify={notify} />
                      </Suspense>
                    </RouteErrorBoundary>
                  } />
                  <Route path="settings" element={
                    <RouteErrorBoundary key="admin-settings">
                      <Suspense fallback={routeFallback}>
                        <SystemSettingsPage notify={notify} />
                      </Suspense>
                    </RouteErrorBoundary>
                  } />
                  <Route path="audit-log" element={
                    <RouteErrorBoundary key="admin-audit-log">
                      <Suspense fallback={routeFallback}>
                        <AuditLogPage notify={notify} />
                      </Suspense>
                    </RouteErrorBoundary>
                  } />
                  <Route path="flagged-content" element={
                    <RouteErrorBoundary key="admin-flagged-content">
                      <Suspense fallback={routeFallback}>
                        <ContentModerationPage notify={notify} />
                      </Suspense>
                    </RouteErrorBoundary>
                  } />
                  <Route path="health" element={
                    <RouteErrorBoundary key="admin-health">
                      <Suspense fallback={routeFallback}>
                        <PlatformHealthPage notify={notify} />
                      </Suspense>
                    </RouteErrorBoundary>
                  } />
                  <Route path="api-docs" element={
                    <RouteErrorBoundary key="admin-api-docs">
                      <Suspense fallback={routeFallback}>
                        <AdminApiDocsPage />
                      </Suspense>
                    </RouteErrorBoundary>
                  } />
                  <Route path="reports" element={
                    <RouteErrorBoundary key="admin-reports">
                      <Suspense fallback={routeFallback}>
                        <AdminOperationsPage notify={notify} />
                      </Suspense>
                    </RouteErrorBoundary>
                  } />
                  <Route path="verifications" element={
                    <RouteErrorBoundary key="admin-verifications">
                      <Suspense fallback={routeFallback}>
                        <AdminOperationsPage notify={notify} />
                      </Suspense>
                    </RouteErrorBoundary>
                  } />
                  <Route path="payments" element={
                    <RouteErrorBoundary key="admin-payments">
                      <Suspense fallback={routeFallback}>
                        <AdminOperationsPage notify={notify} />
                      </Suspense>
                    </RouteErrorBoundary>
                  } />
                  <Route path="conversations" element={
                    <RouteErrorBoundary key="admin-conversations">
                      <Suspense fallback={routeFallback}>
                        <AdminOperationsPage notify={notify} />
                      </Suspense>
                    </RouteErrorBoundary>
                  } />
                </Route>
                <Route
                  path="*"
                  element={
                    <RouteErrorBoundary key="authenticated-not-found">
                      <Suspense fallback={routeFallback}>
                        <NotFoundPage isLoggedIn={true} />
                      </Suspense>
                    </RouteErrorBoundary>
                  }
                />
              </>
            )}
          </Routes>
        </div>

        {/* Render Authentication Modal globally when trigged */}
        {!isLoggedIn && authMode && (
          <AuthModal
            mode={authMode}
            onClose={() => {
              setAuthMode(null);
              navigate("/");
            }}
            language={language}
            initialError={oauthError}
            notify={notify}
            onLoggedIn={async (loggedMode, authResponse) => {
              setAuthMode(null);
              setOauthError("");
              try {
                console.info("[auth] onLoggedIn authResponse", authResponse);
              } catch (_) { /* ignore */ }
              const nextToken = persistAuthSession(authResponse);
              try {
                console.info(
                  "[auth] persistAuthSession returned",
                  nextToken,
                  "cookies",
                  typeof document !== "undefined" ? document.cookie : null,
                );
              } catch (_) { /* ignore */ }
              if (!nextToken) {
                notify({
                  type: "error",
                  title: "Authentication failed",
                  message: "No access token was returned by the server.",
                });
                return;
              }

              try {
                const user = await syncCurrentUser();
                if (!user?.id) {
                  throw new Error("Profile initialization failed");
                }

                notify({
                  type: "success",
                  title:
                    loggedMode === "signup"
                      ? "Account created"
                      : "Welcome back",
                  message: "Authentication successful. Loading your dashboard.",
                });

                const post = localStorage.getItem("auth_post_redirect");
                if (post) {
                  localStorage.removeItem("auth_post_redirect");
                  navigate(post, { replace: true });
                } else {
                  navigate(roleRoot(user.role), { replace: true });
                }
              } catch (error) {
                console.error(
                  "Post-login profile initialization failed",
                  error,
                );
                clearAuthSessionState();
                notify({
                  type: "error",
                  title: "Authentication failed",
                  message: "We could not load your profile. Please try again.",
                });
                navigate("/login", { replace: true });
              }
            }}
          />
        )}

        <ToastCenter toasts={toasts} onDismiss={dismissToast} />
      </div>
    </ThemeProvider>
  );
}
