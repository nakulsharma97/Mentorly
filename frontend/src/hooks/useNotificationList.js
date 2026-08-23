import { useCallback, useEffect, useRef, useState } from "react";
import client from "../api/client";

/**
 * Shared, deduplicated fetcher for the full notification list.
 *
 * Without this, each NotificationCenter instance (dropdown in WorkspaceTopbar
 * + full-page on notification pages) fires its own independent fetch to
 * /api/v1/notifications — resulting in 2-4x duplicate requests.
 *
 * This module caches the full notification list at the module level with a
 * short TTL. Multiple components share a single in-flight request and result.
 */

const CACHE_TTL_MS = 8_000;

// Module-level shared state
let sharedNotifications = null;
let sharedTotalCount = 0;
let lastFetchTime = 0;
let inflightPromise = null;
let onChangeCallbacks = new Set();

function fetchList({ page = 0, size = 20, unreadOnly = false, append = false } = {}) {

  // For the initial (non-append) request with the same params, return cached data if fresh
  if (!append && sharedNotifications && Date.now() - lastFetchTime < CACHE_TTL_MS) {
    if (inflightPromise) return inflightPromise;
    return Promise.resolve({ items: sharedNotifications, total: sharedTotalCount });
  }

  if (inflightPromise && !append) return inflightPromise;

  inflightPromise = client
    .get("/api/v1/notifications", {
      params: { page, size, unreadOnly },
    })
    .then((res) => {
      const raw = res?.data;
      const result = raw && typeof raw === "object" && "data" in raw ? raw.data : raw;
      const items = result?.content || result || [];
      const total = result?.totalElements || items.length;

      if (append && sharedNotifications) {
        sharedNotifications = [...sharedNotifications, ...items];
      } else {
        sharedNotifications = items;
      }
      sharedTotalCount = total;
      lastFetchTime = Date.now();

      // Notify all subscribers
      onChangeCallbacks.forEach((cb) => {
        try {
          cb({ notifications: sharedNotifications, total: sharedTotalCount });
        } catch { /* ignore */ }
      });

      return { items: sharedNotifications, total: sharedTotalCount };
    })
    .catch(() => {
      lastFetchTime = Date.now();
      return { items: sharedNotifications || [], total: sharedTotalCount };
    })
    .finally(() => {
      inflightPromise = null;
    });

  return inflightPromise;
}

/**
 * Shared hook for the full notification list. Multiple callers share a single
 * polling loop and fetch result.
 *
 * @param {{ fullPage?: boolean, filter?: string }} opts
 * @returns {{ notifications: Array, totalCount: number, loading: boolean, error: string|null, fetchNotifications: Function }}
 */
export default function useNotificationList({ filter = "all" } = {}) {
  const [notifications, setNotifications] = useState(sharedNotifications || []);
  const [totalCount, setTotalCount] = useState(sharedTotalCount);
  const [loading, setLoading] = useState(!sharedNotifications);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Register as subscriber
  useEffect(() => {
    const cb = ({ notifications: items, total }) => {
      if (mountedRef.current) {
        setNotifications(items);
        setTotalCount(total);
      }
    };
    onChangeCallbacks.add(cb);

    // Initial fetch if stale
    const isStale = Date.now() - lastFetchTime > CACHE_TTL_MS;
    if (isStale || !sharedNotifications) {
      setLoading(true);
      fetchList({
        page: 0,
        size: 20,
        unreadOnly: filter === "unread",
      }).then(({ items, total }) => {
        if (!mountedRef.current) return;
        setNotifications(items);
        setTotalCount(total);
        setLoading(false);
      }).catch(() => {
        if (mountedRef.current) {
          setError("Failed to load notifications.");
          setLoading(false);
        }
      });
    }

    return () => {
      onChangeCallbacks.delete(cb);
    };
  }, [filter]);

  const fetchNotifications = useCallback(async ({ page = 0, size = 20, unreadOnly = false, append = false } = {}) => {
    try {
      if (!append) setLoading(true);
      setError(null);
      const { items, total } = await fetchList({ page, size, unreadOnly, append });
      if (mountedRef.current) {
        setNotifications(items);
        setTotalCount(total);
      }
      return { items, total };
    } catch (err) {
      if (mountedRef.current) {
        setError(err?.message || "Failed to load notifications.");
      }
      return { items: sharedNotifications || [], total: sharedTotalCount };
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  /** Mark a single notification as read (optimistic). */
  const markRead = useCallback(async (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    try {
      await client.patch(`/api/v1/notifications/${id}/read`);
    } catch {
      // rollback — refetch
      fetchList({ page: 0, unreadOnly: filter === "unread" });
    }
  }, [filter]);

  /** Mark all notifications as read (optimistic). */
  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setTotalCount(0);
    try {
      await client.patch("/api/v1/notifications/read-all");
    } catch (err) {
      fetchList({ page: 0, unreadOnly: filter === "unread" });
      throw err;
    }
  }, [filter]);

  return {
    notifications,
    totalCount,
    loading,
    error,
    fetchNotifications,
    markRead,
    markAllRead,
  };
}
