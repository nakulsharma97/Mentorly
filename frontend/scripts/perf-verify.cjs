/* DevTools-style navigation performance verification for the SkillSwap mentor
 * workspace.
 *
 * Pass 1 ("cold"): first visit to each page after a fresh login — measures the
 * lazy-chunk cost the user experiences on first clicks.
 *
 * Pass 2 ("warm"): after a 6s idle window (letting the route prefetch finish),
 * re-measures to quantify the improvement and confirm the skeleton no longer
 * appears for prefetched pages.
 *
 * Route order deliberately avoids /mentor/messages so we can prove the
 * chat/conversations endpoints do NOT fire on non-messages navigation (the
 * regression check for the route-remount fix).
 *
 * Run: node frontend/scripts/perf-verify.cjs
 */
const { chromium } = require("@playwright/test");

const BASE = process.env.PERF_BASE_URL || "http://localhost:5174";
const API = process.env.PERF_API_URL || "http://localhost:8080";
const ROLE = (process.env.PERF_ROLE || "mentor").toLowerCase();

// Non-messages pages only, so the chat/conversations regression check stays
// clean (the messages page is expected to fetch them).
const MENTOR_ROUTES = [
  { label: "Students", title: "Students", href: "/mentor/students" },
  { label: "Calendar", title: "Calendar", href: "/mentor/calendar" },
  { label: "Reviews", title: "Reviews", href: "/mentor/reviews" },
  { label: "Dashboard", title: "Dashboard", href: "/mentor/dashboard" },
];

const LEARNER_ROUTES = [
  { label: "Mentors", title: "Find Mentors", href: "/learner/mentors" },
  { label: "Skills", title: "Explore Skills", href: "/learner/skills" },
  { label: "Learning", title: "My Learning", href: "/learner/learning" },
  { label: "Sessions", title: "Booked Sessions", href: "/learner/sessions" },
  { label: "Tasks", title: "Daily Tasks", href: "/learner/tasks" },
  { label: "Dashboard", title: "Dashboard", href: "/learner/dashboard" },
];

const ACCOUNTS = {
  mentor: { email: "perfmentor1786262116@test.com", password: "Test@12345" },
  learner: { email: "perflearn1786262116@test.com", password: "Test@12345" },
};
const account = ACCOUNTS[ROLE] || ACCOUNTS.mentor;
const ROUTES = ROLE === "learner" ? LEARNER_ROUTES : MENTOR_ROUTES;
const START_PATH = ROUTES[ROUTES.length - 1].href;

async function measureNav(page, route, waitMsAfter) {
  let navApiCalls = [];
  const capture = (req) => {
    if (req.url().includes("/api/v1/")) {
      navApiCalls.push(req.url().replace("http://localhost:8080", ""));
    }
  };
  page.on("request", capture);

  await page.evaluate(() => {
    window.__sawSkeleton = false;
    const obs = new MutationObserver(() => {
      if (document.body?.innerText?.includes("Loading page")) {
        window.__sawSkeleton = true;
        obs.disconnect();
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
    window.__obs = obs;
  });

  const start = Date.now();
  await page.click(`a[href="${route.href}"]`);
  await page
    .waitForFunction(
      (title) =>
        document.querySelector(".ws-top__title")?.textContent?.trim() === title,
      route.title,
      { timeout: 20000 },
    )
    .catch(() => {});
  if (waitMsAfter) await page.waitForTimeout(waitMsAfter);
  const elapsed = Date.now() - start;

  const sawSkeleton = await page.evaluate(() => window.__sawSkeleton);
  await page.evaluate(() => window.__obs?.disconnect());
  page.off("request", capture);

  const convCalls = navApiCalls.filter(
    (u) => u.includes("/chat/conversations") || u.includes("/chat/direct/conversations"),
  );
  return { elapsed, sawSkeleton, convCalls, apiCalls: [...new Set(navApiCalls)] };
}

(async () => {
  const loginRes = await fetch(`${API}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ emailOrUsername: account.email, password: account.password }),
  });
  const token = (await loginRes.json())?.data?.token;
  if (!token) {
    console.log("LOGIN FAILED");
    process.exit(1);
  }

  const browser = await chromium.launch();
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
  page.on("pageerror", (e) => consoleErrors.push(String(e)));

  await page.addInitScript((tok) => {
    localStorage.setItem("token", tok);
    sessionStorage.setItem("token", tok);
  }, token);

  // Initial load
  const t0 = Date.now();
  await page.goto(`${BASE}${START_PATH}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => document.querySelector(".ws-top__title")?.textContent?.trim() === "Dashboard",
    { timeout: 30000 },
  );
  console.log(`\nINITIAL LOAD (dashboard): ${Date.now() - t0} ms (cold browser + initial bundle)`);

  // Let the dashboard's mount-time polling (unread conversations) finish so it
  // can't be mistaken for requests fired by the next navigation.
  await page.waitForTimeout(1500);

  // ── Pass 1: COLD first visits ──
  console.log("\n=== PASS 1: COLD (first visits after login) ===");
  console.log("page        render ms   skeleton   chat/conversations fired");
  for (const route of ROUTES) {
    const r = await measureNav(page, route, 400);
    const conv = r.convCalls.length ? "YES (unexpected)" : "no";
    console.log(
      `${route.label.padEnd(11)} ${String(r.elapsed).padStart(7)} ms      ${r.sawSkeleton ? "yes" : "no"}        ${conv}`,
    );
  }

  // ── Wait for the idle prefetch to finish ──
  console.log("\nWaiting 7s for idle route prefetch to warm chunks...");
  await page.waitForTimeout(7000);

  // ── Pass 2: WARM (prefetched chunks) ──
  console.log("\n=== PASS 2: WARM (after idle prefetch) ===");
  console.log("page        render ms   skeleton   chat/conversations fired");
  for (const route of ROUTES) {
    const r = await measureNav(page, route, 400);
    const conv = r.convCalls.length ? "YES (unexpected)" : "no";
    console.log(
      `${route.label.padEnd(11)} ${String(r.elapsed).padStart(7)} ms      ${r.sawSkeleton ? "yes" : "no"}        ${conv}`,
    );
  }

  console.log("\nCONSOLE ERRORS:", consoleErrors.length ? consoleErrors : "none");
  await browser.close();
})();
