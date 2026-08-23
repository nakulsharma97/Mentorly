import { useCallback, useEffect, useRef, useState } from "react";
import client from "../api/client";

/**
 * Shared, deduplicated fetcher for /api/v1/notifications/unread-count.
 *
 * Multiple components (useAuth, NotificationCenter, WorkspaceTopbar) each
 * poll this endpoint independently — resulting in 5+ identical HTTP requests
 * every 15-30 seconds.  This hook uses module-level state so every caller
 * shares a single in-flight request and result.
 *
 * The hook exposes a single polling interval (default 15s) that all callers
 * share — only one setInterval runs regardless of how many components mount.
 */

const POLL_INTERVAL_MS = 15_000;

// Module-level shared state
let sharedCount = 0;
let lastFetchTime = 0;
let inflightPromise = null;
let intervalId = null;
let subscriberCount = 0;
let onChangeCallbacks = new Set();

function fetchCount() {
  if (inflightPromise) return inflightPromise;

  inflightPromise = client
    .get("/api/v1/notifications/unread-count")
    .then((res) => {
      const raw = res?.data?.data;
      const count = Number(raw) || 0;
      sharedCount = count;
      lastFetchTime = Date.now();
      // Notify all subscribers
      onChangeCallbacks.forEach((cb) => {
        try { cb(count); } catch { /* ignore */ }
      });
      return count;
    })
    .catch(() => {
      lastFetchTime = Date.now();
      return sharedCount;
    })
    .finally(() => {
      inflightPromise = null;
    });

  return inflightPromise;
}

function startPolling() {
  if (intervalId) return;
  intervalId = setInterval(fetchCount, POLL_INTERVAL_MS);
}

function stopPolling() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

/**
 * @param {{ onChange?: (count: number) => void }} [opts]
 * @returns {{ unreadCount: number, refresh: () => Promise<number> }}
 */
export default function useUnreadNotifications({ onChange } = {}) {
  const [count, setCount] = useState(sharedCount);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Register as subscriber
  useEffect(() => {
    subscriberCount++;
    const cb = (newCount) => {
      if (mountedRef.current) setCount(newCount);
      if (onChange) onChange(newCount);
    };
    onChangeCallbacks.add(cb);

    // Start global polling if this is the first subscriber
    if (subscriberCount === 1) startPolling();

    // Initial fetch if stale
    if (Date.now() - lastFetchTime > 5_000) {
      fetchCount();
    }

    return () => {
      onChangeCallbacks.delete(cb);
      subscriberCount--;
      if (subscriberCount <= 0) {
        subscriberCount = 0;
        stopPolling();
      }
    };
  }, [onChange]);

  const refresh = useCallback(() => fetchCount(), []);

  return { unreadCount: count, refresh };
}
