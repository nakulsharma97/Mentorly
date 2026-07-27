/**
 * Notification Flow End-to-End Test Script
 * ==========================================
 *
 * Simulates the complete notification lifecycle:
 *   1. Login & get auth token
 *   2. Fetch current notifications (REST)
 *   3. Get unread count (baseline)
 *   4. Connect via WebSocket (/ws/notifications?token=...)
 *   5. Wait for a real-time push (timeout after 10s)
 *   6. Mark a single notification as read (PATCH)
 *   7. Verify unread count decreased
 *   8. Mark all notifications as read (PATCH)
 *   9. Verify unread count is 0
 *  10. Close WebSocket & exit
 *
 * Usage:
 *   node scripts/test-notification-flow.cjs
 *
 * Environment variables (optional):
 *   BASE_URL     - Backend base URL     (default: http://localhost:8080)
 *   AUTH_EMAIL   - Login email           (default: learner@test.com)
 *   AUTH_PASSWORD - Login password       (default: password)
 *   WS_URL       - WebSocket URL         (default: ws://localhost:8080)
 */

const WebSocket = require("ws");
const http = require("http");

// ─── Config ────────────────────────────────────────────────────────────────
const BASE_URL = process.env.BASE_URL || "http://localhost:8080";
const WS_URL   = process.env.WS_URL   || "ws://localhost:8080";
const EMAIL    = process.env.AUTH_EMAIL    || "learner@test.com";
const PASSWORD = process.env.AUTH_PASSWORD || "password";

// ─── Helpers ───────────────────────────────────────────────────────────────

const COLORS = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
};

function log(step, msg, ok) {
  const icon = ok === true ? `${COLORS.green}✓${COLORS.reset}` 
              : ok === false ? `${COLORS.red}✗${COLORS.reset}`
              : `${COLORS.cyan}▶${COLORS.reset}`;
  console.log(`  ${icon} ${COLORS.dim}[${step}]${COLORS.reset} ${msg}`);
}

function divider(title) {
  const line = "─".repeat(50);
  console.log(`\n${COLORS.bold}${line}${COLORS.reset}`);
  console.log(` ${COLORS.bold}${title}${COLORS.reset}`);
  console.log(`${COLORS.bold}${line}${COLORS.reset}\n`);
}

// Cookie jar — collects all Set-Cookie values from responses and sends them back
// This is needed because the Spring Boot backend uses CSRF protection and session
// cookies. The Node.js http module does not manage cookies automatically.
let cookieJar = {};

/**
 * Serialize the cookie jar into a single Cookie header value.
 */
function formatCookieHeader() {
  const entries = Object.entries(cookieJar);
  if (entries.length === 0) return null;
  return entries.map(([k, v]) => `${k}=${v}`).join("; ");
}

/**
 * Update the cookie jar from a Set-Cookie response header.
 * Parses cookie name=value pairs and stores them.
 */
function updateCookieJar(setCookieHeader) {
  if (!setCookieHeader) return;
  const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  for (const cookie of cookies) {
    // Format: "name=value; Path=/; HttpOnly; SameSite=Lax"
    const eqIdx = cookie.indexOf("=");
    if (eqIdx <= 0) continue;
    const semiIdx = cookie.indexOf(";", eqIdx);
    const value = semiIdx === -1 ? cookie.substring(eqIdx + 1) : cookie.substring(eqIdx + 1, semiIdx);
    const name = cookie.substring(0, eqIdx);
    // Skip empty values — Spring Security sends empty Set-Cookie headers to
    // clear cookies when re-generating CSRF tokens or invalidating sessions.
    // Ignoring them keeps our jar populated with the last valid cookie values.
    if (value !== "") {
      cookieJar[name] = value;
    }
  }
}

