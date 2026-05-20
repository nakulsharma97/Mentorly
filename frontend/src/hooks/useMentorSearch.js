import { useCallback, useState } from "react";
import client from "../api/client";
import { getErrorFeedback, getInfoFeedback } from "../utils/comingSoon";

/**
 * Custom hook for mentor search functionality
 * Handles: API calls, loading state, error handling, recent searches
 */
export function useMentorSearch() {
  const [mentorSearchResults, setMentorSearchResults] = useState([]);
  const [mentorSearchLoading, setMentorSearchLoading] = useState(false);
  const [mentorSearchMessage, setMentorSearchMessage] = useState("");
  const [recentSearches, setRecentSearches] = useState([]);

  const runMentorSearch = useCallback(async (query, options = {}) => {
    const finalQuery = String(query || "").trim();

    setMentorSearchLoading(true);
    setMentorSearchMessage("");

    try {
      const response = await client.get("/api/v1/search/mentors", {
        params: { q: finalQuery, limit: 100 },
      });

      setMentorSearchResults(response.data.data || []);

      // Add to recent searches if not skipped
      if (!options.skipRecent && finalQuery) {
        setRecentSearches((prev) => {
          const next = [
            finalQuery,
            ...prev.filter(
              (item) =>
                String(item || "").toLowerCase() !== finalQuery.toLowerCase(),
            ),
          ];
          return next.slice(0, 8);
        });
      }

      const resultCount = (response?.data?.data || []).length;
      if (resultCount === 0) {
        setMentorSearchMessage(
          getErrorFeedback("mentorSearchNoMatches").message,
        );
      }
    } catch (error) {
      setMentorSearchResults([]);
      setMentorSearchMessage(getErrorFeedback("mentorSearchFailed").message);
    } finally {
      setMentorSearchLoading(false);
    }
  }, []);

  const clearSearch = useCallback(() => {
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
