import { useEffect, useState, useRef } from "react";
import client from "../api/client";

/**
 * Shared, deduplicated fetcher for /api/v1/public/community-stats.
 *
 * Multiple components on the landing page (AuthPage hero, CommunityStats
 * section) each need this data. Without a shared cache each mounts its own
 * independent fetch — resulting in 3 identical HTTP requests on first load.
 *
 * This hook uses module-level state so every caller shares a single in-flight
 * request and result. The TTL prevents redundant refetches within a short
 * window (default 30 s) while still allowing the data to refresh naturally.
 */

const CACHE_TTL_MS = 30_000;

// Module-level shared state (survives across component mounts/unmounts)
let sharedData = null;
let sharedError = false;
let lastFetchTime = 0;
let inflightPromise = null;

function fetchStats() {
  if (inflightPromise) return inflightPromise;

  inflightPromise = client
    .get("/api/v1/public/community-stats")
    .then((res) => {
      sharedData = res.data ?? null;
      sharedError = false;
      lastFetchTime = Date.now();
      return sharedData;
    })
    .catch(() => {
      sharedError = true;
      lastFetchTime = Date.now();
      return null;
    })
    .finally(() => {
      inflightPromise = null;
    });

  return inflightPromise;
}

/**
 * @param {{ refreshInterval?: number }} [opts]
 * @returns {{ stats: object|null, loading: boolean, error: boolean }}
 */
export default function useCommunityStats({ refreshInterval = 60_000 } = {}) {
  const [stats, setStats] = useState(sharedData);
  const [loading, setLoading] = useState(!sharedData && !sharedError);
  const [error, setError] = useState(sharedError);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Initial fetch (skipped if we already have fresh data)
  useEffect(() => {
    const isFresh = Date.now() - lastFetchTime < CACHE_TTL_MS;
    if (isFresh && sharedData) {
      setStats(sharedData);
      setLoading(false);
      setError(false);
      return;
    }

    setLoading(true);
    fetchStats().then((data) => {
      if (!mountedRef.current) return;
      setStats(data);
      setError(data === null);
      setLoading(false);
    });
  }, []);

  // Optional periodic refresh (e.g. activeUsers count)
  useEffect(() => {
    if (!refreshInterval || refreshInterval <= 0) return;

    const id = setInterval(() => {
      fetchStats().then((data) => {
        if (!mountedRef.current || !data) return;
        setStats(data);
      });
    }, refreshInterval);

    return () => clearInterval(id);
  }, [refreshInterval]);

  return { stats, loading, error };
}
