import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { http, HttpResponse } from "msw";
import { server } from "../../test/mocks/server";
import { clearGetCache } from "../../api/client";
import { ChatProvider } from "../../context/ChatContext";
import MessageApp from "./MessageApp";

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
// Test data
// ──────────────────────────────────────────────

const profile = {
  id: 11,
  email: "learner@test.com",
  fullName: "Learner One",
  role: "LEARNER",
};

const now = new Date().toISOString();

const mentorJane = {
  conversationId: 1,
  participantId: 22,
  participantName: "Mentor Jane",
  participantUsername: "janementor",
  participantRole: "MENTOR",
  participantSkills: "React",
  participantProfileImageUrl: "",
  participantVerified: true,
  participantOnline: false,
  participantPresenceText: "Offline",
  participantEmail: "jane@test.com",
  lastMessagePreview: "Hi",
  lastMessageAt: now,
  unreadCount: 0,
  pinned: false,
  archived: false,
};

/** Search result for a user we can message directly (existing relationship). */
const mentorSam = {
  userId: 33,
  fullName: "Mentor Sam",
  username: "samsingh",
  email: "sam@x.com",
  role: "MENTOR",
  skills: "React",
  mentorVerified: false,
  online: true,
  availability: "Online now",
  canStartDirect: true,
};

/** Search result for a user that requires a conversation request first. */
const pendingPat = {
  userId: 44,
  fullName: "Pending Pat",
  username: "patty",
  email: "pat@x.com",
  role: "MENTOR",
  skills: "Python",
  mentorVerified: false,
  online: false,
  availability: "Active recently",
  canStartDirect: false,
};

// Counters reset per test — used to prove exactly which endpoints were called.
let directPosts = 0;
let requestPosts = [];
// When true, GET /api/v1/chat/direct/conversations fails with a 500.
let failListRefresh = false;
// Mutable "search directory" — the search handler reads it at request time,
// so each test controls results without stacking MSW handlers.
let searchDirectory = [mentorSam];
// When true, GET /api/v1/search/users fails with a 500.
let failSearch = false;

beforeEach(() => {
  MockWebSocket.instances = [];
  directPosts = 0;
  requestPosts = [];
  failListRefresh = false;
  searchDirectory = [mentorSam];
  failSearch = false;
  vi.stubGlobal("WebSocket", MockWebSocket);
  Element.prototype.scrollTo = vi.fn();
  // The axios client dedups GETs by path for 5s — without clearing, every
  // test after the first would be served test 1's cached search/list responses.
  clearGetCache();

  server.use(
    http.get("*/api/v1/chat/conversations", () =>
      HttpResponse.json({ message: "ok", data: [] }),
    ),
    // Deliberately STALE: it never contains a conversation created during a
    // test — the strictest version of "the refresh raced the create".
    http.get("*/api/v1/chat/direct/conversations", () => {
      if (failListRefresh) {
        return HttpResponse.json(
          { message: "Conversations could not be loaded." },
          { status: 500 },
        );
      }
      return HttpResponse.json({ message: "ok", data: [mentorJane] });
    }),
    http.get("*/api/message-requests", () =>
      HttpResponse.json({ message: "ok", data: [] }),
    ),
    http.get("*/api/v1/safety/blocked", () =>
      HttpResponse.json({ message: "ok", data: [] }),
    ),
    http.get("*/api/v1/search/users", ({ request }) => {
      const url = new URL(request.url);
      const q = (url.searchParams.get("q") || "").trim().toLowerCase();
      if (failSearch) {
        return HttpResponse.json({ message: "Search exploded" }, { status: 500 });
      }
      const rows = q
        ? searchDirectory.filter((u) =>
            [u.fullName, u.username, u.email, u.skills].some((f) =>
              String(f || "").toLowerCase().includes(q),
            ),
          )
        : searchDirectory;
      return HttpResponse.json({ message: "ok", data: rows });
    }),
    http.get("*/api/v1/chat/direct/:id/messages", () =>
      HttpResponse.json({ message: "ok", data: [] }),
    ),
    http.post("*/api/v1/chat/direct/:id", () => {
      directPosts += 1;
      return HttpResponse.json({
        message: "Conversation ready",
        data: {
          conversationId: 99,
          participantId: 33,
          participantName: "Mentor Sam",
          participantUsername: "samsingh",
          participantRole: "MENTOR",
          participantSkills: "React",
          participantProfileImageUrl: "",
          participantVerified: false,
          participantOnline: true,
          participantPresenceText: "Online",
          participantEmail: "sam@x.com",
          lastMessagePreview: "",
          lastMessageAt: new Date().toISOString(),
          unreadCount: 0,
          pinned: false,
          archived: false,
        },
      });
    }),
    http.post("*/api/message-requests", async ({ request }) => {
      requestPosts.push(await request.json());
      return HttpResponse.json({ message: "Message request sent", data: { id: 7 } });
    }),
  );
});

