/**
 * E2E test: No card overflow at 320px viewport.
 *
 * Verifies that all card types (skill cards, mentor cards, path cards,
 * career cards, resource cards) render without horizontal overflow
 * at a narrow 320px mobile viewport.
 *
 * Uses the same auth injection and API mocking patterns as the
 * accessibility audit tests.
 */

import { expect, test } from "@playwright/test";

/* ──────────────────────────────────────────────────────────
   Mock JWT + auth helpers (mirrored from accessibility-audit)
   ────────────────────────────────────────────────────────── */

function base64url(str) {
  return Buffer.from(str)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function createMockJwt(userId, role) {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      userId,
      role,
      exp: Math.floor(Date.now() / 1000) + 86400,
      sub: String(userId),
    })
  );
  return `${header}.${payload}.mocksignature`;
}

const MOCK_USER = {
  id: 21,
  email: "learner@test.com",
  role: "LEARNER",
  firstName: "Alex",
  lastName: "Learner",
  aboutMe: "Test profile for overflow testing.",
  skills: "React, JavaScript, CSS",
  profileCompletionPercent: 100,
};

async function injectAuthState(page) {
  const token = createMockJwt(MOCK_USER.id, MOCK_USER.role);

  await page.addInitScript((args) => {
    window.localStorage.setItem("token", args.token);
    window.localStorage.setItem("user", args.user.email);
    window.localStorage.setItem("currentUser", JSON.stringify(args.user));
  }, { token, user: MOCK_USER });

  await page.route("**/api/v1/users/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { data: MOCK_USER } }),
    });
  });

  await page.route("**/api/v1/notifications/unread-count", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { data: 0 } }),
    });
  });

  await page.route("**/api/v1/auth/refresh", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { token } }),
    });
  });

  await page.route("**/api/v1/users/me/ping", async (route) => {
    await route.fulfill({ status: 200, body: "{}" });
  });
}

/* ──────────────────────────────────────────────────────────
   Overflow check helper
   ────────────────────────────────────────────────────────── */

/**
 * Scrolls through all cards of the given selector and checks for overflow.
 * Returns an array of { index, selector, text } for cards that overflow.
 */
async function findOverflowingCards(page, cardSelector) {
  return page.evaluate((selector) => {
    const cards = document.querySelectorAll(selector);
    const overflowing = [];
    cards.forEach((card, i) => {
      // hidden overflow on the card itself
      if (card.scrollWidth > card.clientWidth) {
        overflowing.push({
          index: i,
          selector: selector,
          text: (card.textContent || "").trim().substring(0, 80),
          type: "card-scroll",
          scrollWidth: card.scrollWidth,
          clientWidth: card.clientWidth,
        });
      }
      // Check children for overflow beyond card bounds
      // Skip absolutely/fixed positioned elements (e.g. save buttons, watermarks, badges)
      const cardRect = card.getBoundingClientRect();
      const children = card.querySelectorAll("*");
      children.forEach((child) => {
        const pos = window.getComputedStyle(child).position;
        if (pos === "absolute" || pos === "fixed") return;
        // Skip pseudo-elements and invisible children
        const childRect = child.getBoundingClientRect();
        if (childRect.width === 0 || childRect.height === 0) return;
        if (
          childRect.right > cardRect.right + 1 ||
          childRect.left < cardRect.left - 1
        ) {
          const tag = child.tagName.toLowerCase();
          const cls = child.className || "";
          overflowing.push({
            index: i,
            selector: selector,
            text: (child.textContent || "").trim().substring(0, 60),
            type: "child-overflow",
            tag,
            class: typeof cls === "string" ? cls.substring(0, 60) : "",
            childRight: Math.round(childRect.right),
            cardRight: Math.round(cardRect.right),
          });
        }
      });
    });
    return overflowing;
  }, cardSelector);
}

/* ──────────────────────────────────────────────────────────
   Test: No card overflow at 320px viewport
   ────────────────────────────────────────────────────────── */

