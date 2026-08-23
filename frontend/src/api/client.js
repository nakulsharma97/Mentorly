import axios from "axios";
import * as Sentry from "@sentry/react";
import { reportError, reportPerformance } from "../utils/monitoring";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

// ── Maintenance Mode Event System ──
const MAINTENANCE_EVENT = "skillswap:maintenance-mode";

/**
 * Subscribe to maintenance mode activation events.
 * Returns an unsubscribe function.
 */
export function onMaintenanceMode(callback) {
  const handler = () => callback();
  window.addEventListener(MAINTENANCE_EVENT, handler);
  return () => window.removeEventListener(MAINTENANCE_EVENT, handler);
}

/**
 * Programmatically trigger maintenance mode (used when filter blocks a request).
 */
function triggerMaintenanceMode() {
  window.dispatchEvent(new CustomEvent(MAINTENANCE_EVENT));
}

const client = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

let activeAuthToken = null;

// One-time migration: sessions created before the token-hardening change may
// have the refresh token sitting in web storage where XSS could read it. The
// refresh token now lives only in the httpOnly refresh_token cookie, so purge
// any legacy copy immediately on app load — even before the user logs out.
if (typeof window !== "undefined") {
  try {
    window.localStorage.removeItem("refreshToken");
    window.sessionStorage.removeItem("refreshToken");
  } catch {
    // ignore storage access errors (e.g. privacy modes)
  }
}

function readCookie(name) {
  if (typeof document === "undefined") {
    return null;
  }
  const encodedName = `${encodeURIComponent(name)}=`;
  const found = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(encodedName));
  if (!found) {
    return null;
  }
  return decodeURIComponent(found.substring(encodedName.length));
}

function readStoredCookieAuthToken() {
  return readCookie("access_token") || readCookie("accessToken") || null;
}

function readStoredAuthToken() {
  if (typeof window === "undefined") {
    return null;
  }
  return (
    window.localStorage.getItem("token") ||
    window.sessionStorage.getItem("token")
  );
}

function applyAuthHeader(token) {
  if (!token) {
    delete client.defaults.headers.common.Authorization;
    return;
  }
  client.defaults.headers.common.Authorization = `Bearer ${token}`;
}

