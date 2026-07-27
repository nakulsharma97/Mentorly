/**
 * E2E test for the full BookingFlowPage lifecycle.
 *
 * Tests:
 * 1. Full successful booking flow: mentor profile -> Step 1 (details) -> Step 2 (payment)
 *    -> Step 3 (success) -> navigate to sessions
 * 2. Error retry flow: first POST intercepted with 409 conflict, error shown on step 2,
 *    retry succeeds on second attempt (mocked)
 *
 * All booking and payment API calls are mocked to avoid duplicate booking prevention
 * on the backend, making the test self-contained and idempotent.
 */

import { expect, test } from "@playwright/test";

const BACKEND_URL =
  process.env.PLAYWRIGHT_BACKEND_URL || "http://localhost:8080";

async function loginAsLearner(request) {
  const pwds = ["password", "test@123"];
  for (const pwd of pwds) {
    const resp = await request.post(BACKEND_URL + "/api/v1/auth/login", {
      data: { email: "learner@test.com", password: pwd },
    });
    if (resp.ok()) {
      const body = await resp.json();
      const t = body?.data?.token;
      if (t) return t;
    }
  }
  return null;
}

async function findMentorWithFutureSession(request, token) {
  const hdrs = { Authorization: "Bearer " + token };
  const mResp = await request.get(BACKEND_URL + "/api/v1/users/mentors", {
    headers: hdrs,
  });
  if (!mResp.ok()) return null;
  const mentors = (await mResp.json())?.data || [];
  for (const m of mentors) {
    if (!m?.id) continue;
    const sResp = await request.get(
      BACKEND_URL + "/api/v1/sessions/mentor/" + m.id,
      { headers: hdrs },
    );
    if (!sResp.ok()) continue;
    const sessions = (await sResp.json())?.data || [];
    if (
      sessions.some(
        (s) => s?.startTime && new Date(s.startTime).getTime() > Date.now() + 60000,
      )
    ) {
      return m;
    }
  }
  return null;
}

