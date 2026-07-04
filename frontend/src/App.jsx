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
const Dashboard = lazy(() => import("./pages/Dashboard"));
const LearnerDashboard = lazy(() => import("./pages/LearnerDashboard"));
const MentorDashboard = lazy(() => import("./pages/MentorDashboard"));
const MentorStudentsPage = lazy(() => import("./pages/MentorStudentsPage"));
const MentorCalendarPage = lazy(() => import("./pages/MentorCalendarPage"));
const MentorReviewsPage = lazy(() => import("./pages/MentorReviewsPage"));
const RoleGuide = lazy(() => import("./pages/RoleGuide"));
const AnalyticsPage = lazy(() => import("./pages/AnalyticsPage"));
const LearningPage = lazy(() => import("./pages/LearningPage"));
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
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));
import AuthModal from "./components/AuthModal";
import Navbar from "./components/Navbar";
import ToastCenter from "./components/ToastCenter";
import OfflineStatusBanner from "./components/OfflineStatusBanner";
import { ThemeProvider } from "./context/ThemeContext";
import client from "./api/client";
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

  const syncCurrentUser = useCallback(async () => {
    try {
      const response = await client.get("/api/v1/users/me");
      setProfile(response.data.data);
      return response.data.data;
    } catch {
      // Attempt silent refresh using refresh token cookie, then retry once
      try {
        await client.post("/api/v1/auth/refresh");
        const retry = await client.get("/api/v1/users/me");
        setProfile(retry.data.data);
        return retry.data.data;
      } catch (err) {
        // Ensure server clears cookies and always reset local UI state
        try {
          await client.post("/api/v1/auth/logout");
        } catch (logoutError) {
          console.debug("Logout cleanup failed", logoutError);
        }
        setProfile(null);
        console.debug("Logout cleanup failed", err);
        return null;
      }
    } finally {
      setProfileChecked(true);
    }
  }, []);

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
    setProfile(null);
    setProfileChecked(true);
    setUnreadNotifications(0);
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
                          <Dashboard
                            onLogout={handleLogout}
                            language={language}
                            page="mentors"
                            notify={notify}
                          />
                        </Suspense>
                      </RouteErrorBoundary>
                    }
                  />
                  <Route
                    path="sessions"
                    element={
                      <RouteErrorBoundary key="learner-sessions">
                        <Suspense fallback={routeFallback}>
                          <LearningPage notify={notify} />
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
                    path="messages"
                    element={
                      <RouteErrorBoundary key="learner-messages">
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
                        <MentorProfilePage isLoggedIn={true} />
                      </Suspense>
                    </RouteErrorBoundary>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    profile?.role === "ADMIN" ? (
                      <RouteErrorBoundary key="admin">
                        <Suspense fallback={routeFallback}>
                          <AdminOperationsPage notify={notify} />
                        </Suspense>
                      </RouteErrorBoundary>
                    ) : (
                      <Navigate to={roleRoot(profile?.role)} replace />
                    )
                  }
                />
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
            onLoggedIn={async (loggedMode) => {
              setAuthMode(null);
              setOauthError("");
              const user = await syncCurrentUser();
              notify({
                type: "success",
                title:
                  loggedMode === "signup" ? "Account created" : "Welcome back",
                message: "Authentication successful. Loading your dashboard.",
              });
              const post = localStorage.getItem("auth_post_redirect");
              if (post) {
                localStorage.removeItem("auth_post_redirect");
                navigate(post, { replace: true });
              } else {
                navigate(roleRoot(user?.role || profile?.role), {
                  replace: true,
                });
              }
            }}
          />
        )}

        <ToastCenter toasts={toasts} onDismiss={dismissToast} />
      </div>
    </ThemeProvider>
  );
}
