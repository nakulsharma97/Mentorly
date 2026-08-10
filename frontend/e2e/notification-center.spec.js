import { expect, test } from "@playwright/test";

const BACKEND_URL =
  process.env.PLAYWRIGHT_BACKEND_URL || "http://localhost:8080";

/**
 * Fetch auth token via the backend API.
 */
async function fetchAuthToken(request, email, candidates = ["password", "test@123"]) {
  for (const password of candidates) {
    const resp = await request.post(`${BACKEND_URL}/api/v1/auth/login`, {
      data: { email, password },
    });
    if (resp.ok()) {
      const body = await resp.json();
      const token = body?.data?.token;
      if (token) return token;
    }
  }
  return null;
}

/**
 * Inject token into localStorage before page JavaScript runs.
 */
async function injectToken(page, token) {
  await page.addInitScript((t) => {
    window.localStorage.setItem("token", t);
  }, token);
}

test.describe("Notification Center – API", () => {
  test("learner notifications endpoint returns data", async ({ request }) => {
    const token = await fetchAuthToken(request, "learner@test.com");
    test.skip(!token, "Skipping – could not obtain auth token.");

    const response = await request.get(
      `${BACKEND_URL}/api/v1/notifications?page=0&size=5`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.data.totalElements).toBeGreaterThanOrEqual(0);
  });

  test("mentor notifications endpoint returns data", async ({ request }) => {
    const token = await fetchAuthToken(request, "mentor@test.com");
    test.skip(!token, "Skipping – could not obtain auth token.");

    const response = await request.get(
      `${BACKEND_URL}/api/v1/notifications?page=0&size=5`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.data.totalElements).toBeGreaterThan(0);
  });

  test("unread count endpoint works", async ({ request }) => {
    const token = await fetchAuthToken(request, "learner@test.com");
    test.skip(!token, "Skipping – could not obtain auth token.");

    const response = await request.get(
      `${BACKEND_URL}/api/v1/notifications/unread-count`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.data).toBeGreaterThanOrEqual(0);
  });
});

