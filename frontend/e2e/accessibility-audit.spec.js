import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// ═══════════════════════════════════════════════════════════
//  Mock JWT utilities (Node.js-compatible)
// ═══════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════
//  Mock user profiles
// ═══════════════════════════════════════════════════════════

const MOCK_USERS = {
  LEARNER: {
    id: 21,
    email: "learner@test.com",
    role: "LEARNER",
    firstName: "Alex",
    lastName: "Learner",
    aboutMe: "A learner profile for accessibility testing.",
    skills: "React, JavaScript, CSS",
    profileCompletionPercent: 100,
  },
  MENTOR: {
    id: 42,
    email: "mentor@test.com",
    role: "MENTOR",
    firstName: "Morgan",
    lastName: "Mentor",
    aboutMe: "A mentor profile for accessibility testing.",
    skills: "React, Node.js, System Design",
    profileCompletionPercent: 100,
  },
  ADMIN: {
    id: 1,
    email: "admin@test.com",
    role: "ADMIN",
    firstName: "Admin",
    lastName: "User",
    aboutMe: "Admin account for accessibility testing.",
    skills: "Management, Operations",
    profileCompletionPercent: 100,
  },
};

// ═══════════════════════════════════════════════════════════
//  Auth injection helper — sets up localStorage + API mocks
// ═══════════════════════════════════════════════════════════

async function injectAuthState(page, role = "LEARNER") {
  const user = MOCK_USERS[role];
  const token = createMockJwt(user.id, user.role);

  // Set auth tokens in localStorage before page loads
  await page.addInitScript((args) => {
    window.localStorage.setItem("token", args.token);
    window.localStorage.setItem("user", args.user.email);
    window.localStorage.setItem("currentUser", JSON.stringify(args.user));
  }, { token, user });

  // Use route.fallback() so that more general routes don't shadow specific ones.
  // These are registered as the FIRST routes (will be checked last in LIFO),
  // which is correct: specific override routes registered AFTER will take precedence.
  // See Playwright docs: routes are checked in reverse registration order.

  await page.route("**/api/v1/users/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { data: user } }),
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

// ═══════════════════════════════════════════════════════════
//  Axe-core runner — runs audit and logs all violations
// ═══════════════════════════════════════════════════════════

async function runAxeAudit(page, pageName) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
    .analyze();

  const violations = results.violations;

  console.log(`\n═══════════════════════════════════════`);
  console.log(`  Page: ${pageName}`);
  console.log(`  URL: ${page.url()}`);
  console.log(`  Violations: ${violations.length}`);
  console.log(`    Critical: ${violations.filter(v => v.impact === "critical").length}`);
  console.log(`    Serious:  ${violations.filter(v => v.impact === "serious").length}`);
  console.log(`    Moderate: ${violations.filter(v => v.impact === "moderate").length}`);
  console.log(`    Minor:    ${violations.filter(v => v.impact === "minor").length}`);
  console.log(`  Passes: ${results.passes.length}`);
  console.log(`═══════════════════════════════════════\n`);

  for (const violation of violations) {
    console.log(`  ❌ ${violation.id} (${violation.impact})`);
    console.log(`     Help: ${violation.help}`);
    console.log(`     WCAG: ${violation.tags.filter(t => t.startsWith("wcag")).join(", ")}`);
    for (const node of violation.nodes.slice(0, 5)) {
      console.log(`     • ${node.html.substring(0, 150)}`);
      for (const issue of node.all.slice(0, 1)) {
        console.log(`       ↳ ${issue.message.substring(0, 150)}`);
      }
    }
    if (violation.nodes.length > 5) {
      console.log(`       … and ${violation.nodes.length - 5} more`);
    }
    console.log("");
  }

  return results;
}

// ═══════════════════════════════════════════════════════════
//  Page audit helper — navigate, wait, run axe, assert
// ═══════════════════════════════════════════════════════════

async function testPageAccessibility(page, url, name, authRole = null) {
  await test.step(`Navigate to ${name}`, async () => {
    if (authRole) {
      await injectAuthState(page, authRole);
    }
    // Use "load" instead of "networkidle" because the app has polling intervals
    // (notification count every 15s, activity ping every 60s) that never settle
    await page.goto(url, { waitUntil: "load", timeout: 30000 });
    await page.waitForTimeout(2000);
  });

  await test.step(`Run axe-core audit on ${name}`, async () => {
    const results = await runAxeAudit(page, name);
    const criticalSerious = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );
    expect(
      criticalSerious,
      `Found ${criticalSerious.length} critical/serious violations on ${name}`
    ).toHaveLength(0);
  });
}

