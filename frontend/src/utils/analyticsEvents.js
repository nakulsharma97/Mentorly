export async function trackAnalyticsEvent(name, payload = {}) {
  if (!name || import.meta?.env?.MODE === "test") {
    return;
  }

  try {
    await fetch("/api/v1/analytics/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
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
