/**
 * Debug script to understand what happens after clicking Confirm & Pay
 * in the BookingFlowPage step 3.
 */
const { chromium } = require("playwright");

(async () => {
  const b = await chromium.launch({ headless: true });
  const ctx = await b.newContext();
  const pg = await ctx.newPage();

  // Collect all network requests
  const apiLogs = [];
  pg.on("request", (req) => {
    if (req.url().includes("/api/v1/bookings") || req.url().includes("/api/v1/payments") || req.url().includes("/api/v1/sessions")) {
      apiLogs.push("REQ: " + req.method() + " " + req.url().split("/api")[1]);
    }
  });
  pg.on("response", async (res) => {
    if (res.url().includes("/api/v1/bookings") || res.url().includes("/api/v1/payments") || res.url().includes("/api/v1/sessions")) {
      let body = "";
      try { body = (await res.text()).substring(0, 200); } catch {}
      apiLogs.push("RES: " + res.status() + " " + res.url().split("/api")[1] + " => " + body);
    }
  });
  pg.on("pageerror", (e) => apiLogs.push("PAGE_ERROR: " + e.message));

  // Login
  const loginResp = await ctx.request.post("http://localhost:8080/api/v1/auth/login", {
    data: { email: "learner@test.com", password: "password" },
  });
  const token = (await loginResp.json())?.data?.token;
  if (!token) { console.log("NO_TOKEN"); await b.close(); return; }

  // Find mentor with future session
  const mentorsResp = await ctx.request.get("http://localhost:8080/api/v1/users/mentors", {
    headers: { Authorization: "Bearer " + token },
  });
  const mentors = (await mentorsResp.json())?.data || [];
  let mentorId = null;
  for (const m of mentors) {
    const sessResp = await ctx.request.get("http://localhost:8080/api/v1/sessions/mentor/" + m.id, {
      headers: { Authorization: "Bearer " + token },
    });
    const sessions = (await sessResp.json())?.data || [];
    if (sessions.some((s) => s.startTime && new Date(s.startTime) > new Date())) {
      mentorId = m.id;
      break;
    }
  }
  if (!mentorId) { console.log("NO_MENTOR"); await b.close(); return; }
  console.log("Found mentor:", mentorId);

  await pg.addInitScript((t) => { window.localStorage.setItem("token", t); }, token);
  await pg.goto("http://localhost:5174/mentors/" + mentorId, { waitUntil: "networkidle" });
  await pg.locator(".mpr-hero").waitFor({ timeout: 15000 });
  await pg.locator(".mpr-booking-card__type").first().waitFor({ timeout: 15000 });

  // Click session button -> Step 1
  await pg.locator(".mpr-booking-card__type").first().click();
  await pg.getByRole("heading", { name: /Review Session Details/i }).waitFor({ timeout: 15000 });
  console.log("STEP 1: OK");

  // Step 1 -> Step 2
  await pg.getByRole("button", { name: /Next.*Confirm/i }).first().click();
  await pg.getByRole("heading", { name: /Confirm Payment/i }).waitFor({ timeout: 15000 });
  console.log("STEP 2: OK");

  // Click Confirm & Pay
  await pg.getByRole("button", { name: /Confirm.*Pay/i }).click();
  await pg.waitForTimeout(8000);

  // Check what's on the page now
  const overlayText = await pg.locator(".mpr-overlay").textContent().catch(() => "NO_OVERLAY");
  console.log("STEP 3 CONTENT:", overlayText.substring(0, 1500));

  // Check for specific elements
  const hasSuccess = await pg.getByRole("button", { name: /Go to My Sessions/i }).isVisible().catch(() => false);
  const hasError = await pg.locator(".mpr-overlay").getByText(/fail|error|retry/i).isVisible().catch(() => false);
  console.log("Has 'Go to My Sessions':", hasSuccess);
  console.log("Has error/retry text:", hasError);
  console.log("Step in URL:", pg.url());

  console.log("\n=== API LOGS ===");
  apiLogs.forEach((l) => console.log(l));

  await b.close();
})().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
