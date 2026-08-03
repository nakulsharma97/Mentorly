import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock react-router ──
const mockNavigate = vi.fn();
vi.mock("react-router", () => ({
  useNavigate: () => mockNavigate,
}));

// ── Mock API client ──
const mockGet = vi.fn();
const mockPatch = vi.fn();

vi.mock("../api/client", () => ({
  default: {
    get: (...args) => mockGet(...args),
    patch: (...args) => mockPatch(...args),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

// ── Mock CSS ──
vi.mock("./NotificationCenter.css", () => ({}));

// ── Import after mocks ──
import NotificationCenter from "./NotificationCenter";

describe("NotificationCenter — onNotify on API failure", () => {
  const mockNotifications = [
    {
      id: 1,
      title: "Session Reminder",
      message: "Your session starts in 30 minutes.",
      type: "SESSION_CREATED",
      read: false,
      createdAt: new Date().toISOString(),
    },
    {
      id: 2,
      title: "New Review",
      message: "You received a 5-star review!",
      type: "REVIEW_SUBMITTED",
      read: true,
      createdAt: new Date().toISOString(),
    },
  ];

  const buildGetResponse = (content) => ({
    data: {
      message: "Notifications fetched",
      data: { content, totalElements: content.length },
    },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();

    // Default: GET returns notifications, PATCH succeeds
    mockGet.mockImplementation((url) => {
      if (url === "/api/v1/notifications") {
        return Promise.resolve(buildGetResponse(mockNotifications));
      }
      if (url === "/api/v1/notifications/unread-count") {
        return Promise.resolve({ data: { data: 1, message: "Count fetched" } });
      }
      return Promise.resolve({ data: null });
    });

    mockPatch.mockResolvedValue({ data: null });
  });

  /* ─────────────────────────────────────────────────────────────
     Test: onNotify called on handleMarkRead failure
     ───────────────────────────────────────────────────────────── */

  it("calls onNotify with error when marking all notifications as read via mark-all-read fails", async () => {
    const onNotify = vi.fn();
    const user = userEvent.setup();

    // Make the mark-all-read PATCH fail
    mockPatch.mockRejectedValue(new Error("Server error"));

    render(
      <NotificationCenter
        fullPage
        hideFullPageHeader
        onNotify={onNotify}
        notificationsPath="/learner/notifications"
      />,
    );

    // Wait for the "Mark all read" button to appear (needs unread count fetch to complete)
    const markAllBtn = await screen.findByRole("button", { name: /Mark all read/i });
    expect(markAllBtn).toBeInTheDocument();

    await user.click(markAllBtn);

    // Wait for the catch block to execute — onNotify should be called with an error
    await waitFor(() => {
      expect(onNotify).toHaveBeenCalledTimes(1);
      expect(onNotify).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "error",
          title: "Mark all read failed",
        }),
      );
    });
  });

  /* ─────────────────────────────────────────────────────────────
     Test: onNotify called on handleMarkAllRead failure
     ───────────────────────────────────────────────────────────── */

  it("calls onNotify with error when mark-all-read API call fails", async () => {
    const onNotify = vi.fn();
    const user = userEvent.setup();

    // Make the mark-all-read PATCH fail
    mockPatch.mockRejectedValue(new Error("Server error"));

    render(
      <NotificationCenter
        fullPage
        hideFullPageHeader
        onNotify={onNotify}
        notificationsPath="/learner/notifications"
      />,
    );

    // Wait for the "Mark all read" button to appear (needs unread count fetch to complete)
    const markAllBtn = await screen.findByRole("button", { name: /Mark all read/i });
    expect(markAllBtn).toBeInTheDocument();

    await user.click(markAllBtn);

    // Wait for the catch block to execute — onNotify should be called with an error
    await waitFor(() => {
      expect(onNotify).toHaveBeenCalledTimes(1);
      expect(onNotify).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "error",
          title: "Mark all read failed",
        }),
      );
    });
  });

  /* ─────────────────────────────────────────────────────────────
     Test: onNotify NOT called when mark-read succeeds
     ───────────────────────────────────────────────────────────── */

  it("does NOT call onNotify when marking a notification as read succeeds", async () => {
    const onNotify = vi.fn();
    const user = userEvent.setup();

    // PATCH succeeds by default (mocked in beforeEach)
    render(
      <NotificationCenter
        fullPage
        hideFullPageHeader
        onNotify={onNotify}
        notificationsPath="/learner/notifications"
      />,
    );

    // Wait for notification title to appear
    const titleEl = await screen.findByText("Session Reminder");
    expect(titleEl).toBeInTheDocument();

    // Click the notification card via its closest role="button"
    const notifCard = titleEl.closest('[role="button"]');
    expect(notifCard).toBeInTheDocument();
    await user.click(notifCard);

    // Wait for the PATCH call to confirm the async handler completed
    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalled();
    });

    // Since the API succeeded, onNotify should NOT have been called
    expect(onNotify).not.toHaveBeenCalled();
  });

  /* ─────────────────────────────────────────────────────────────
     Test: onNotify NOT called when mark-all-read succeeds
     ───────────────────────────────────────────────────────────── */

  it("does NOT call onNotify when mark-all-read succeeds", async () => {
    const onNotify = vi.fn();
    const user = userEvent.setup();

    // PATCH succeeds by default
    render(
      <NotificationCenter
        fullPage
        hideFullPageHeader
        onNotify={onNotify}
        notificationsPath="/learner/notifications"
      />,
    );

    // Wait for the mark all read button (unread count must be loaded)
    const markAllBtn = await screen.findByRole("button", { name: /Mark all read/i });
    expect(markAllBtn).toBeInTheDocument();

    await user.click(markAllBtn);

    // Wait for the PATCH call to confirm the async handler completed
    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalled();
    });

    // Since the API succeeded, onNotify should NOT have been called
    expect(onNotify).not.toHaveBeenCalled();
  });

  /* ─────────────────────────────────────────────────────────────
     Test: onNotify called with correct message from server
     ───────────────────────────────────────────────────────────── */

  it("passes the server error message to onNotify on failure", async () => {
    const onNotify = vi.fn();
    const user = userEvent.setup();

    // Mock PATCH to fail with a server response containing a message
    mockPatch.mockRejectedValue({
      response: {
        data: { message: "Database connection timeout" },
      },
    });

    render(
      <NotificationCenter
        fullPage
        hideFullPageHeader
        onNotify={onNotify}
        notificationsPath="/learner/notifications"
      />,
    );

    // Wait for the mark all read button
    const markAllBtn = await screen.findByRole("button", { name: /Mark all read/i });
    expect(markAllBtn).toBeInTheDocument();

    await user.click(markAllBtn);

    await waitFor(() => {
      expect(onNotify).toHaveBeenCalledTimes(1);
      expect(onNotify).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "error",
          message: "Database connection timeout",
        }),
      );
    });
  });
});
