import { performanceMarker } from "./performanceUtils";

const MONITORING_ENABLED = import.meta.env.VITE_ENABLE_MONITORING !== "false";
const MONITORING_ENDPOINT = String(
  import.meta.env.VITE_MONITORING_ENDPOINT || "",
).trim();
const APP_ENV = String(
  import.meta.env.VITE_APP_ENV || import.meta.env.MODE || "development",
).trim();

let listenersRegistered = false;

const safeSerializeError = (error) => ({
  name: error?.name || "Error",
  message: String(error?.message || error || "Unknown error"),
  stack: String(error?.stack || ""),
});

const dispatchMonitoringEvent = (eventName, payload) => {
  if (!MONITORING_ENABLED) {
    return;
  }

  const body = JSON.stringify({
    eventName,
    appEnv: APP_ENV,
    timestamp: new Date().toISOString(),
    ...payload,
  });

  if (
    MONITORING_ENDPOINT &&
    typeof navigator !== "undefined" &&
    navigator.sendBeacon
  ) {
    const beaconBlob = new Blob([body], { type: "application/json" });
    navigator.sendBeacon(MONITORING_ENDPOINT, beaconBlob);
    return;
  }

  if (APP_ENV === "development" && typeof console !== "undefined") {
    console.info(`[monitoring] ${eventName}`, payload);
  }
};

export const reportError = (error, context = {}) => {
  dispatchMonitoringEvent("error", {
    error: safeSerializeError(error),
    context,
  });
};

export const reportPerformance = (name, durationMs, context = {}) => {
  dispatchMonitoringEvent("performance", {
    metric: name,
    durationMs: Number.isFinite(durationMs) ? Math.round(durationMs) : 0,
    context,
  });
};

export const createPerformanceReporter = (name, context = {}) => {
  const stop = performanceMarker(name);
  return () => {
    stop();
    if (typeof window !== "undefined" && window.performance?.getEntriesByName) {
      const entries = window.performance.getEntriesByName(name);
      const latest = entries[entries.length - 1];
      if (latest) {
        reportPerformance(name, latest.duration, context);
      }
    }
  };
};

export const initGlobalMonitoring = () => {
  if (listenersRegistered || typeof window === "undefined") {
    return;
  }

  listenersRegistered = true;

  window.addEventListener("error", (event) => {
    reportError(event.error || event.message, {
      source: event.filename,
      line: event.lineno,
      column: event.colno,
      type: "window.error",
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    reportError(event.reason, {
      type: "unhandledrejection",
    });
  });
};

export default {
  reportError,
  reportPerformance,
  createPerformanceReporter,
  initGlobalMonitoring,
};
