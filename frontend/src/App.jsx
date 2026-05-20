import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import AuthPage from './pages/AuthPage';
import LazyLoadingFallback from './components/LazyLoadingFallback';
const Dashboard = lazy(() => import('./pages/Dashboard'));
const LearnerDashboard = lazy(() => import('./pages/LearnerDashboard'));
const MentorDashboard = lazy(() => import('./pages/MentorDashboard'));
const RoleGuide = lazy(() => import('./pages/RoleGuide'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const LearningPage = lazy(() => import('./pages/LearningPage'));
const ResourcesPage = lazy(() => import('./pages/ResourcesPage'));
const TeachingPage = lazy(() => import('./pages/TeachingPage'));
const ProfileSetup = lazy(() => import('./pages/ProfileSetup'));
const MentorProfilePage = lazy(() => import('./pages/MentorProfilePage'));
const MessagesPage = lazy(() => import('./pages/MessagesPage'));
const AdminOperationsPage = lazy(() => import('./pages/AdminOperationsPage'));
const WalletPage = lazy(() => import('./pages/WalletPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
import AuthModal from './components/AuthModal';
import ToastCenter from './components/ToastCenter';
import OfflineStatusBanner from './components/OfflineStatusBanner';
import { ThemeProvider } from './context/ThemeContext';
import client from './api/client';
import { createPerformanceReporter, initGlobalMonitoring } from './utils/monitoring';

const isProfileComplete = (profile) => {
  if (!profile) {
    return false;
  }
  return Boolean(
    String(profile.skills || '').trim()
    && String(profile.aboutMe || '').trim()
    && String(profile.githubUrl || '').trim()
    && String(profile.linkedinUrl || '').trim()
  );
};

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [authMode, setAuthMode] = useState(null);
  const [oauthError, setOauthError] = useState('');
  const [language, setLanguage] = useState(localStorage.getItem('language') || 'en');
  const [profile, setProfile] = useState(null);
  const [profileChecked, setProfileChecked] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [toasts, setToasts] = useState([]);
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname;
  const hideGlobalNavbar = false;
  const routeTransitionKey = `${pathname}${location.search}`;
  const routeFallback = <LazyLoadingFallback label="Loading page" />;

  useEffect(() => {
    initGlobalMonitoring();
  }, []);

  useEffect(() => {
    const stopRouteTiming = createPerformanceReporter('route.transition', {
      path: pathname,
    });

    return () => {
      stopRouteTiming();
    };
  }, [pathname]);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return undefined;
    }

    let isMounted = true;

    const registerServiceWorker = async () => {
      try {
        await navigator.serviceWorker.register('/service-worker.js', { scope: '/' });
      } catch {
        if (isMounted) {
          return;
        }
      }
    };

    if (document.readyState === 'complete') {
      registerServiceWorker();
    } else {
      window.addEventListener('load', registerServiceWorker, { once: true });
    }

    return () => {
      isMounted = false;
      window.removeEventListener('load', registerServiceWorker);
    };
  }, []);

  const isLoggedIn = useMemo(() => Boolean(token), [token]);
  const needsProfileSetup = useMemo(
    () => isLoggedIn && profileChecked && profile?.role !== 'ADMIN' && !isProfileComplete(profile),
    [isLoggedIn, profileChecked, profile]
  );

  const notify = useCallback((toast) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const normalizedToast = {
      id,
      duration: toast?.persistent ? 12000 : 4200,
      persistent: false,
      ...toast
    };
    setToasts((prev) => [...prev, normalizedToast]);
  }, []);

  const dismissToast = (id) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  };

  useEffect(() => {
    if (!token) {
      setProfile(null);
      setProfileChecked(false);
      setUnreadNotifications(0);
      return;
    }

    let isMounted = true;
    const controller = new AbortController();
    setProfileChecked(false);

    // Prevent the UI from getting stuck on "Loading your profile..." when backend is unavailable.
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 7000);

    client.get('/api/v1/users/me', { signal: controller.signal })
      .then((response) => {
        if (!isMounted) {
          return;
        }
        clearTimeout(timeoutId);
        setProfile(response.data.data);
        setProfileChecked(true);
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }
        clearTimeout(timeoutId);
        localStorage.removeItem('token');
        setToken(null);
        setProfile(null);
        setProfileChecked(false);
        notify({
          type: 'warning',
          title: 'Session ended',
          message: 'Please sign in again. If backend is down, start it on port 8080.'
        });
        navigate('/home', { replace: true });
      });

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [token, navigate, notify]);

  useEffect(() => {
    if (!token) {
      return undefined;
    }

    let isMounted = true;

    const fetchUnreadCount = async () => {
      try {
        const response = await client.get('/api/v1/notifications/unread-count');
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
  }, [token]);

  useEffect(() => {
    const onOffline = () => {
      notify({
        type: 'warning',
        title: 'You are offline',
        message: 'Some actions may fail until your internet connection is restored.',
        persistent: true
      });
    };

    const onOnline = () => {
      notify({
        type: 'success',
        title: 'Connection restored',
        message: 'You are back online.'
      });
    };

    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);

    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, [notify]);

  useEffect(() => {
    if (!token) {
      return undefined;
    }

    let isMounted = true;

    const pingActivity = async () => {
      try {
        await client.post('/api/v1/users/me/ping');
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
  }, [token]);

  useEffect(() => {
    if (pathname !== '/oauth/callback') {
      return;
    }

    const params = new URLSearchParams(location.search);
    const oauthToken = params.get('token');
    if (oauthToken) {
      localStorage.setItem('token', oauthToken);
      setToken(oauthToken);
      setAuthMode(null);
      setOauthError('');
      const post = localStorage.getItem('auth_post_redirect');
      if (post) {
        localStorage.removeItem('auth_post_redirect');
        navigate(post, { replace: true });
      } else {
        navigate('/home', { replace: true });
      }
      return;
    }

    setOauthError('OAuth login failed. Please try again.');
    setAuthMode('login');
    navigate('/login', { replace: true });
  }, [pathname, location.search, navigate]);

  useEffect(() => {
    if (pathname === '/login') {
      setAuthMode('login');
      return;
    }
    if (pathname === '/signup') {
      setAuthMode('signup');
      return;
    }
    setAuthMode(null);
  }, [pathname]);

  useEffect(() => {
    if (!isLoggedIn) {
      const publicPaths = ['/', '/home', '/login', '/signup'];
      const isPublicMentorProfile = pathname.startsWith('/mentors/');
      if (!publicPaths.includes(pathname) && !isPublicMentorProfile) {
        navigate('/home', { replace: true });
      }
      return;
    }

    if (!profileChecked) {
      return;
    }

    if (!needsProfileSetup && (pathname === '/' || pathname === '/login' || pathname === '/signup')) {
      navigate('/home', { replace: true });
    }
  }, [isLoggedIn, needsProfileSetup, pathname, profileChecked, navigate]);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: prefersReducedMotion ? 'auto' : 'smooth'
    });
  }, [pathname]);

  useEffect(() => {
    const focusTarget = document.getElementById('route-content');
    if (focusTarget) {
      focusTarget.focus();
    }
  }, [pathname]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setProfile(null);
    setProfileChecked(false);
    notify({ type: 'info', title: 'Logged out', message: 'You have been signed out successfully.' });
    navigate('/home', { replace: true });
  };

  const handleSelectAuthMode = (mode) => {
    setOauthError('');
    setAuthMode(mode);
    navigate(mode === 'login' ? '/login' : '/signup');
  };

  const handleLanguageChange = (value) => {
    localStorage.setItem('language', value);
    setLanguage(value);
  };

  return (
    <ThemeProvider>
      <div className="app-shell">
        <a className="skip-link" href="#route-content">Skip to main content</a>

        <OfflineStatusBanner />

        {/* Global navbar removed — using per-page bottom nav for mobile and page headers for desktop */}

      <div
        key={routeTransitionKey}
        id="route-content"
        className="route-transition"
        tabIndex={-1}
        role="main"
        aria-label="Primary content"
      >
        <Suspense fallback={routeFallback}>
        <Routes>
        {!isLoggedIn ? (
          <>
            <Route
              path="/"
              element={
                <AuthPage
                  onSelectSignup={() => handleSelectAuthMode('signup')}
                  onSelectLogin={() => handleSelectAuthMode('login')}
                  language={language}
                  onLanguageChange={handleLanguageChange}
                />
              }
            />
            <Route
              path="/home"
              element={
                <AuthPage
                  onSelectSignup={() => handleSelectAuthMode('signup')}
                  onSelectLogin={() => handleSelectAuthMode('login')}
                  language={language}
                  onLanguageChange={handleLanguageChange}
                />
              }
            />
            <Route
              path="/login"
              element={
                <AuthPage
                  onSelectSignup={() => handleSelectAuthMode('signup')}
                  onSelectLogin={() => handleSelectAuthMode('login')}
                  language={language}
                  onLanguageChange={handleLanguageChange}
                />
              }
            />
            <Route
              path="/signup"
              element={
                <AuthPage
                  onSelectSignup={() => handleSelectAuthMode('signup')}
                  onSelectLogin={() => handleSelectAuthMode('login')}
                  language={language}
                  onLanguageChange={handleLanguageChange}
                />
              }
            />
            <Route
              path="/mentors/:mentorId"
              element={
                <main>
                  <MentorProfilePage
                    isLoggedIn={false}
                    onRequireLogin={() => handleSelectAuthMode('login')}
                  />
                </main>
              }
            />
            <Route
              path="/resources"
              element={<ResourcesPage />}
            />
            <Route
              path="/teach"
              element={
                profile?.role === 'MENTOR'
                  ? <TeachingPage />
                  : <Navigate to="/sessions" replace />
              }
            />
            <Route path="*" element={<NotFoundPage isLoggedIn={false} />} />
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
                      type: 'success',
                      title: 'Profile completed',
                      message: 'You can now browse mentors and start booking sessions.'
                    });
                    navigate('/home', { replace: true });
                  }}
                  onLogout={handleLogout}
                  language={language}
                />
              }
            />
            <Route
              path="/"
              element={<Navigate to="/home" replace />}
            />
            <Route
              path="/home"
              element={
                profile?.role === 'ADMIN' ? (
                  <AdminOperationsPage notify={notify} />
                ) : profile?.role === 'MENTOR' ? (
                  <MentorDashboard profile={profile} onLogout={handleLogout} />
                ) : (
                  <LearnerDashboard profile={profile} onLogout={handleLogout} />
                )
              }
            />
            <Route
              path="/role-guide"
              element={<RoleGuide />}
            />
            <Route
              path="/sessions"
              element={<LearningPage notify={notify} />}
            />
            <Route
              path="/sessions/:roadmapId"
              element={<LearningPage notify={notify} />}
            />
            <Route
              path="/resources"
              element={<ResourcesPage />}
            />
            <Route
              path="/teach"
              element={
                profile?.role === 'MENTOR'
                  ? <TeachingPage notify={notify} />
                  : <Navigate to="/sessions" replace />
              }
            />
            <Route
              path="/mentors"
              element={
                profile?.role === 'MENTOR'
                  ? <Dashboard onLogout={handleLogout} language={language} page="mentors" notify={notify} />
                  : <LearningPage notify={notify} />
              }
            />
            <Route
              path="/mentors/:mentorId"
              element={<MentorProfilePage isLoggedIn={true} />}
            />
            <Route
              path="/wallet"
              element={
                <WalletPage profile={profile} notify={notify} />
              }
            />
            <Route
              path="/messages"
              element={
                <MessagesPage
                  profile={profile}
                  notify={notify}
                  onLogout={handleLogout}
                />
              }
            />
            <Route
              path="/admin"
              element={
                profile?.role === 'ADMIN'
                  ? <AdminOperationsPage notify={notify} />
                  : <Navigate to="/home" replace />
              }
            />
            <Route path="*" element={<NotFoundPage isLoggedIn={true} />} />
          </>
        )}
        </Routes>
        </Suspense>
      </div>

      {/* Render Authentication Modal globally when trigged */}
      {!isLoggedIn && authMode && (
        <AuthModal
          mode={authMode}
          onClose={() => {
            setAuthMode(null);
            navigate('/home');
          }}
          language={language}
          initialError={oauthError}
          notify={notify}
          onLoggedIn={(loggedMode) => {
            setToken(localStorage.getItem('token'));
            setAuthMode(null);
            setOauthError('');
            notify({
              type: 'success',
              title: loggedMode === 'signup' ? 'Account created' : 'Welcome back',
              message: 'Authentication successful. Loading your dashboard.'
            });
            const post = localStorage.getItem('auth_post_redirect');
            if (post) {
              localStorage.removeItem('auth_post_redirect');
              navigate(post, { replace: true });
            } else {
              navigate('/home', { replace: true });
            }
          }}
        />
      )}

      <ToastCenter toasts={toasts} onDismiss={dismissToast} />
      </div>
    </ThemeProvider>
  );
}