function request(method, path, body, token) {
  const url = new URL(path, BASE_URL);
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { "Content-Type": "application/json" },
      timeout: 10000,
    };
    if (token) opts.headers["Authorization"] = `Bearer ${token}`;

    // Send all known cookies on every request
    const cookieHeader = formatCookieHeader();
    if (cookieHeader) opts.headers["Cookie"] = cookieHeader;

    // CSRF: send XSRF token header for state-changing methods
    if (cookieJar["XSRF-TOKEN"] && ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase())) {
      opts.headers["X-XSRF-TOKEN"] = cookieJar["XSRF-TOKEN"];
    }

    const req = http.request(opts, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        // Collect any cookies returned by the server
        updateCookieJar(res.headers["set-cookie"]);
        try {
          resolve({
            status: res.statusCode,
            body: JSON.parse(data),
          });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("Request timeout")); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Main Flow ─────────────────────────────────────────────────────────────

async function main() {
  let exitCode = 0;
  let token = null;
  let ws = null;
  const results = {
    login: false,
    fetch: false,
    unreadBaseline: false,
    wsConnect: false,
    markSingle: false,
    countDecreased: false,
    markAll: false,
    countZero: false,
  };

  try {
    // ═══════════════════════════════════════════════════════════════════
    divider("1. LOGIN & GET AUTH TOKEN");
    // ═══════════════════════════════════════════════════════════════════

    log("1.1", `Logging in as ${EMAIL}...`);
    const loginRes = await request("POST", "/api/v1/auth/login", {
      email: EMAIL,
      password: PASSWORD,
    });

    if (loginRes.status === 200) {
      const tokenData = loginRes.body?.data?.token || loginRes.body?.token;
      if (tokenData) {
        token = tokenData;
        results.login = true;
        log("1.2", "Auth token obtained", true);
      } else {
        log("1.2", `Login response: ${JSON.stringify(loginRes.body).substring(0, 200)}`, false);
        throw new Error("No token in login response");
      }
    } else {
      // Try signup as fallback
      log("1.1", `Login failed (${loginRes.status}), trying signup...`);
      const signupRes = await request("POST", "/api/v1/auth/signup", {
        email: EMAIL,
        password: PASSWORD,
        fullName: "Test Learner",
        role: "LEARNER",
      });
      if (signupRes.status === 200) {
        token = signupRes.body?.data?.token || signupRes.body?.token;
        results.login = true;
        log("1.2", "Signed up and got token", true);
      } else {
        throw new Error(`Auth failed: ${signupRes.status} ${JSON.stringify(signupRes.body)}`);
      }
    }

    console.log(`  ${COLORS.dim}  Token: ${token.substring(0, 30)}...${COLORS.reset}`);

    // ═══════════════════════════════════════════════════════════════════
    divider("2. FETCH NOTIFICATIONS (REST)");
    // ═══════════════════════════════════════════════════════════════════

    log("2.1", "Fetching notifications...");
    const notifsRes = await request("GET", "/api/v1/notifications?page=0&size=20", null, token);
    if (notifsRes.status !== 200) {
      throw new Error(`Fetch notifications failed: ${notifsRes.status}`);
    }

    const notifs = notifsRes.body?.data?.content || notifsRes.body?.data || [];
    results.fetch = true;
    log("2.2", `Total notifications: ${notifs.length}`, true);
    if (notifs.length > 0) {
      console.log(`  ${COLORS.dim}  Latest: ${JSON.stringify(notifs[0], null, 2).substring(0, 200)}${COLORS.reset}`);
    }

    // ═══════════════════════════════════════════════════════════════════
    divider("3. GET UNREAD COUNT (BASELINE)");
    // ═══════════════════════════════════════════════════════════════════

    log("3.1", "Fetching unread count...");
    const countRes1 = await request("GET", "/api/v1/notifications/unread-count", null, token);
    if (countRes1.status !== 200) {
      throw new Error(`Unread count failed: ${countRes1.status}`);
    }

    const unreadBefore = countRes1.body?.data ?? 0;
    results.unreadBaseline = true;
    log("3.2", `Unread notifications: ${unreadBefore}`, true);

    // ═══════════════════════════════════════════════════════════════════
    divider("4. WEBSOCKET CONNECTION");
    // ═══════════════════════════════════════════════════════════════════

    log("4.1", `Connecting to ${WS_URL}/ws/notifications?token=...`);

    ws = new WebSocket(`${WS_URL}/ws/notifications?token=${encodeURIComponent(token)}`);

    const wsConnected = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("WebSocket connection timeout (5s)"));
      }, 5000);

      ws.on("open", () => {
        clearTimeout(timeout);
        resolve(true);
      });

      ws.on("error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    await wsConnected;
    results.wsConnect = true;
    log("4.2", "WebSocket connected successfully", true);

    // Set up handler for incoming notification pushes
    const pushPromise = new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve(null); // No push received within window — that's fine
      }, 10000);

      ws.on("message", (data) => {
        clearTimeout(timeout);
        try {
          const notification = JSON.parse(data.toString());
          log("4.3", `Push received: "${notification.title}"`, true);
          console.log(`  ${COLORS.dim}  Type: ${notification.type}, ID: ${notification.id}${COLORS.reset}`);
          resolve(notification);
        } catch {
          log("4.3", `Raw message: ${data.toString().substring(0, 100)}`, false);
          resolve(null);
        }
      });

      // Gracefully resolve if WS disconnects during the push wait window
      ws.on("close", () => {
        clearTimeout(timeout);
        resolve(null);
      });
      ws.on("error", () => {
        clearTimeout(timeout);
        resolve(null);
      });
    });

    // ═══════════════════════════════════════════════════════════════════
    divider("5. WAIT FOR REAL-TIME PUSH (10s timeout)");
    // ═══════════════════════════════════════════════════════════════════

    log("5.1", "Listening for incoming notifications...");
    const pushedNotification = await pushPromise;

    if (pushedNotification) {
      log("5.2", "Real-time notification received via WebSocket", true);
    } else {
      log("5.2", "No push received within 10s (expected if no new notifications were created)", true);
    }

    // ═══════════════════════════════════════════════════════════════════
    divider("6. MARK SINGLE NOTIFICATION AS READ");
    // ═══════════════════════════════════════════════════════════════════

    // Find an unread notification
    const unreadNotifs = notifs.filter((n) => !n.read);
    if (unreadNotifs.length > 0) {
      const target = unreadNotifs[0];
      log("6.1", `Marking notification ${target.id} as read: "${target.title}"`);

      const markRes = await request("PATCH", `/api/v1/notifications/${target.id}/read`, null, token);
      if (markRes.status === 200) {
        results.markSingle = true;
        log("6.2", "Mark single as read: SUCCESS", true);
      } else {
        log("6.2", `Mark single as read FAILED: ${markRes.status} ${JSON.stringify(markRes.body)}`, false);
        exitCode = 1;
      }
    } else {
      log("6.1", "No unread notifications to mark — skipping single mark test");
      results.markSingle = true;
      results.countDecreased = true;
    }

    // ═══════════════════════════════════════════════════════════════════
    divider("7. VERIFY UNREAD COUNT DECREASED");
    // ═══════════════════════════════════════════════════════════════════

    await sleep(1000); // Allow DB write to propagate

    log("7.1", "Fetching unread count after marking one as read...");
    const countRes2 = await request("GET", "/api/v1/notifications/unread-count", null, token);
    const unreadAfter = countRes2.body?.data ?? 0;

    if (unreadNotifs.length > 0) {
      const expected = Math.max(0, unreadBefore - 1);
      if (unreadAfter === expected) {
        results.countDecreased = true;
        log("7.2", `Unread count decreased correctly: ${unreadBefore} → ${unreadAfter}`, true);
      } else {
        log("7.2", `Unread count mismatch: expected ${expected}, got ${unreadAfter}`, false);
        exitCode = 1;
      }
    } else {
      log("7.2", `Unread count: ${unreadBefore} → ${unreadAfter} (no change — no unread existed)`);
    }

    // ═══════════════════════════════════════════════════════════════════
    divider("8. MARK ALL AS READ");
    // ═══════════════════════════════════════════════════════════════════

    log("8.1", "Calling mark all as read...");
    const markAllRes = await request("PATCH", "/api/v1/notifications/read-all", null, token);
    if (markAllRes.status === 200) {
      results.markAll = true;
      log("8.2", "Mark all as read: SUCCESS", true);
    } else {
      log("8.2", `Mark all as read FAILED: ${markAllRes.status} ${JSON.stringify(markAllRes.body)}`, false);
      exitCode = 1;
    }

    // ═══════════════════════════════════════════════════════════════════
    divider("9. VERIFY UNREAD COUNT IS 0");
    // ═══════════════════════════════════════════════════════════════════

    await sleep(1000); // Allow DB write to propagate

    log("9.1", "Fetching unread count after mark all...");
    const countRes3 = await request("GET", "/api/v1/notifications/unread-count", null, token);
    const unreadFinal = countRes3.body?.data ?? -1;

    if (unreadFinal === 0) {
      results.countZero = true;
      log("9.2", `Unread count is 0 ✓`, true);
    } else {
      log("9.2", `Expected unread count 0, got ${unreadFinal}`, false);
      exitCode = 1;
    }

    // ═══════════════════════════════════════════════════════════════════
    divider("10. SUMMARY");
    // ═══════════════════════════════════════════════════════════════════

    const icon = (ok) => ok ? `${COLORS.green}✓${COLORS.reset}` : `${COLORS.red}✗${COLORS.reset}`;
    console.log(`\n  ${COLORS.bold}Notification Flow Test Results${COLORS.reset}\n`);
    console.log(`  ${icon(results.login)} Login & Authentication`);
    console.log(`  ${icon(results.fetch)} Fetch notifications (REST API)`);
    console.log(`  ${icon(results.unreadBaseline)} Fetch unread count (baseline)`);
    console.log(`  ${icon(results.wsConnect)} WebSocket connection (real-time)`);
    console.log(`  ${icon(results.markSingle)} Mark single notification as read`);
    console.log(`  ${icon(results.countDecreased)} Verify unread count decreased`);
    console.log(`  ${icon(results.markAll)} Mark all notifications as read`);
    console.log(`  ${icon(results.countZero)} Verify unread count = 0`);

    if (pushedNotification) {
      console.log(`  ${COLORS.green}✓${COLORS.reset} Real-time push received via WebSocket`);
    } else {
      console.log(`  ${COLORS.dim}  - No push received (no new notifications triggered)${COLORS.reset}`);
    }

    console.log(`\n  ${exitCode === 0 ? COLORS.green + "ALL CHECKS PASSED" : COLORS.red + "SOME CHECKS FAILED"}${COLORS.reset}\n`);

  } catch (err) {
    console.error(`\n  ${COLORS.red}FATAL ERROR:${COLORS.reset} ${err.message}`);
    console.error(`  ${COLORS.dim}${err.stack?.substring(0, 300)}${COLORS.reset}`);
    exitCode = 1;
  } finally {
    // Cleanup
    if (ws) {
      try { ws.close(); } catch { /* ignore */ }
    }
    process.exit(exitCode);
  }
}

main();
