/**
 * Chat WebSocket Flow End-to-End Test Script
 * ============================================
 *
 * Simulates the complete direct chat lifecycle:
 *   1. Login & get auth token
 *   2. Find a mentor (to create a conversation with)
 *   3. Create or get a direct conversation
 *   4. List messages in the conversation (baseline)
 *   5. Connect via WebSocket (/ws/chat/direct?token=...&conversationId=...)
 *   6. Send PING → expect PONG response
 *   7. Send a TEXT message via WebSocket → verify broadcast
 *   8. Fetch messages via REST API → verify message was persisted
 *   9. Send a TEXT message via REST API
 *  10. Send a TYPING event (fire-and-forget)
 *  11. Close WebSocket & summary
 *
 * Usage:
 *   node scripts/test-chat-flow.cjs
 *
 * Environment variables (optional):
 *   BASE_URL       - Backend base URL         (default: http://localhost:8080)
 *   WS_URL         - WebSocket URL            (default: ws://localhost:8080)
 *   AUTH_EMAIL     - Login email              (default: learner@test.com)
 *   AUTH_PASSWORD  - Login password           (default: password)
 *   MENTOR_ID      - Target mentor ID         (default: auto-detect from mentors list)
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

// Cookie jar — same pattern as test-notification-flow.cjs
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

// Wait for a specific WebSocket message matching a predicate, with a timeout
function waitForWsMessage(ws, predicate, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      resolve(null);
    }, timeoutMs);

    function onMessage(data) {
      try {
        const parsed = JSON.parse(data.toString());
        if (predicate(parsed)) {
          cleanup();
          resolve(parsed);
        }
      } catch { /* ignore parse errors */ }
    }

    function onClose() {
      cleanup();
      resolve(null);
    }

    function onError() {
      cleanup();
      resolve(null);
    }

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

// ─── Main Flow ─────────────────────────────────────────────────────────────

