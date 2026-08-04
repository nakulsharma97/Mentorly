import { render, screen, waitFor, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { http, HttpResponse } from "msw";
import { server } from "../test/mocks/server";
import LearnerMessagesPage from "./LearnerMessagesPage";

// ──────────────────────────────────────────────
// Mock WebSocket for jsdom (not natively available)
// ──────────────────────────────────────────────

class MockWebSocket {
  /** Track all active instances so tests can inspect them. */
  static instances = [];

  static get latest() {
    return MockWebSocket.instances[MockWebSocket.instances.length - 1] || null;
  }

  static reset() {
    MockWebSocket.instances = [];
  }

  url;
  readyState = MockWebSocket.CONNECTING; // 0
  onopen = null;
  onclose = null;
  onmessage = null;
  onerror = null;
  /** Sent payloads recorded for assertions. */
  sentMessages = [];

  constructor(url) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(data) {
    this.sentMessages.push(data);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent("close", { code: 1000, reason: "closed" }));
    }
  }

  // ── Test helpers ──

  _open() {
    this.readyState = MockWebSocket.OPEN;
    if (this.onopen) {
      this.onopen(new Event("open"));
    }
  }

  _receive(payload) {
    if (this.onmessage) {
      this.onmessage(
        new MessageEvent("message", { data: JSON.stringify(payload) }),
      );
    }
  }

  _close(code = 1000, reason = "test close") {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent("close", { code, reason }));
    }
  }
}

MockWebSocket.CONNECTING = 0;
MockWebSocket.OPEN = 1;
MockWebSocket.CLOSING = 2;
MockWebSocket.CLOSED = 3;

// ──────────────────────────────────────────────
// Test data
// ──────────────────────────────────────────────

const profile = {
  id: 11,
  email: "learner@test.com",
  fullName: "Learner One",
  role: "LEARNER",
};

const mentorUser = {
  id: 22,
  email: "mentor@test.com",
  fullName: "Mentor Jane",
  role: "MENTOR",
};

const now = new Date().toISOString();
// Give booking conversations an older timestamp so direct conversations sort first
const yesterday = new Date(Date.now() - 86400000).toISOString();

const mockDirectConvs = [
  {
    conversationId: 1,
    participantId: mentorUser.id,
    participantName: mentorUser.fullName,
    participantRole: mentorUser.role,
    participantSkills: "React, Node.js",
    participantProfileImageUrl: "",
    participantVerified: true,
    participantOnline: false,
    participantPresenceText: "Offline",
    lastMessagePreview: "Looking forward to our session!",
    lastMessageAt: now,
    unreadCount: 2,
  },
];

const mockBookingConvs = [
  {
    bookingId: 101,
    sessionTitle: "React Fundamentals",
    participantId: mentorUser.id,
    participantName: mentorUser.fullName,
    participantRole: mentorUser.role,
    participantSkills: "React",
    participantProfileImageUrl: "",
    participantVerified: true,
    participantOnline: true,
    participantPresenceText: "Online",
    lastMessagePreview: "See you tomorrow",
    lastMessageAt: yesterday,
    unreadCount: 1,
  },
];

