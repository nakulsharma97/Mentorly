import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import client, {
  clearAuthSessionState,
  extractJwtUserId,
  getActiveAuthToken,
  onMaintenanceMode,
} from "../api/client";
import { isPublicPath, roleRoot } from "../modules/common/routeUtils";

const isProfileComplete = (profile) => {
  if (!profile) return false;
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

export function useAuthProfile({ notify }) {
  const [profile, setProfile] = useState(null);
  const [profileChecked, setProfileChecked] = useState(false);
  const [authMode, setAuthMode] = useState(null);
  const [oauthError, setOauthError] = useState("");
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname;
  // Generation counter for syncCurrentUser to prevent stale responses
  // from overwriting newer profile data after login switching.
  const syncGenerationRef = useRef(0);

  // Maintenance mode listener
  useEffect(() => {
    const unsubscribe = onMaintenanceMode(() => {
      setMaintenanceMode(true);
      notify({
        type: "warning",
        title: "Under maintenance",
        message: "The platform is currently in maintenance mode. Only admins can access the system.",
        persistent: true,
      });
    });
    return unsubscribe;
  }, [notify]);

  const resetProfileState = useCallback(() => {
    setProfile(null);
    setProfileChecked(false);
    setUnreadNotifications(0);
  }, []);

  const syncCurrentUser = useCallback(async () => {
    const generation = ++syncGenerationRef.current;
    resetProfileState();
    const activeToken = getActiveAuthToken();
    if (!activeToken) {
      try {
        const maybe = await client.get("/api/v1/users/me");
        const maybeProfile = maybe?.data?.data || null;
        if (maybeProfile?.id) {
          if (generation !== syncGenerationRef.current) {
            return null;
          }
          setProfile(maybeProfile);
          setProfileChecked(true);
          return maybeProfile;
        }
      } catch {
        // ignore
      }
      clearAuthSessionState();
      if (generation !== syncGenerationRef.current) {
        return null;
      }
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

      if (generation !== syncGenerationRef.current) {
        // A newer syncCurrentUser call started — discard this stale result
        return null;
      }
      setProfile(nextProfile);
      setProfileChecked(true);
      return nextProfile;
    } catch (err) {
      const status = Number(err?.response?.status || 0);

      // ── Auth errors (401/403): clear session and redirect to login ──
      if (status === 401 || status === 403) {
        clearAuthSessionState();
        setProfile(null);
        setProfileChecked(true);
        return null;
      }

      // ── Server errors (5xx): retry with exponential backoff ──
      // Do NOT clear auth state on server errors because the issue is
      // likely transient (e.g. LazyInitializationException, DB hiccup)
      // and the JWT is still valid. Clearing state would force a logout.
      if (status >= 500 && status < 600) {
        const maxRetries = 2;
        const baseDelay = 500;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          await new Promise(resolve => setTimeout(resolve, baseDelay * attempt));
          try {
            if (generation !== syncGenerationRef.current) {
              return null;
            }
            const retryResponse = await client.get("/api/v1/users/me");
            const retryProfile = retryResponse?.data?.data || null;
            if (retryProfile?.id) {
              const retryUserId = Number(retryProfile.id);
              if (Number.isFinite(retryUserId) && retryUserId === tokenUserId) {
                if (generation !== syncGenerationRef.current) {
                  return null;
                }
                setProfile(retryProfile);
                setProfileChecked(true);
                return retryProfile;
              }
            }
          } catch {
            // Transient failure — the retry loop will handle it.
          }
        }
        // All retries failed — don't clear auth state, just mark as checked
        // so the UI doesn't hang. The user may still navigate and retry.
        console.warn("Profile fetch failed after retries for userId=" + tokenUserId);
        setProfileChecked(true);
        return null;
      }

      // ── Try token refresh for non-5xx, non-4xx auth failures ──
      try {
        await client.post("/api/v1/auth/refresh");
        if (generation !== syncGenerationRef.current) {
          return null;
        }
        const retry = await client.get("/api/v1/users/me");
        const refreshedProfile = retry?.data?.data || null;
        if (!refreshedProfile?.id) {
          clearAuthSessionState();
          setProfile(null);
          setProfileChecked(true);
          return null;
        }
        const refreshedUserId = Number(refreshedProfile.id);
        if (!Number.isFinite(refreshedUserId) || refreshedUserId !== tokenUserId) {
          clearAuthSessionState();
          setProfile(null);
          setProfileChecked(true);
          return null;
        }
        if (generation !== syncGenerationRef.current) {
          return null;
        }
        setProfile(refreshedProfile);
        setProfileChecked(true);
        return refreshedProfile;
      } catch {
        try {
          await client.post("/api/v1/auth/logout");
        } catch {
          // ignore
        }
        clearAuthSessionState();
        setProfile(null);
        setProfileChecked(true);
        return null;
      }
    }
  }, [resetProfileState]);

  // Expose syncGenerationRef so external callers (App.jsx) can bump it
  // before triggering a new sync, ensuring stale in-flight responses
  // from the mount effect are discarded.
  const bumpSyncGeneration = useCallback(() => {
    syncGenerationRef.current += 1;
  }, []);

  const isLoggedIn = Boolean(profile);
  const needsProfileSetup =
    isLoggedIn &&
    profileChecked &&
    profile?.role !== "ADMIN" &&
    !isProfileComplete(profile);

  // Initial profile sync
  useEffect(() => {
    let isMounted = true;
    setProfileChecked(false);
    const timeoutId = window.setTimeout(() => {
      if (isMounted) setProfileChecked(true);
    }, 7000);

    syncCurrentUser().finally(() => {
      if (isMounted) window.clearTimeout(timeoutId);
    });

    return () => {
      isMounted = false;
      window.clearTimeout(timeoutId);
    };
  }, [syncCurrentUser]);

  // Unread notification polling
  useEffect(() => {
    if (!isLoggedIn) return undefined;
    let isMounted = true;

    const fetchUnreadCount = async () => {
      try {
        const response = await client.get("/api/v1/notifications/unread-count");
        if (isMounted) setUnreadNotifications(Number(response?.data?.data || 0));
      } catch {
        if (isMounted) setUnreadNotifications(0);
      }
    };

    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 15000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isLoggedIn]);

  // Activity ping
  useEffect(() => {
    if (!isLoggedIn) return undefined;

    const pingActivity = async () => {
      try {
        await client.post("/api/v1/users/me/ping");
      } catch {
        // ignore
      }
    };

    pingActivity();
    const intervalId = setInterval(pingActivity, 60000);
    return () => {
      clearInterval(intervalId);
    };
  }, [isLoggedIn]);

  // OAuth callback handling
  useEffect(() => {
    if (pathname !== "/oauth/callback") return;

    const params = new URLSearchParams(location.search);
    if (params.get("error")) {
      setOauthError("OAuth login failed. Please try again.");
      setAuthMode("login");
      navigate("/login", { replace: true });
      return;
    }

    if (!profileChecked) return;

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
  }, [isLoggedIn, location.search, navigate, pathname, profileChecked, profile?.role]);

  // Auth mode sync from URL
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

  // Route protection redirects
  useEffect(() => {
    if (!profileChecked) return;

    if (!isLoggedIn) {
      const isPublicMentorProfile = pathname.startsWith("/mentors/");
      if (pathname !== "/oauth/callback" && !isPublicPath(pathname) && !isPublicMentorProfile) {
        navigate("/", { replace: true });
      }
      return;
    }

    if (
      !needsProfileSetup &&
      (pathname === "/" ||
        pathname === "/login" ||
        pathname === "/signup" ||
        pathname === "/admin/login")
    ) {
      navigate(roleRoot(profile?.role), { replace: true });
    }
  }, [isLoggedIn, needsProfileSetup, pathname, profileChecked, navigate, profile]);

  const handleLogout = useCallback(async () => {
    try {
      await client.post("/api/v1/auth/logout");
    } catch {
      // Clear UI state even if server call fails
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
  }, [notify, navigate]);

  const handleSelectAuthMode = useCallback(
    (mode) => {
      setOauthError("");
      setAuthMode(mode);
      navigate(mode === "login" ? "/login" : "/signup");
    },
    [navigate],
  );

  return {
    profile,
    setProfile,
    profileChecked,
    setProfileChecked,
    isLoggedIn,
    needsProfileSetup,
    authMode,
    setAuthMode,
    oauthError,
    setOauthError,
    maintenanceMode,
    unreadNotifications,
    setUnreadNotifications,
    syncCurrentUser,
    bumpSyncGeneration,
    handleLogout,
    handleSelectAuthMode,
  };
}
