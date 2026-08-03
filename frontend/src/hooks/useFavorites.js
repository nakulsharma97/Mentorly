import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import client from "../api/client";
import { getApiErrorMessage } from "../utils/apiErrors";

/**
 * Normalizes a favorite mentor id out of the many shapes the API has returned
 * over time: DTO ({ mentorId }), legacy entity ({ mentor: { id } }),
 * or raw ({ id }).
 */
function extractMentorId(item) {
  return (
    item?.mentorId ??
    item?.mentor?.id ??
    item?.id ??
    null
  );
}

/**
 * React state manager for the learner's favorite mentors.
 *
 * Features:
 *  - Single fetch of the favorites list on mount (and on explicit refresh()).
 *  - Optimistic toggle: the heart updates immediately, rolls back if the API
 *    call fails, and shows a single deduped error toast.
 *  - Per-mentor pending set so rapid double-clicks are ignored while a request
 *    is in flight (no duplicate API calls, no duplicate favorites).
 *  - `favoriteIds` is derived from the fetched list; components should prefer
 *    `isFavorite(id)` / `pendingIds.has(id)` for rendering.
 */
export function useFavorites({ notify } = {}) {
  const [favorites, setFavorites] = useState([]);
  const [pendingIds, setPendingIds] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const notifyRef = useRef(notify);
  notifyRef.current = notify;

  const refresh = useCallback(async () => {
    try {
      const response = await client.get("/api/v1/favorites");
      const list = response?.data?.data ?? response?.data ?? [];
      setFavorites(Array.isArray(list) ? list : []);
    } catch {
      // Non-fatal: keep the last known list. Individual toggles surface their
      // own errors; a failed list fetch should never take the page down.
      setFavorites((current) => current);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const favoriteIds = useMemo(
    () =>
      new Set(
        favorites
          .map(extractMentorId)
          .filter((id) => id != null),
      ),
    [favorites],
  );

  const isFavorite = useCallback(
    (mentorId) => favoriteIds.has(mentorId),
    [favoriteIds],
  );

  const isPending = useCallback(
    (mentorId) => pendingIds.has(mentorId),
    [pendingIds],
  );

  /**
   * Optimistically toggles a mentor in/out of favorites.
   * Returns the new favorited state (true = now favorited) or throws the
   * original error so callers can decide how loudly to react.
   */
  const toggleFavorite = useCallback(
    async (mentorId) => {
      if (mentorId == null || pendingIds.has(mentorId)) {
        return favoriteIds.has(mentorId);
      }

      const wasFavorite = favoriteIds.has(mentorId);
      const nextState = !wasFavorite;

      // Optimistic UI update.
      setFavorites((current) => {
        if (nextState) {
          if (current.some((item) => extractMentorId(item) === mentorId)) {
            return current;
          }
          // Optimistically append a lightweight placeholder; a subsequent
          // refresh() will replace it with the full server DTO.
          return [...current, { mentorId }];
        }
        return current.filter((item) => extractMentorId(item) !== mentorId);
      });
      setPendingIds((current) => new Set(current).add(mentorId));

      try {
        if (wasFavorite) {
          await client.delete(`/api/v1/favorites/${mentorId}`);
        } else {
          await client.post(`/api/v1/favorites/${mentorId}`);
        }
        // Re-sync with the server so the list holds real DTOs (ratings,
        // prices, etc.) and any other tabs stay consistent.
        await refresh();
        return nextState;
      } catch (err) {
        // Roll back the optimistic update.
        setFavorites((current) => {
          if (wasFavorite) {
            if (current.some((item) => extractMentorId(item) === mentorId)) {
              return current;
            }
            return [...current, { mentorId }];
          }
          return current.filter((item) => extractMentorId(item) !== mentorId);
        });

        const status = Number(err?.response?.status || 0);
        const reason = getApiErrorMessage(err, "Could not update favorites");
        if (status === 401 || status === 403) {
          notifyRef.current?.({
            type: "error",
            title: "Sign in required",
            message: "Please sign in to manage your favorite mentors.",
          });
        } else {
          notifyRef.current?.({
            type: "error",
            title: wasFavorite
              ? "Could not remove favorite"
              : "Could not add favorite",
            message: reason,
          });
        }
        throw err;
      } finally {
        setPendingIds((current) => {
          const next = new Set(current);
          next.delete(mentorId);
          return next;
        });
      }
    },
    [favoriteIds, pendingIds, refresh],
  );

  return {
    favorites,
    favoriteIds,
    loading,
    isFavorite,
    isPending,
    toggleFavorite,
    refresh,
  };
}