function renderApp(notify = vi.fn()) {
  const utils = render(
    <ChatProvider profile={profile}>
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <MessageApp profile={profile} notify={notify} variant="LEARNER" />
      </MemoryRouter>
    </ChatProvider>,
  );
  return { ...utils, notify };
}

/** Wait until the conversation list has loaded and Mentor Jane auto-selects. */
async function waitForLoaded() {
  await waitFor(() =>
    expect(screen.getAllByText("Mentor Jane").length).toBeGreaterThan(0),
  );
}

async function openNewChatPanel(user) {
  await user.click(screen.getByRole("button", { name: /new chat/i }));
  await waitFor(() =>
    expect(screen.getByText("Start New Conversation")).toBeInTheDocument(),
  );
}

/** Click the action button on a user card inside the New Conversation panel. */
async function clickCardAction(user, name) {
  const card = screen.getByText(name).closest("article");
  const actionBtn = within(card).getByRole("button");
  await user.click(actionBtn);
  return card;
}

// ──────────────────────────────────────────────
// 1. Opening the panel
// ──────────────────────────────────────────────

describe("New Chat — opening the panel", () => {
  it("clicking New Chat opens the New Conversation panel", async () => {
    const user = userEvent.setup();
    renderApp();
    await waitForLoaded();

    // The panel is the default right pane until the first conversation
    // auto-selects; wait for that, then confirm New Chat re-opens it.
    await waitFor(() =>
      expect(screen.queryByText("Start New Conversation")).toBeNull(),
    );
    await openNewChatPanel(user);

    // Search input and suggestion sections are present.
    expect(screen.getByLabelText("Search mentors")).toBeInTheDocument();
    expect(screen.getByText("Suggested Mentors")).toBeInTheDocument();
  });

  it("the close (X) button dismisses the panel and returns to the conversation", async () => {
    const user = userEvent.setup();
    renderApp();
    await waitForLoaded();
    await openNewChatPanel(user);

    const panel = screen.getByText("Start New Conversation").closest("section");
    await user.click(within(panel).getByRole("button", { name: "Close" }));

    await waitFor(() =>
      expect(screen.queryByText("Start New Conversation")).toBeNull(),
    );
    // Mentor Jane's conversation is still selected and visible.
    expect(screen.getAllByText("Mentor Jane").length).toBeGreaterThan(0);
  });

  it("the Escape key dismisses the panel", async () => {
    renderApp();
    await waitForLoaded();
    await openNewChatPanel(userEvent.setup());

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() =>
      expect(screen.queryByText("Start New Conversation")).toBeNull(),
    );
    expect(screen.getAllByText("Mentor Jane").length).toBeGreaterThan(0);
  });
});

// ──────────────────────────────────────────────
// 2. Starting a conversation
// ──────────────────────────────────────────────