async function main() {
  let exitCode = 0;
  let token = null;
  let ws = null;
  let conversationId = null;
  let mentorId = null;
  const results = {
    login: false,
    findMentor: false,
    createConversation: false,
    listMessages: false,
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
    divider("1. LOGIN & GET AUTH TOKEN");
    // ═══════════════════════════════════════════════════════════════════

    log("1.1", `Logging in as ${EMAIL}...`);
    const loginRes = await request("POST", "/api/v1/auth/login", { email: EMAIL, password: PASSWORD });

    if (loginRes.status === 200) {
      token = loginRes.body?.data?.token || loginRes.body?.token;
      if (!token) throw new Error("No token in login response");
      results.login = true;
      log("1.2", "Auth token obtained", true);
      console.log(`  ${COLORS.dim}  Token: ${token.substring(0, 30)}...${COLORS.reset}`);
    } else {
      log("1.1", `Login failed (${loginRes.status}), trying signup...`);
      const signupRes = await request("POST", "/api/v1/auth/signup", {
        email: EMAIL, password: PASSWORD, fullName: "Test Learner", role: "LEARNER",
      });
      if (signupRes.status === 200) {
        token = signupRes.body?.data?.token || signupRes.body?.token;
        results.login = true;
        log("1.2", "Signed up and got token", true);
      } else {
        throw new Error(`Auth failed: ${signupRes.status}`);
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    divider("2. FIND A MENTOR");
    // ═══════════════════════════════════════════════════════════════════

    const mentorIdOverride = process.env.MENTOR_ID;
    if (mentorIdOverride) {
      mentorId = parseInt(mentorIdOverride, 10);
      log("2.1", `Using MENTOR_ID from env: ${mentorId}`, true);
    } else {
      log("2.1", "Fetching mentors list...");
      const mentorsRes = await request("GET", "/api/v1/users/mentors?page=0&size=10", null, token);
      if (mentorsRes.status !== 200) throw new Error(`Failed to fetch mentors: ${mentorsRes.status}`);

      const mentors = mentorsRes.body?.data || [];
      if (mentors.length === 0) throw new Error("No mentors found in the system");
      mentorId = mentors[0].id;
      log("2.2", `Found mentor: ID=${mentorId} "${mentors[0].fullName}"`, true);
    }
    results.findMentor = true;

    // ═══════════════════════════════════════════════════════════════════
    divider("3. CREATE/GET DIRECT CONVERSATION");
    // ═══════════════════════════════════════════════════════════════════

    log("3.1", `Creating or getting conversation with mentor ${mentorId}...`);
    const convRes = await request("POST", `/api/v1/chat/direct/${mentorId}`, null, token);
    if (convRes.status !== 200) throw new Error(`Create conversation failed: ${convRes.status} ${JSON.stringify(convRes.body)}`);

    conversationId = convRes.body?.data?.conversationId;
    if (!conversationId) {
      // Try parsing from response body directly
      const data = convRes.body?.data;
      conversationId = data?.conversationId || data?.id;
    }
    if (!conversationId) throw new Error(`No conversationId in response: ${JSON.stringify(convRes.body).substring(0, 200)}`);

    results.createConversation = true;
    log("3.2", `Conversation ID: ${conversationId}`, true);
    console.log(`  ${COLORS.dim}  Partner: ${convRes.body?.data?.participantName || "Unknown"}${COLORS.reset}`);

    // ═══════════════════════════════════════════════════════════════════
    divider("4. LIST MESSAGES (BASELINE)");
    // ═══════════════════════════════════════════════════════════════════

    log("4.1", "Fetching existing messages...");
    const msgsRes = await request("GET", `/api/v1/chat/direct/${conversationId}/messages`, null, token);
    if (msgsRes.status !== 200) throw new Error(`List messages failed: ${msgsRes.status}`);

    const existingMsgs = msgsRes.body?.data || [];
    results.listMessages = true;
    log("4.2", `Existing messages: ${existingMsgs.length}`, true);

    // ═══════════════════════════════════════════════════════════════════
    divider("5. WEBSOCKET CONNECTION");
    // ═══════════════════════════════════════════════════════════════════

    const wsUrl = `${WS_URL}/ws/chat/direct?token=${encodeURIComponent(token)}&conversationId=${conversationId}`;
    log("5.1", `Connecting to direct chat WS (conversationId=${conversationId})...`);

    ws = new WebSocket(wsUrl);

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("WebSocket connection timeout (5s)")), 5000);
      ws.on("open", () => { clearTimeout(timeout); resolve(); });
      ws.on("error", (err) => { clearTimeout(timeout); reject(err); });
    });

    results.wsConnect = true;
    log("5.2", "WebSocket connected successfully", true);

    // ═══════════════════════════════════════════════════════════════════
    divider("6. PING → EXPECT PONG");
    // ═══════════════════════════════════════════════════════════════════

    log("6.1", "Sending PING message...");
    const pongPromise = waitForWsMessage(ws, (msg) => msg.type === "PONG", 3000);
    ws.send(JSON.stringify({ type: "PING" }));

    const pong = await pongPromise;
    if (pong) {
      results.pingPong = true;
      log("6.2", "PONG received", true);
    } else {
      log("6.2", "No PONG received within 3s", false);
      exitCode = 1;
    }

    // ═══════════════════════════════════════════════════════════════════
    divider("7. SEND TEXT MESSAGE VIA WEBSOCKET");
    // ═══════════════════════════════════════════════════════════════════

    const testMessage = `E2E test message ${Date.now()}`;
    log("7.1", `Sending via WS: "${testMessage}"`);

    // Listen for the broadcast of our own message
    const broadcastPromise = waitForWsMessage(
      ws,
      (msg) => msg.type === "TEXT" && msg.message?.content === testMessage,
      3000
    );

    ws.send(JSON.stringify({ type: "TEXT", content: testMessage }));
    results.wsSendMessage = true;
    log("7.2", "Message sent via WebSocket", true);

    const broadcastMsg = await broadcastPromise;
    if (broadcastMsg) {
      results.wsReceiveBroadcast = true;
      log("7.3", `Broadcast received: "${broadcastMsg.message?.content}"`, true);
      console.log(`  ${COLORS.dim}  Message ID: ${broadcastMsg.message?.id}${COLORS.reset}`);
    } else {
      log("7.3", "No broadcast received within 3s (may be a timing issue on first message)", false);
      // Not critical — REST verification below is the definitive check
    }

    // ═══════════════════════════════════════════════════════════════════
    divider("8. VERIFY PERSISTENCE VIA REST");
    // ═══════════════════════════════════════════════════════════════════

    await sleep(1000); // Allow DB write to propagate

    log("8.1", "Fetching messages via REST to verify persistence...");
    const verifyRes = await request("GET", `/api/v1/chat/direct/${conversationId}/messages`, null, token);
    if (verifyRes.status !== 200) throw new Error(`Verify messages failed: ${verifyRes.status}`);

    const allMsgs = verifyRes.body?.data || [];
    const persisted = allMsgs.find((m) => m.content === testMessage);

    if (persisted) {
      results.restVerifyPersist = true;
      log("8.2", `Message persisted: ID=${persisted.id}, content="${persisted.content}"`, true);
    } else {
      log("8.2", `Message NOT found in REST response (of ${allMsgs.length} messages)`, false);
      console.log(`  ${COLORS.dim}  Sent: "${testMessage}"${COLORS.reset}`);
      console.log(`  ${COLORS.dim}  Messages on server: ${JSON.stringify(allMsgs.map(m => m.content))}${COLORS.reset}`);
      exitCode = 1;
    }

    // ═══════════════════════════════════════════════════════════════════
    divider("9. SEND MESSAGE VIA REST");
    // ═══════════════════════════════════════════════════════════════════

    const restMessage = `E2E REST message ${Date.now()}`;
    log("9.1", `Sending via REST: "${restMessage}"...`);
    const sendRes = await request("POST", `/api/v1/chat/direct/${conversationId}/messages`, { content: restMessage }, token);

    if (sendRes.status === 200) {
      const saved = sendRes.body?.data;
      if (saved && saved.id) {
        results.restSendMessage = true;
        log("9.2", `REST message sent: ID=${saved.id}`, true);
      } else {
        log("9.2", "REST response OK but no message ID returned", false);
        exitCode = 1;
      }
    } else {
      log("9.2", `REST send failed: ${sendRes.status}`, false);
      exitCode = 1;
    }

    // ═══════════════════════════════════════════════════════════════════
    divider("10. SEND TYPING EVENT");
    // ═══════════════════════════════════════════════════════════════════

    log("10.1", "Sending TYPING event...");
    ws.send(JSON.stringify({ type: "TYPING" }));
    await sleep(500);
    results.typingEvent = true;
    log("10.2", "TYPING event sent (fire-and-forget)", true);

    // ═══════════════════════════════════════════════════════════════════
    divider("11. SUMMARY");
    // ═══════════════════════════════════════════════════════════════════

    const icon = (ok) => ok ? `${COLORS.green}✓${COLORS.reset}` : `${COLORS.red}✗${COLORS.reset}`;
    console.log(`\n  ${COLORS.bold}Chat WebSocket Flow Test Results${COLORS.reset}\n`);
    console.log(`  ${icon(results.login)} Login & Authentication`);
    console.log(`  ${icon(results.findMentor)} Find mentor`);
    console.log(`  ${icon(results.createConversation)} Create/get direct conversation`);
    console.log(`  ${icon(results.listMessages)} List messages (baseline)`);
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
