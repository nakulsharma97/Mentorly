import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { http, HttpResponse } from "msw";
import { server } from "../test/mocks/server";
import { clearGetCache } from "../api/client";
import { ChatProvider } from "../context/ChatContext";
import MessagesPage from "./MessagesPage";

// ──────────────────────────────────────────────
// Mock WebSocket for jsdom (not natively available)
// ──────────────────────────────────────────────

class MockWebSocket {
  static instances = [];
  url;
  readyState = 0;
  onopen = null;
  onclose = null;
  onmessage = null;
  onerror = null;
  constructor(url) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }
  send() {}
  close() {}
}

// ──────────────────────────────────────────────
// Test data — two direct conversations; the deep-linked one is NOT first,
// so only the route param can make it the selected conversation.
// ──────────────────────────────────────────────

const mentorProfile = {
  id: 11,
  email: "mentor@test.com",
  fullName: "Mentor One",
  role: "MENTOR",
};

const now = new Date().toISOString();

const directConv = (conversationId, participantName) => ({
  conversationId,
  participantId: 100 + conversationId,
  participantName,
  participantUsername: participantName.toLowerCase().replace(/\s+/g, ""),
  participantRole: "LEARNER",
  participantSkills: "React",
  participantProfileImageUrl: "",
  participantVerified: false,
  participantOnline: false,
  participantPresenceText: "Offline",
  lastMessagePreview: "Hello there",
  lastMessageAt: now,
  unreadCount: 0,
  pinned: false,
  archived: false,
});

// Conversation 43 comes FIRST in the list; 42 is the deep-link target.
const conv43 = directConv(43, "Learner Sam");
const conv42 = directConv(42, "Learner Zoe");

function renderPage(initialRoute) {
  return render(
    <ChatProvider profile={mentorProfile}>
      <MemoryRouter
        initialEntries={[initialRoute]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route
            path="/mentor/messages"
            element={<MessagesPage profile={mentorProfile} />}
          />
          <Route
            path="/mentor/messages/:conversationId"
            element={<MessagesPage profile={mentorProfile} />}
          />
        </Routes>
      </MemoryRouter>
    </ChatProvider>,
  );
}

/** The conversation-list card for `name` (other buttons may match too). */
const rowFor = (name) =>
  screen
    .getAllByRole("button", { name: new RegExp(name, "i") })
    .find((el) => el.className.includes("ms-conv-card-v2"));

beforeEach(() => {
  MockWebSocket.instances = [];
  vi.stubGlobal("WebSocket", MockWebSocket);
  vi.stubEnv("VITE_API_BASE_URL", "http://localhost:5174");
  Element.prototype.scrollTo = vi.fn();
  // The axios client dedups GETs for 5s — clear so each test refetches.
  clearGetCache();

  server.use(
    http.get("*/api/v1/chat/conversations", () =>
      HttpResponse.json({ message: "ok", data: [] }),
    ),
    http.get("*/api/v1/chat/direct/conversations", () =>
      HttpResponse.json({ message: "ok", data: [conv43, conv42] }),
    ),
    http.get("*/api/message-requests", () =>
      HttpResponse.json({ message: "ok", data: [] }),
    ),
    http.get("*/api/v1/safety/blocked", () =>
      HttpResponse.json({ message: "ok", data: [] }),
    ),
    http.get("*/api/v1/search/users", () =>
      HttpResponse.json({ message: "ok", data: [] }),
    ),
    http.get("*/api/v1/chat/direct/:id/messages", () =>
      HttpResponse.json({ message: "ok", data: [] }),
    ),
    http.put("*/api/v1/chat/booking/:id/read", () =>
      HttpResponse.json({ message: "ok", data: null }),
    ),
  );
});

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  server.resetHandlers();
});

describe("MessagesPage — mentor conversation deep link", () => {
  it("/mentor/messages/42 selects conversation 42 after the list loads", async () => {
    renderPage("/mentor/messages/42");

    // Conversation 43 is first in the list, so only the route param can
    // select Zoe's conversation — proven by Sam's row staying unselected.
    await waitFor(() => expect(rowFor("Learner Sam")).toBeTruthy());

    const zoeRow = await screen.findByRole("button", {
      name: /Learner Zoe/i,
    });
    await waitFor(() =>
      expect(zoeRow.getAttribute("aria-current")).toBe("true"),
    );
    expect(rowFor("Learner Sam").getAttribute("aria-current")).toBeNull();
  });

  it("keeps the mentor variant identity on the deep-linked route", async () => {
    renderPage("/mentor/messages/42");

    await waitFor(() => expect(rowFor("Learner Zoe")).toBeTruthy());
    expect(document.title).toBe("Messages | Mentorly Mentor");
  });

  it("/mentor/messages without a param still auto-selects the first conversation", async () => {
    renderPage("/mentor/messages");

    await waitFor(() => expect(rowFor("Learner Sam")).toBeTruthy());
    await waitFor(() =>
      expect(rowFor("Learner Sam").getAttribute("aria-current")).toBe("true"),
    );
    expect(rowFor("Learner Zoe").getAttribute("aria-current")).toBeNull();
  });
});