describe("New Chat — starting a conversation", () => {
  it("selecting a user creates the conversation, closes the panel, and adds it to the list — even when the follow-up list refresh is stale", async () => {
    const user = userEvent.setup();
    const { notify } = renderApp();
    await waitForLoaded();
    await openNewChatPanel(user);

    await waitFor(() => expect(screen.getByText("Mentor Sam")).toBeInTheDocument());
    // Force the follow-up refresh onto the real network (still stale — it
    // never contains conversation 99) instead of a same-path cached response.
    clearGetCache();
    await clickCardAction(user, "Mentor Sam");

    // Panel closes and the new conversation opens.
    await waitFor(() =>
      expect(screen.queryByText("Start New Conversation")).toBeNull(),
    );
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Conversation ready" }),
    );

    // The stale refresh (which lacks conversation 99) must not revert the
    // panel or drop the new conversation from the sidebar.
    await new Promise((r) => setTimeout(r, 400));
    expect(screen.queryByText("Start New Conversation")).toBeNull();
    const sidebar = screen.getByRole("complementary", {
      name: "Conversations",
    });
    expect(within(sidebar).getByText("Mentor Sam")).toBeInTheDocument();
    expect(within(sidebar).getByText("Mentor Jane")).toBeInTheDocument();

    // Exactly one direct-conversation create/reuse call, no request fallback.
    expect(directPosts).toBe(1);
    expect(requestPosts).toHaveLength(0);
  });

  it("a failing list refresh after creation keeps the panel closed and preserves every conversation", async () => {
    const user = userEvent.setup();
    renderApp();
    await waitForLoaded();
    await openNewChatPanel(user);

    await waitFor(() => expect(screen.getByText("Mentor Sam")).toBeInTheDocument());
    clearGetCache(); // the refresh must actually hit the failing endpoint
    failListRefresh = true; // the silent refresh right after create now 500s
    await clickCardAction(user, "Mentor Sam");

    await waitFor(() =>
      expect(screen.queryByText("Start New Conversation")).toBeNull(),
    );
    await new Promise((r) => setTimeout(r, 400));

    expect(screen.queryByText("Start New Conversation")).toBeNull();
    const sidebar = screen.getByRole("complementary", {
      name: "Conversations",
    });
    // New conversation survived the failed refresh…
    expect(within(sidebar).getByText("Mentor Sam")).toBeInTheDocument();
    // …and the pre-existing conversation was not wiped either.
    expect(within(sidebar).getByText("Mentor Jane")).toBeInTheDocument();
  });

  it("users without a direct path get a conversation request (no duplicate, panel stays with feedback)", async () => {
    const user = userEvent.setup();
    searchDirectory = [pendingPat];
    const { notify } = renderApp();
    await waitForLoaded();
    await openNewChatPanel(user);

    await waitFor(() => expect(screen.getByText("Pending Pat")).toBeInTheDocument());
    const card = await clickCardAction(user, "Pending Pat");

    // Request posted with the correct payload — never a direct conversation.
    await waitFor(() => expect(requestPosts).toHaveLength(1));
    expect(requestPosts[0].receiver).toBe(44);
    expect(String(requestPosts[0].firstMessage || "").length).toBeGreaterThan(0);
    expect(directPosts).toBe(0);

    // Visible per-card + toast feedback; no fake success (no conversation opens).
    expect(await within(card).findByText("Request Sent")).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: /Request Sent/i })).toBeDisabled();
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Request sent" }),
    );
    expect(screen.getByText("Start New Conversation")).toBeInTheDocument();
  });
});

// ──────────────────────────────────────────────
// 3. Search states: loading, results, empty, error
// ──────────────────────────────────────────────

describe("New Chat — search states", () => {
  it("typing shows the loading skeleton, then an error banner when the search API fails", async () => {
    const user = userEvent.setup();
    renderApp();
    await waitForLoaded();
    await openNewChatPanel(user);
    // Let the initial empty-query search (suggestions) settle first.
    await waitFor(() => expect(screen.getByText("Mentor Sam")).toBeInTheDocument());

    // Clear the GET dedup cache so this typed query reaches the network
    // (the mount-time "?q=" result would otherwise be served for 5s).
    clearGetCache();
    failSearch = true;

    await user.type(screen.getByLabelText("Search mentors"), "zzz");

    // Loading state is shown during the debounce/request window.
    await waitFor(
      () => expect(document.querySelector(".ms-skel-user")).not.toBeNull(),
      { timeout: 2000 },
    );

    // Error state surfaces the backend message — never a silent failure.
    // (The client retries 500s with backoff, so allow time for that.)
    const alert = await screen.findByRole("alert", {}, { timeout: 6000 });
    expect(alert).toHaveTextContent("Search exploded");
  });

  it("a successful search shows matching users with avatar, name and username", async () => {
    const user = userEvent.setup();
    renderApp();
    await waitForLoaded();
    await openNewChatPanel(user);
    clearGetCache(); // make the typed query hit the network, not the cache

    await user.type(screen.getByLabelText("Search mentors"), "sam");

    // Typing highlights the match (name is split by <mark>), so match on
    // the username and the card's aggregated text instead of the raw node.
    const username = await screen.findByText("@samsingh");
    expect(username).toBeInTheDocument();
    expect(screen.getByText(/1 match for/i)).toBeInTheDocument();
    // Profile image/avatar rendered (Avatar falls back to initials container).
    const card = username.closest("article");
    expect(card).toBeInTheDocument();
    expect(card.textContent).toContain("Mentor Sam");
    expect(card.querySelector(".ms-avatar, [class*=avatar]")).not.toBeNull();
    expect(within(card).getByRole("button", { name: /Open Chat/i })).toBeInTheDocument();
  });

  it("no results shows the empty state with a clear-search action", async () => {
    const user = userEvent.setup();
    renderApp();
    await waitForLoaded();
    await openNewChatPanel(user);
    clearGetCache(); // make the typed query hit the network, not the cache

    await user.type(screen.getByLabelText("Search mentors"), "zzzz");

    await waitFor(() =>
      expect(screen.getByText("No mentors found")).toBeInTheDocument(),
    );
    // Scope to the empty state — the search input also has a "Clear search" X.
    const empty = document.querySelector(".ms-new__empty");
    expect(empty).not.toBeNull();
    expect(
      within(empty).getByRole("button", { name: /clear search/i }),
    ).toBeInTheDocument();
  });
});
