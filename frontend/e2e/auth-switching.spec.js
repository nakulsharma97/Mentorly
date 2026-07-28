/**
 * E2E test for login + account switching flow.
 *
 * Validates that switching between two different accounts works correctly
 * without stale session cookies from the previous user causing an
 * "Authentication failed — We could not load your profile" error.
 *
 * Flow:
 *   1. Log in as User A (mentor) via backend → inject token + stale cookie
 *   2. Verify User A's dashboard loads
 *   3. Switch to User B (learner): inject new token while stale User A cookie persists
 *   4. Verify User B's dashboard loads without auth errors
 *
 * This simulates the real-world scenario where a user logs out of account A
 * and logs into account B. If the old session cookies aren't cleared, the
 * backend may authenticate GET /api/v1/users/me via the stale cookie and
 * return the wrong profile, causing the strict user ID check to fail.
 *
 * The fix in persistAuthSession() solves this by clearing old cookies when
 * the new login response contains its own token.
 */

import { expect, test } from "@playwright/test";

const BACKEND_URL =
  process.env.PLAYWRIGHT_BACKEND_URL || "http://localhost:8080";
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:5174";

/**
 * Fetch a real auth token via the backend login API.
 * Tries multiple known test passwords.
 */
async function fetchAuthToken(request, email) {
  const candidates = ["password", "test@123"];
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
 * Inject a token via addInitScript. Each call registers a script that runs
 * before EVERY page load. When multiple scripts are registered (e.g. during
 * account switching), they execute in registration order. The last one wins
 * for localStorage writes.
 */
function injectToken(page, token) {
  return page.addInitScript((t) => {
    window.localStorage.setItem("token", t);
  }, token);
}

test.describe("Login + Account Switching", () => {
  /**
   * ─────────────────────────────────────────────────────────────
   * Test 1: Mentor → Learner switch with stale cookie present
   * ─────────────────────────────────────────────────────────────
   * Regression test for the cookie conflict bug.
   * User A (mentor) logs in first. Then User B (learner) logs in.
   * A stale cookie from User A persists. The app must still
   * successfully load User B's profile.
   */
  test("mentor to learner switch survives stale session cookies", async ({
    page,
    request,
  }) => {
    test.setTimeout(120000);

    // Collect console errors
    const consoleErrors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    // ── Step 1: Fetch tokens for both users ──
    const tokenA = await fetchAuthToken(request, "mentor@test.com");
    test.skip(
      !tokenA,
      "Skipping – could not obtain token for mentor@test.com.",
    );

    const tokenB = await fetchAuthToken(request, "learner@test.com");
    test.skip(
      !tokenB,
      "Skipping – could not obtain token for learner@test.com.",
    );

    // ── Step 2: Log in as User A (mentor) ──
    injectToken(page, tokenA);
    await page.goto("/mentor/dashboard", { waitUntil: "load" });

    // Confirm User A's dashboard renders
    await expect(
      page.locator('[class*="mdash2"]').first(),
    ).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(/Dashboard/i)).toBeVisible({ timeout: 10000 });

    // ── Step 3: Plant stale cookies from User A's session ──
    // These simulate HttpOnly session cookies that weren't cleared on logout.
    await page.context().addCookies([
      {
        name: "access_token",
        value: "stale-user-a-session",
        domain: new URL(BASE_URL).hostname,
        path: "/",
      },
      {
        name: "refresh_token",
        value: "stale-user-a-refresh",
        domain: new URL(BASE_URL).hostname,
        path: "/",
      },
    ]);

    // ── Step 4: Switch to User B (learner) ──
    // Register a second init script. Both scripts run on next navigation;
    // script 1 sets tokenA, then script 2 overwrites with tokenB.
    // Final localStorage state: token = tokenB
    injectToken(page, tokenB);

    // Navigate directly to User B's dashboard.
    // No need for about:blank — both addInitScript scripts have been
    // registered and will execute in order on this navigation.
    await page.goto("/learner/dashboard", { waitUntil: "load" });

    // ── Step 5: Verify User B's dashboard loads ──
    // Core assertion: no "Authentication failed" toast despite stale cookies
    await expect(page.getByText("Authentication failed")).not.toBeVisible({
      timeout: 5000,
    });
    await expect(
      page.getByText("could not load your profile"),
    ).not.toBeVisible({ timeout: 5000 });

    // Confirm learner dashboard content is rendered
    await expect(
      page.locator('[class*="ws-top"]').first(),
    ).toBeVisible({ timeout: 20000 });

    // Verify the URL is a learner route (confirms the correct role was loaded)
    await expect(page).toHaveURL(/\/learner\//);

    // No auth-related console errors
    const authErrors = consoleErrors.filter(
      (msg) =>
        msg.includes("401") ||
        msg.includes("403") ||
        msg.includes("Authentication failed") ||
        msg.includes("could not load your profile"),
    );
    expect(authErrors).toEqual([]);
  });

  /**
   * ─────────────────────────────────────────────────────────────
   * Test 2: Learner → Mentor switch (reverse direction)
   * ─────────────────────────────────────────────────────────────
   */
  test("learner to mentor switch survives stale session cookies", async ({
    page,
    request,
  }) => {
    test.setTimeout(120000);

    const consoleErrors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    // ── Step 1: Fetch tokens ──
    const tokenA = await fetchAuthToken(request, "learner@test.com");
    test.skip(
      !tokenA,
      "Skipping – could not obtain token for learner@test.com.",
    );

    const tokenB = await fetchAuthToken(request, "mentor@test.com");
    test.skip(
      !tokenB,
      "Skipping – could not obtain token for mentor@test.com.",
    );

    // ── Step 2: Log in as User A (learner) ──
    injectToken(page, tokenA);
    await page.goto("/learner/dashboard", { waitUntil: "load" });

    await expect(
      page.locator('[class*="ws-top"]').first(),
    ).toBeVisible({ timeout: 20000 });

    // ── Step 3: Plant stale cookies ──
    await page.context().addCookies([
      {
        name: "access_token",
        value: "stale-user-a-session",
        domain: new URL(BASE_URL).hostname,
        path: "/",
      },
      {
        name: "refresh_token",
        value: "stale-user-a-refresh",
        domain: new URL(BASE_URL).hostname,
        path: "/",
      },
    ]);

    // ── Step 4: Switch to User B (mentor) ──
    injectToken(page, tokenB);
    await page.goto("/mentor/dashboard", { waitUntil: "load" });

    // ── Step 5: Verify User B's dashboard loads ──
    await expect(page.getByText("Authentication failed")).not.toBeVisible({
      timeout: 5000,
    });
    await expect(
      page.getByText("could not load your profile"),
    ).not.toBeVisible({ timeout: 5000 });

    await expect(
      page.locator('[class*="mdash2"]').first(),
    ).toBeVisible({ timeout: 20000 });

    // Confirm mentor route
    await expect(page).toHaveURL(/\/mentor\//);

    const authErrors = consoleErrors.filter(
      (msg) =>
        msg.includes("401") ||
        msg.includes("403") ||
        msg.includes("Authentication failed") ||
        msg.includes("could not load your profile"),
    );
    expect(authErrors).toEqual([]);
  });

  /**
   * ─────────────────────────────────────────────────────────────
   * Test 3: Same account — reload does not show auth error
   * ─────────────────────────────────────────────────────────────
   */
  test("re-logging into the same account still works", async ({
    page,
    request,
  }) => {
    test.setTimeout(90000);

    const token = await fetchAuthToken(request, "mentor@test.com");
    test.skip(!token, "Skipping – could not obtain auth token.");

    injectToken(page, token);
    await page.goto("/mentor/dashboard", { waitUntil: "load" });

    await expect(
      page.locator('[class*="mdash2"]').first(),
    ).toBeVisible({ timeout: 20000 });

    // Reload — simulates returning to the app
    await page.reload({ waitUntil: "load" });

    await expect(page.getByText("Authentication failed")).not.toBeVisible({
      timeout: 5000,
    });
    await expect(
      page.locator('[class*="mdash2"]').first(),
    ).toBeVisible({ timeout: 20000 });
  });

  /**
   * ─────────────────────────────────────────────────────────────
   * Test 4: Profile ID mismatch — app must reject gracefully
   * ─────────────────────────────────────────────────────────────
   * If the backend returns a profile whose ID doesn't match the JWT's
   * userId (e.g., due to stale cookies), the app should detect the
   * mismatch and redirect to the landing page instead of crashing.
   */
  test("app rejects profile when user ID from backend mismatches JWT", async ({
    page,
    request,
  }) => {
    test.setTimeout(90000);

    const consoleErrors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    const tokenA = await fetchAuthToken(request, "mentor@test.com");
    test.skip(
      !tokenA,
      "Skipping – could not obtain token for mentor@test.com.",
    );

    // Inject User A's real JWT (which claims userId = mentor's id)
    injectToken(page, tokenA);

    // Mock /api/v1/users/me to return a DIFFERENT user's profile (id: 999).
    // This simulates what happens when the backend authenticates via a stale
    // cookie instead of the Bearer token — syncCurrentUser() will detect
    // the ID mismatch, clear auth state, and redirect.
    await page.route("**/api/v1/users/me", async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            id: 999,
            email: "wrong-user@test.com",
            fullName: "Wrong User",
            role: "LEARNER",
          },
        }),
      });
    });

    // Navigate — the app should detect the ID mismatch
    await page.goto("/mentor/dashboard", { waitUntil: "load" });

    // Allow time for the SPA to detect the mismatch and redirect
    await page.waitForTimeout(3000);

    // The app should redirect to the root landing page (home)
    // because syncCurrentUser() nulls the profile on mismatch
    await expect(page).toHaveURL(/^https?:\/\/[^\/]+\/?$/);

    // No unhandled JavaScript exceptions
    const crashErrors = consoleErrors.filter(
      (msg) =>
        !msg.includes("401") &&
        !msg.includes("403") &&
        !msg.includes("Authentication failed") &&
        !msg.includes("could not load your profile") &&
        !msg.includes("Failed to load") &&
        msg.includes("Error"),
    );
    expect(crashErrors).toEqual([]);
  });
});
