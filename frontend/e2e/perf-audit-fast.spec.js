// @ts-check
/**
 * DevSync Performance Audit — Optimized version
 *
 * Key optimization: logs in once per role and reuses the same browser
 * context for all routes of that role, instead of creating a new context
 * (and re-authenticating) for every single route.
 *
 * Usage: npx playwright test e2e/perf-audit-fast.spec.js --reporter=list
 */
import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

// ── Routes ──
/** @type {{path:string;name:string;auth:"none"|"learner"|"mentor"|"admin"}[]} */
const ROUTES = [
  { path: "/", name: "Landing / Auth Page", auth: "none" },
  { path: "/login", name: "Login Page", auth: "none" },
  { path: "/signup", name: "Signup Page", auth: "none" },
  { path: "/resources", name: "Resources (Public)", auth: "none" },

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

const THRESHOLDS = { fcp: 1800, lcp: 2500, load: 3000, ttfb: 800 };

const CREDS = {
  learner: { email: "nakulsharma978397@gmail.com", passwords: ["Learner@123", "password", "test@123"] },
  mentor:  { email: "pritilthakur@gmail.com",      passwords: ["Mentor@123", "password", "test@123"] },
  admin:   { email: "nakulsharma@gmail.com",        passwords: ["Admin@123", "password", "test@123"] },
};

/** Login via API fetch (sets httpOnly cookie). */
async function loginViaApi(page, role) {
  const cred = CREDS[role];
  if (!cred) return false;
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.waitForTimeout(500);
  for (const pwd of cred.passwords) {
    const result = await page.evaluate(async ({ email, password }) => {
      try {
        const resp = await fetch("/api/v1/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
          credentials: "include",
        });
        if (!resp.ok) return { ok: false };
        const data = await resp.json();
        return { ok: true, token: data?.data?.token };
      } catch { return { ok: false }; }
    }, { email: cred.email, password: pwd });
    if (result.ok) {
      console.log(`  ✓ Authenticated as ${role}`);
      return true;
    }
  }
  console.log(`  ✗ No working password for ${role}`);
  return false;
}

/** Measure performance for a single route. */
async function measurePage(page, routePath) {
  const apiCalls = new Map();
  const consoleErrors = [];
  const reqHandler = (req) => {
    if (req.url().includes("/api/")) {
      const ep = req.url().split("?")[0];
      apiCalls.set(ep, (apiCalls.get(ep) || 0) + 1);
    }
  };
  const consoleHandler = (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 200));
  };
  page.on("request", reqHandler);
  page.on("console", consoleHandler);

  const start = Date.now();
  const resp = await page.goto(routePath, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForLoadState("networkidle", { timeout: 12000 }).catch(() => {});
  await page.waitForTimeout(1000);
  const totalTime = Date.now() - start;

  const metrics = await page.evaluate(() => {
    const perf = performance;
    const entries = perf.getEntriesByType("navigation");
    const nav = entries[0];
    const fcpEntries = perf.getEntriesByName("first-contentful-paint");
    const fcp = fcpEntries.length > 0 ? fcpEntries[0].startTime : 0;
    let lcp = 0;
    const lcpEntries = perf.getEntriesByType("largest-contentful-paint");
    if (lcpEntries.length > 0) lcp = lcpEntries[lcpEntries.length - 1].startTime;
    return {
      ttfb: nav ? nav.responseStart - nav.requestStart : 0,
      fcp,
      lcp,
      domContentLoaded: nav ? nav.domContentLoadedEventEnd - nav.startTime : 0,
      load: nav ? nav.loadEventEnd - nav.startTime : 0,
    };
  });

  const duplicates = [];
  for (const [ep, count] of apiCalls) {
    if (count > 1) duplicates.push(`${ep} (×${count})`);
  }

  page.removeListener("request", reqHandler);
  page.removeListener("console", consoleHandler);

  return { ...metrics, totalTime, requests: apiCalls.size, duplicates, consoleErrors, statusCode: resp?.status() ?? 0 };
}