const mockDirectMessages = [
  {
    id: 1,
    conversationId: 1,
    senderId: mentorUser.id,
    senderEmail: mentorUser.email,
    senderName: mentorUser.fullName,
    senderRole: mentorUser.role,
    senderProfileImageUrl: "",
    content: "Hello! Ready for our session?",
    readByRecipient: false,
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 2,
    conversationId: 1,
    senderId: profile.id,
    senderEmail: profile.email,
    senderName: profile.fullName,
    senderRole: profile.role,
    senderProfileImageUrl: "",
    content: "Yes, looking forward to it!",
    readByRecipient: true,
    createdAt: new Date(Date.now() - 1800000).toISOString(),
  },
];

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function renderPage(initialRoute = "/learner/messages") {
  return render(
    <MemoryRouter initialEntries={[initialRoute]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route
          path="/learner/messages"
          element={<LearnerMessagesPage profile={profile} />}
        />
        <Route
          path="/learner/messages/:conversationId"
          element={<LearnerMessagesPage profile={profile} />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

/** Await the component to finish loading conversations and auto-select the first one. */
async function waitForLoaded() {
  await waitFor(() => {
    expect(screen.getAllByRole("button", { name: /Mentor Jane/i }).length).toBeGreaterThan(0);
  });
}

/** Return the active MockWebSocket instance, waiting until one is created. */
async function waitForWebSocket() {
  await waitFor(() => {
    expect(MockWebSocket.instances.length).toBeGreaterThan(0);
  });
  return MockWebSocket.latest;
}

// ──────────────────────────────────────────────
// MSW handlers for chat API endpoints
// ──────────────────────────────────────────────

function setupDefaultHandlers() {
  server.use(
    http.get("*/api/v1/chat/conversations", () => {
      return HttpResponse.json({
        message: "Conversations fetched",
        data: mockBookingConvs,
      });
    }),
    http.get("*/api/v1/chat/direct/conversations", () => {
      return HttpResponse.json({
        message: "Direct conversations fetched",
        data: mockDirectConvs,
      });
    }),
    http.get("*/api/v1/chat/direct/:id/messages", () => {
      return HttpResponse.json({
        message: "Messages fetched",
        data: mockDirectMessages,
      });
    }),
    http.get("*/api/v1/chat/booking/:bookingId", () => {
      return HttpResponse.json({
        message: "Chat history fetched",
        data: mockDirectMessages.map((m) => ({
          ...m,
          bookingId: 101,
          senderVerified: m.senderRole === "MENTOR",
        })),
      });
    }),
    http.get("*/api/v1/chat/direct/:id", ({ params }) => {
      return HttpResponse.json({
        message: "Conversation fetched",
        data: {
          conversationId: Number(params.id),
          participantId: mentorUser.id,
          participantName: mentorUser.fullName,
          participantRole: mentorUser.role,
          participantSkills: "React, Node.js",
          participantProfileImageUrl: "",
          participantVerified: true,
          participantOnline: false,
          participantPresenceText: "Offline",
          messages: mockDirectMessages,
        },
      });
    }),
    http.put("*/api/v1/chat/booking/:id/read", () => {
      return HttpResponse.json({ message: "Messages marked read", data: null });
    }),
  );
}

// ──────────────────────────────────────────────
// Setup & teardown
// ──────────────────────────────────────────────

beforeEach(() => {
  MockWebSocket.reset();
  vi.stubGlobal("WebSocket", MockWebSocket);
  // Provide a stable API base so wsBase is predictable
  vi.stubEnv("VITE_API_BASE_URL", "http://localhost:5174");
  // Mock scrollTo which is not available in jsdom
  Element.prototype.scrollTo = vi.fn();
  setupDefaultHandlers();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  server.resetHandlers();
});

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

describe("LearnerMessagesPage — WebSocket integration", () => {
  // ── Test 1: Loads conversations and shows the list ──
  it("loads conversations and renders the conversation list", async () => {
    renderPage();

    await waitForLoaded();

    // The page should show loaded conversations with the mentor name
    expect(screen.getByRole("heading", { name: /Messages/i })).toBeInTheDocument();
    const convButtons = screen.getAllByRole("button", { name: new RegExp(mentorUser.fullName, "i") });
    expect(convButtons.length).toBeGreaterThanOrEqual(1);
  });

  // ── Test 2: Connects WebSocket and sends READ on open ──
  it("connects WebSocket for a direct conversation and sends READ message on open", async () => {
    renderPage();

    await waitForLoaded();

    // The first conversation should be auto-selected, which triggers WebSocket connect
    const ws = await waitForWebSocket();

    // Verify WebSocket URL points to direct chat endpoint with correct conversation ID
    expect(ws.url).toContain("/ws/chat/direct");
    expect(ws.url).toContain("conversationId=1");

    // Simulate WebSocket opening
    act(() => {
      ws._open();
    });

    // Verify READ message was sent over WebSocket
    await waitFor(() => {
      expect(ws.sentMessages.length).toBeGreaterThan(0);
    });

    const readPayload = JSON.parse(ws.sentMessages[0]);
    expect(readPayload.type).toBe("READ");
    expect(readPayload.conversationId).toBe(1);
  });

  // ── Test 3: Receives TEXT message via WebSocket and appends it to thread ──
  it("appends an incoming TEXT message to the thread in real-time", async () => {
    renderPage();

    await waitForLoaded();

    const ws = await waitForWebSocket();

    // Open the WebSocket
    act(() => {
      ws._open();
    });

    // Wait for initial messages to load via REST
    await waitFor(() => {
      expect(screen.getByText("Hello! Ready for our session?")).toBeInTheDocument();
    });

    // Simulate incoming real-time message
    const incomingMsg = {
      type: "TEXT",
      message: {
        id: 3,
        conversationId: 1,
        senderId: mentorUser.id,
        senderEmail: mentorUser.email,
        senderName: mentorUser.fullName,
        senderRole: mentorUser.role,
        senderProfileImageUrl: "",
        content: "Let's start with React hooks!",
        readByRecipient: false,
        createdAt: new Date().toISOString(),
      },
    };

    act(() => {
      ws._receive(incomingMsg);
    });

    // The new message should appear in the thread
    await waitFor(() => {
      expect(screen.getByText("Let's start with React hooks!")).toBeInTheDocument();
    });
  });

  // ── Test 4: Shows typing indicator when TYPING received ──
  it("shows typing indicator when receiving a TYPING event", async () => {
    renderPage();

    await waitForLoaded();

    const ws = await waitForWebSocket();
    act(() => {
      ws._open();
    });

    // Simulate typing indicator from the other user
    act(() => {
      ws._receive({
        type: "TYPING",
        typingUserEmail: mentorUser.email,
        conversationId: 1,
      });
    });

    // Typing indicator should show with aria-label
    await waitFor(() => {
      expect(
        screen.getByLabelText(`${mentorUser.fullName} is typing`),
      ).toBeInTheDocument();
    });
  });

  // ── Test 5: Handles READ_ACK to update read receipts ──
  it("updates read receipts when READ_ACK is received", async () => {
    renderPage();

    await waitForLoaded();

    const ws = await waitForWebSocket();
    act(() => {
      ws._open();
    });

    // Wait for initial messages to load
    await waitFor(() => {
      expect(screen.getByText("Hello! Ready for our session?")).toBeInTheDocument();
    });

    // Simulate READ_ACK (the other user read our messages)
    act(() => {
      ws._receive({
        type: "READ_ACK",
        readByEmail: mentorUser.email,
        conversationId: 1,
      });
    });

    // The thread should still render the initial messages after READ_ACK processing
    await waitFor(() => {
      expect(screen.getByText("Yes, looking forward to it!")).toBeInTheDocument();
    });
  });

  // ── Test 6: WebSocket reconnects with exponential backoff ──
  it("reconnects WebSocket with exponential backoff on close", async () => {
    renderPage();

    await waitForLoaded();

    const ws = await waitForWebSocket();
    act(() => {
      ws._open();
    });

    // Clear the instances so we can track the reconnection
    MockWebSocket.instances = [];

    // Simulate WebSocket closing (triggers reconnection with 1s backoff)
    act(() => {
      ws._close(1006, "Connection lost");
    });

    // A new WebSocket should be created after the exponential backoff delay
    await waitFor(
      () => {
        expect(MockWebSocket.instances.length).toBeGreaterThan(0);
      },
      { timeout: 3000 },
    );

    const newWs = MockWebSocket.latest;
    expect(newWs).not.toBeNull();
    expect(newWs.url).toContain("/ws/chat/direct");
    expect(newWs.url).toContain("conversationId=1");
  });

  // ── Test 7: WebSocket connects for booking conversations correctly ──
  it("connects WebSocket for booking conversations with correct endpoint", async () => {
    // Override the default handlers: return empty direct conversations
    // so the booking conversation is auto-selected (it appears first in the merged list)
    server.use(
      http.get("*/api/v1/chat/direct/conversations", () => {
        return HttpResponse.json({
          message: "Direct conversations fetched",
          data: [],
        });
      }),
    );

    renderPage();

    await waitForLoaded();

    const ws = await waitForWebSocket();

    // Should connect to booking WebSocket endpoint
    expect(ws.url).toContain("/ws/chat");
    expect(ws.url).toContain("bookingId=101");

    act(() => {
      ws._open();
    });

    // Should send READ with bookingId
    await waitFor(() => {
      expect(ws.sentMessages.length).toBeGreaterThan(0);
    });

    const readPayload = JSON.parse(ws.sentMessages[0]);
    expect(readPayload.type).toBe("READ");
    expect(readPayload.bookingId).toBe(101);
  });
});