// ═══════════════════════════════════════════════════════════
//  TESTS — Public (Unauthenticated) Pages
// ═══════════════════════════════════════════════════════════

test.describe("Accessibility Audit — Public Pages", () => {
  test("Landing / Auth page", async ({ page }) => {
    await testPageAccessibility(page, "/", "Landing / Auth Page");
  });

  test("Login page", async ({ page }) => {
    await testPageAccessibility(page, "/login", "Login Page");
  });

  test("Signup page", async ({ page }) => {
    await testPageAccessibility(page, "/signup", "Signup Page");
  });

  test("Public resources page", async ({ page }) => {
    await testPageAccessibility(page, "/resources", "Public Resources");
  });

  test("Not Found (404) page", async ({ page }) => {
    await testPageAccessibility(page, "/nonexistent-route-xyz", "404 Not Found");
  });

  test("Public mentor profile", async ({ page }) => {
    await page.route("**/api/v1/users/mentors/42", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            id: 42,
            firstName: "Morgan",
            lastName: "Mentor",
            role: "MENTOR",
            title: "Senior Software Engineer",
            aboutMe: "Experienced mentor helping others grow.",
            skills: "React, Node.js, System Design",
            languages: "English, Spanish",
            hourlyRate: 50,
            rating: 4.8,
            reviewCount: 24,
            available: true,
          },
        }),
      });
    });
    await testPageAccessibility(page, "/mentors/42", "Public Mentor Profile");
  });
});

// ═══════════════════════════════════════════════════════════
//  TESTS — Learner Pages (authenticated as LEARNER)
// ═══════════════════════════════════════════════════════════

test.describe("Accessibility Audit — Learner Pages", () => {
  const API_MOCKS = [
    { pattern: "**/api/v1/mentors/**",           body: { data: [] } },
    { pattern: "**/api/v1/sessions/**",           body: { data: [] } },
    { pattern: "**/api/v1/certificates/**",       body: { data: [] } },
    { pattern: "**/api/v1/conversations/**",      body: { data: [] } },
    { pattern: "**/api/v1/bookings/**",           body: { data: [] } },
    { pattern: "**/api/v1/notifications/**",      body: { data: [] } },
  ];

  test.beforeEach(async ({ page }) => {
    // Register API mocks AFTER injectAuthState routes so they take precedence.
    // Playwright checks routes in reverse registration order (LIFO),
    // so registering these after injectAuthState means they'll be checked first.
    for (const mock of API_MOCKS) {
      await page.route(mock.pattern, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mock.body),
        });
      });
    }
  });

  const LEARNER_ROUTES = [
    ["/learner/dashboard", "Learner Dashboard"],
    ["/learner/mentors", "Learner Mentors"],
    ["/learner/skills", "Learner Skills"],
    ["/learner/sessions", "Learner Sessions"],
    ["/learner/messages", "Learner Messages"],
    ["/learner/profile", "Learner Profile"],
    ["/learner/settings", "Learner Settings"],
    ["/learner/notifications", "Learner Notifications"],
    ["/learner/certificates", "Learner Certificates"],
    ["/learner/wallet", "Learner Wallet"],
    ["/learner/saved", "Learner Saved Mentors"],
    ["/learner/path", "Learner Path"],
    ["/learner/achievements", "Learner Achievements"],
    ["/learner/resources", "Learner Resources"],
  ];

  for (const [route, name] of LEARNER_ROUTES) {
    test(`Learner: ${name}`, async ({ page }) => {
      await testPageAccessibility(page, route, name, "LEARNER");
    });
  }
});

