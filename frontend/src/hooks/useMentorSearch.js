import { useCallback, useEffect, useRef, useState } from "react";
import client from "../api/client";
import { getErrorFeedback } from "../utils/comingSoon";

/**
 * Custom hook for mentor search functionality
 * Handles: API calls, loading state, error handling, recent searches
 */
export function useMentorSearch() {
  const [mentorSearchResults, setMentorSearchResults] = useState([]);
  const [mentorSearchLoading, setMentorSearchLoading] = useState(false);
  const [mentorSearchMessage, setMentorSearchMessage] = useState("");
  const [recentSearches, setRecentSearches] = useState([]);
  const debounceRef = useRef(null);
  const resultsCacheRef = useRef(new Map());

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const runMentorSearch = useCallback((query, filters = {}, options = {}) => {
    const finalQuery = String(query || "").trim();
    const normalizedFilters =
      filters && typeof filters === "object" ? filters : {};

    const cacheKey = JSON.stringify({
      q: finalQuery,
      minPrice: normalizedFilters.priceMin,
      maxPrice: normalizedFilters.priceMax,
      rating: normalizedFilters.rating,
    });

    setMentorSearchLoading(true);
    setMentorSearchMessage("");

    if (resultsCacheRef.current.has(cacheKey)) {
      setMentorSearchResults(resultsCacheRef.current.get(cacheKey) || []);
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    return new Promise((resolve) => {
      debounceRef.current = setTimeout(async () => {
        try {
          const params = { q: finalQuery, size: 50 };
          if (Number(normalizedFilters.priceMin || 0) > 0) {
            params.minPrice = normalizedFilters.priceMin;
          }
          if (Number(normalizedFilters.priceMax || 500) < 500) {
            params.maxPrice = normalizedFilters.priceMax;
          }
          if (Number(normalizedFilters.rating || 0) > 0) {
            params.minRating = normalizedFilters.rating;
          }

          const response = await client.get("/api/v1/search/mentors", {
            params,
          });

          // Paginated response: ApiResponse<Page<MentorSearchResult>>. Unwrap
          // the ApiResponse envelope, then take .content off the Page object.
          const nextResults = response?.data?.data?.content || [];
          resultsCacheRef.current.set(cacheKey, nextResults);
          setMentorSearchResults(nextResults);

          if (!options.skipRecent && finalQuery) {
            setRecentSearches((prev) => {
              const next = [
                finalQuery,
                ...prev.filter(
                  (item) =>
                    String(item || "").toLowerCase() !==
                    finalQuery.toLowerCase(),
                ),
              ];
              return next.slice(0, 8);
            });
          }

          if (nextResults.length === 0) {
            setMentorSearchMessage(
              getErrorFeedback("mentorSearchNoMatches").message,
            );
          }

          resolve(nextResults);
        } catch (error) {
          setMentorSearchResults([]);
          setMentorSearchMessage(
            getErrorFeedback("mentorSearchFailed").message,
          );
          resolve([]);
        } finally {
          setMentorSearchLoading(false);
        }
      }, 300);
    });
  }, []);

  const clearSearch = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    setMentorSearchResults([]);
    setMentorSearchMessage("");
    setMentorSearchLoading(false);
  }, []);

  const clearRecentSearches = useCallback(() => {
    setRecentSearches([]);
  }, []);

  return {
    mentorSearchResults,
    mentorSearchLoading,
    mentorSearchMessage,
    recentSearches,
    runMentorSearch,
    setMentorSearchMessage,
    setMentorSearchResults,
    clearSearch,
    clearRecentSearches,
  };
}

export default useMentorSearch;
