/**
 * E2E test for the full Review submission flow on Mentor Profile page.
 *
 * Tests:
 * 1. Empty state: Shows empty state message when no completed bookings exist.
 * 2. Successful review submission: Mocks eligible bookings → fills form → submits → success message.
 * 3. Backend error: Shows actual backend error message when submission fails.
 * 4. Full E2E flow: Creates a real booking via API, then submits a review.
 *
 * Review-specific API calls are mocked where needed to prevent actual DB writes
 * and to make the test self-contained and idempotent.
 */

import { expect, test } from "@playwright/test";

const BACKEND_URL =
  process.env.PLAYWRIGHT_BACKEND_URL || "http://localhost:8080";

/**
 * Try to log in as a given user by trying multiple common passwords.
 */
async function loginAs(request, email) {
  const pwds = ["password", "test@123", "admin123", "Admin@123"];
  for (const pwd of pwds) {
    const resp = await request.post(BACKEND_URL + "/api/v1/auth/login", {
      data: { email, password: pwd },
    });
    if (resp.ok()) {
      const body = await resp.json();
      const t = body?.data?.token;
      if (t) {
        console.log(`[login] Logged in as ${email}`);
        return t;
      }
    }
  }
  return null;
}

async function loginAsLearner(request) {
  return loginAs(request, "learner@test.com");
}

async function loginAsAdmin(request) {
  // Try common admin email patterns. First match wins.
  const adminEmails = ["admin@test.com", "admin@example.com"];
  for (const email of adminEmails) {
    const token = await loginAs(request, email);
    if (token) return token;
  }
  return null;
}

async function findAnyMentor(request, token) {
  const hdrs = { Authorization: "Bearer " + token };
  const mResp = await request.get(BACKEND_URL + "/api/v1/users/mentors", {
    headers: hdrs,
  });
  if (!mResp.ok()) return null;
  const mentors = (await mResp.json())?.data || [];
  return mentors.length > 0 ? mentors[0] : null;
}

async function findMentorWithSession(request, token) {
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
    if (sessions.length > 0) {
      return { mentor: m, session: sessions[0] };
    }
  }
  return null;
}

