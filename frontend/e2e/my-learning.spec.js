/**
 * E2E test for the session-based "My Learning" dashboard.
 *
 * Covers the learner journey end to end:
 *   1. My Learning renders the premium session dashboard (hero greeting with
 *      glass quick-stats, Learning Overview, priority Continue Learning,
 *      Session Timeline, Learning History, Learning Calendar, Today's Todo
 *      List, Recent Activity, Learning Statistics) — all backed by the real
 *      backend, with honest empty states for a brand-new learner (including
 *      the auto-generated "Book your next session" todo suggestion).
 *   2. The todo list supports add / complete / delete against the database.
 *   3. My Roadmaps hosts the "Choose Your Learning Goal" catalog; creating a
 *      roadmap archives nothing and shows the ACTIVE roadmap card.
 *
 * The test signs up a throwaway learner through the backend API (unique email
 * per run), completes the profile via the API, then injects the auth token —
 * no UI form automation needed, keeping the spec self-contained and idempotent.
 */

import { expect, test } from "@playwright/test";

const BACKEND_URL =
  process.env.PLAYWRIGHT_BACKEND_URL || "http://localhost:8080";

const COMPLETE_PROFILE_PAYLOAD = {
  fullName: "E2E Learner",
  profileImageUrl: "https://i.pravatar.cc/150",
  aboutMe: "Learning to become a backend developer.",
  skills: "Java,Spring Boot",
  languages: "English",
  country: "India",
  state: "Delhi",
  city: "New Delhi",
  timezone: "Asia/Kolkata",
  phoneNumber: "+911234567890",
  learningGoals: "Become a Java Backend Developer",
  currentSkillLevel: "Beginner",
};

/** Signs up a fresh learner, completes the profile and returns the auth token. */
async function createCompletedLearner(request) {
  const suffix = Date.now().toString(36);
  const signup = await request.post(`${BACKEND_URL}/api/v1/auth/signup`, {
    data: {
      email: `mylearning-${suffix}@test.com`,
      password: "TestPass123!",
      fullName: "E2E Learner",
      username: `mylearner${suffix}`,
      role: "LEARNER",
    },
  });
  if (!signup.ok()) return null;
  const body = await signup.json();
  const token = body?.data?.token;
  if (!token) return null;

  const profile = await request.post(
    `${BACKEND_URL}/api/v1/users/me/profile/complete`,
    { headers: { Authorization: `Bearer ${token}` }, data: COMPLETE_PROFILE_PAYLOAD },
  );
  if (!profile.ok()) return null;
  return token;
}

test.describe("My Learning — session-based learner dashboard", () => {
  test("renders the dashboard sections, manages todos, and creates a roadmap", async ({
    page,
    request,
  }) => {
    test.setTimeout(120000);

    const token = await createCompletedLearner(request);
    test.skip(!token, "Skipping — could not create a completed learner via the backend.");

    await page.addInitScript((t) => {
      window.localStorage.setItem("token", t);
      window.sessionStorage.setItem("token", t);
      window.localStorage.setItem(
        "currentUser",
        JSON.stringify({ email: "mylearning@test.com", role: "LEARNER" }),
      );
    }, token);

    // ── Step 1: Session dashboard sections ──────────────────────────────
    await page.goto("/learner/learning");
    await expect(page.getByText(/Good (Morning|Afternoon|Evening)/)).toBeVisible({
      timeout: 20000,
    });
    await expect(page.getByText("E2E", { exact: false }).first()).toBeVisible();

    // Hero action buttons match the platform language.
    await expect(
      page.getByRole("link", { name: /Browse Mentors/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Book Session/i }),
    ).toBeVisible();

    const sections = [
      "Learning Overview",
      "Session Timeline",
      "Learning History",
      "Learning Calendar",
      "Today's Todo List",
      "Recent Activity",
      "Learning Statistics",
    ];
    for (const title of sections) {
      await expect(page.getByRole("heading", { name: title }).first()).toBeVisible();
    }
    // Continue Learning heading appears (hero button + section heading).
    await expect(page.getByText("Continue Learning").first()).toBeVisible();

    // A brand-new learner sees honest empty states…
    await expect(page.getByText("No active learning sessions yet")).toBeVisible();
    await expect(page.getByText("Your learning timeline will appear here")).toBeVisible();
    // …the Active Mentors section is hidden entirely (no mentors yet)…
    await expect(
      page.getByRole("heading", { name: "Active Mentors" }),
    ).not.toBeVisible();
    // …and the backend auto-generates a first todo suggestion from real data.
    await expect(
      page.getByText("Book your next session with a mentor"),
    ).toBeVisible();

    await page.screenshot({ path: "test-results/my-learning-1-dashboard.png" });

    // ── Step 2: Todo list CRUD ──────────────────────────────────────────
    const todoInput = page.getByLabel("New task");
    await expect(todoInput).toBeVisible();

    const todoList = page.locator(".ml-todo-list");

    // Add
    await todoInput.fill("Revise Java Collections");
    await page.getByRole("button", { name: "Add" }).click();
    await expect(todoList.getByText("Revise Java Collections")).toBeVisible({
      timeout: 10000,
    });

    // Add a second task
    await todoInput.fill("Submit Spring Boot assignment");
    await page.getByRole("button", { name: "Add" }).click();
    await expect(todoList.getByText("Submit Spring Boot assignment")).toBeVisible({
      timeout: 10000,
    });

    // Complete the first task
    await page
      .getByRole("button", { name: /Mark "Revise Java Collections" as done/i })
      .click();
    await expect(
      page.getByRole("button", { name: /Mark "Revise Java Collections" as not done/i }),
    ).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: "test-results/my-learning-2-todos.png" });

    // Delete the second task
    await page
      .getByRole("button", { name: /Delete "Submit Spring Boot assignment"/i })
      .click();
    await expect(todoList.getByText("Submit Spring Boot assignment")).not.toBeVisible({
      timeout: 10000,
    });

    // Recent Activity reflects the todo actions.
    await expect(page.getByText("Completed a task").first()).toBeVisible();

    // ── Step 3: My Roadmaps onboarding + creation ───────────────────────
    await page.goto("/learner/roadmaps");
    await expect(
      page.getByRole("heading", { name: "Choose Your Learning Goal" }),
    ).toBeVisible({ timeout: 20000 });

    const javaCard = page
      .locator(".ml-goal-card", { hasText: "Java Backend Developer" })
      .first();
    await expect(javaCard).toBeVisible();
    await expect(javaCard.getByText("16 Weeks")).toBeVisible();
    await expect(javaCard.getByText("Intermediate")).toBeVisible();
    await expect(
      javaCard.getByRole("button", { name: /Create Roadmap/i }),
    ).toBeVisible();

    await javaCard.getByRole("button", { name: /Create Roadmap/i }).click();
    const roadmapCard = page
      .locator(".ml-roadmap-card", { hasText: "Java Backend Developer" })
      .first();
    await expect(roadmapCard).toBeVisible({ timeout: 20000 });
    await expect(roadmapCard.getByText("Active")).toBeVisible();
    await expect(roadmapCard.getByText(/0% complete/)).toBeVisible();
    await expect(
      roadmapCard.getByRole("button", { name: /Archive/i }),
    ).toBeVisible();
    await page.screenshot({ path: "test-results/my-learning-3-my-roadmaps.png" });
  });
});