test.describe("Booking Flow - Full Lifecycle", () => {
  test("successful booking through all 3 steps of BookingFlowPage", async ({
    page,
    request,
  }) => {
    test.setTimeout(120000);

    const token = await loginAsLearner(request);
    test.skip(!token, "Skipping - could not obtain auth token for learner@test.com.");

    const mentor = await findMentorWithFutureSession(request, token);
    test.skip(!mentor, "Skipping - no mentor with future sessions found.");

    await page.addInitScript((t) => {
      window.localStorage.setItem("token", t);
    }, token);

    // Mock booking and payment POSTs to avoid backend duplicate booking prevention
    // and make the test self-contained.
    await page.route("**/api/v1/bookings", async (route) => {
      if (route.request().method() === "POST") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: {
              id: 9999,
              sessionId: 1,
              learnerId: 1,
              status: "CONFIRMED",
              createdAt: new Date().toISOString(),
            },
          }),
        });
      }
      return route.continue();
    });

    await page.route("**/api/v1/payments/intent", async (route) => {
      if (route.request().method() === "POST") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: {
              id: 8888,
              status: "INITIATED",
              gateway: "razorpay",
              gatewayResponse: null,
            },
          }),
        });
      }
      return route.continue();
    });

    // Navigate to mentor profile
    await page.goto("/mentors/" + mentor.id);
    await expect(page.locator(".mpr-hero")).toBeVisible({ timeout: 20000 });
    await expect(page.locator(".mpr-booking-card__type").first()).toBeVisible({
      timeout: 20000,
    });

    // Click session button -> Step 1
    await page.locator(".mpr-booking-card__type").first().click();
    await expect(
      page.getByRole("heading", { name: /Review Session Details/i }),
    ).toBeVisible({ timeout: 15000 });

    // Verify session details rendered (session title h3 in overlay)
    await expect(page.locator(".mpr-overlay h3")).toBeVisible({ timeout: 10000 });

    // Step 1 -> Step 2
    await page.getByRole("button", { name: /Next.*Confirm/i }).first().click();
    await expect(
      page.getByRole("heading", { name: /Confirm Payment/i }),
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Session price/i)).toBeVisible({ timeout: 5000 });

    // Step 2 -> Step 3 (click Confirm & Pay - mocked booking POST)
    await page.getByRole("button", { name: /Confirm.*Pay/i }).click();

    // Step 3: Success message should appear with "Go to My Sessions" button
    await expect(
      page.getByRole("button", { name: /Go to My Sessions/i }),
    ).toBeVisible({ timeout: 15000 });

    await page.getByRole("button", { name: /Go to My Sessions/i }).click();
    await expect(page).toHaveURL(/\/sessions/);
  });

  test("booking conflict shows error on first attempt and succeeds on retry", async ({
    page,
    request,
  }) => {
    test.setTimeout(120000);

    const token = await loginAsLearner(request);
    test.skip(!token, "Skipping - could not obtain auth token for learner@test.com.");

    const mentor = await findMentorWithFutureSession(request, token);
    test.skip(!mentor, "Skipping - no mentor with future sessions found.");

    await page.addInitScript((t) => {
      window.localStorage.setItem("token", t);
    }, token);

    // Intercept booking POSTs: first returns 409, second returns success
    let bookingAttempts = 0;
    await page.route("**/api/v1/bookings", async (route) => {
      if (route.request().method() === "POST") {
        bookingAttempts++;
        if (bookingAttempts === 1) {
          return route.fulfill({
            status: 409,
            contentType: "application/json",
            body: JSON.stringify({
              message: "Request failed",
              data: {
                code: "BOOKING_TEMPORARY_CONFLICT",
                error: "Temporary booking conflict. Please retry.",
                message: "Temporary booking conflict. Please retry.",
                retryable: true,
                traceId: "e2e-forced-conflict",
              },
            }),
          });
        }
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: {
              id: 9998,
              sessionId: 1,
              learnerId: 1,
              status: "CONFIRMED",
              createdAt: new Date().toISOString(),
            },
          }),
        });
      }
      return route.continue();
    });

    // Mock payment intent to avoid backend errors
    await page.route("**/api/v1/payments/intent", async (route) => {
      if (route.request().method() === "POST") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: {
              id: 8887,
              status: "INITIATED",
              gateway: "razorpay",
              gatewayResponse: null,
            },
          }),
        });
      }
      return route.continue();
    });

    // Navigate to mentor profile
    await page.goto("/mentors/" + mentor.id);
    await expect(page.locator(".mpr-hero")).toBeVisible({ timeout: 20000 });
    await expect(page.locator(".mpr-booking-card__type").first()).toBeVisible({
      timeout: 20000,
    });

    // Open BookingFlowPage
    await page.locator(".mpr-booking-card__type").first().click();
    await expect(
      page.getByRole("heading", { name: /Review Session Details/i }),
    ).toBeVisible({ timeout: 15000 });

    // Step 1 -> Step 2
    await page.getByRole("button", { name: /Next.*Confirm/i }).first().click();
    await expect(
      page.getByRole("heading", { name: /Confirm Payment/i }),
    ).toBeVisible({ timeout: 10000 });

    // Click Confirm & Pay - first attempt returns 409
    await page.getByRole("button", { name: /Confirm.*Pay/i }).click();

    // The booking creation failed - error text should appear on step 2
    await expect(
      page.getByText("Temporary booking conflict. Please retry."),
    ).toBeVisible({ timeout: 10000 });

    // Click Confirm & Pay again - second attempt returns success (mocked)
    await page.getByRole("button", { name: /Confirm.*Pay/i }).click();

    // On success, "Go to My Sessions" button should appear
    await expect(
      page.getByRole("button", { name: /Go to My Sessions/i }),
    ).toBeVisible({ timeout: 15000 });

    await page.getByRole("button", { name: /Go to My Sessions/i }).click();
    await expect(page).toHaveURL(/\/sessions/);
  });
});
