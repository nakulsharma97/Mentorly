// @ts-check
/**
 * DevSync Performance Audit
 * ─────────────────────────
 * Measures TTFB, FCP, LCP, DOMContentLoaded, Load, and interactive time
 * for every route in the application. Flags slow pages and duplicate API calls.
 *
 * Usage:
 *   npx playwright test e2e/perf-audit.spec.js
 *   npm run perf:audit
 *
 * Requires: frontend dev server on :5174, backend on :8080
 */
import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

// ──────────────────────────────────────────────
//  Route Definitions
// ──────────────────────────────────────────────

/** @typedef {{ path: string; name: string; auth: "none"|"learner"|"mentor"|"admin" }} RouteDef */

/** @type {RouteDef[]} */
const ROUTES = [
  // ── Public ──
  { path: "/", name: "Landing / Auth Page", auth: "none" },
  { path: "/login", name: "Login Page", auth: "none" },
  { path: "/signup", name: "Signup Page", auth: "none" },
  { path: "/resources", name: "Resources (Public)", auth: "none" },

  // ── Learner ──
  { path: "/learner/dashboard", name: "Learner Dashboard", auth: "learner" },
  { path: "/learner/mentors", name: "Learner Mentors", auth: "learner" },
  { path: "/learner/skills", name: "Learner Skills", auth: "learner" },
  { path: "/learner/skills/1", name: "Learner Skill Detail", auth: "learner" },
  { path: "/learner/learning", name: "Learner My Learning", auth: "learner" },
  { path: "/learner/tasks", name: "Learner Tasks", auth: "learner" },
  { path: "/learner/sessions", name: "Learner Sessions", auth: "learner" },
  { path: "/learner/requests", name: "Learner Session Requests", auth: "learner" },
  { path: "/learner/certificates", name: "Learner Certificates", auth: "learner" },
  { path: "/learner/messages", name: "Learner Messages", auth: "learner" },
  { path: "/learner/saved", name: "Learner Saved Mentors", auth: "learner" },
  { path: "/learner/path", name: "Learner Learning Path", auth: "learner" },
  { path: "/learner/achievements", name: "Learner Achievements", auth: "learner" },
  { path: "/learner/notifications", name: "Learner Notifications", auth: "learner" },
  { path: "/learner/profile", name: "Learner Profile", auth: "learner" },
  { path: "/learner/settings", name: "Learner Settings", auth: "learner" },
  { path: "/learner/wallet", name: "Learner Wallet", auth: "learner" },

  // ── Mentor ──
  { path: "/mentor/dashboard", name: "Mentor Dashboard", auth: "mentor" },
  { path: "/mentor/teach", name: "Mentor Teach", auth: "mentor" },
  { path: "/mentor/students", name: "Mentor Students", auth: "mentor" },
  { path: "/mentor/calendar", name: "Mentor Calendar", auth: "mentor" },
  { path: "/mentor/analytics", name: "Mentor Analytics", auth: "mentor" },
  { path: "/mentor/reviews", name: "Mentor Reviews", auth: "mentor" },
  { path: "/mentor/messages", name: "Mentor Messages", auth: "mentor" },
  { path: "/mentor/wallet", name: "Mentor Wallet", auth: "mentor" },
  { path: "/mentor/professional-profile", name: "Mentor Professional Profile", auth: "mentor" },
  { path: "/mentor/notifications", name: "Mentor Notifications", auth: "mentor" },
  { path: "/mentor/settings", name: "Mentor Settings", auth: "mentor" },

  // ── Admin ──
  { path: "/admin/dashboard", name: "Admin Dashboard", auth: "admin" },
  { path: "/admin/users", name: "Admin Users", auth: "admin" },
  { path: "/admin/sessions", name: "Admin Sessions", auth: "admin" },
  { path: "/admin/analytics", name: "Admin Analytics", auth: "admin" },
  { path: "/admin/notifications", name: "Admin Broadcast", auth: "admin" },
  { path: "/admin/notification-center", name: "Admin Notification Center", auth: "admin" },
  { path: "/admin/settings", name: "Admin Settings", auth: "admin" },
  { path: "/admin/audit-log", name: "Admin Audit Log", auth: "admin" },
  { path: "/admin/flagged-content", name: "Admin Flagged Content", auth: "admin" },
  { path: "/admin/health", name: "Admin Health", auth: "admin" },
  { path: "/admin/reports", name: "Admin Reports", auth: "admin" },
  { path: "/admin/verifications", name: "Admin Verifications", auth: "admin" },
  { path: "/admin/payments", name: "Admin Payments", auth: "admin" },
  { path: "/admin/skills", name: "Admin Skills", auth: "admin" },
  { path: "/admin/conversations", name: "Admin Conversations", auth: "admin" },
];

