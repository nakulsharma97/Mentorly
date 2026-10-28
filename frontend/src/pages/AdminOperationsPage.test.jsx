import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mock API client ──
const mockGet = vi.fn();

vi.mock("../api/client", () => ({
  default: {
    get: (...args) => mockGet(...args),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import AdminOperationsPage from "./AdminOperationsPage";

const summary = {
  totalUsers: 42,
  learners: 30,
  mentors: 11,
  admins: 1,
  openReports: 3,
  pendingMentorVerifications: 2,
};

const report = {
  id: 7,
  reporterName: "Alice Learner",
  reporterEmail: "alice@test.com",
  reportedUserId: 202,
  reportedName: "Bob Mentor",
  reportedEmail: "bob@test.com",
  reportedEnabled: true,
  targetType: "MENTOR",
  targetLabel: "Bob's profile",
  reason: "Suspicious behavior in session",
  status: "OPEN",
  priority: "HIGH",
  createdAt: "2026-08-04T11:53:00Z",
  updatedAt: "2026-08-04T11:53:00Z",
};

// The exact shape GET /api/v1/admin/reports returns: ApiResponse<Page<Dto>>.
const reportsPage = {
  content: [report],
  totalElements: 1,
  totalPages: 1,
  number: 0,
  size: 20,
};

const conversations = [
  {
    id: "booking-12",
    kind: "booking",
    referenceId: 12,
    participantName: "Alice Learner & Bob Mentor",
    sessionTitle: "React Fundamentals",
    status: "CONFIRMED",
    lastMessagePreview: "See you tomorrow!",
    lastActivityAt: "2026-08-04T11:53:00Z",
    unreadCount: 2,
  },
  {
    id: "direct-5",
    kind: "direct",
    referenceId: 5,
    participantName: "Carol Designer & Dave Mentor",
    sessionTitle: "Direct conversation",
    status: "ACTIVE",
    lastMessagePreview: null,
    lastActivityAt: "2026-08-03T09:00:00Z",
    unreadCount: 0,
  },
];

const messages = [
  {
    id: 1,
    senderName: "Alice Learner",
    senderEmail: "alice@test.com",
    content: "Hello there, is the session still on?",
    readByRecipient: true,
    createdAt: "2026-08-04T11:50:00Z",
  },
];

const apiError = (status) =>
  Object.assign(new Error(`HTTP ${status}`), {
    response: { status, data: { message: "boom" } },
  });

function renderPage(initialPath = "/admin/conversations") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/admin/conversations"
          element={<AdminOperationsPage notify={vi.fn()} />}
        />
        <Route path="/admin/reports" element={<div>REPORTS_PAGE_MARKER</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AdminOperationsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // jsdom does not implement scrollIntoView; the message pane calls it.
    window.HTMLElement.prototype.scrollIntoView = vi.fn();

    mockGet.mockImplementation((url) => {
      if (url.startsWith("/api/v1/admin/summary")) {
        return Promise.resolve({ data: { data: summary } });
      }
      if (url.startsWith("/api/v1/admin/reports?")) {
        return Promise.resolve({ data: { data: reportsPage } });
      }
      if (url.includes("/messages")) {
        return Promise.resolve({ data: { data: messages } });
      }
      if (url.startsWith("/api/v1/admin/conversations")) {
        return Promise.resolve({ data: { data: conversations } });
      }
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
  });

  it("renders the conversations list on load", async () => {
    renderPage();
    expect(
      await screen.findByText("Alice Learner & Bob Mentor"),
    ).toBeInTheDocument();
    expect(screen.getByText("Carol Designer & Dave Mentor")).toBeInTheDocument();
    expect(screen.getByText("See you tomorrow!")).toBeInTheDocument();
  });

  // Regression: /api/v1/admin/reports answers with a Spring Page
  // ({ content: [...] }), not an array. The Overview tab used to assign that
  // object to a list state and call `.map()` on it, crashing the whole console
  // with "d.map is not a function" (d = minified reports state).
  it("renders the Overview tab when reports arrive in a Spring Page envelope", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Alice Learner & Bob Mentor");

    await user.click(screen.getByRole("tab", { name: "Overview" }));

    expect(await screen.findByText("Total accounts")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    // The report queue is unwrapped from page.content and rendered.
    expect(screen.getByText("Suspicious behavior in session")).toBeInTheDocument();
  });

  it("opens the Overview tab when the reports page body is null", async () => {
    mockGet.mockImplementation((url) => {
      if (url.startsWith("/api/v1/admin/summary")) {
        return Promise.resolve({ data: { data: summary } });
      }
      if (url.startsWith("/api/v1/admin/reports?")) {
        return Promise.resolve({ data: { data: null } });
      }
      return Promise.resolve({ data: { data: conversations } });
    });
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Alice Learner & Bob Mentor");

    await user.click(screen.getByRole("tab", { name: "Overview" }));

    expect(await screen.findByText("No reports in this queue.")).toBeInTheDocument();
  });

  it("navigates to the reports management page from the hero button", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Alice Learner & Bob Mentor");

    await user.click(screen.getByRole("button", { name: /Review reports queue/ }));

    expect(await screen.findByText("REPORTS_PAGE_MARKER")).toBeInTheDocument();
  });

  it("navigates to the reports management page from the Reports tab", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Alice Learner & Bob Mentor");

    await user.click(screen.getByRole("tab", { name: "Reports" }));

    expect(await screen.findByText("REPORTS_PAGE_MARKER")).toBeInTheDocument();
  });

  it("shows the message history of the selected conversation", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Alice Learner & Bob Mentor");

    await user.click(screen.getByText("Alice Learner & Bob Mentor"));

    expect(
      await screen.findByText("Hello there, is the session still on?"),
    ).toBeInTheDocument();
    expect(mockGet).toHaveBeenCalledWith(
      "/api/v1/admin/conversations/booking/12/messages",
    );
  });

  it("shows the empty state when there are no conversations", async () => {
    mockGet.mockImplementation((url) => {
      if (url.startsWith("/api/v1/admin/summary")) {
        return Promise.resolve({ data: { data: summary } });
      }
      if (url.startsWith("/api/v1/admin/reports?")) {
        return Promise.resolve({ data: { data: reportsPage } });
      }
      return Promise.resolve({ data: { data: [] } });
    });
    renderPage();

    expect(await screen.findByText("No conversations found")).toBeInTheDocument();
  });

  it("renders the empty state instead of crashing on a wrapped page body", async () => {
    // Wrong envelope for this endpoint — must degrade, not throw.
    mockGet.mockImplementation((url) => {
      if (url.startsWith("/api/v1/admin/summary")) {
        return Promise.resolve({ data: { data: summary } });
      }
      if (url.startsWith("/api/v1/admin/reports?")) {
        return Promise.resolve({ data: { data: reportsPage } });
      }
      return Promise.resolve({ data: { data: { content: conversations } } });
    });
    renderPage();

    expect(await screen.findByText("No conversations found")).toBeInTheDocument();
  });

  it("shows a retryable error state when conversations fail to load", async () => {
    mockGet.mockImplementation((url) => {
      if (url.startsWith("/api/v1/admin/summary")) {
        return Promise.resolve({ data: { data: summary } });
      }
      if (url.startsWith("/api/v1/admin/reports?")) {
        return Promise.resolve({ data: { data: reportsPage } });
      }
      return Promise.reject(apiError(500));
    });
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText("Conversations unavailable")).toBeInTheDocument();
    expect(
      screen.getByText(/The server is having trouble right now/),
    ).toBeInTheDocument();

    // Retry re-queries the endpoint.
    mockGet.mockClear();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/admin/conversations"),
      );
    });
  });

  it("tells the admin to sign in again on an expired session", async () => {
    mockGet.mockImplementation((url) => {
      if (url.startsWith("/api/v1/admin/summary")) {
        return Promise.resolve({ data: { data: summary } });
      }
      if (url.startsWith("/api/v1/admin/reports?")) {
        return Promise.resolve({ data: { data: reportsPage } });
      }
      return Promise.reject(apiError(401));
    });
    renderPage();

    expect(
      await screen.findByText(/Your session expired/),
    ).toBeInTheDocument();
  });

  it("sends the debounced search query to the backend", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Alice Learner & Bob Mentor");

    await user.type(
      screen.getByPlaceholderText(/Search by name, email, title, or message/),
      "alice",
    );

    await waitFor(
      () => {
        expect(mockGet).toHaveBeenCalledWith(
          expect.stringContaining("q=alice"),
        );
      },
      { timeout: 2000 },
    );
  });

  it("filters conversations by type", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Alice Learner & Bob Mentor");

    await user.selectOptions(screen.getByRole("combobox"), "direct");

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith(expect.stringContaining("type=direct"));
    });
  });
});
