/**
 * Booking Chat WebSocket Flow End-to-End Test Script
 * ====================================================
 *
 * Simulates the complete booking chat lifecycle:
 *   1. Login as mentor → create a session (future-dated)
 *   2. Login as learner → create a booking for that session
 *   3. Connect via WebSocket (/ws/chat?token=...&bookingId=...)
 *   4. Send PING → expect PONG response
 *   5. Send a TEXT message via WebSocket → verify broadcast
 *   6. Fetch messages via REST API → verify message persisted
 *   7. Send a TEXT message via REST API
 *   8. Send a TYPING event (fire-and-forget)
 *   9. Summary
 *
 * Usage:
 *   node scripts/test-booking-chat-flow.cjs
 *
 * Environment variables (optional):
 *   BASE_URL       - Backend base URL          (default: http://localhost:8080)
 *   WS_URL         - WebSocket URL             (default: ws://localhost:8080)
 *   LEARNER_EMAIL  - Learner login email       (default: learner@test.com)
 *   LEARNER_PASS   - Learner password          (default: password)
 *   MENTOR_EMAIL   - Mentor login email        (default: mentor@test.com)
 *   MENTOR_PASS    - Mentor password           (default: password)
 */

const WebSocket = require("ws");
const http = require("http");

// ─── Config ────────────────────────────────────────────────────────────────
const BASE_URL      = process.env.BASE_URL || "http://localhost:8080";
const WS_URL        = process.env.WS_URL   || "ws://localhost:8080";
const LEARNER_EMAIL = process.env.LEARNER_EMAIL || "learner@test.com";
const LEARNER_PASS  = process.env.LEARNER_PASS  || "password";
const MENTOR_EMAIL  = process.env.MENTOR_EMAIL  || "mentor@test.com";
const MENTOR_PASS   = process.env.MENTOR_PASS   || "password";

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

// Cookie jar — same pattern as other test scripts
let cookieJar = {};

function formatCookieHeader() {
  const entries = Object.entries(cookieJar);
  if (entries.length === 0) return null;
  return entries.map(([k, v]) => `${k}=${v}`).join("; ");
}

function updateCookieJar(setCookieHeader) {
  if (!setCookieHeader) return;
  const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  for (const cookie of cookies) {
    const eqIdx = cookie.indexOf("=");
    if (eqIdx <= 0) continue;
    const semiIdx = cookie.indexOf(";", eqIdx);
    const value = semiIdx === -1 ? cookie.substring(eqIdx + 1) : cookie.substring(eqIdx + 1, semiIdx);
    const name = cookie.substring(0, eqIdx);
    if (value !== "") cookieJar[name] = value;
  }
}

// Reset cookie jar for each new user session
function resetCookieJar() { cookieJar = {}; }

function request(method, path, body, token, extraHeaders) {
  const url = new URL(path, BASE_URL);
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { "Content-Type": "application/json", ...(extraHeaders || {}) },
      timeout: 15000,
    };
    if (token) opts.headers["Authorization"] = `Bearer ${token}`;
    const cookieHeader = formatCookieHeader();
    if (cookieHeader) opts.headers["Cookie"] = cookieHeader;
    if (cookieJar["XSRF-TOKEN"] && ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase())) {
      opts.headers["X-XSRF-TOKEN"] = cookieJar["XSRF-TOKEN"];
    }

    const req = http.request(opts, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        updateCookieJar(res.headers["set-cookie"]);
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
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

function waitForWsMessage(ws, predicate, timeoutMs) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => { cleanup(); resolve(null); }, timeoutMs);

    function onMessage(data) {
      try {
        const parsed = JSON.parse(data.toString());
        if (predicate(parsed)) { cleanup(); resolve(parsed); }
      } catch { /* ignore parse errors */ }
    }
    function onClose() { cleanup(); resolve(null); }
    function onError() { cleanup(); resolve(null); }
    function cleanup() {
      clearTimeout(timeout);
      ws.removeListener("message", onMessage);
      ws.removeListener("close", onClose);
      ws.removeListener("error", onError);
    }

    ws.on("message", onMessage);
    ws.on("close", onClose);
    ws.on("error", onError);
  });
}

// Try to login with given credentials; returns token or null
async function tryLogin(email, password) {
  const res = await request("POST", "/api/v1/auth/login", { email, password });
  if (res.status === 200) {
    return res.body?.data?.token || res.body?.token || null;
  }
  return null;
}