function fmtMs(ms) {
  if (ms === 0) return "N/A";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function evaluate(metrics, duplicates) {
  const reasons = [];
  if (metrics.fcp > THRESHOLDS.fcp && metrics.fcp > 0) reasons.push(`FCP ${fmtMs(metrics.fcp)} > ${fmtMs(THRESHOLDS.fcp)}`);
  if (metrics.lcp > THRESHOLDS.lcp && metrics.lcp > 0) reasons.push(`LCP ${fmtMs(metrics.lcp)} > ${fmtMs(THRESHOLDS.lcp)}`);
  if (metrics.load > THRESHOLDS.load && metrics.load > 0) reasons.push(`Load ${fmtMs(metrics.load)} > ${fmtMs(THRESHOLDS.load)}`);
  if (metrics.ttfb > THRESHOLDS.ttfb && metrics.ttfb > 0) reasons.push(`TTFB ${fmtMs(metrics.ttfb)} > ${fmtMs(THRESHOLDS.ttfb)}`);
  if (duplicates.length > 0) reasons.push(`${duplicates.length} duplicate API call(s)`);
  return { status: reasons.length === 0 ? "PASS" : "FAIL", reasons };
}

// ── Test Suite ──
const results = [];

test.describe("DevSync Performance Audit (Fast)", () => {
  test.setTimeout(180_000);

  // ── Public Pages (no auth needed, reuse one page) ──
  test("Audit: Public Pages", async ({ page }) => {
    const publicRoutes = ROUTES.filter((r) => r.auth === "none");
    for (const route of publicRoutes) {
      console.log(`  Testing ${route.name} (${route.path})...`);
      const m = await measurePage(page, route.path);
      const { status, reasons } = evaluate(m, m.duplicates);
      results.push({ name: route.name, path: route.path, auth: route.auth, ...m, status, reasons });
      console.log(`    ${status === "PASS" ? "✅" : "❌"} FCP=${fmtMs(m.fcp)} LCP=${fmtMs(m.lcp)} Load=${fmtMs(m.load)} Reqs=${m.requests} Dups=${m.duplicates.length}`);
    }
  });

  // ── Learner Pages (one login, reuse context) ──
  test("Audit: Learner Pages", async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const ok = await loginViaApi(page, "learner");
    if (!ok) { test.skip(); return; }
    const learnerRoutes = ROUTES.filter((r) => r.auth === "learner");
    for (const route of learnerRoutes) {
      console.log(`  Testing ${route.name} (${route.path})...`);
      const m = await measurePage(page, route.path);
      const { status, reasons } = evaluate(m, m.duplicates);
      results.push({ name: route.name, path: route.path, auth: route.auth, ...m, status, reasons });
      console.log(`    ${status === "PASS" ? "✅" : "❌"} FCP=${fmtMs(m.fcp)} LCP=${fmtMs(m.lcp)} Load=${fmtMs(m.load)} Reqs=${m.requests} Dups=${m.duplicates.length}`);
    }
    await ctx.close();
  });

  // ── Mentor Pages ──
  test("Audit: Mentor Pages", async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const ok = await loginViaApi(page, "mentor");
    if (!ok) { test.skip(); return; }
    const mentorRoutes = ROUTES.filter((r) => r.auth === "mentor");
    for (const route of mentorRoutes) {
      console.log(`  Testing ${route.name} (${route.path})...`);
      const m = await measurePage(page, route.path);
      const { status, reasons } = evaluate(m, m.duplicates);
      results.push({ name: route.name, path: route.path, auth: route.auth, ...m, status, reasons });
      console.log(`    ${status === "PASS" ? "✅" : "❌"} FCP=${fmtMs(m.fcp)} LCP=${fmtMs(m.lcp)} Load=${fmtMs(m.load)} Reqs=${m.requests} Dups=${m.duplicates.length}`);
    }
    await ctx.close();
  });

  // ── Admin Pages ──
  test("Audit: Admin Pages", async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const ok = await loginViaApi(page, "admin");
    if (!ok) { test.skip(); return; }
    const adminRoutes = ROUTES.filter((r) => r.auth === "admin");
    for (const route of adminRoutes) {
      console.log(`  Testing ${route.name} (${route.path})...`);
      const m = await measurePage(page, route.path);
      const { status, reasons } = evaluate(m, m.duplicates);
      results.push({ name: route.name, path: route.path, auth: route.auth, ...m, status, reasons });
      console.log(`    ${status === "PASS" ? "✅" : "❌"} FCP=${fmtMs(m.fcp)} LCP=${fmtMs(m.lcp)} Load=${fmtMs(m.load)} Reqs=${m.requests} Dups=${m.duplicates.length}`);
    }
    await ctx.close();
  });

  // ── Generate Report ──
  test.afterAll(async () => {
    results.sort((a, b) => {
      if (a.status !== b.status) return a.status === "FAIL" ? -1 : 1;
      return b.lcp - a.lcp;
    });

    // Console table
    console.log("\n" + "═".repeat(140));
    console.log("  DEVSYNC PERFORMANCE AUDIT REPORT");
    console.log("═".repeat(140));
    console.log(
      "Page".padEnd(38) +
      "FCP".padEnd(12) +
      "LCP".padEnd(12) +
      "Load".padEnd(12) +
      "Reqs".padEnd(8) +
      "Dups".padEnd(8) +
      "Errors".padEnd(8) +
      "Status"
    );
    console.log("─".repeat(140));

    for (const r of results) {
      console.log(
        r.name.padEnd(38) +
        fmtMs(r.fcp).padEnd(12) +
        fmtMs(r.lcp).padEnd(12) +
        fmtMs(r.load).padEnd(12) +
        String(r.requests).padEnd(8) +
        String(r.duplicates.length).padEnd(8) +
        String(r.consoleErrors.length).padEnd(8) +
        (r.status === "PASS" ? "✅ PASS" : "❌ FAIL")
      );
    }

    console.log("─".repeat(140));
    const passCount = results.filter((r) => r.status === "PASS").length;
    const failCount = results.filter((r) => r.status === "FAIL").length;
    console.log(`\nTotal: ${results.length} pages | ✅ ${passCount} PASS | ❌ ${failCount} FAIL`);
    console.log("═".repeat(140));

    // Detailed failures
    const failures = results.filter((r) => r.status === "FAIL");
    if (failures.length > 0) {
      console.log("\n🚨 FAILED PAGES — DETAIL:");
      console.log("─".repeat(80));
      for (const f of failures) {
        console.log(`\n  ❌ ${f.name} (${f.path})`);
        for (const reason of f.reasons) console.log(`     • ${reason}`);
        if (f.duplicates.length > 0) {
          console.log("     • Duplicate API calls:");
          for (const dup of f.duplicates) console.log(`       - ${dup}`);
        }
        if (f.consoleErrors.length > 0) {
          console.log(`     • Console errors (${f.consoleErrors.length}):`);
          for (const err of f.consoleErrors.slice(0, 3)) console.log(`       - ${err}`);
        }
      }
      console.log("─".repeat(80));
    }

    // Save JSON
    const reportDir = path.join(process.cwd(), "..");
    const jsonReport = {
      timestamp: new Date().toISOString(),
      thresholds: THRESHOLDS,
      summary: { total: results.length, pass: passCount, fail: failCount },
      results: results.map((r) => ({
        name: r.name, path: r.path, auth: r.auth,
        ttfb: Math.round(r.ttfb), fcp: Math.round(r.fcp), lcp: Math.round(r.lcp),
        load: Math.round(r.load), domContentLoaded: Math.round(r.domContentLoaded),
        requests: r.requests, duplicateCalls: r.duplicates,
        consoleErrors: r.consoleErrors, status: r.status, reasons: r.reasons,
      })),
    };
    fs.writeFileSync(path.join(reportDir, "perf-audit-report.json"), JSON.stringify(jsonReport, null, 2));
    console.log(`\n📄 JSON report saved to perf-audit-report.json`);
  });
});
