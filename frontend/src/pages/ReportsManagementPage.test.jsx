import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock API client ──
const mockGet = vi.fn();
const mockPatch = vi.fn();
const mockDelete = vi.fn();

vi.mock("../api/client", () => ({
  default: {
    get: (...args) => mockGet(...args),
    post: vi.fn(),
    patch: (...args) => mockPatch(...args),
    put: vi.fn(),
    delete: (...args) => mockDelete(...args),
  },
}));

// ── Import after mocks ──
import ReportsManagementPage from "./ReportsManagementPage";

const makeReport = (overrides = {}) => ({
  id: 101,
  reporterName: "Alice Learner",
  reporterEmail: "alice@test.com",
  reporterUsername: "alice",
  reportedUserId: 202,
  reportedName: "Bob Mentor",
  reportedEmail: "bob@test.com",
  reportedUsername: "bob",
  reportedEnabled: true,
  targetType: "SESSION",
  targetId: 303,
  targetLabel: "React Fundamentals",
  reason: "Suspicious behavior during session",
  details: "Bob behaved oddly during our booked session.",
  priority: "HIGH",
  status: "OPEN",
  assignedAdminId: null,
  assignedAdminName: null,
  moderatorNote: null,
  internalNotes: null,
  escalated: false,
  escalationLevel: null,
  escalationReason: null,
  escalatedAt: null,
  createdAt: "2026-08-04T11:53:00Z",
  updatedAt: "2026-08-04T11:53:00Z",
  ...overrides,
});

const mockStats = {
  total: 3,
  open: 1,
  inReview: 1,
  resolved: 1,
  rejected: 0,
  suspendedUsers: 1,
};

const mockReports = [
  makeReport({ id: 101, status: "OPEN", priority: "HIGH", reporterName: "Alice Learner" }),
  makeReport({
    id: 102,
    status: "IN_REVIEW",
    priority: "MEDIUM",
    reporterName: "Carol Designer",
    reason: "Misleading skill profile",
    reportedUserId: 203,
    reportedName: "Dave Mentor",
    targetType: "MENTOR",
    targetLabel: "Dave's profile",
  }),
  makeReport({ id: 103, status: "RESOLVED", priority: "LOW", reporterName: "Eve Tester", reason: "Spam message" }),
];

describe("ReportsManagementPage", () => {
  const notify = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockImplementation((url) => {
      if (url.includes("/stats")) return Promise.resolve({ data: { data: mockStats } });
      if (url.includes("/admin/reports/")) return Promise.resolve({ data: { data: mockReports[0] } });
      return Promise.resolve({
        data: {
          data: { content: mockReports, totalElements: mockReports.length, totalPages: 1 },
        },
      });
    });
  });

  it("renders the hero, stats, filters and report table", async () => {
    render(<ReportsManagementPage notify={notify} />);

    expect(screen.getByRole("heading", { name: "Trust & Safety" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search by reporter, reported user, email, reason...")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Alice Learner")).toBeInTheDocument();
    });

    // Stats
    expect(screen.getAllByText("Total reports")).toHaveLength(1);
    expect(screen.getByText("Suspended users")).toBeInTheDocument();

    // Table rows + badges
    expect(screen.getAllByText("Bob Mentor")).toHaveLength(2);
    expect(screen.getByRole("status", { name: "Open" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Under investigation" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Resolved" })).toBeInTheDocument();
    expect(within(screen.getByRole("table")).getAllByText("High")).toHaveLength(1);
  });

  it("opens the details drawer from View Details", async () => {
    const user = userEvent.setup();
    render(<ReportsManagementPage notify={notify} />);

    await waitFor(() => expect(screen.getByText("Alice Learner")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /View details for report 101/ }));

    let dialog;
    await waitFor(() => {
      dialog = screen.getByRole("dialog", { name: "Report #101 details" });
      expect(dialog).toBeInTheDocument();
    });
    // The reason text also appears in the table row — scope to the drawer
    expect(within(dialog).getByText(/Suspicious behavior during session/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close details" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("resolves a report through the three-dot menu", async () => {
    const user = userEvent.setup();
    mockPatch.mockResolvedValue({ data: { data: {} } });
    render(<ReportsManagementPage notify={notify} />);

    await waitFor(() => expect(screen.getByText("Alice Learner")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Actions for report 101" }));
    const resolveItem = await screen.findByRole("menuitem", { name: /Resolve report/ });
    await user.click(resolveItem);

    const dialog = await screen.findByRole("dialog", { name: "Resolve report" });
    await user.click(within(dialog).getByRole("button", { name: "Confirm" }));

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith("/api/v1/admin/reports/101/decision", {
        status: "RESOLVED",
        note: null,
        suspendUser: false,
      });
    });
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: "success" }));
  });

  it("closes the details drawer with the Escape key", async () => {
    const user = userEvent.setup();
    render(<ReportsManagementPage notify={notify} />);

    await waitFor(() => expect(screen.getByText("Alice Learner")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /View details for report 101/ }));
    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Report #101 details" })).toBeInTheDocument();
    });

    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("closes the three-dot menu after picking an action and gates Assign to actionable reports", async () => {
    const user = userEvent.setup();
    render(<ReportsManagementPage notify={notify} />);

    await waitFor(() => expect(screen.getByText("Alice Learner")).toBeInTheDocument());

    // OPEN report: Assign + Start investigation are available.
    await user.click(screen.getByRole("button", { name: "Actions for report 101" }));
    expect(await screen.findByRole("menuitem", { name: /Assign to me/ })).toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: /Start investigation/ }));
    await waitFor(() => {
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });
  });

  it("does not offer Assign/Resolve on a resolved report", async () => {
    const user = userEvent.setup();
    mockGet.mockImplementation((url) => {
      if (url.includes("/stats")) return Promise.resolve({ data: { data: mockStats } });
      return Promise.resolve({
        data: {
          data: {
            content: [makeReport({ id: 103, status: "RESOLVED", priority: "LOW" })],
            totalElements: 1,
            totalPages: 1,
          },
        },
      });
    });
    render(<ReportsManagementPage notify={notify} />);

    await waitFor(() => expect(screen.getByText("Alice Learner")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Actions for report 103" }));
    expect(await screen.findByRole("menu", { name: "Actions for report 103" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /Assign to me/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /Resolve report/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /Delete spam/ })).not.toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Add note/ })).toBeInTheDocument();
  });

  it("filters the table by status via the dropdown", async () => {
    const user = userEvent.setup();
    render(<ReportsManagementPage notify={notify} />);

    await waitFor(() => expect(screen.getByText("Alice Learner")).toBeInTheDocument());

    await user.selectOptions(screen.getByRole("combobox", { name: "Filter by status" }), "RESOLVED");

    await waitFor(() => {
      // loadReports re-queries with status=RESOLVED
      expect(mockGet).toHaveBeenCalledWith(expect.stringContaining("status=RESOLVED"));
    });
  });

  it("shows the empty state when there are no reports", async () => {
    mockGet.mockImplementation((url) => {
      if (url.includes("/stats")) return Promise.resolve({ data: { data: mockStats } });
      return Promise.resolve({ data: { data: { content: [], totalElements: 0, totalPages: 0 } } });
    });
    render(<ReportsManagementPage notify={notify} />);

    await waitFor(() => {
      expect(screen.getByText("No reports available")).toBeInTheDocument();
    });
  });
});