// ═══════════════════════════════════════════════════════════
//  TESTS — Mentor Pages (authenticated as MENTOR)
// ═══════════════════════════════════════════════════════════

test.describe("Accessibility Audit — Mentor Pages", () => {
  const API_MOCKS = [
    { pattern: "**/api/v1/sessions/**",  body: { data: { sessions: [], totalCount: 0 } } },
    { pattern: "**/api/v1/reviews/**",   body: { data: [] } },
    { pattern: "**/api/v1/students/**",  body: { data: [] } },
    { pattern: "**/api/v1/analytics/**",  body: { data: {} } },
    { pattern: "**/api/v1/availability/**", body: { data: { slots: [] } } },
    { pattern: "**/api/v1/conversations/**", body: { data: [] } },
    { pattern: "**/api/v1/notifications/**", body: { data: [] } },
  ];

  test.beforeEach(async ({ page }) => {
    for (const mock of API_MOCKS) {
      await page.route(mock.pattern, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mock.body),
        });
      });
    }
  });

  const MENTOR_ROUTES = [
    ["/mentor/dashboard", "Mentor Dashboard"],
    ["/mentor/teach", "Mentor Teach"],
    ["/mentor/students", "Mentor Students"],
    ["/mentor/calendar", "Mentor Calendar"],
    ["/mentor/analytics", "Mentor Analytics"],
    ["/mentor/reviews", "Mentor Reviews"],
    ["/mentor/messages", "Mentor Messages"],
    ["/mentor/wallet", "Mentor Wallet"],
    ["/mentor/professional-profile", "Mentor Professional Profile"],
    ["/mentor/notifications", "Mentor Notifications"],
    ["/mentor/settings", "Mentor Settings"],
  ];

  for (const [route, name] of MENTOR_ROUTES) {
    test(`Mentor: ${name}`, async ({ page }) => {
      await testPageAccessibility(page, route, name, "MENTOR");
    });
  }
});

// ═══════════════════════════════════════════════════════════
//  TESTS — Admin Pages (authenticated as ADMIN)
// ═══════════════════════════════════════════════════════════

test.describe("Accessibility Audit — Admin Pages", () => {
  const API_MOCKS = [
    { pattern: "**/api/v1/admin/**",        body: { data: [] } },
    { pattern: "**/api/v1/users/**",        body: { data: [] } },
    { pattern: "**/api/v1/admin/audit-logs/**", body: { data: { logs: [], totalPages: 0 } } },
    { pattern: "**/api/v1/admin/metrics/**",    body: { data: {} } },
    { pattern: "**/api/v1/notifications/**",    body: { data: [] } },
  ];

  test.beforeEach(async ({ page }) => {
    for (const mock of API_MOCKS) {
      await page.route(mock.pattern, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mock.body),
        });
      });
    }
  });

  const ADMIN_ROUTES = [
    ["/admin/dashboard", "Admin Dashboard"],
    ["/admin/users", "Admin User Management"],
    ["/admin/sessions", "Admin Session Management"],
    ["/admin/analytics", "Admin Analytics"],
    ["/admin/payments", "Admin Payments"],
    ["/admin/notifications", "Admin Broadcast"],
    ["/admin/settings", "Admin System Settings"],
    ["/admin/audit-log", "Admin Audit Log"],
    ["/admin/flagged-content", "Admin Content Moderation"],
    ["/admin/health", "Admin Platform Health"],
    ["/admin/api-docs", "Admin API Docs"],
  ];

  for (const [route, name] of ADMIN_ROUTES) {
    test(`Admin: ${name}`, async ({ page }) => {
      await testPageAccessibility(page, route, name, "ADMIN");
    });
  }
});
