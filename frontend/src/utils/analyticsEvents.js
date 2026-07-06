export async function trackAnalyticsEvent(name, payload = {}) {
  if (!name || import.meta?.env?.MODE === "test") {
    return;
  }

  try {
    const csrfCookie = document.cookie
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith("XSRF-TOKEN="));
    const csrfToken = csrfCookie
      ? decodeURIComponent(csrfCookie.substring("XSRF-TOKEN=".length))
      : "";

    await fetch("/api/v1/analytics/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(csrfToken ? { "X-XSRF-TOKEN": csrfToken } : {}),
      },
      keepalive: true,
      credentials: "include",
      body: JSON.stringify({
        name,
        payload,
      }),
    });
  } catch {
    // Intentionally best-effort: telemetry should never block UX.
  }
}