test.describe("Notification Center – UI", () => {
  test("learner dashboard shows notification bell with badge", async ({
    page,
    request,
  }) => {
    const token = await fetchAuthToken(request, "learner@test.com");
    test.skip(!token, "Skipping – could not obtain auth token.");

    // Mock the unread count to be > 0 so the badge is guaranteed to render
    await page.route("**/api/v1/notifications/unread-count", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: 3 }),
      });
    });

    await injectToken(page, token);

    await page.goto("/learner/dashboard", { waitUntil: "load" });

    // Wait for the SPA to authenticate (topbar = auth confirmed)
    await expect(page.locator('[class*="ws-top"]').first()).toBeVisible({
      timeout: 15000,
    });

    // Bell icon should be visible in the topbar — use button[class*="notif-bell"] to avoid matching the badge span
    const bellButton = page.locator('button[class*="notif-bell"]').first();
    await expect(bellButton).toBeVisible({ timeout: 10000 });

    // Badge should show unread count
    const badge = bellButton.locator('[class*="notif-bell__badge"]');
    await expect(badge).toBeVisible({ timeout: 5000 });
    const badgeText = await badge.textContent();
    const count = Number(badgeText);
    expect(Number.isFinite(count) && count >= 0).toBeTruthy();

    // Open dropdown
    await bellButton.click();
    await page.waitForTimeout(1500);

    // Use .notif-dropdown to only match the main dropdown div (not the arrow)
    const dropdown = page.locator('.notif-dropdown');
    await expect(dropdown).toBeVisible({ timeout: 5000 });

    // Notification cards in dropdown
    await expect(
      dropdown.locator('[class*="notif-card"]').first(),
    ).toBeVisible({ timeout: 5000 });

    // "Mark all read" button — uses class-based selector to avoid ambiguity
    await expect(
      dropdown.locator('button[class*="notif-panel__mark-all"]'),
    ).toBeVisible({ timeout: 3000 });

    // "View All" navigation button — uses class-based selector
    await expect(
      dropdown.locator('button[class*="notif-panel__view-all"]'),
    ).toBeVisible({ timeout: 3000 });
  });

  test("learner notifications full page shows cards and filters", async ({
    page,
    request,
  }) => {
    const token = await fetchAuthToken(request, "learner@test.com");
    test.skip(!token, "Skipping – could not obtain auth token.");

    await injectToken(page, token);

    await page.goto("/learner/notifications", { waitUntil: "load" });

    // Wait for topbar (auth confirmed) — use .first() because "ws-top" appears in many class names
    await expect(page.locator('[class*="ws-top"]').first()).toBeVisible({
      timeout: 15000,
    });

    // Notification cards should load
    const notifCards = page.locator('[class*="notif-card"]');
    await expect(notifCards.first()).toBeVisible({ timeout: 15000 });

    // Type badges should be visible on cards
    await expect(
      page.locator('[class*="notif-card__type-badge"]').first(),
    ).toBeVisible({ timeout: 5000 });

    // Filter tabs — use class-based selector instead of text matching (count span adds extra text)
    const filterBtns = page.locator('button[class*="notif-panel__filter"]');
    await expect(filterBtns.nth(0)).toBeVisible({ timeout: 5000 });
    await expect(filterBtns.nth(1)).toBeVisible({ timeout: 5000 });
  });

  test("mentor dashboard shows notification dropdown with cards", async ({
    page,
    request,
  }) => {
    const token = await fetchAuthToken(request, "mentor@test.com");
    test.skip(!token, "Skipping – could not obtain auth token.");

    await injectToken(page, token);

    await page.goto("/mentor/dashboard", { waitUntil: "load" });

    // Use .first() — "ws-top" appears in many class names across the workspace
    await expect(page.locator('[class*="ws-top"]').first()).toBeVisible({
      timeout: 15000,
    });

    const bellButton = page.locator('button[class*="notif-bell"]').first();
    await expect(bellButton).toBeVisible({ timeout: 10000 });

    await bellButton.click();
    await page.waitForTimeout(1500);

    // Use .notif-dropdown to match only the main dropdown container
    const dropdown = page.locator('.notif-dropdown');
    await expect(dropdown).toBeVisible({ timeout: 5000 });

    await expect(
      dropdown.locator('[class*="notif-card"]').first(),
    ).toBeVisible({ timeout: 5000 });
  });

  test("admin dashboard opens the notification dropdown without navigating", async ({
    page,
    request,
  }) => {
    // Try the known admin password FIRST so the test never adds failed
    // login attempts — the backend brute-force guard (5 failed attempts
    // per IP per 15 min) would otherwise rate-limit the whole spec.
    const token = await fetchAuthToken(request, "nakulsharma@gmail.com", [
      "nakul97",
      "password",
      "test@123",
    ]);
    test.skip(!token, "Skipping – could not obtain auth token.");

    // Mock the unread count so the badge is guaranteed to render
    await page.route("**/api/v1/notifications/unread-count", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: 3 }),
      });
    });

    await injectToken(page, token);

    await page.goto("/admin/dashboard", { waitUntil: "load" });

    // Wait for the SPA to authenticate (topbar = auth confirmed)
    await expect(page.locator('[class*="ws-top"]').first()).toBeVisible({
      timeout: 15000,
    });

    // The global navbar (whose bell navigates) must NOT render on admin pages
    await expect(page.locator(".site-navbar")).toHaveCount(0);

    // Only the workspace topbar bell (which opens the dropdown) is present
    const bellButton = page.locator('button[class*="notif-bell"]');
    await expect(bellButton).toHaveCount(1);
    await expect(bellButton).toBeVisible({ timeout: 10000 });

    const badge = bellButton.locator('[class*="notif-bell__badge"]');
    await expect(badge).toBeVisible({ timeout: 5000 });
    const badgeText = (await badge.textContent()) || "";
    expect(Number(badgeText)).toBeGreaterThanOrEqual(0);

    const urlBeforeClick = page.url();

    await bellButton.click();
    await page.waitForTimeout(1500);

    // Clicking the bell opens the dropdown — it must NOT navigate
    expect(page.url()).toBe(urlBeforeClick);

    const dropdown = page.locator(".notif-dropdown");
    await expect(dropdown).toBeVisible({ timeout: 5000 });

    await expect(
      dropdown.locator('input[type="search"]'),
    ).toBeVisible({ timeout: 3000 });
    await expect(
      dropdown.locator('button[class*="notif-panel__mark-all"]'),
    ).toBeVisible({ timeout: 3000 });
    await expect(
      dropdown.locator('button[class*="notif-panel__filter"]').nth(0),
    ).toBeVisible({ timeout: 3000 });
    await expect(
      dropdown.locator('button[class*="notif-panel__filter"]').nth(1),
    ).toBeVisible({ timeout: 3000 });

    // View All → Admin Notifications page
    await dropdown.locator('button[class*="notif-panel__view-all"]').click();
    await expect(page).toHaveURL(/\/admin\/notification-center/, {
      timeout: 8000,
    });
  });
});
