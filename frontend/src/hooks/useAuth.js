import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import client, {
  clearAuthSessionState,
  extractJwtUserId,
  getActiveAuthToken,
  onMaintenanceMode,
} from "../api/client";
import { setUnreadMessages } from "../modules/messages/unreadMessagesStore";
import { isPublicPath, roleRoot } from "../modules/common/routeUtils";
import useUnreadNotifications from "./useUnreadNotifications";
import { fetchProfile, invalidateProfileCache } from "./useProfileCache";
import {
  clearOnboardingDismissal,
  isOnboardingDismissed,
  isProfileComplete,
  PROFILE_ONBOARDING_PATH,
} from "../modules/common/profileCompletion";

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
    // Clear the unread-message badge so a previous user's count never leaks
    // into the next session (polling repopulates it with fresh data).
    setUnreadMessages(0);
  }, []);

  const syncCurrentUser = useCallback(async () => {
    const generation = ++syncGenerationRef.current;
    resetProfileState();
    const activeToken = getActiveAuthToken();
    if (!activeToken) {
      try {
        const maybeProfile = await fetchProfile();
        if (maybeProfile?.id) {
          if (generation !== syncGenerationRef.current) {
            return null;
          }
          setProfile(maybeProfile);
          setProfileChecked(true);
          return maybeProfile;
        }
      } catch (err) {
        // Only a definitive auth rejection ends the session here. The axios
        // response interceptor owns cookie/token cleanup for refresh failures
        // (single-flight, then clearAuthSessionState). Network errors / 5xx
        // are transient — clearing the refresh cookie on those would log a
        // valid user out during a backend hiccup, breaking the landing page.
        const status = Number(err?.response?.status || 0);
        if (status === 401 || status === 403) {
          clearAuthSessionState();
        }
      }
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
      const nextProfile = await fetchProfile();
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
  // Mandatory onboarding gate: mentors + learners must complete their profile
  // before any core feature is reachable. Admins are always exempt.
  // A mentor may dismiss the onboarding page for this session (Close ✕) and
  // explore their dashboard — the gate then opens up, and the dashboard
  // shows a persistent "profile incomplete" banner instead.
  const needsProfileSetup =
    isLoggedIn &&
    profileChecked &&
    profile?.role !== "ADMIN" &&
    !isProfileComplete(profile) &&
    !isOnboardingDismissed();

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

  // Unread notification polling — delegated to shared hook
  useUnreadNotifications({
    onChange: isLoggedIn ? (count) => setUnreadNotifications(count) : undefined,
  });

  // Activity ping — skip first mount, only ping every 60s
  const lastPingRef = useRef(0);
  useEffect(() => {
    if (!isLoggedIn) return undefined;

    const pingActivity = async () => {
      const now = Date.now();
      if (now - lastPingRef.current < 60_000) return; // skip if <60s since last
      try {
        await client.post("/api/v1/users/me/ping");
        lastPingRef.current = now;
      } catch {
        // ignore
      }
    };

    // Skip first mount — only start pinging after 60s
    const intervalId = setInterval(pingActivity, 15_000);
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
      // Profile not completed yet — onboarding takes priority over any
      // previously requested destination.
      if (needsProfileSetup) {
        navigate(PROFILE_ONBOARDING_PATH, { replace: true });
        return;
      }
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
  }, [isLoggedIn, location.search, navigate, pathname, profileChecked, profile?.role, needsProfileSetup]);

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
      if (pathname === "/oauth/callback" || isPublicPath(pathname)) {
        return;
      }
      // Mentor profiles require sign-in. Remember the exact destination
      // (path + query) so the login flow can return the user to the profile
      // they originally wanted instead of dropping them on a dashboard.
      if (pathname.startsWith("/mentors/")) {
        localStorage.setItem("auth_post_redirect", pathname + location.search);
        navigate("/login", { replace: true });
      } else {
        navigate("/", { replace: true });
      }
      return;
    }

    // Mandatory onboarding: while the profile is incomplete the ONLY page a
    // mentor/learner may see is /complete-profile. Even a manually typed URL
    // bounces straight back here.
    if (needsProfileSetup) {
      if (pathname !== PROFILE_ONBOARDING_PATH) {
        navigate(PROFILE_ONBOARDING_PATH, { replace: true });
      }
      return;
    }

    // Profile complete — /complete-profile now doubles as the reusable
    // "Edit Your Profile" page ("Full Profile Setup"), so it stays
    // accessible. Do NOT bounce a completed profile back to the dashboard.

    if (
      pathname === "/" ||
      pathname === "/login" ||
      pathname === "/signup"
    ) {
      // A protected page (e.g. a mentor profile) may have saved a pending
      // post-login redirect. Honor the intended destination instead of
      // bouncing the freshly logged-in user to the role dashboard. This is
      // the single consumer of the redirect for the modal-login flow.
      const pendingRedirect = localStorage.getItem("auth_post_redirect");
      // Only honor internal app paths — never a malformed/stale value.
      if (pendingRedirect && pendingRedirect.startsWith("/")) {
        localStorage.removeItem("auth_post_redirect");
        navigate(pendingRedirect, { replace: true });
      } else {
        navigate(roleRoot(profile?.role), { replace: true });
      }
    }
  }, [isLoggedIn, needsProfileSetup, pathname, location.search, profileChecked, navigate, profile]);

  const handleLogout = useCallback(async () => {
    try {
      await client.post("/api/v1/auth/logout");
    } catch {
      // Clear UI state even if server call fails
    }
    clearAuthSessionState();
    invalidateProfileCache();
    // A fresh login must re-trigger mandatory onboarding for an incomplete
    // profile — never carry the previous session's dismissal across accounts.
    clearOnboardingDismissal();
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
      // Manual auth intent (navbar / landing-page buttons) — drop any stale
      // post-login redirect so an abandoned "login to view profile" flow can
      // never hijack a later, unrelated sign-in.
      localStorage.removeItem("auth_post_redirect");
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
