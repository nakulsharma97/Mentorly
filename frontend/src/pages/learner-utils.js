/**
 * Shared utilities extracted from LearnerPages.jsx.
 * Individual page files import from here instead of the monolith.
 */
import { useEffect, useRef, useState } from "react";
import client from "../api/client";
import { pageContent } from "../utils/pagination";

/* Stable empty array reference */
export const EMPTY_ARRAY = [];

export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = `${title} | Mentorly`;
  }, [title]);
}

export function unwrapResponse(payload) {
  if (
    payload &&
    typeof payload === "object" &&
    Object.prototype.hasOwnProperty.call(payload, "data") &&
    Object.prototype.hasOwnProperty.call(payload, "message")
  ) {
    return payload.data;
  }
  return payload;
}

export async function apiGet(path, config) {
  const response = await client.get(path, config);
  return unwrapResponse(response.data);
}

export async function apiPost(path, body, config) {
  const response = await client.post(path, body, config);
  return unwrapResponse(response.data);
}

export async function apiPut(path, body, config) {
  const response = await client.put(path, body, config);
  return unwrapResponse(response.data);
}

export function getErrorMessage(error) {
  return (
    error?.response?.data?.data?.error ||
    error?.response?.data?.message ||
    error?.message ||
    "Request failed"
  );
}

export function useResource(loader, deps = []) {
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: null }));
    Promise.resolve()
      .then(() => loaderRef.current())
      .then((data) => {
        if (!active) return;
        setState({ loading: false, data, error: null });
      })
      .catch((error) => {
        if (!active) return;
        window.console.error("[LearnerPages] Failed to load data:", error);
        setState({ loading: false, data: null, error: getErrorMessage(error) });
      });
    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

export function useLearnerLearningData(refreshKey = 0) {
  return useResource(async () => {
    const [bookings, certifications, mentors, savedMentors, savedSkills, profile] =
      await Promise.all([
        apiGet("/api/v1/bookings"),
        apiGet("/api/v1/certifications/me"),
        apiGet("/api/v1/users/mentors").catch(() => []),
        apiGet("/api/v1/watchlist/mentors").catch(() => []),
        apiGet("/api/v1/watchlist/skills").catch(() => []),
        apiGet("/api/v1/users/me"),
      ]);
    return {
      bookings: pageContent(bookings, EMPTY_ARRAY),
      certifications: pageContent(certifications, EMPTY_ARRAY),
      mentors: pageContent(mentors, EMPTY_ARRAY),
      savedMentors: pageContent(savedMentors, EMPTY_ARRAY),
      savedSkills: pageContent(savedSkills, EMPTY_ARRAY),
      profile,
    };
  }, [refreshKey]);
}

export function useNotificationsData(refreshKey = 0) {
  return useResource(async () => {
    const [notifications, preferences] = await Promise.all([
      apiGet("/api/v1/notifications"),
      apiGet("/api/v1/notifications/preferences").catch(() => null),
    ]);
    const items = Array.isArray(notifications)
      ? notifications
      : (notifications?.content || EMPTY_ARRAY);
    return { notifications: items, preferences };
  }, [refreshKey]);
}

export function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
}
