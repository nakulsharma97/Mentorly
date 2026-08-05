import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockNavigate = vi.fn();
vi.mock("react-router", () => ({
  useNavigate: () => mockNavigate,
}));

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

vi.mock("./NotificationCenter.css", () => ({}));

import NotificationCenter from "./NotificationCenter";

function daysAgo(days) {
  return new Date(Date.now() - days * 86400000).toISOString();
}

describe("NotificationCenter — admin routing, grouping, search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
    mockPatch.mockResolvedValue({ data: null });
  });

  const buildGetResponse = (content) => ({
    data: {
      message: "Notifications fetched",
      data: { content, totalElements: content.length },
    },
  });

  const mockFetch = (items) => {
    mockGet.mockImplementation((url) => {
      if (url === "/api/v1/notifications") {
        return Promise.resolve(buildGetResponse(items));
      }
      if (url === "/api/v1/notifications/unread-count") {
        return Promise.resolve({ data: { data: items.filter((n) => !n.read).length } });
      }
      return Promise.resolve({ data: null });
    });
  };

  it("routes admin notifications to the matching admin page (never a learner route)", async () => {
    const user = userEvent.setup();
    mockFetch([
      {
        id: 1,
        title: "New Mentor Verification",
        message: "A mentor submitted verification documents.",
        type: "MENTOR_VERIFICATION_REQUEST",
        read: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: 2,
        title: "Payment received",
        message: "Escrow funded.",
        type: "PAYMENT_RECEIVED",
        read: true,
        createdAt: new Date().toISOString(),
      },
    ]);

    render(
      <NotificationCenter
        fullPage
        hideFullPageHeader
        notificationsPath="/admin/notification-center"
      />,
    );

    const verifyCard = await screen.findByText("New Mentor Verification");
    const card = verifyCard.closest('[role="button"]');
    expect(card).toBeInTheDocument();
    await user.click(card);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/admin/verifications");
    });
  });

  it("groups notifications into Today / Yesterday / Earlier sections", async () => {
    mockFetch([
      {
        id: 1,
        title: "Just now item",
        message: "Recent.",
        type: "PLATFORM_ALERT",
        read: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: 2,
        title: "Yesterday item",
        message: "A day ago.",
        type: "SYSTEM_WARNING",
        read: false,
        createdAt: daysAgo(1),
      },
      {
        id: 3,
        title: "Older item",
        message: "Last week.",
        type: "ANNOUNCEMENT",
        read: true,
        createdAt: daysAgo(5),
      },
    ]);

    render(
      <NotificationCenter
        fullPage
        hideFullPageHeader
        notificationsPath="/admin/notification-center"
      />,
    );

    expect(await screen.findByText("Just now item")).toBeInTheDocument();
    // Relative timestamps can repeat the group label (e.g. a card shows
    // "Yesterday" while the group header is also "Yesterday"), so use
    // getAllByText for the group headers.
    await waitFor(() => {
      expect(screen.getAllByText("Today").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Yesterday").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Earlier").length).toBeGreaterThan(0);
    });
  });

  it("filters notifications instantly via the search box", async () => {
    const user = userEvent.setup();
    mockFetch([
      {
        id: 1,
        title: "Withdrawal request",
        message: "Mentor requested payout.",
        type: "WITHDRAWAL_REQUEST",
        read: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: 2,
        title: "User reported",
        message: "A report was filed.",
        type: "USER_REPORTED",
        read: false,
        createdAt: new Date().toISOString(),
      },
    ]);

    render(
      <NotificationCenter
        fullPage
        hideFullPageHeader
        notificationsPath="/admin/notification-center"
      />,
    );

    expect(await screen.findByText("Withdrawal request")).toBeInTheDocument();
    expect(screen.getByText("User reported")).toBeInTheDocument();

    const search = screen.getByLabelText("Search notifications");
    await user.type(search, "withdrawal");

    await waitFor(() => {
      expect(screen.getByText("Withdrawal request")).toBeInTheDocument();
    });
    expect(screen.queryByText("User reported")).not.toBeInTheDocument();
  });

  it("hides the bell badge entirely when unread count is zero", async () => {
    mockFetch([]);
    render(
      <NotificationCenter
        unreadNotifications={0}
        notificationsPath="/admin/notification-center"
      />,
    );

    const bell = screen.getByRole("button", { name: /notifications/i });
    expect(bell).toBeInTheDocument();
    expect(within(bell).queryByText(/^\d/)).not.toBeInTheDocument();
    expect(bell).toHaveAttribute("aria-expanded", "false");
  });

  it("shows 99+ on the badge for large unread counts", () => {
    render(
      <NotificationCenter
        unreadNotifications={145}
        notificationsPath="/admin/notification-center"
      />,
    );

    const bell = screen.getByRole("button", { name: /notifications/i });
    expect(within(bell).getByText("99+")).toBeInTheDocument();
  });
});
