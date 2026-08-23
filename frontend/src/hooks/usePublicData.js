import { useEffect, useState, useRef } from "react";
import client from "../api/client";
import { pageContent } from "../utils/pagination";

/**
 * Shared, deduplicated fetcher for public landing-page data:
 *  - /api/v1/users/mentors (mentor cards)
 *  - /api/v1/public/testimonials (review cards)
 *
 * Without this, AuthPage and Testimonials each independently fetch their
 * own endpoints — resulting in 2 separate HTTP requests that run in parallel
 * but share no state. When both components mount on the same page, the
 * data is fetched twice.
 *
 * This hook caches at the module level (same pattern as useCommunityStats)
 * so every caller shares a single in-flight request and result.
 */

const CACHE_TTL_MS = 30_000;

// Module-level shared state
let sharedMentors = [];
let sharedTestimonials = [];
let mentorsError = false;
let testimonialsError = false;
let lastFetchTime = 0;
let inflightMentors = null;
let inflightTestimonials = null;

/**
 * Cached, deduplicated fetcher for /api/v1/users/mentors.
 * Exported so non-hook code (learner-utils, useEffect loaders) can share
 * the same in-flight request and result.
 */
export function fetchCachedMentors() {
  if (inflightMentors) return inflightMentors;

  inflightMentors = client
    .get("/api/v1/users/mentors")
    .then((res) => {
      sharedMentors = pageContent(res?.data?.data) || [];
      mentorsError = false;
      lastFetchTime = Date.now();
      return sharedMentors;
    })
    .catch(() => {
      mentorsError = true;
      lastFetchTime = Date.now();
      return [];
    })
    .finally(() => {
      inflightMentors = null;
    });

  return inflightMentors;
}

function fetchTestimonials() {
  if (inflightTestimonials) return inflightTestimonials;

  inflightTestimonials = client
    .get("/api/v1/public/testimonials")
    .then((res) => {
      sharedTestimonials = res.data || [];
      testimonialsError = false;
      lastFetchTime = Date.now();
      return sharedTestimonials;
    })
    .catch(() => {
      testimonialsError = true;
      lastFetchTime = Date.now();
      return [];
    })
    .finally(() => {
      inflightTestimonials = null;
    });

  return inflightTestimonials;
}

/**
 * @param {{ fetchMentors?: boolean, fetchTestimonials?: boolean }} [opts]
 * @returns {{ mentors: Array, mentorsLoading: boolean, testimonials: Array, testimonialsLoading: boolean }}
 */
export default function usePublicData({ fetchMentors: shouldFetchMentors = true, fetchTestimonials: shouldFetchTestimonials = true } = {}) {
  const [mentors, setMentors] = useState(sharedMentors ?? []);
  const [mentorsLoading, setMentorsLoading] = useState(shouldFetchMentors && !sharedMentors.length && !mentorsError);
  const [testimonials, setTestimonials] = useState(sharedTestimonials ?? []);
  const [testimonialsLoading, setTestimonialsLoading] = useState(shouldFetchTestimonials && !sharedTestimonials.length && !testimonialsError);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Fetch mentors if requested and stale
  useEffect(() => {
    if (!shouldFetchMentors) return;

    const isFresh = Date.now() - lastFetchTime < CACHE_TTL_MS;
    if (isFresh && sharedMentors.length) {
      setMentors(sharedMentors);
      setMentorsLoading(false);
      return;
    }

    setMentorsLoading(true);
    fetchCachedMentors().then((data) => {
      if (!mountedRef.current) return;
      setMentors(data);
      setMentorsLoading(false);
    });
  }, [shouldFetchMentors]);

  // Fetch testimonials if requested and stale
  useEffect(() => {
    if (!shouldFetchTestimonials) return;

    const isFresh = Date.now() - lastFetchTime < CACHE_TTL_MS;
    if (isFresh && sharedTestimonials.length) {
      setTestimonials(sharedTestimonials);
      setTestimonialsLoading(false);
      return;
    }

    setTestimonialsLoading(true);
    fetchTestimonials().then((data) => {
      if (!mountedRef.current) return;
      setTestimonials(data);
      setTestimonialsLoading(false);
    });
  }, [shouldFetchTestimonials]);

  return { mentors, mentorsLoading, testimonials, testimonialsLoading };
}