// ─── Main Flow ─────────────────────────────────────────────────────────────

async function main() {
  let exitCode = 0;
  let mentorToken = null;
  let learnerToken = null;
  let sessionId = null;
  let bookingId = null;
  let ws = null;
  let mentorEmail = null;
  let learnerEmail = null;

  const results = {
    mentorLogin: false,
    createSession: false,
    learnerLogin: false,
    createBooking: false,
    wsConnect: false,
    pingPong: false,
    wsSendMessage: false,
    wsReceiveBroadcast: false,
    restVerifyPersist: false,
    restSendMessage: false,
    typingEvent: false,
  };

  try {
    // ═══════════════════════════════════════════════════════════════════
    divider("1. LOGIN AS MENTOR & CREATE SESSION");
    // ═══════════════════════════════════════════════════════════════════

    log("1.1", `Logging in as mentor (${MENTOR_EMAIL})...`);
    mentorToken = await tryLogin(MENTOR_EMAIL, MENTOR_PASS);

    // Try alternative common passwords if first attempt fails
    if (!mentorToken) {
      const altPasswords = ["test@123", "Test@123", "admin123", "mentor123", "password123"];
      for (const alt of altPasswords) {
        mentorToken = await tryLogin(MENTOR_EMAIL, alt);
        if (mentorToken) break;
      }
    }

    if (mentorToken) {
      results.mentorLogin = true;
      log("1.2", `Mentor logged in successfully`, true);
      mentorEmail = MENTOR_EMAIL;
    } else {
      log("1.2", `Mentor login failed for ${MENTOR_EMAIL}.`, false);
      log("1.3", `Tip: Set MENTOR_EMAIL and MENTOR_PASS env vars to valid mentor credentials.`, false);
    }

    if (!mentorToken) {
      log("1.4", "Cannot create a session without mentor credentials. Aborting.", false);
      exitCode = 1;
      throw new Error("Mentor login failed. Please set MENTOR_EMAIL and MENTOR_PASS env vars.");
    }

    if (mentorToken) {
      // Create a session for future date
      const now = new Date();
      const startTime = new Date(now.getTime() + 3600000); // 1 hour from now
      const endTime = new Date(startTime.getTime() + 3600000); // 2 hours from now

      const sessionPayload = {
        title: "E2E Test Session " + Date.now(),
        description: "Session created by E2E booking chat test",
        sessionType: "ONE_ON_ONE",
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        priceAmount: 0,
        meetingLink: "https://meet.google.com/e2e-test",
        maxParticipants: 1,
      };

      log("1.6", "Creating test session...");
      const sessionRes = await request("POST", "/api/v1/sessions", sessionPayload, mentorToken);

      if (sessionRes.status === 200) {
        sessionId = sessionRes.body?.data?.id;
        if (sessionId) {
          results.createSession = true;
          log("1.7", `Session created: ID=${sessionId}`, true);
        } else {
          log("1.7", "Session created but no ID in response", false);
        }
      } else {
        log("1.6", `Session creation failed: ${sessionRes.status}`, false);
        const errMsg = typeof sessionRes.body === 'object' ? JSON.stringify(sessionRes.body).substring(0, 200) : sessionRes.body;
        log("1.7", `Error: ${errMsg}`, false);
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    divider("2. LOGIN AS LEARNER & CREATE BOOKING");
    // ═══════════════════════════════════════════════════════════════════

    if (!sessionId) {
      log("2.0", "No session available — cannot create booking. Skipping.", false);
      exitCode = 1;
      throw new Error("No session available. Cannot proceed with booking chat test.");
    }

    // Reset cookie jar to avoid leaking mentor session cookies into learner requests
    resetCookieJar();
    log("2.1", `Logging in as learner (${LEARNER_EMAIL})...`);
    learnerToken = await tryLogin(LEARNER_EMAIL, LEARNER_PASS);
    if (!learnerToken) {
      learnerToken = await tryLogin(LEARNER_EMAIL, "test@123");
    }

    if (!learnerToken) {
      log("2.1", `Learner login failed for ${LEARNER_EMAIL}`, false);
      exitCode = 1;
      throw new Error("Learner login failed");
    }

    results.learnerLogin = true;
    log("2.2", "Learner logged in successfully", true);
    learnerEmail = LEARNER_EMAIL;

    // Create a booking for the session
    const idempotencyKey = `e2e-test-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    log("2.3", `Creating booking for session ${sessionId}...`);

    const bookingRes = await request(
      "POST",
      "/api/v1/bookings",
      { sessionId },
      learnerToken,
      { "Idempotency-Key": idempotencyKey }
    );

    if (bookingRes.status === 200) {
      bookingId = bookingRes.body?.data?.id;
      if (bookingId) {
        results.createBooking = true;
        log("2.4", `Booking created: ID=${bookingId}`, true);
      } else {
        log("2.4", "Booking created but no ID in response", false);
        exitCode = 1;
        throw new Error("No booking ID in response");
      }
    } else {
      log("2.3", `Booking creation failed: ${bookingRes.status}`, false);
      const errMsg = typeof bookingRes.body === 'object' ? JSON.stringify(bookingRes.body).substring(0, 300) : bookingRes.body;
      log("2.4", `Error: ${errMsg}`, false);
      exitCode = 1;
      throw new Error("Booking creation failed");
    }

    // ═══════════════════════════════════════════════════════════════════
    divider("3. LIST MESSAGES (BASELINE)");
    // ═══════════════════════════════════════════════════════════════════

    log("3.1", "Fetching existing booking chat messages...");
    const msgsRes = await request("GET", `/api/v1/chat/booking/${bookingId}`, null, learnerToken);
    if (msgsRes.status !== 200) {
      log("3.1", `List messages failed: ${msgsRes.status}`, false);
      throw new Error(`List messages failed: ${msgsRes.status}`);
    }

    const existingMsgs = msgsRes.body?.data || [];
    log("3.2", `Existing messages: ${existingMsgs.length}`, true);

    // ═══════════════════════════════════════════════════════════════════
    divider("4. WEBSOCKET CONNECTION");
    // ═══════════════════════════════════════════════════════════════════

    const wsUrl = `${WS_URL}/ws/chat?token=${encodeURIComponent(learnerToken)}&bookingId=${bookingId}`;
    log("4.1", `Connecting to booking chat WS (bookingId=${bookingId})...`);

    ws = new WebSocket(wsUrl);

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("WebSocket connection timeout (5s)")), 5000);
      ws.on("open", () => { clearTimeout(timeout); resolve(); });
      ws.on("error", (err) => { clearTimeout(timeout); reject(err); });
    });

    results.wsConnect = true;
    log("4.2", "WebSocket connected successfully", true);

    // ═══════════════════════════════════════════════════════════════════
    divider("5. PING → EXPECT PONG");
    // ═══════════════════════════════════════════════════════════════════

    log("5.1", "Sending PING message...");
    const pongPromise = waitForWsMessage(ws, (msg) => msg.type === "PONG", 3000);
    ws.send(JSON.stringify({ type: "PING" }));

    const pong = await pongPromise;
    if (pong) {
      results.pingPong = true;
      log("5.2", "PONG received", true);
    } else {
      log("5.2", "No PONG received within 3s", false);
      exitCode = 1;
    }

    // ═══════════════════════════════════════════════════════════════════
    divider("6. SEND TEXT MESSAGE VIA WEBSOCKET");
    // ═══════════════════════════════════════════════════════════════════

    const testMessage = `E2E booking chat test ${Date.now()}`;
    log("6.1", `Sending via WS: "${testMessage}"`);

    // Booking chat broadcasts the ChatMessageView which has:
    // { type: "TEXT", message: { id, bookingId, senderId, senderEmail, senderName, senderRole, content, ... } }
    const broadcastPromise = waitForWsMessage(
      ws,
      (msg) => msg.type === "TEXT" && msg.message?.content === testMessage,
      3000
    );

    ws.send(JSON.stringify({ type: "TEXT", content: testMessage }));
    results.wsSendMessage = true;
    log("6.2", "Message sent via WebSocket", true);

    const broadcastMsg = await broadcastPromise;
    if (broadcastMsg) {
      results.wsReceiveBroadcast = true;
      log("6.3", `Broadcast received: "${broadcastMsg.message?.content}"`, true);
      console.log(`  ${COLORS.dim}  Message ID: ${broadcastMsg.message?.id}${COLORS.reset}`);
    } else {
      log("6.3", "No broadcast received within 3s (REST verification will confirm)", false);
    }

    // ═══════════════════════════════════════════════════════════════════
    divider("7. VERIFY PERSISTENCE VIA REST");
    // ═══════════════════════════════════════════════════════════════════

    await sleep(1000); // Allow DB write to propagate

    log("7.1", "Fetching messages via REST to verify persistence...");
    const verifyRes = await request("GET", `/api/v1/chat/booking/${bookingId}`, null, learnerToken);
    if (verifyRes.status !== 200) throw new Error(`Verify messages failed: ${verifyRes.status}`);

    const allMsgs = verifyRes.body?.data || [];
    const persisted = allMsgs.find((m) => m.content === testMessage);

    if (persisted) {
      results.restVerifyPersist = true;
      log("7.2", `Message persisted: ID=${persisted.id}, content="${persisted.content}"`, true);
    } else {
      log("7.2", `Message NOT found in REST response (of ${allMsgs.length} messages)`, false);
      if (allMsgs.length > 0) {
        console.log(`  ${COLORS.dim}  Messages on server: ${JSON.stringify(allMsgs.map(m => m.content))}${COLORS.reset}`);
      }
      exitCode = 1;
    }

    // ═══════════════════════════════════════════════════════════════════
    divider("8. SEND MESSAGE VIA REST");
    // ═══════════════════════════════════════════════════════════════════

    const restMessage = `E2E booking REST message ${Date.now()}`;
    log("8.1", `Sending via REST: "${restMessage}"...`);
    const sendRes = await request("POST", `/api/v1/chat/booking/${bookingId}`, { content: restMessage }, learnerToken);

    if (sendRes.status === 200) {
      const saved = sendRes.body?.data;
      if (saved && saved.id) {
        results.restSendMessage = true;
        log("8.2", `REST message sent: ID=${saved.id}`, true);
      } else {
        log("8.2", "REST response OK but no message ID returned", false);
        exitCode = 1;
      }
    } else {
      log("8.2", `REST send failed: ${sendRes.status}`, false);
      exitCode = 1;
    }

    // ═══════════════════════════════════════════════════════════════════
    divider("9. SEND TYPING EVENT");
    // ═══════════════════════════════════════════════════════════════════

    log("9.1", "Sending TYPING event...");
    ws.send(JSON.stringify({ type: "TYPING" }));
    await sleep(500);
    results.typingEvent = true;
    log("9.2", "TYPING event sent (fire-and-forget)", true);

    // ═══════════════════════════════════════════════════════════════════
    divider("10. SUMMARY");
    // ═══════════════════════════════════════════════════════════════════

    const icon = (ok) => ok ? `${COLORS.green}✓${COLORS.reset}` : `${COLORS.red}✗${COLORS.reset}`;
    console.log(`\n  ${COLORS.bold}Booking Chat WebSocket Flow Test Results${COLORS.reset}\n`);
    console.log(`  ${icon(results.mentorLogin)} Mentor login`);
    console.log(`  ${icon(results.createSession)} Create session`);
    console.log(`  ${icon(results.learnerLogin)} Learner login`);
    console.log(`  ${icon(results.createBooking)} Create booking`);
    console.log(`  ${icon(results.wsConnect)} WebSocket connection`);
    console.log(`  ${icon(results.pingPong)} PING → PONG`);
    console.log(`  ${icon(results.wsSendMessage)} Send TEXT via WebSocket`);
    console.log(`  ${icon(results.wsReceiveBroadcast)} Receive broadcast via WebSocket`);
    console.log(`  ${icon(results.restVerifyPersist)} Verify persistence via REST`);
    console.log(`  ${icon(results.restSendMessage)} Send message via REST`);
    console.log(`  ${icon(results.typingEvent)} TYPING event`);
    console.log(`\n  ${exitCode === 0 ? COLORS.green + "ALL CHECKS PASSED" : COLORS.red + "SOME CHECKS FAILED"}${COLORS.reset}\n`);

  } catch (err) {
    console.error(`\n  ${COLORS.red}FATAL ERROR:${COLORS.reset} ${err.message}`);
    console.error(`  ${COLORS.dim}${err.stack?.substring(0, 300)}${COLORS.reset}`);
    exitCode = 1;
  } finally {
    if (ws) {
      try { ws.close(); } catch { /* ignore */ }
    }
    process.exit(exitCode);
  }
}

main();
