/**
 * E2E test for the Profile Setup "Add Skill" input field.
 *
 * Verifies:
 * 1. The skill input renders on Step 2 and accepts typed text
 * 2. Typing is visible in the input
 * 3. Clicking "Add" creates a skill tag
 * 4. The input clears after adding
 *
 * Uses a real auth token from the backend login API, then selectively
 * mocks the /api/v1/users/me endpoint to return an INCOMPLETE mentor
 * profile so the app navigates to /profile-setup (needsProfileSetup).
 * All other API calls pass through to the real backend normally.
 */

import { expect, test } from "@playwright/test";

const BACKEND_URL =
  process.env.PLAYWRIGHT_BACKEND_URL || "http://localhost:8080";

/**
 * Fetch a real auth token via the backend API.
 */
async function fetchAuthToken(request) {
  const candidates = ["password", "test@123"];
  for (const password of candidates) {
    const resp = await request.post(`${BACKEND_URL}/api/v1/auth/login`, {
      data: { email: "mentor@test.com", password },
    });
    if (resp.ok()) {
      const body = await resp.json();
      const token = body?.data?.token;
      if (token) return token;
    }
  }
  return null;
}

/* ─────────────────────────────────────────────────────────────
   Test: Skill input renders, accepts typing, and adds skills
   ───────────────────────────────────────────────────────────── */

test.describe("Profile Setup — Add Skill input", () => {
  test("typing in the skill input shows the entered text and Add button creates a skill tag", async ({
    page,
    request,
  }) => {
    test.setTimeout(60000);

    const token = await fetchAuthToken(request);
    test.skip(!token, "Skipping – could not obtain auth token for mentor@test.com.");

    // Collect console errors from the very start
    const consoleErrors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    // Inject the real auth token into localStorage before the app loads
    await page.addInitScript((t) => {
      window.localStorage.setItem("token", t);
    }, token);

    // Intercept GET /api/v1/users/me: fetch the real response from the backend
    // (which has the correct user ID matching the JWT token), then override
    // only the profile fields to be empty so needsProfileSetup=true.
    // This preserves the real user ID from the database, which is critical
    // because useAuth.js strictly compares JWT userId vs profile userId.
    await page.route("**/api/v1/users/me", async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      const response = await route.fetch();
      const body = await response.json();
      if (body?.data?.id) {
        // Make the profile appear incomplete so the app stays on /profile-setup
        body.data.skills = "";
        body.data.aboutMe = "";
        body.data.githubUrl = "";
        body.data.linkedinUrl = "";
      }
      return route.fulfill({ response, body: JSON.stringify(body) });
    });

    // Navigate to the profile-setup page
    await page.goto("/profile-setup", { waitUntil: "domcontentloaded" });

    // Wait for the SPA to bootstrap and the auth flow to complete.
    // The ps-wrapper class appears once the ProfileSetup component renders.
    await page.waitForSelector(".ps-wrapper", { timeout: 30000 });

    // Verify we're on the right page
    await expect(
      page.getByRole("heading", { name: /Complete Your Mentor Profile/i }),
    ).toBeVisible({ timeout: 5000 });

    // ── Step 1: Basic Info should be visible by default ──
    await expect(
      page.getByRole("heading", { name: /Basic Information/i }),
    ).toBeVisible();

    // ── Navigate to Step 2 (Skills & Experience) by clicking Continue ──
    const continueBtn = page.getByRole("button", { name: /Continue/i });
    await continueBtn.click();

    // Wait for the skills section to appear
    await expect(
      page.getByRole("heading", { name: /Skills & Experience/i }),
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