test.describe("Card overflow at 320px viewport", () => {
  test.beforeEach(async ({ page }) => {
    await injectAuthState(page);
    await page.setViewportSize({ width: 320, height: 800 });
  });

  test("Skill cards have no overflow on the Explore Skills page", async ({ page }) => {
    const consoleErrors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    // Mock skills API — return plain array so apiGet passes it through
    await page.route("**/api/v1/skills*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          { id: 1, name: "Java", category: "Backend", difficulty: "intermediate", description: "Build enterprise applications with Java.", learners: 12000, mentors: 45, rating: 4.5 },
          { id: 2, name: "React", category: "Frontend", difficulty: "beginner", description: "Master React to build interactive user interfaces.", learners: 25000, mentors: 60, rating: 4.8 },
          { id: 3, name: "Spring Boot", category: "Backend", difficulty: "intermediate", description: "Create production-grade Spring applications.", learners: 8000, mentors: 30, rating: 4.3 },
          { id: 4, name: "Python", category: "AI/ML", difficulty: "beginner", description: "Learn Python from scratch.", learners: 30000, mentors: 55, rating: 4.7 },
          { id: 5, name: "Node.js", category: "Backend", difficulty: "intermediate", description: "Build scalable server applications.", learners: 15000, mentors: 40, rating: 4.4 },
          { id: 6, name: "AWS", category: "Cloud", difficulty: "advanced", description: "Master Amazon Web Services.", learners: 10000, mentors: 35, rating: 4.6 },
          { id: 7, name: "Docker", category: "DevOps", difficulty: "intermediate", description: "Containerise your applications.", learners: 7000, mentors: 25, rating: 4.2 },
          { id: 8, name: "SQL", category: "Data", difficulty: "beginner", description: "Manage relational databases.", learners: 20000, mentors: 20, rating: 4.1 },
        ]),
      });
    });

    await page.route("**/api/v1/users/mentors", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
    });

    await page.route("**/api/v1/watchlist/skills", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
    });

    await page.goto("/learner/skills", { waitUntil: "load", timeout: 30000 });
    await page.waitForTimeout(2000);

    // Check sk-card elements for overflow
    const overflowCards = await findOverflowingCards(page, ".sk-card");
    if (overflowCards.length > 0) {
      console.log("Overflowing skill cards:", JSON.stringify(overflowCards, null, 2));
    }
    expect(overflowCards, `Found ${overflowCards.length} skill cards with overflow`).toHaveLength(0);

    // Check career cards
    const overflowCareers = await findOverflowingCards(page, ".sk-career-card--catalog");
    if (overflowCareers.length > 0) {
      console.log("Overflowing career cards:", JSON.stringify(overflowCareers, null, 2));
    }
    expect(overflowCareers, `Found ${overflowCareers.length} career cards with overflow`).toHaveLength(0);

    // Check resource cards
    const overflowResources = await findOverflowingCards(page, ".sk-resource-card--catalog");
    if (overflowResources.length > 0) {
      console.log("Overflowing resource cards:", JSON.stringify(overflowResources, null, 2));
    }
    expect(overflowResources, `Found ${overflowResources.length} resource cards with overflow`).toHaveLength(0);

    // Check path cards
    const overflowPaths = await findOverflowingCards(page, ".sk-path-card--catalog");
    if (overflowPaths.length > 0) {
      console.log("Overflowing path cards:", JSON.stringify(overflowPaths, null, 2));
    }
    expect(overflowPaths, `Found ${overflowPaths.length} path cards with overflow`).toHaveLength(0);

    // No console errors
    expect(consoleErrors).toEqual([]);
  });

  test("Mentor cards have no overflow on the Find Mentors page", async ({ page }) => {
    const consoleErrors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    // Mock search mentors API — return plain array
    await page.route("**/api/v1/search/mentors*", async (route) => {
      const mentors = Array.from({ length: 6 }, (_, i) => ({
        mentorId: i + 1,
        mentorName: `Mentor Number ${i + 1} With a Very Long Name`,
        skills: "JavaScript, TypeScript, React, Node.js, Python, Java",
        profileImageUrl: null,
        averageRating: 4.5 + (i * 0.1),
        totalReviews: 10 + i * 5,
        liveNow: i < 2,
        mentorVerified: i < 3,
        bookingEnabled: true,
        acceptingStudents: true,
        languages: "English, Hindi, Spanish",
        responseTimeMinutes: 30 + i * 15,
        totalCompletedSessions: 50 + i * 20,
        minSessionPrice: 25 + i * 10,
        headline: "Senior Software Engineer & Technical Mentor",
        company: "Tech Corp Inc.",
        experienceYears: 3 + i,
      }));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mentors),
      });
    });

    await page.route("**/api/v1/watchlist/mentors", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
    });

    await page.goto("/learner/mentors", { waitUntil: "load", timeout: 30000 });
    await page.waitForTimeout(2000);

    // Check mentor cards
    const overflowMentors = await findOverflowingCards(page, ".lf-mentor-card");
    if (overflowMentors.length > 0) {
      console.log("Overflowing mentor cards:", JSON.stringify(overflowMentors, null, 2));
    }
    expect(overflowMentors, `Found ${overflowMentors.length} mentor cards with overflow`).toHaveLength(0);

    expect(consoleErrors).toEqual([]);
  });

  test("Skill detail page card sections have no overflow", async ({ page }) => {
    const consoleErrors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    // Static/sample data, no API mocking needed
    await page.goto("/learner/skills/java", { waitUntil: "load", timeout: 30000 });
    await page.waitForTimeout(2000);

    // Check stat/panel sections for overflow
    const overflowStats = await findOverflowingCards(page, ".mp-stat");
    if (overflowStats.length > 0) {
      console.log("Overflowing stat panels:", JSON.stringify(overflowStats, null, 2));
    }
    expect(overflowStats, `Found ${overflowStats.length} stat panels with overflow`).toHaveLength(0);

    expect(consoleErrors).toEqual([]);
  });
});