// ──────────────────────────────────────────────
//  Thresholds
// ──────────────────────────────────────────────
const THRESHOLDS = {
  fcp: 1800,    // ms – First Contentful Paint
  lcp: 2500,    // ms – Largest Contentful Paint
  load: 3000,   // ms – Full load
  ttfb: 800,    // ms – Time to First Byte
};

// ──────────────────────────────────────────────
//  Credentials
// ──────────────────────────────────────────────
const CREDS = {
  learner: { email: "nakulsharma978397@gmail.com", passwords: ["Learner@123", "password", "test@123"] },
  mentor:  { email: "pritilthakur@gmail.com",      passwords: ["Mentor@123", "password", "test@123"] },
  admin:   { email: "nakulsharma@gmail.com",        passwords: ["Admin@123", "password", "test@123"] },
};

// ──────────────────────────────────────────────
//  Helpers
// ──────────────────────────────────────────────

/**
 * Login via API fetch (same-origin) so the server sets the httpOnly access_token cookie.
 * No UI interaction needed.
 */
async function loginAs(page, role) {
  const cred = CREDS[role];
  if (!cred) return;

  // Navigate to the app first so same-origin fetch works
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);

  // Try each password via same-origin fetch — cookies are set automatically
  for (const pwd of cred.passwords) {
    const result = await page.evaluate(async ({ email, password }) => {
      try {
        const resp = await fetch("/api/v1/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
          credentials: "include",
        });
        if (!resp.ok) return { ok: false, status: resp.status };
        const data = await resp.json();
        return { ok: true, token: data?.data?.token };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    }, { email: cred.email, password: pwd });

    if (result.ok) {
      console.log(`  ✓ Authenticated as ${role} (password worked)`);
      return;
    }
  }

  console.log(`  ✗ No working password found for ${role} (${cred.email})`);
}

/**
 * Measures performance metrics for a page load using Performance API.
 */
async function measurePerformance(page, routePath) {
  // Navigate and collect metrics
  const startTime = Date.now();

  const response = await page.goto(routePath, {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });

  // Wait for network to settle
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500); // Extra settle time for lazy-loaded content

  const totalTime = Date.now() - startTime;

  // Collect Performance API metrics
  const metrics = await page.evaluate(() => {
    const perf = performance;
    const entries = perf.getEntriesByType("navigation");
    const nav = /** @type {PerformanceNavigationTiming} */ (entries[0]);

    // FCP
    const fcpEntries = perf.getEntriesByName("first-contentful-paint");
    const fcp = fcpEntries.length > 0 ? fcpEntries[0].startTime : 0;

    // LCP
    let lcp = 0;
    const lcpEntries = perf.getEntriesByType("largest-contentful-paint");
    if (lcpEntries.length > 0) {
      lcp = /** @type {PerformanceEntry} */ (lcpEntries[lcpEntries.length - 1]).startTime;
    }

    return {
      ttfb: nav ? nav.responseStart - nav.requestStart : 0,
      fcp,
      lcp,
      domContentLoaded: nav ? nav.domContentLoadedEventEnd - nav.startTime : 0,
      load: nav ? nav.loadEventEnd - nav.startTime : 0,
      domInteractive: nav ? nav.domInteractive - nav.startTime : 0,
      transferSize: nav ? nav.transferSize : 0,
      decodedBodySize: nav ? nav.decodedBodySize : 0,
    };
  });

  return {
    ...metrics,
    totalTime,
    statusCode: response?.status() ?? 0,
  };
}

/**
 * Captures network requests and flags duplicates.
 */
