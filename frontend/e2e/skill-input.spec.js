/**
 * E2E test for the Profile Setup "Add Skill" input field.
 *
 * Verifies:
 * 1. The skill input renders on Step 2 and accepts typed text
 * 2. Typing is visible in the input
 * 3. Clicking "Add" creates a skill tag
 * 4. The input clears after adding
 *
 * Uses page.addInitScript to inject a fake JWT token before the app loads,
 * and page.route() to intercept API calls with mock data (no backend required).
 */

import { expect, test } from "@playwright/test";

/* ─────────────────────────────────────────────────────────────
   Build a fake JWT in Node.js (outside browser) so it's
   guaranteed to have correct base64 encoding.
   Format:  base64(header).base64(payload).signature
   Header:  {"alg":"HS256","typ":"JWT"}
   Payload: {"sub":1,"exp":9999999999}
   ───────────────────────────────────────────────────────────── */
function buildFakeJwt() {
  const toB64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64");
  const header = toB64({ alg: "HS256", typ: "JWT" });
  const payload = toB64({ sub: 1, exp: 9999999999 });
  return `${header}.${payload}.ZmFrZS1zaWduYXR1cmU`;
}
const FAKE_JWT = buildFakeJwt();

/* ─────────────────────────────────────────────────────────────
   Mock mentor profile returned by /api/v1/users/me
   ───────────────────────────────────────────────────────────── */
const MOCK_PROFILE = {
  id: 1,
  fullName: "Test Mentor",
  email: "mentor@test.com",
  role: "MENTOR",
  skills: "",
  aboutMe: "",
  githubUrl: "",
  linkedinUrl: "",
  profileImageUrl: "",
};

/* ─────────────────────────────────────────────────────────────
   Inject token before page JS runs, then intercept API calls
   ───────────────────────────────────────────────────────────── */

async function setupAuthAndMocks(page) {
  // Inject the fake JWT into localStorage before any React code runs
  await page.addInitScript((token) => {
    window.localStorage.setItem("token", token);
  }, FAKE_JWT);

  // Intercept all API calls and return mock responses
  await page.route("**/api/**", async (route) => {
    const url = route.request().url();

    // ── User profile ──
    if (url.includes("/api/v1/users/me") && route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: MOCK_PROFILE }),
      });
    }

    // ── User profile update (PUT) ──
    if (url.includes("/api/v1/users/me/profile") && route.request().method() === "PUT") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: MOCK_PROFILE }),
      });
    }

    // ── Projects ──
    if (url.includes("/api/v1/users/me/projects") && route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [] }),
      });
    }

    // ── Activity ping ──
    if (url.includes("/api/v1/users/me/ping")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { ok: true } }),
      });
    }

    // ── Notification unread count ──
    if (url.includes("/api/v1/notifications/unread-count")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: 0 }),
      });
    }

    // ── Notifications list ──
    if (url.includes("/api/v1/notifications")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            content: [],
            totalElements: 0,
            totalPages: 1,
          },
        }),
      });
    }

    // ── Auth refresh (POST) ──
    if (url.includes("/api/v1/auth/refresh")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { token: FAKE_JWT } }),
      });
    }

    // ── Certification evaluation ──
    if (url.includes("/api/v1/certifications/evaluate")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { ok: true } }),
      });
    }

    // ── Mentors list (if called) ──
    if (url.includes("/api/v1/users/mentors")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [] }),
      });
    }

    // ── Bookings ──
    if (url.includes("/api/v1/bookings")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [] }),
      });
    }

    // ── Sessions ──
    if (url.includes("/api/v1/sessions")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [] }),
      });
    }

    // ── Reviews ──
    if (url.includes("/api/v1/reviews")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [] }),
      });
    }

    // ── Roadmaps ──
    if (url.includes("/api/v1/roadmaps")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [] }),
      });
    }

    // ── Watchlist ──
    if (url.includes("/api/v1/watchlist")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [] }),
      });
    }

    // ── Certificate evaluation ──
    if (url.includes("/api/v1/certifications")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [] }),
      });
    }

    // ── Referral ──
    if (url.includes("/api/v1/users/me/referral")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: null }),
      });
    }

    // ── Verification ──
    if (url.includes("/api/v1/verification/mentor/status")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: null }),
      });
    }

    // Fallback: return empty success for any unhandled API call
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: null }),
    });
  });
}

/* ─────────────────────────────────────────────────────────────
   Test: Skill input renders, accepts typing, and adds skills
   ───────────────────────────────────────────────────────────── */

test.describe("Profile Setup — Add Skill input", () => {
  test("typing in the skill input shows the entered text and Add button creates a skill tag", async ({
    page,
  }) => {
    test.setTimeout(60000);

    // Collect console errors from the very start
    const consoleErrors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await setupAuthAndMocks(page);

    // Navigate to the profile-setup page
    await page.goto("/profile-setup", { waitUntil: "domcontentloaded" });

    // Wait for the SPA to bootstrap and the auth flow to complete.
    // The ps-wrapper class appears once the ProfileSetup component renders.
    // Take a screenshot first in case the wait times out (for diagnostics)
    const screenshotTaken = page.screenshot({
      path: "e2e-screenshots/profile-setup-loaded.png",
      fullPage: true,
    }).catch(() => {});

    await page.waitForSelector(".ps-wrapper", { timeout: 25000 });
    await screenshotTaken;

    // Verify we're on the right page
    await expect(
      page.getByRole("heading", { name: /Complete Your Mentor Profile/i }),
    ).toBeVisible({ timeout: 5000 });

    // ── Step 1: Basic Info should be visible by default ──
    await expect(
      page.getByText("Basic Information"),
    ).toBeVisible();

    // ── Navigate to Step 2 (Skills & Experience) by clicking Continue ──
    const continueBtn = page.getByRole("button", { name: /Continue/i });
    await continueBtn.click();

    // Wait for the skills section to appear
    await expect(
      page.getByText("Skills & Experience"),
    ).toBeVisible();

    // ── Find the skill input ──
    const skillInput = page.locator(
      '.ps-skills-row input[placeholder="Enter a skill"]',
    );

    await expect(skillInput).toBeVisible({ timeout: 5000 });

    // ── Verify the input is editable by typing text in it ──
    await skillInput.click();
    await skillInput.fill("");

    // Type character by character to verify it works
    await skillInput.pressSequentially("React", { delay: 100 });

    // ── Verify the typed text appears in the input ──
    const inputValue = await skillInput.inputValue();
    expect(inputValue).toBe("React");

    // ── Click the "Add" button ──
    const addButton = page.getByRole("button", { name: /Add/i });
    await expect(addButton).toBeVisible();
    await addButton.click();

    // ── Verify the skill tag "React" appears ──
    const skillTag = page.locator(".ps-tag span").first();
    await expect(skillTag).toBeVisible({ timeout: 5000 });
    await expect(skillTag).toHaveText("React");

    // ── Verify the input is cleared after adding ──
    const clearedValue = await skillInput.inputValue();
    expect(clearedValue).toBe("");

    // Type and add one more skill to ensure repeated use works
    await skillInput.fill("TypeScript");
    await addButton.click();

    // Verify both skill tags exist
    const tagTexts = await page.locator(".ps-tag span").allTextContents();
    expect(tagTexts).toContain("React");
    expect(tagTexts).toContain("TypeScript");

    // Verify no console errors were logged during the entire test
    expect(consoleErrors).toEqual([]);
  });
});
