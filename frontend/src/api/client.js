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
