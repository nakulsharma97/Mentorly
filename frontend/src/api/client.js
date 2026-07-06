import axios from "axios";
import * as Sentry from "@sentry/react";
import { reportError, reportPerformance } from "../utils/monitoring";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

const client = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

const AUTH_STORAGE_KEYS = [
  "token",
  "refreshToken",
  "user",
  "profile",
  "currentUser",
  "mentorProfile",
  "learnerProfile",
  "auth_cache",
  "auth_session",
];

let activeAuthToken = null;

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
  ["access_token", "refresh_token"].forEach((name) => {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
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
    window.localStorage.clear();
    window.sessionStorage.clear();
    if (preservedLanguage) {
      window.localStorage.setItem("language", preservedLanguage);
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
  const cookieTokenBeforeClear = readStoredCookieAuthToken();
  const cookieRefreshTokenBeforeClear =
    readCookie("refresh_token") || readCookie("refreshToken") || null;

  clearAuthSessionState({ preserveCookies: true });

  const normalizedAuthResponse = resolveAuthResponsePayload(authResponse);

  // DEBUG: Log the parsed values so we can see why tokens may be missing.
  try {
    console.info("[auth] cookieTokenBeforeClear", cookieTokenBeforeClear);
    console.info(
      "[auth] cookieRefreshTokenBeforeClear",
      cookieRefreshTokenBeforeClear,
    );
    console.info("[auth] normalizedAuthResponse", normalizedAuthResponse);
  } catch (e) {
    /* ignore logging failures in non-browser envs */
  }

  const nextToken =
    normalizedAuthResponse?.token ||
    normalizedAuthResponse?.accessToken ||
    normalizedAuthResponse?.jwt ||
    cookieTokenBeforeClear ||
    null;
  const nextRefreshToken =
    normalizedAuthResponse?.refreshToken ||
    normalizedAuthResponse?.refresh_token ||
    cookieRefreshTokenBeforeClear ||
    null;
  const nextEmail =
    normalizedAuthResponse?.email ||
    normalizedAuthResponse?.user?.email ||
    null;
  const nextRole =
    normalizedAuthResponse?.role || normalizedAuthResponse?.user?.role || null;

  // DEBUG: Log what tokens were resolved before persisting
  try {
    console.info("[auth] nextToken", nextToken);
    console.info("[auth] nextRefreshToken", nextRefreshToken);
    console.info("[auth] nextEmail", nextEmail);
    console.info("[auth] nextRole", nextRole);
  } catch (e) {
    /* ignore */
  }

  if (nextToken) {
    setAuthToken(nextToken);
  }

  if (typeof window !== "undefined") {
    if (nextRefreshToken) {
      window.localStorage.setItem("refreshToken", nextRefreshToken);
      window.sessionStorage.setItem("refreshToken", nextRefreshToken);
    }
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
    clearAuthSessionState();
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

client.interceptors.request.use((config) => {
  config.headers = config.headers || {};
  config.metadata = {
    startedAt: performance?.now ? performance.now() : Date.now(),
  };

  const method = String(config.method || "get").toUpperCase();
  if (!["GET", "HEAD", "OPTIONS", "TRACE"].includes(method)) {
    const csrfToken = readCookie("XSRF-TOKEN");
    if (csrfToken && !config.headers["X-XSRF-TOKEN"]) {
      config.headers["X-XSRF-TOKEN"] = csrfToken;
    }
  }

  const authToken = getActiveAuthToken();
  if (authToken && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }

  if (
    (method === "POST" || method === "PATCH" || method === "PUT") &&
    !config.headers["Idempotency-Key"]
  ) {
    const route = String(config.url || "api").replace(/[^a-zA-Z0-9]+/g, "-");
    config.headers["Idempotency-Key"] = createIdempotencyKey(route);
  }
  return config;
});

const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

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
    return response;
  },
  async (error) => {
    const config = error?.config || {};
    const method = String(config.method || "get").toUpperCase();
    const status = Number(error?.response?.status || 0);
    const isNetworkError = !error?.response;
    const retryCount = Number(config.__retryCount || 0);

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
        clearAuthSessionState();
        await axios.post(`${API_BASE_URL}/api/v1/auth/refresh`, null, {
          withCredentials: true,
          headers: { "Content-Type": "application/json" },
        });
        const retryConfig = {
          ...config,
          __isRetry: true,
          headers: {
            ...(config.headers || {}),
          },
        };
        return client(retryConfig);
      } catch {
        return Promise.reject(error);
      }
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
    const delayMs = 250 * config.__retryCount;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return client(config);
  },
);

export default client;