function captureNetworkRequests(page) {
  /** @type {Map<string, number>} */
  const apiCalls = new Map();
  /** @type {string[]} */
  const consoleErrors = [];
  /** @type {string[]} */
  const consoleWarnings = [];

  const requestHandler = (req) => {
    const url = req.url();
    if (url.includes("/api/")) {
      const endpoint = url.split("?")[0]; // Strip query params
      apiCalls.set(endpoint, (apiCalls.get(endpoint) || 0) + 1);
    }
  };

  const consoleHandler = (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text().slice(0, 200));
    } else if (msg.type() === "warning") {
      consoleWarnings.push(msg.text().slice(0, 200));
    }
  };

  page.on("request", requestHandler);
  page.on("console", consoleHandler);

  return {
    apiCalls,
    consoleErrors,
    consoleWarnings,
    cleanup: () => {
      page.removeListener("request", requestHandler);
      page.removeListener("console", consoleHandler);
    },
  };
}

/**
 * Formats milliseconds to a human-readable string.
 */
function fmtMs(ms) {
  if (ms === 0) return "N/A";
  if (ms < 1) return "<1ms";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Determines PASS/FAIL based on thresholds.
 */
function evaluateStatus(metrics, duplicateCalls) {
  const reasons = [];
  if (metrics.fcp > THRESHOLDS.fcp && metrics.fcp > 0) reasons.push(`FCP ${fmtMs(metrics.fcp)} > ${fmtMs(THRESHOLDS.fcp)}`);
  if (metrics.lcp > THRESHOLDS.lcp && metrics.lcp > 0) reasons.push(`LCP ${fmtMs(metrics.lcp)} > ${fmtMs(THRESHOLDS.lcp)}`);
  if (metrics.load > THRESHOLDS.load && metrics.load > 0) reasons.push(`Load ${fmtMs(metrics.load)} > ${fmtMs(THRESHOLDS.load)}`);
  if (metrics.ttfb > THRESHOLDS.ttfb && metrics.ttfb > 0) reasons.push(`TTFB ${fmtMs(metrics.ttfb)} > ${fmtMs(THRESHOLDS.ttfb)}`);
  if (duplicateCalls.length > 0) reasons.push(`${duplicateCalls.length} duplicate API call(s)`);

  return {
    status: reasons.length === 0 ? "PASS" : "FAIL",
    reasons,
  };
}

// ──────────────────────────────────────────────
//  Test Suite
// ──────────────────────────────────────────────

test.describe("DevSync Performance Audit", () => {
  // Increase timeout for the whole suite
  test.setTimeout(120_000);

  /** @type {Array<{name: string, path: string, auth: string, ttfb: number, fcp: number, lcp: number, load: number, domContentLoaded: number, requests: number, duplicateCalls: string[], consoleErrors: string[], status: string, reasons: string[]}>} */
  const results = [];

  // Group routes by auth level to minimize logins
  const publicRoutes = ROUTES.filter((r) => r.auth === "none");
  const learnerRoutes = ROUTES.filter((r) => r.auth === "learner");
  const mentorRoutes = ROUTES.filter((r) => r.auth === "mentor");
  const adminRoutes = ROUTES.filter((r) => r.auth === "admin");

  // ── Public Routes ──
  test.describe("Public Pages", () => {
    for (const route of publicRoutes) {
      test(`Performance: ${route.name} (${route.path})`, async ({ page }) => {
        const net = captureNetworkRequests(page);

        const metrics = await measurePerformance(page, route.path);

        // Collect duplicate API calls
        const duplicates = [];
        for (const [endpoint, count] of net.apiCalls) {
          if (count > 1) duplicates.push(`${endpoint} (×${count})`);
        }

        const { status, reasons } = evaluateStatus(metrics, duplicates);

        results.push({
          name: route.name,
          path: route.path,
          auth: route.auth,
          ttfb: metrics.ttfb,
          fcp: metrics.fcp,
          lcp: metrics.lcp,
          load: metrics.load,
          domContentLoaded: metrics.domContentLoaded,
          requests: net.apiCalls.size,
          duplicateCalls: duplicates,
          consoleErrors: net.consoleErrors,
          status,
          reasons,
        });

        // Soft assert so the test doesn't fail immediately
        if (status === "FAIL") {
          console.log(`  ✗ ${route.name}: ${reasons.join(", ")}`);
        }

        net.cleanup();
      });
    }
  });

  // ── Learner Routes ──
  test.describe("Learner Pages", () => {
    test.beforeAll(async ({ browser }) => {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await loginAs(page, "learner");
      await ctx.close();
    });

    for (const route of learnerRoutes) {
      test(`Performance: ${route.name} (${route.path})`, async ({ browser }) => {
        const ctx = await browser.newContext();
        const loginPage = await ctx.newPage();
        await loginAs(loginPage, "learner");
        await loginPage.close();
        const page = await ctx.newPage();
        const net = captureNetworkRequests(page);

        const metrics = await measurePerformance(page, route.path);

        const duplicates = [];
        for (const [endpoint, count] of net.apiCalls) {
          if (count > 1) duplicates.push(`${endpoint} (×${count})`);
        }

        const { status, reasons } = evaluateStatus(metrics, duplicates);

        results.push({
          name: route.name,
          path: route.path,
          auth: route.auth,
          ttfb: metrics.ttfb,
          fcp: metrics.fcp,
          lcp: metrics.lcp,
          load: metrics.load,
          domContentLoaded: metrics.domContentLoaded,
          requests: net.apiCalls.size,
          duplicateCalls: duplicates,
          consoleErrors: net.consoleErrors,
          status,
          reasons,
        });

        if (status === "FAIL") {
          console.log(`  ✗ ${route.name}: ${reasons.join(", ")}`);
        }

        net.cleanup();
        await ctx.close();
      });
    }
  });

  // ── Mentor Routes ──
  test.describe("Mentor Pages", () => {
    test.beforeAll(async ({ browser }) => {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await loginAs(page, "mentor");
      await ctx.close();
    });

    for (const route of mentorRoutes) {
      test(`Performance: ${route.name} (${route.path})`, async ({ browser }) => {
        const ctx = await browser.newContext();
        const loginPage = await ctx.newPage();
        await loginAs(loginPage, "mentor");
        await loginPage.close();
        const page = await ctx.newPage();
        const net = captureNetworkRequests(page);

        const metrics = await measurePerformance(page, route.path);

        const duplicates = [];
        for (const [endpoint, count] of net.apiCalls) {
          if (count > 1) duplicates.push(`${endpoint} (×${count})`);
        }

        const { status, reasons } = evaluateStatus(metrics, duplicates);

        results.push({
          name: route.name,
          path: route.path,
          auth: route.auth,
          ttfb: metrics.ttfb,
          fcp: metrics.fcp,
          lcp: metrics.lcp,
          load: metrics.load,
          domContentLoaded: metrics.domContentLoaded,
          requests: net.apiCalls.size,
          duplicateCalls: duplicates,
          consoleErrors: net.consoleErrors,
          status,
          reasons,
        });

        if (status === "FAIL") {
          console.log(`  ✗ ${route.name}: ${reasons.join(", ")}`);
        }

        net.cleanup();
        await ctx.close();
      });
    }
  });

  // ── Admin Routes ──
  test.describe("Admin Pages", () => {
    test.beforeAll(async ({ browser }) => {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await loginAs(page, "admin");
      await ctx.close();
    });

    for (const route of adminRoutes) {
      test(`Performance: ${route.name} (${route.path})`, async ({ browser }) => {
        const ctx = await browser.newContext();
        const loginPage = await ctx.newPage();
        await loginAs(loginPage, "admin");
        await loginPage.close();
        const page = await ctx.newPage();
        const net = captureNetworkRequests(page);

        const metrics = await measurePerformance(page, route.path);

        const duplicates = [];
        for (const [endpoint, count] of net.apiCalls) {
          if (count > 1) duplicates.push(`${endpoint} (×${count})`);
        }

        const { status, reasons } = evaluateStatus(metrics, duplicates);

        results.push({
          name: route.name,
          path: route.path,
          auth: route.auth,
          ttfb: metrics.ttfb,
          fcp: metrics.fcp,
          lcp: metrics.lcp,
          load: metrics.load,
          domContentLoaded: metrics.domContentLoaded,
          requests: net.apiCalls.size,
          duplicateCalls: duplicates,
          consoleErrors: net.consoleErrors,
          status,
          reasons,
        });

        if (status === "FAIL") {
          console.log(`  ✗ ${route.name}: ${reasons.join(", ")}`);
        }

        net.cleanup();
        await ctx.close();
      });
    }
  });

  // ── Generate Report (runs after ALL tests via afterAll) ──
  test.afterAll(async () => {
    // Sort by worst performance (highest LCP first)
    results.sort((a, b) => {
      // FAILs first
      if (a.status !== b.status) return a.status === "FAIL" ? -1 : 1;
      // Then by LCP
      return b.lcp - a.lcp;
    });

    // ── Console Table ──
    console.log("\n" + "═".repeat(120));
    console.log("  DEVSYNC PERFORMANCE AUDIT REPORT");
    console.log("═".repeat(120));
    console.log(
      "Page".padEnd(35) +
      "TTFB".padEnd(10) +
      "FCP".padEnd(10) +
      "LCP".padEnd(10) +
      "Load".padEnd(10) +
      "Requests".padEnd(10) +
      "Duplicates".padEnd(20) +
      "Errors".padEnd(8) +
      "Status"
    );
    console.log("─".repeat(120));

    for (const r of results) {
      console.log(
        r.name.padEnd(35) +
        fmtMs(r.ttfb).padEnd(10) +
        fmtMs(r.fcp).padEnd(10) +
        fmtMs(r.lcp).padEnd(10) +
        fmtMs(r.load).padEnd(10) +
        String(r.requests).padEnd(10) +
        (r.duplicateCalls.length > 0 ? r.duplicateCalls.length + " found" : "None").padEnd(20) +
        String(r.consoleErrors.length).padEnd(8) +
        (r.status === "PASS" ? "✅ PASS" : "❌ FAIL")
      );
    }

    console.log("─".repeat(120));

    const passCount = results.filter((r) => r.status === "PASS").length;
    const failCount = results.filter((r) => r.status === "FAIL").length;
    console.log(`\nTotal: ${results.length} pages | ✅ ${passCount} PASS | ❌ ${failCount} FAIL`);
    console.log("═".repeat(120));

    // ── Detailed FAIL breakdown ──
    const failures = results.filter((r) => r.status === "FAIL");
    if (failures.length > 0) {
      console.log("\n🚨 FAILED PAGES — DETAIL:");
      console.log("─".repeat(80));
      for (const f of failures) {
        console.log(`\n  ❌ ${f.name} (${f.path})`);
        for (const reason of f.reasons) {
          console.log(`     • ${reason}`);
        }
        if (f.duplicateCalls.length > 0) {
          console.log(`     • Duplicate API calls:`);
          for (const dup of f.duplicateCalls) {
            console.log(`       - ${dup}`);
          }
        }
        if (f.consoleErrors.length > 0) {
          console.log(`     • Console errors (${f.consoleErrors.length}):`);
          for (const err of f.consoleErrors.slice(0, 3)) {
            console.log(`       - ${err}`);
          }
        }
      }
      console.log("─".repeat(80));
    }

    // ── Save JSON report ──
    const reportDir = path.join(process.cwd(), "..");
    const jsonReport = {
      timestamp: new Date().toISOString(),
      thresholds: THRESHOLDS,
      summary: {
        total: results.length,
        pass: passCount,
        fail: failCount,
      },
      results: results.map((r) => ({
        name: r.name,
        path: r.path,
        auth: r.auth,
        ttfb: Math.round(r.ttfb),
        fcp: Math.round(r.fcp),
        lcp: Math.round(r.lcp),
        load: Math.round(r.load),
        domContentLoaded: Math.round(r.domContentLoaded),
        requests: r.requests,
        duplicateCalls: r.duplicateCalls,
        consoleErrors: r.consoleErrors,
        status: r.status,
        reasons: r.reasons,
      })),
    };

    const jsonPath = path.join(reportDir, "perf-audit-report.json");
    fs.writeFileSync(jsonPath, JSON.stringify(jsonReport, null, 2));
    console.log(`\n📄 JSON report saved to: ${jsonPath}`);

    // ── Save Markdown report ──
    let md = `# DevSync Performance Audit Report\n\n`;
    md += `**Generated:** ${new Date().toISOString()}\n\n`;
    md += `## Summary\n\n`;
    md += `| Metric | Value |\n|---|---|\n`;
    md += `| Total Pages | ${results.length} |\n`;
    md += `| ✅ Pass | ${passCount} |\n`;
    md += `| ❌ Fail | ${failCount} |\n`;
    md += `| FCP Threshold | <${fmtMs(THRESHOLDS.fcp)} |\n`;
    md += `| LCP Threshold | <${fmtMs(THRESHOLDS.lcp)} |\n`;
    md += `| Load Threshold | <${fmtMs(THRESHOLDS.load)} |\n\n`;

    md += `## Results (sorted by worst performance)\n\n`;
    md += `| Page | Route | Auth | TTFB | FCP | LCP | Load | Requests | Duplicates | Errors | Status |\n`;
    md += `|---|---|---|---|---|---|---|---|---|---|---|\n`;

    for (const r of results) {
      const statusIcon = r.status === "PASS" ? "✅" : "❌";
      md += `| ${r.name} | \`${r.path}\` | ${r.auth} | ${fmtMs(r.ttfb)} | ${fmtMs(r.fcp)} | ${fmtMs(r.lcp)} | ${fmtMs(r.load)} | ${r.requests} | ${r.duplicateCalls.length > 0 ? r.duplicateCalls.length : "—"} | ${r.consoleErrors.length} | ${statusIcon} ${r.status} |\n`;
    }

    if (failures.length > 0) {
      md += `\n## 🚨 Failed Pages\n\n`;
      for (const f of failures) {
        md += `### ${f.name} (\`${f.path}\`)\n\n`;
        for (const reason of f.reasons) {
          md += `- ${reason}\n`;
        }
        if (f.duplicateCalls.length > 0) {
          md += `- **Duplicate API calls:**\n`;
          for (const dup of f.duplicateCalls) {
            md += `  - ${dup}\n`;
          }
        }
        if (f.consoleErrors.length > 0) {
          md += `- **Console errors (${f.consoleErrors.length}):**\n`;
          for (const err of f.consoleErrors.slice(0, 5)) {
            md += `  - \`${err}\`\n`;
          }
        }
        md += `\n`;
      }
    }

    // ── Recommendations ──
    md += `## Recommendations\n\n`;

    const fcpFails = results.filter((r) => r.fcp > THRESHOLDS.fcp && r.fcp > 0);
    if (fcpFails.length > 0) {
      md += `### High FCP (${fcpFails.length} pages)\n\n`;
      md += `These pages take too long to show first content. Consider:\n`;
      md += `- Reducing initial JS bundle size (code-splitting, tree-shaking)\n`;
      md += `- Inlining critical CSS\n`;
      md += `- Preloading key resources\n\n`;
    }

    const lcpFails = results.filter((r) => r.lcp > THRESHOLDS.lcp && r.lcp > 0);
    if (lcpFails.length > 0) {
      md += `### High LCP (${lcpFails.length} pages)\n\n`;
      md += `The largest element takes too long to render. Consider:\n`;
      md += `- Optimizing hero images (WebP, lazy loading, srcset)\n`;
      md += `- Reducing server response time for API data\n`;
      md += `- Avoiding layout shifts that delay LCP\n\n`;
    }

    const dupFails = results.filter((r) => r.duplicateCalls.length > 0);
    if (dupFails.length > 0) {
      md += `### Duplicate API Calls (${dupFails.length} pages)\n\n`;
      md += `Multiple components fetch the same endpoint. Consider:\n`;
      md += `- Using a shared React context or cache for shared data\n`;
      md += `- Deduplicating with React Query/SWR\n`;
      md += `- Adding server-side caching (Cache-Control headers)\n\n`;
    }

    md += `---\n*Report generated by DevSync Performance Audit*\n`;

    const mdPath = path.join(reportDir, "perf-audit-report.md");
    fs.writeFileSync(mdPath, md);
    console.log(`📄 Markdown report saved to: ${mdPath}`);

    // Always pass — the test is about generating the report
    // (no assertion needed for afterAll)
  });
});