function clearBrowserAuthCookies() {
  if (typeof document === "undefined") {
    return;
  }
  // HttpOnly cookies set by the server can't always be reliably cleared from JavaScript
  // because document.cookie may not overwrite cookies with the HttpOnly flag in some
  // browsers. We try multiple variants to maximize the chance, but the server-side
  // Set-Cookie in the logout response is the authoritative clearing mechanism.
  const cookieNames = ["access_token", "refresh_token", "accessToken", "refreshToken"];
  const domain = window.location.hostname;
  cookieNames.forEach((name) => {
    // Non-secure, SameSite=Lax (dev environment)
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
    // Secure, SameSite=None (production environment)
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=None; Secure`;
    // No SameSite (fallback)
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    // With explicit domain (for subdomain-scoped cookies)
    if (domain && domain !== "localhost") {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${domain}; SameSite=Lax`;
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${domain}; SameSite=None; Secure`;
    }
  });
}

function clearBrowserAuthCaches() {
  if (typeof window === "undefined" || !("caches" in window)) {
    return;
  }
  window.caches
    .keys()
    .then((cacheNames) => {
      cacheNames.forEach((cacheName) => window.caches.delete(cacheName));
    })
    .catch(() => undefined);
}

export function setAuthToken(token) {
  activeAuthToken = token || null;
  if (token) {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("token", token);
      window.sessionStorage.setItem("token", token);
    }
    applyAuthHeader(token);
    return;
  }
  if (typeof window !== "undefined") {
    window.localStorage.removeItem("token");
    window.sessionStorage.removeItem("token");
  }
  applyAuthHeader(null);
}

export function clearAuthSessionState(options = {}) {
  const { preserveCookies = false } = options;
  if (typeof window !== "undefined") {
    const preservedLanguage = window.localStorage.getItem("language");
    const preservedTheme = window.localStorage.getItem("theme-preference");
    // Only clear auth-related keys instead of wiping all of localStorage
    const authKeys = ["token", "refreshToken", "user", "currentUser"];
    authKeys.forEach((key) => {
      window.localStorage.removeItem(key);
      window.sessionStorage.removeItem(key);
    });
    if (preservedLanguage) {
      window.localStorage.setItem("language", preservedLanguage);
    }
    if (preservedTheme) {
      window.localStorage.setItem("theme-preference", preservedTheme);
    }
  }
  activeAuthToken = null;
  applyAuthHeader(null);
  if (!preserveCookies) {
    clearBrowserAuthCookies();
  }
  clearBrowserAuthCaches();
}

export function resolveAuthResponsePayload(payload) {
  const visit = (value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }

    if (
      value?.token ||
      value?.accessToken ||
      value?.jwt ||
      value?.refreshToken ||
      value?.email ||
      value?.role
    ) {
      return value;
    }

    for (const candidate of [value?.data, value?.payload, value?.result]) {
      const nestedValue = visit(candidate);
      if (nestedValue) {
        return nestedValue;
      }
    }

    return null;
  };

  return visit(payload);
}

export function persistAuthSession(authResponse) {
  // The refresh token is intentionally NEVER written to localStorage or
  // sessionStorage. It lives ONLY in the httpOnly refresh_token cookie set by
  // the server (AuthCookieService), so JavaScript — and therefore XSS — cannot
  // read it. The access token is still stored because it is short-lived and
  // needed to attach the Authorization header on page reload.
  const cookieTokenBeforeClear = readStoredCookieAuthToken();

  clearAuthSessionState({ preserveCookies: true });

  const normalizedAuthResponse = resolveAuthResponsePayload(authResponse);

  // DEV: Log the parsed values to debug token resolution.
  // Tree-shaken in production builds via Vite's process.env.NODE_ENV replacement.
  if (process.env.NODE_ENV === 'development') {
    console.debug("[auth] cookieTokenBeforeClear", cookieTokenBeforeClear);
    console.debug("[auth] normalizedAuthResponse", normalizedAuthResponse);
  }

  const nextToken =
    normalizedAuthResponse?.token ||
    normalizedAuthResponse?.accessToken ||
    normalizedAuthResponse?.jwt ||
    cookieTokenBeforeClear ||
    null;
  const nextEmail =
    normalizedAuthResponse?.email ||
    normalizedAuthResponse?.user?.email ||
    null;
  const nextRole =
    normalizedAuthResponse?.role || normalizedAuthResponse?.user?.role || null;

  // DEV: Log what tokens were resolved before persisting.
  // Tree-shaken in production builds via Vite's process.env.NODE_ENV replacement.
  if (process.env.NODE_ENV === 'development') {
    console.debug("[auth] nextToken", nextToken);
    console.debug("[auth] nextEmail", nextEmail);
    console.debug("[auth] nextRole", nextRole);
  }

  if (nextToken) {
    setAuthToken(nextToken);
  }

  if (typeof window !== "undefined") {
    if (nextEmail) {
      window.localStorage.setItem("user", nextEmail);
      window.sessionStorage.setItem("user", nextEmail);
    }
    if (nextRole) {
      const currentUserData = { email: nextEmail, role: nextRole };
      window.localStorage.setItem(
        "currentUser",
        JSON.stringify(currentUserData),
      );
      window.sessionStorage.setItem(
        "currentUser",
        JSON.stringify(currentUserData),
      );
    }
  }

  return nextToken;
}

export function getActiveAuthToken() {
  const storedToken = activeAuthToken || readStoredAuthToken();
  if (!storedToken) {
    return null;
  }

  const payload = decodeJwtPayload(storedToken);
  if (!payload?.exp) {
    return storedToken;
  }

  const expiryMs = Number(payload.exp) * 1000;
  if (Number.isFinite(expiryMs) && Date.now() >= expiryMs) {
    // Expired access token — return null WITHOUT clearing the session.
    //
    // The old behavior called clearAuthSessionState() here, which also wiped
    // the httpOnly refresh_token cookie. Every request (incl. the mount-time
    // /users/me check) then hit 401, and the response interceptor's refresh
    // call found NO refresh cookie -> backend returned 400 "Refresh token is
    // required" -> the user was force-logged-out on every token expiry and on
    // every page refresh. By leaving the session intact, the 401 handler can
    // refresh transparently using the still-present refresh cookie.
    return null;
  }

  return storedToken;
}

export function decodeJwtPayload(token) {
  if (!token) {
    return null;
  }

  const segments = String(token).split(".");
  if (segments.length < 2) {
    return null;
  }

  try {
    const payload = segments[1].replace(/-/g, "+").replace(/_/g, "/");
    const normalized = payload.padEnd(Math.ceil(payload.length / 4) * 4, "=");
    return JSON.parse(window.atob(normalized));
  } catch {
    return null;
  }
}

export function extractJwtUserId(token) {
  const payload = decodeJwtPayload(token);
  if (!payload) {
    return null;
  }

  const rawUserId = payload.userId ?? payload.sub;
  if (rawUserId == null) {
    return null;
  }

  const parsed = Number(rawUserId);
  return Number.isFinite(parsed) ? parsed : null;
}

let idempotencySeed = 0;

export function createIdempotencyKey(prefix = "req") {
  idempotencySeed += 1;
  return `${prefix}-${Date.now()}-${idempotencySeed}`;
}

// ── GET-request deduplication cache ──────────────────────────────────────
const GET_DEDUP_TTL_MS = 5_000;
const _getCache = new Map();
const _getInflight = new Map();

/**
 * Clear the GET dedup cache. Call on logout or when auth state changes.
 */
export function clearGetCache() {
  _getCache.clear();
  _getInflight.clear();
}

client.interceptors.request.use((config) => {
  config.headers = config.headers || {};
  config.metadata = {
    startedAt: performance?.now ? performance.now() : Date.now(),
  };

  const requestMethod = String(config.method || "get").toUpperCase();

  const authToken = getActiveAuthToken();
  if (authToken && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }

  // GET dedup: reuse cached result or piggyback on in-flight request
  if (requestMethod === "GET" && !config.__dedupAdapterSet) {
    const cacheKey = String(config.url || "");
    const cached = _getCache.get(cacheKey);
    if (cached && Date.now() < cached.expiry) {
      config.__dedupAdapterSet = true;
      config.adapter = () =>
        Promise.resolve({ data: cached.data, status: 200, statusText: "OK", headers: {}, config });
      return config;
    }
    if (_getInflight.has(cacheKey)) {
      config.__dedupAdapterSet = true;
      config.adapter = () => _getInflight.get(cacheKey);
      return config;
    }
    // Register inflight: wrap the real adapter so a concurrent caller
    // can piggyback on this exact HTTP request.
    let resolveInflight, rejectInflight;
    const inflightPromise = new Promise((resolve, reject) => {
      resolveInflight = resolve;
      rejectInflight = reject;
    });
    _getInflight.set(cacheKey, inflightPromise);
    const realAdapter = config.adapter;
    config.adapter = async (cfg) => {
      try {
        const response = realAdapter
          ? await realAdapter(cfg)
          : await axios.defaults.adapter(cfg);
        resolveInflight(response);
        return response;
      } catch (err) {
        rejectInflight(err);
        _getInflight.delete(cacheKey);
        throw err;
      }
    };
    config.__dedupAdapterSet = true;
    return config;
  }

  if (
    (requestMethod === "POST" || requestMethod === "PATCH" || requestMethod === "PUT") &&
    !config.headers["Idempotency-Key"]
  ) {
    const route = String(config.url || "api").replace(/[^a-zA-Z0-9]+/g, "-");
    config.headers["Idempotency-Key"] = createIdempotencyKey(route);
  }
  return config;
});

const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

// Single-flight lock for the 401 refresh flow: when several requests fail
// with 401 at once, they share ONE /auth/refresh call instead of firing N
// concurrent refreshes (which could race the backend's single-use rotation
// and spuriously log the user out).
let activeRefreshPromise = null;

client.interceptors.response.use(
  (response) => {
    const startedAt = response?.config?.metadata?.startedAt;
    if (Number.isFinite(startedAt)) {
      const durationMs =
        (performance?.now ? performance.now() : Date.now()) - startedAt;
      reportPerformance("api.request", durationMs, {
        method: String(response?.config?.method || "get").toUpperCase(),
        url: String(response?.config?.url || ""),
        status: Number(response?.status || 0),
      });
    }
    // Populate the GET dedup cache on success
    if (String(response?.config?.method || "get").toUpperCase() === "GET") {
      const cacheKey = String(response?.config?.url || "");
      _getCache.set(cacheKey, { data: response.data, expiry: Date.now() + GET_DEDUP_TTL_MS });
      _getInflight.delete(cacheKey);
    }
    return response;
  },
  async (error) => {
    const config = error?.config || {};
    const method = String(config.method || "get").toUpperCase();
    const status = Number(error?.response?.status || 0);
    const isNetworkError = !error?.response;
    const retryCount = Number(config.__retryCount || 0);

    // Clear inflight dedup on non-retryable errors
    if (method === "GET" && status !== 401) {
      _getInflight.delete(String(config.url || ""));
    }

    const startedAt = config.metadata?.startedAt;
    if (Number.isFinite(startedAt)) {
      const durationMs =
        (performance?.now ? performance.now() : Date.now()) - startedAt;
      reportPerformance("api.request.failed", durationMs, {
        method,
        url: String(config.url || ""),
        status,
      });
    }

    reportError(error, {
      type: "api.request",
      method,
      url: String(config.url || ""),
      status,
      retryCount,
    });
    Sentry.captureException(error, {
      extra: { url: config.url, method, status },
    });

    if (
      status === 401 &&
      !config.__isRetry &&
      !String(config.url || "").includes("/api/v1/auth/refresh") &&
      !String(config.url || "").includes("/api/v1/auth/login") &&
      !String(config.url || "").includes("/api/v1/auth/signup")
    ) {
      try {
        if (!activeRefreshPromise) {
          activeRefreshPromise = axios
            .post(`${API_BASE_URL}/api/v1/auth/refresh`, null, {
              withCredentials: true,
              headers: { "Content-Type": "application/json" },
            })
            .finally(() => {
              activeRefreshPromise = null;
            });
        }
        const refreshResponse = await activeRefreshPromise;

        // Extract and persist the new token from the refresh response body.
        // Without this, the retried request would still have the old expired token
        // in config.headers.Authorization (set by the request interceptor), causing
        // another 401 and an infinite retry loop.
        const refreshData = resolveAuthResponsePayload(refreshResponse?.data);
        const newToken = refreshData?.token || refreshData?.accessToken || refreshData?.jwt || null;
        if (newToken) {
          setAuthToken(newToken);
        }

        // Remove the expired Authorization header from the retry config so the
        // request interceptor picks up the newly stored token.
        const retryHeaders = { ...(config.headers || {}) };
        delete retryHeaders.Authorization;

        const retryConfig = {
          ...config,
          __isRetry: true,
          headers: retryHeaders,
        };
        return client(retryConfig);
      } catch (refreshError) {
        // Refresh failed — clear all auth state so the user sees the login screen.
        clearAuthSessionState();
        return Promise.reject(refreshError);
      }
    }

    // Detect maintenance mode (503 from MaintenanceModeFilter)
    if (status === 503 && error?.response?.data?.data?.code === "MAINTENANCE_MODE") {
      triggerMaintenanceMode();
      return Promise.reject(error);
    }

    if (method !== "GET") {
      return Promise.reject(error);
    }

    if (!isNetworkError && !RETRYABLE_STATUSES.has(status)) {
      return Promise.reject(error);
    }

    if (retryCount >= 2) {
      return Promise.reject(error);
    }

    config.__retryCount = retryCount + 1;
    // Preserve the dedup adapter through retries so it isn't lost
    const prevAdapter = config.adapter;
    const delayMs = 250 * config.__retryCount;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    if (prevAdapter) config.adapter = prevAdapter;
    return client(config);
  },
);

// ── OTP Verification API ──

/**
 * Send OTP for email verification during signup.
 * Does NOT create the account yet.
 */
export async function sendVerificationOtp({ email, fullName, username, password, role, walletAddress }) {
  const response = await client.post("/api/v1/auth/send-verification-otp", {
    email,
    fullName,
    username,
    password,
    role,
    walletAddress,
  });
  return response.data;
}

/**
 * Verify OTP and complete account creation.
 */
export async function verifyEmailAndSignup({ email, otp, fullName, username, password, role, walletAddress }) {
  const response = await client.post("/api/v1/auth/verify-email", {
    email,
    otp,
    fullName,
    username,
    password,
    role,
    walletAddress,
  });
  return response.data;
}

/**
 * Resend OTP for email verification.
 */
export async function resendVerificationOtp(email) {
  const response = await client.post("/api/v1/auth/resend-verification-otp", {
    email,
  });
  return response.data;
}

export default client;
