import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock react-router-dom (used by LearnerPages.jsx components) ──
vi.mock("react-router-dom", () => ({
  Link: ({ children, to, ...props }) => (
    <a href={to} {...props}>{children}</a>
  ),
  Navigate: () => null,
  useNavigate: () => vi.fn(),
}));

// ── Mock API client ──
const mockPatch = vi.fn();
const mockPut = vi.fn();
const mockGet = vi.fn();

vi.mock("../api/client", () => ({
  default: {
    get: (...args) => mockGet(...args),
    patch: (...args) => mockPatch(...args),
    put: (...args) => mockPut(...args),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

// ── Mock child components ──
vi.mock("../modules/common/dashboard/Icon", () => ({
  default: ({ name, className, style, ...rest }) => (
    <span data-testid={`icon-${name}`} className={className} style={style} {...rest}>
      {name}
    </span>
  ),
}));

vi.mock("../modules/common/dashboard/SectionCard", () => ({
  default: ({ title, children, actionLabel, onAction, className }) => (
    <div data-testid="section-card" className={className}>
      <h3>{title}</h3>
      {children}
      {actionLabel && <button type="button" onClick={onAction}>{actionLabel}</button>}
    </div>
  ),
  EmptyState: ({ title, description, actionLabel, onAction }) => (
    <div data-testid="empty-state">
      <span>{title}</span>
      <p>{description}</p>
      {actionLabel && <button type="button" onClick={onAction}>{actionLabel}</button>}
    </div>
  ),
}));

vi.mock("../modules/common/dashboard/StatsCard", () => ({
  default: ({ label, value, description }) => (
    <div data-testid="stats-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{description}</p>
    </div>
  ),
}));

// ── Mock CSS ──
vi.mock("./LearnerPages.css", () => ({}));

// ── Import after mocks ──
import { LearnerNotificationsPage } from "./LearnerPages";

describe("LearnerNotificationsPage — markNotification & markAllRead", () => {
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

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock GET to return notifications wrapped in a paginated Page format,
    // matching the real backend response (ApiResponse<Page<AppNotification>>).
    // The useNotificationsData hook now extracts .content from the Page object.
    mockGet.mockImplementation((url) => {
      if (url === "/api/v1/notifications") {
        return Promise.resolve({
          data: {
            message: "Notifications fetched",
            data: { content: mockNotifications, totalElements: mockNotifications.length },
          },
        });
      }
      if (url === "/api/v1/notifications/preferences") {
        return Promise.resolve({
          data: {
            emailEnabled: true,
            bookingUpdates: true,
            sessionAnnouncements: true,
            reviewAlerts: true,
            certificationAlerts: true,
            roleChangeAlerts: true,
          },
        });
      }
      return Promise.resolve({ data: null });
    });

    mockPatch.mockResolvedValue({ data: null });
    mockPut.mockResolvedValue({ data: null });
  });

  /* ──────────────────────────────────────
     Smoke test
     ────────────────────────────────────── */

  it("renders the notification page and shows notifications", async () => {
    render(<LearnerNotificationsPage />);

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText("Session Reminder")).toBeInTheDocument();
    });

    expect(screen.getByText("New Review")).toBeInTheDocument();
  });

  /* ──────────────────────────────────────
     apiPatch → markNotification
     ────────────────────────────────────── */

  it("calls client.patch with /api/v1/notifications/{id}/read when a notification is clicked", async () => {
    const user = userEvent.setup();
    render(<LearnerNotificationsPage />);

    await waitFor(() => {
      expect(screen.getByText("Session Reminder")).toBeInTheDocument();
    });

    // Click the notification row (role="button" with accessible name)
    const notifRow = screen.getByRole("button", { name: /Session Reminder/i });
    await user.click(notifRow);

    // apiPatch(path, body, config) passes all 3 args; body & config are undefined
    await waitFor(() => {
      expect(mockPatch.mock.calls[0][0]).toBe("/api/v1/notifications/1/read");
    });
  });

  it("calls client.patch with correct ID for a second notification", async () => {
    const user = userEvent.setup();
    render(<LearnerNotificationsPage />);

    await waitFor(() => {
      expect(screen.getByText("New Review")).toBeInTheDocument();
    });

    // Notification with id=2
    const notifRow = screen.getByRole("button", { name: /New Review/i });
    await user.click(notifRow);

    await waitFor(() => {
      expect(mockPatch.mock.calls[0][0]).toBe("/api/v1/notifications/2/read");
    });
  });

  /* ──────────────────────────────────────
     markAllRead
     ────────────────────────────────────── */

  it("renders a 'Mark all read' button when notifications exist", async () => {
    render(<LearnerNotificationsPage />);

    await waitFor(() => {
      expect(screen.getByText("Session Reminder")).toBeInTheDocument();
    });

    // Look for button with "Mark all read" text
    const markAllBtn = screen.queryByRole("button", { name: /Mark all read/i });
    expect(markAllBtn).toBeInTheDocument();
  });

  it("calls client.patch with /api/v1/notifications/read-all when 'Mark all read' is clicked", async () => {
    const user = userEvent.setup();
    render(<LearnerNotificationsPage />);

    await waitFor(() => {
      expect(screen.getByText("Session Reminder")).toBeInTheDocument();
    });

    const markAllBtn = screen.getByRole("button", { name: /Mark all read/i });
    await user.click(markAllBtn);

    await waitFor(() => {
      expect(mockPatch.mock.calls[0][0]).toBe("/api/v1/notifications/read-all");
    });
  });

  /* ──────────────────────────────────────
     Method correctness: PATCH not PUT
     ────────────────────────────────────── */

  it("uses PATCH (not PUT) for marking single notification as read", async () => {
    const user = userEvent.setup();
    render(<LearnerNotificationsPage />);

    await waitFor(() => {
      expect(screen.getByText("Session Reminder")).toBeInTheDocument();
    });

    const notifRow = screen.getByRole("button", { name: /Session Reminder/i });
    await user.click(notifRow);

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalled();
    });

    // PUT should NOT have been called for the notification endpoint
    expect(mockPut).not.toHaveBeenCalledWith("/api/v1/notifications/1/read");
  });

  it("uses PATCH (not PUT) for mark-all-read", async () => {
    const user = userEvent.setup();
    render(<LearnerNotificationsPage />);

    await waitFor(() => {
      expect(screen.getByText("Session Reminder")).toBeInTheDocument();
    });

    const markAllBtn = screen.getByRole("button", { name: /Mark all read/i });
    await user.click(markAllBtn);

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalled();
      expect(mockPatch.mock.calls[0][0]).toBe("/api/v1/notifications/read-all");
    });

    expect(mockPut).not.toHaveBeenCalledWith("/api/v1/notifications/read-all");
  });

  /* ──────────────────────────────────────
     URL correctness (no old wrong URLs)
     ────────────────────────────────────── */

  it("never calls the old wrong URL /mark-all-read", async () => {
    const user = userEvent.setup();
    render(<LearnerNotificationsPage />);

    await waitFor(() => {
      expect(screen.getByText("Session Reminder")).toBeInTheDocument();
    });

    // Trigger both markNotification and markAllRead
    const notifRow = screen.getByRole("button", { name: /Session Reminder/i });
    await user.click(notifRow);

    const markAllBtn = screen.getByRole("button", { name: /Mark all read/i });
    await user.click(markAllBtn);

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledTimes(2);
    });

    // Check that none of the calls contain the old wrong URL pattern
    const patchCalls = mockPatch.mock.calls.map((c) => c[0]);
    expect(patchCalls.some((url) => url.includes("mark-all-read"))).toBe(false);
  });
});