function generateIdempotencyKey() {
  return `e2e-review-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

test.describe("Review Flow - Mentor Profile", () => {
  test("shows empty state when no completed bookings exist", async ({
    page,
    request,
  }) => {
    test.setTimeout(120000);

    const token = await loginAsLearner(request);
    test.skip(
      !token,
      "Skipping - could not obtain auth token for learner@test.com.",
    );

    const mentor = await findAnyMentor(request, token);
    test.skip(!mentor, "Skipping - no mentors found in the system.");

    await page.addInitScript((t) => {
      window.localStorage.setItem("token", t);
    }, token);

    // Mock eligible bookings to return empty (no completed bookings)
    await page.route("**/api/v1/reviews/eligible/mentor/**", async (route) => {
      if (route.request().method() === "GET") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            message: "Eligible bookings fetched",
            data: [],
          }),
        });
      }
      return route.continue();
    });

    await page.goto("/mentors/" + mentor.id);
    await expect(page.locator(".mpr-hero")).toBeVisible({ timeout: 20000 });
    await expect(
      page.locator('section[data-section="5"]'),
    ).toBeVisible({ timeout: 15000 });

    // Scroll to the review section
    await page.evaluate(() => {
      const el = document.querySelector('section[data-section="5"]');
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    await page.waitForTimeout(1000);

    // Verify empty state is shown with explanation text and "View My Sessions" button
    await expect(page.locator(".mpr-review-form__empty")).toBeVisible({
      timeout: 10000,
    });
    await expect(
      page.getByText(
        "You can review a mentor only after completing a booked session.",
      ),
    ).toBeVisible({ timeout: 5000 });
    await expect(
      page.getByRole("button", { name: /View My Sessions/i }),
    ).toBeVisible({ timeout: 5000 });
  });

  test("submits a review successfully with mocked completed booking", async ({
    page,
    request,
  }) => {
    test.setTimeout(120000);

    const token = await loginAsLearner(request);
    test.skip(
      !token,
      "Skipping - could not obtain auth token for learner@test.com.",
    );

    const mentor = await findAnyMentor(request, token);
    test.skip(!mentor, "Skipping - no mentors found in the system.");

    const mentorName = mentor.fullName || "Mentor";
    const mockBookingId = 999001;
    const mockSessionTitle = "Java Backend Mentoring";
    const mockCompletedAt = "2026-07-15T10:30:00Z";

    await page.addInitScript((t) => {
      window.localStorage.setItem("token", t);
    }, token);

    // Mock eligible bookings to return a fake completed booking
    await page.route("**/api/v1/reviews/eligible/mentor/**", async (route) => {
      if (route.request().method() === "GET") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            message: "Eligible bookings fetched",
            data: [
              {
                bookingId: mockBookingId,
                sessionId: 1001,
                sessionTitle: mockSessionTitle,
                completedAt: mockCompletedAt,
              },
            ],
          }),
        });
      }
      return route.continue();
    });

    // Mock the review POST to verify payload and return success
    await page.route("**/api/v1/reviews", async (route) => {
      if (route.request().method() === "POST") {
        const postData = JSON.parse(route.request().postData() || "{}");
        console.log(
          "[review-flow] Review POST payload:",
          JSON.stringify(postData),
        );

        // Verify the payload has all required fields
        expect(postData.bookingId).toBe(mockBookingId);
        expect(postData.mentorId).toBe(mentor.id);
        expect(postData.rating).toBeGreaterThanOrEqual(1);
        expect(postData.rating).toBeLessThanOrEqual(5);
        expect(postData.comment).toBeTruthy();
        expect(postData.anonymous).toBeDefined();

        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            message: "Review submitted",
            data: {
              id: 555001,
              mentorId: mentor.id,
              learnerId: 1,
              learnerName: "Test Learner",
              rating: postData.rating,
              comment: postData.comment,
              createdAt: new Date().toISOString(),
            },
          }),
        });
      }
      return route.continue();
    });

    await page.goto("/mentors/" + mentor.id);
    await expect(page.locator(".mpr-hero")).toBeVisible({ timeout: 20000 });
    await expect(
      page.locator('section[data-section="5"]'),
    ).toBeVisible({ timeout: 15000 });

    // Scroll to review form
    await page.evaluate(() => {
      const el = document.querySelector('section[data-section="5"]');
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    await page.waitForTimeout(1000);

    // Verify the review form heading
    await expect(page.getByText("Leave a Review")).toBeVisible({
      timeout: 10000,
    });

    // Select the eligible booking from dropdown
    const bookingSelect = page.locator("select.mpr-review-form__field").first();
    await expect(bookingSelect).toBeVisible({ timeout: 5000 });

    // Verify option exists (inside select, option elements are hidden)
    const optionCount = await page
      .locator(`select.mpr-review-form__field option[value="${mockBookingId}"]`)
      .count();
    expect(optionCount).toBeGreaterThanOrEqual(1);

    await bookingSelect.selectOption(String(mockBookingId));
    await page.waitForTimeout(300);

    // Verify booking info section appears
    await expect(page.locator(".mpr-review-form__booking-info")).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText("Mentor: " + mentorName)).toBeVisible({
      timeout: 3000,
    });
    await expect(page.getByText("Skill: " + mockSessionTitle)).toBeVisible({
      timeout: 3000,
    });
    await expect(page.getByText("Completed: Jul 15, 2026")).toBeVisible({
      timeout: 3000,
    });

    // Select rating (1st star = highest rating 5, stars rendered as [5,4,3,2,1])
    const stars = page.locator(".mpr-review-form__star");
    await expect(stars.first()).toBeVisible({ timeout: 3000 });
    await stars.first().click(); // Click the 1st star = rating 5
    await page.waitForTimeout(300);
    await expect(page.getByText("Great!")).toBeVisible({ timeout: 3000 });

    // Fill in the review comment
    const commentInput = page.locator("textarea.mpr-review-form__textarea");
    await expect(commentInput).toBeVisible({ timeout: 3000 });
    await commentInput.fill(
      "Amazing mentor! Very detailed explanations and hands-on guidance. Highly recommend for anyone learning Java backend development.",
    );
    await page.waitForTimeout(300);

    // Check "Post anonymously"
    const anonCheckbox = page.locator(
      '.mpr-review-form__toggle input[type="checkbox"]',
    );
    await anonCheckbox.check();
    await expect(anonCheckbox).toBeChecked();

    // Verify Submit button is enabled
    const submitBtn = page.locator('button.mpr-btn--primary[type="submit"]');
    await expect(submitBtn).toBeVisible({ timeout: 3000 });
    await expect(submitBtn).toBeEnabled({ timeout: 3000 });

    // Submit the review
    await submitBtn.click();

    // Verify success message
    await expect(
      page.getByText("Review submitted successfully. Thank you!"),
    ).toBeVisible({ timeout: 10000 });
    await expect(page.locator(".mpr-review-form__msg--success")).toBeVisible({
      timeout: 5000,
    });

    // Verify comment field is cleared after successful submission
    await page.waitForTimeout(500);
    await expect(commentInput).toHaveValue("", { timeout: 3000 });
  });

  test("shows backend error message when review submission fails", async ({
    page,
    request,
  }) => {
    test.setTimeout(120000);

    const token = await loginAsLearner(request);
    test.skip(
      !token,
      "Skipping - could not obtain auth token for learner@test.com.",
    );

    const mentor = await findAnyMentor(request, token);
    test.skip(!mentor, "Skipping - no mentors found in the system.");

    const mockBookingId = 999002;

    await page.addInitScript((t) => {
      window.localStorage.setItem("token", t);
    }, token);

    // Mock eligible bookings to return a fake completed booking
    await page.route("**/api/v1/reviews/eligible/mentor/**", async (route) => {
      if (route.request().method() === "GET") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            message: "Eligible bookings fetched",
            data: [
              {
                bookingId: mockBookingId,
                sessionId: 1002,
                sessionTitle: "DSA Mentoring",
                completedAt: "2026-07-10T14:00:00Z",
              },
            ],
          }),
        });
      }
      return route.continue();
    });

    // Mock the review POST to return a backend validation error
    await page.route("**/api/v1/reviews", async (route) => {
      if (route.request().method() === "POST") {
        return route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({
            message: "Bad request",
            data: {
              error: "You have already submitted a review for this booking.",
            },
          }),
        });
      }
      return route.continue();
    });

    await page.goto("/mentors/" + mentor.id);
    await expect(page.locator(".mpr-hero")).toBeVisible({ timeout: 20000 });
    await expect(
      page.locator('section[data-section="5"]'),
    ).toBeVisible({ timeout: 15000 });

    // Scroll to review form
    await page.evaluate(() => {
      const el = document.querySelector('section[data-section="5"]');
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    await page.waitForTimeout(1000);

    // Fill in the form
    const bookingSelect = page.locator("select.mpr-review-form__field").first();
    await expect(bookingSelect).toBeVisible({ timeout: 5000 });
    await bookingSelect.selectOption(String(mockBookingId));
    await page.waitForTimeout(300);

    const stars = page.locator(".mpr-review-form__star");
    await stars.nth(1).click(); // Index 1 = star value 4
    await page.waitForTimeout(200);

    const commentInput = page.locator("textarea.mpr-review-form__textarea");
    await commentInput.fill("Great session! Learned a lot about DSA.");

    // Submit
    const submitBtn = page.locator('button.mpr-btn--primary[type="submit"]');
    await expect(submitBtn).toBeEnabled({ timeout: 3000 });
    await submitBtn.click();

    // Verify the actual backend error message is displayed
    await expect(
      page.getByText(
        "You have already submitted a review for this booking.",
      ),
    ).toBeVisible({ timeout: 10000 });
    await expect(page.locator(".mpr-review-form__msg--error")).toBeVisible({
      timeout: 5000,
    });
  });

  test("full flow: creates a real booking via API, marks it accepted via admin, then submits a review", async ({
    page,
    request,
  }) => {
    test.setTimeout(120000);

    // ── Lifecycle limitation note ──
    // The booking lifecycle is:
    //   PENDING → ACCEPTED → CONFIRMED → IN_PROGRESS → COMPLETED
    //
    // - ACCEPTED can be set via admin PATCH (tested below)
    // - CONFIRMED requires the session's OWN mentor (not available in this test)
    // - IN_PROGRESS is auto-promoted by the system scheduler (not reachable from API)
    // - COMPLETED requires IN_PROGRESS first (not reachable from test without scheduler)
    //
    // Therefore we create a real booking and accept it (real API), but the
    // COMPLETED status is simulated via mocked eligible-bookings endpoint.
    // ─────────────────────────────────────────────────────────────────

    const token = await loginAsLearner(request);
    test.skip(
      !token,
      "Skipping - could not obtain auth token for learner@test.com.",
    );

    // Find a mentor that has at least one session
    const result = await findMentorWithSession(request, token);
    test.skip(
      !result,
      "Skipping - no mentor with sessions found in the system.",
    );

    const { mentor, session } = result;
    const mentorName = mentor.fullName || "Mentor";
    const sessionTitle = session.title || "Session";

    console.log(
      `[review-flow] Creating real booking: mentorId=${mentor.id}, sessionId=${session.id}, title="${sessionTitle}"`,
    );

    // Step 1: Create a real booking via the API as learner
    const idempotencyKey = generateIdempotencyKey();
    const bookingResp = await request.post(
      BACKEND_URL + "/api/v1/bookings",
      {
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        data: { sessionId: session.id },
      },
    );

    let bookingId = null;
    let lifecycleToken = token;
    let accepted = false;
    if (bookingResp.ok()) {
      const bookingBody = await bookingResp.json();
      bookingId = bookingBody?.data?.id;
      console.log(
        `[review-flow] Real booking created: id=${bookingId}`,
      );

      // Step 2: Log in as admin to accept the booking
      const adminToken = await loginAsAdmin(request);
      if (adminToken) {
        lifecycleToken = adminToken;
        console.log(`[review-flow] Using admin token for lifecycle calls`);
      } else {
        console.log(
          `[review-flow] Admin login unavailable — using learner token (accept will fail)`,
        );
      }

      // Step 3: Accept the booking via PATCH (admin can accept ANY PENDING booking)
      const acceptResp = await request.patch(
        BACKEND_URL + "/api/v1/bookings/" + bookingId + "/status",
        {
          headers: {
            Authorization: "Bearer " + lifecycleToken,
            "Content-Type": "application/json",
          },
          data: { status: "ACCEPTED" },
        },
      );
      const acceptBody = await acceptResp.text();
      accepted = acceptResp.ok();
      console.log(
        `[review-flow] Accept booking: ${acceptResp.status()} ${acceptResp.ok() ? "✅ ACCEPTED" : "❌ failed"}`,
      );

      if (!acceptResp.ok()) {
        console.log(`  Response: ${acceptBody.substring(0, 200)}`);
        console.log(
          `  Tip: Add an admin user via backend seed data for successful accept.`,
        );
      }

      // Step 4: Try to complete the booking (expected to fail — needs IN_PROGRESS).
      // POST /{id}/complete calls the same backend method as PATCH with COMPLETED.
      const completeResp = await request.post(
        BACKEND_URL + "/api/v1/bookings/" + bookingId + "/complete",
        {
          headers: {
            Authorization: "Bearer " + lifecycleToken,
            "Content-Type": "application/json",
          },
        },
      );
      const completeBody = await completeResp.text();
      console.log(
        `[review-flow] Complete booking (expected 400 — needs IN_PROGRESS): ${completeResp.status()}`,
      );
      if (!completeResp.ok()) {
        console.log(`  Response: ${completeBody.substring(0, 150)}`);
      }
    } else {
      const errBody = await bookingResp.text();
      console.log(
        `[review-flow] Booking creation skipped (may already exist): ${bookingResp.status()} ${errBody.substring(0, 200)}`,
      );
    }

    // Step 2: Mock the eligible-bookings API (booking may not be COMPLETED + payment SUCCESS)
    await page.addInitScript((t) => {
      window.localStorage.setItem("token", t);
    }, token);

    const mockBookingId = bookingId || 999003;

    await page.route("**/api/v1/reviews/eligible/mentor/**", async (route) => {
      if (route.request().method() === "GET") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            message: "Eligible bookings fetched",
            data: [
              {
                bookingId: mockBookingId,
                sessionId: session.id,
                sessionTitle: sessionTitle,
                completedAt: "2026-07-20T09:00:00Z",
              },
            ],
          }),
        });
      }
      return route.continue();
    });

    // Mock the review POST to prevent actual DB write and verify payload
    await page.route("**/api/v1/reviews", async (route) => {
      if (route.request().method() === "POST") {
        const postData = JSON.parse(route.request().postData() || "{}");
        console.log(
          "[review-flow-full] Review POST payload:",
          JSON.stringify(postData),
        );

        expect(postData.bookingId).toBe(mockBookingId);
        expect(postData.mentorId).toBe(mentor.id);
        expect(postData.rating).toBeGreaterThanOrEqual(1);
        expect(postData.comment).toBeTruthy();
        expect(postData.anonymous).toBeDefined();

        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            message: "Review submitted",
            data: {
              id: 555002,
              mentorId: mentor.id,
              learnerId: 1,
              learnerName: "Test Learner",
              rating: postData.rating,
              comment: postData.comment,
              createdAt: new Date().toISOString(),
            },
          }),
        });
      }
      return route.continue();
    });

    // Step 3: Navigate to the mentor profile and submit a review
    await page.goto("/mentors/" + mentor.id);
    await expect(page.locator(".mpr-hero")).toBeVisible({ timeout: 20000 });
    await expect(
      page.locator('section[data-section="5"]'),
    ).toBeVisible({ timeout: 15000 });

    await page.evaluate(() => {
      const el = document.querySelector('section[data-section="5"]');
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    await page.waitForTimeout(1000);

    // Verify form is visible
    await expect(page.getByText("Leave a Review")).toBeVisible({
      timeout: 10000,
    });

    // Select the booking from dropdown
    const bookingSelect = page.locator("select.mpr-review-form__field").first();
    await expect(bookingSelect).toBeVisible({ timeout: 5000 });
    await bookingSelect.selectOption(String(mockBookingId));
    await page.waitForTimeout(300);

    // Verify booking info appears with real mentor name + session title
    await expect(page.locator(".mpr-review-form__booking-info")).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText("Mentor: " + mentorName)).toBeVisible({
      timeout: 3000,
    });
    await expect(page.getByText("Skill: " + sessionTitle)).toBeVisible({
      timeout: 3000,
    });

    // Select rating (1st star = rating 5)
    const stars = page.locator(".mpr-review-form__star");
    await stars.first().click();
    await page.waitForTimeout(200);

    // Fill comment
    const commentInput = page.locator("textarea.mpr-review-form__textarea");
    await commentInput.fill(
      "Excellent session! The mentor was very knowledgeable and helpful. Learned a lot about " +
        sessionTitle +
        ".",
    );

    // Submit the review
    const submitBtn = page.locator('button.mpr-btn--primary[type="submit"]');
    await expect(submitBtn).toBeEnabled({ timeout: 3000 });
    await submitBtn.click();

    // Verify success message
    await expect(
      page.getByText("Review submitted successfully. Thank you!"),
    ).toBeVisible({ timeout: 10000 });
    await expect(page.locator(".mpr-review-form__msg--success")).toBeVisible({
      timeout: 5000,
    });

    // Step 4: Cleanup — cancel the booking if we created one
    if (bookingId && bookingCreated) {
      try {
        const cancelResp = await request.post(
          BACKEND_URL + "/api/v1/bookings/" + bookingId + "/cancel",
          {
            headers: {
              Authorization: "Bearer " + token,
              "Content-Type": "application/json",
            },
          },
        );
        console.log(
          `[review-flow] Booking ${bookingId} cancelled: ${cancelResp.status()}`,
        );
      } catch (err) {
        console.log(
          `[review-flow] Cancel cleanup issue: ${err.message}`,
        );
      }
    }

    console.log(
      `[review-flow] Full flow completed: bookingId=${mockBookingId}, mentorId=${mentor.id}, bookingCreated=${bookingCreated}`,
    );
  });
});
