import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

const ALLOWED_MENTOR_SORTS = new Set([
  "score",
  "skillMatch",
  "rating",
  "completion",
]);

const parseMentorScore = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(100, parsed) : 0;
};

/**
 * Custom hook for managing mentor search filters and URL synchronization
 * Handles: search query, sort order, and minimum score filter
 * Automatically syncs with URL search params
 */
export function useMentorFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize from URL params
  const initialQuery = String(searchParams.get("q") || "").trim();
  const initialSort = ALLOWED_MENTOR_SORTS.has(searchParams.get("sort"))
    ? searchParams.get("sort")
    : "score";
  const initialMinScore = parseMentorScore(searchParams.get("minScore"));

  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [mentorSortBy, setMentorSortBy] = useState(initialSort);
  const [mentorMinScore, setMentorMinScore] = useState(initialMinScore);

  // Sync local state with URL params when URL changes
  useEffect(() => {
    const nextQuery = String(searchParams.get("q") || "").trim();
    const nextSort = ALLOWED_MENTOR_SORTS.has(searchParams.get("sort"))
      ? searchParams.get("sort")
      : "score";
    const nextMinScore = parseMentorScore(searchParams.get("minScore"));

    if (nextQuery !== searchQuery) setSearchQuery(nextQuery);
    if (nextSort !== mentorSortBy) setMentorSortBy(nextSort);
    if (nextMinScore !== mentorMinScore) setMentorMinScore(nextMinScore);
  }, [searchParams, searchQuery, mentorSortBy, mentorMinScore]);

  // Sync local state changes to URL params
  useEffect(() => {
    const currentQuery = String(searchParams.get("q") || "").trim();
    const currentSort = ALLOWED_MENTOR_SORTS.has(searchParams.get("sort"))
      ? searchParams.get("sort")
      : "score";
    const currentMinScore = parseMentorScore(searchParams.get("minScore"));

    const nextQuery = String(searchQuery || "").trim();
    const nextSort = ALLOWED_MENTOR_SORTS.has(mentorSortBy)
      ? mentorSortBy
      : "score";
    const nextMinScore = parseMentorScore(mentorMinScore);

    // No changes needed
    if (
      currentQuery === nextQuery &&
      currentSort === nextSort &&
      currentMinScore === nextMinScore
    ) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);

    if (nextQuery) {
      nextParams.set("q", nextQuery);
    } else {
      nextParams.delete("q");
    }

    if (nextSort && nextSort !== "score") {
      nextParams.set("sort", nextSort);
    } else {
      nextParams.delete("sort");
    }

    if (nextMinScore > 0) {
      nextParams.set("minScore", String(nextMinScore));
    } else {
      nextParams.delete("minScore");
    }

    setSearchParams(nextParams, { replace: true });
  }, [
    mentorMinScore,
    mentorSortBy,
    searchParams,
    searchQuery,
    setSearchParams,
  ]);

  const updateQuery = useCallback((query) => {
    setSearchQuery(String(query || "").trim());
  }, []);

  const updateSort = useCallback((sort) => {
    if (ALLOWED_MENTOR_SORTS.has(sort)) {
      setMentorSortBy(sort);
    }
  }, []);

  const updateMinScore = useCallback((score) => {
    setMentorMinScore(parseMentorScore(score));
  }, []);

  const resetFilters = useCallback(() => {
    setSearchQuery("");
    setMentorSortBy("score");
    setMentorMinScore(0);
  }, []);

  return {
    searchQuery,
    mentorSortBy,
    mentorMinScore,
    updateQuery,
    updateSort,
    updateMinScore,
    resetFilters,
  };
}

export default useMentorFilters;
