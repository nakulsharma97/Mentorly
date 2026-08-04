import { render, screen, waitFor, within } from "@testing-library/react";

import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock react-router (page + components use Link / useSearchParams) ──
vi.mock("react-router", () => ({
  Link: ({ children, to, ...props }) => (
    <a href={to} {...props}>{children}</a>
  ),
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
}));

// ── Mock API client ──
const mockGet = vi.fn();
const mockPost = vi.fn();

vi.mock("../api/client", () => ({
  default: {
    get: (...args) => mockGet(...args),
    post: (...args) => mockPost(...args),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

// ── Import after mocks ──
import LearnerSessionRequestsPage from "./LearnerSessionRequestsPage";

const makeRequest = (overrides = {}) => ({
  id: 1,
  message: "Looking forward to learning backend development with you!",
  subject: "Backend Deep Dive",
  status: "PENDING",
  createdAt: "2026-08-04T11:53:00Z",
  mentor: {
    id: 47,
    fullName: "Test Mentor",
    profileImageUrl: null,
    headline: "Full Stack Developer",
    skills: "Java, Spring Boot, React",
  },
  ...overrides,
});

const mockRequests = [
  makeRequest({
    id: 1,
    message: "Looking forward to learning backend development with you!",
    subject: "Backend Deep Dive",
    status: "PENDING",
  }),
  makeRequest({
    id: 2,
    message: "Ready when you are!",
    subject: "Backend Deep Dive",
    status: "ACCEPTED",
    sessionId: 501,
  }),
  makeRequest({
    id: 3,
    message: "Could we schedule a session about system design interviews?",
    subject: "System Design",
    status: "DECLINED",
    declineReason: "Booked solid for the next two weeks.",
    mentor: { id: 2, fullName: "Pritil", skills: '[{"name":"Java"}]' },
  }),
];

describe("LearnerSessionRequestsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mockGet.mockResolvedValue({ data: { data: mockRequests } });
  });

  it("renders the header, summary stats and request cards", async () => {
    render(<LearnerSessionRequestsPage />);

    expect(screen.getByRole("heading", { name: "My Requests" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search mentor, skill, request...")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getAllByText("Test Mentor").length).toBeGreaterThan(0);
    });

    // Summary stats
    expect(screen.getAllByText("Total Requests")).toHaveLength(1);
    expect(screen.getAllByText("Pending").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Accepted").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Declined").length).toBeGreaterThanOrEqual(1);

    // Cards with status badges and per-status actions
    expect(screen.getByRole("status", { name: "Accepted" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Declined" })).toBeInTheDocument();
    // "View Session" is a link (has a descriptive aria-label); "Pay Now" a button
    expect(screen.getByRole("link", { name: /view session/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Pay Now/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel request/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Reply$/ })).toBeInTheDocument();
  });

  it("filters cards by search query", async () => {
    const user = userEvent.setup();
    render(<LearnerSessionRequestsPage />);

    await waitFor(() => {
      expect(screen.getAllByText("Test Mentor").length).toBeGreaterThan(0);
    });

    await user.type(screen.getByPlaceholderText("Search mentor, skill, request..."), "system");

    await waitFor(() => {
      // Only the declined "System Design" card remains
      expect(screen.queryAllByText("Test Mentor")).toHaveLength(0);
      expect(screen.getByText("Pritil")).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: /cancel request/i })).not.toBeInTheDocument();
  });

  it("filters cards by status via the filter menu", async () => {
    const user = userEvent.setup();
    render(<LearnerSessionRequestsPage />);

    await waitFor(() => {
      expect(screen.getAllByText("Test Mentor").length).toBeGreaterThan(0);
    });

    await user.click(screen.getByRole("button", { name: "Filter by status" }));

    const pendingOption = await screen.findByRole("option", { name: /Pending/ });
    await user.click(pendingOption);

    await waitFor(() => {
      expect(screen.getByRole("status", { name: "Pending" })).toBeInTheDocument();
      expect(screen.queryByRole("status", { name: "Accepted" })).not.toBeInTheDocument();
      expect(screen.queryByRole("status", { name: "Declined" })).not.toBeInTheDocument();
    });
  });

  it("opens the details modal from a pending request", async () => {
    const user = userEvent.setup();
    render(<LearnerSessionRequestsPage />);

    await waitFor(() => {
      expect(screen.getAllByText("Test Mentor").length).toBeGreaterThan(0);
    });

    // First "View Details" button belongs to the pending card
    const [firstViewDetails] = screen.getAllByRole("button", { name: /View Details/ });
    await user.click(firstViewDetails);

    let dialog;
    await waitFor(() => {
      dialog = screen.getByRole("dialog", { name: /Request details/ });
      expect(dialog).toBeInTheDocument();
    });
    // The message text appears both on the card and inside the modal — scope to the dialog
    expect(within(dialog).getByText(/Looking forward to learning backend development/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Close details" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("closes the details modal with the Escape key", async () => {
    const user = userEvent.setup();
    render(<LearnerSessionRequestsPage />);

    await waitFor(() => {
      expect(screen.getAllByText("Test Mentor").length).toBeGreaterThan(0);
    });

    const [firstViewDetails] = screen.getAllByRole("button", { name: /View Details/ });
    await user.click(firstViewDetails);

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: /Request details/ })).toBeInTheDocument();
    });

    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("cancels a pending request after confirmation", async () => {
    const user = userEvent.setup();
    mockPost.mockResolvedValue({ data: { data: {} } });
    render(<LearnerSessionRequestsPage />);

    await waitFor(() => {
      expect(screen.getAllByText("Test Mentor").length).toBeGreaterThan(0);
    });

    await user.click(screen.getByRole("button", { name: /cancel request/i }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith("/api/v1/session-requests/1/cancel");
    });
    // Card is removed from the list
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /cancel request/i })).not.toBeInTheDocument();
    });
  });

  it("shows the empty state when there are no requests", async () => {
    mockGet.mockResolvedValue({ data: { data: [] } });
    render(<LearnerSessionRequestsPage />);

    await waitFor(() => {
      expect(screen.getByText("No Requests Yet")).toBeInTheDocument();
    });
    expect(screen.getByText("Find Mentors")).toBeInTheDocument();
  });
});
