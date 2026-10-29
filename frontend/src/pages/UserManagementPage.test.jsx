import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGet = vi.fn();
const mockDelete = vi.fn();

vi.mock("../api/client", () => ({
  default: {
    get: (...args) => mockGet(...args),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: (...args) => mockDelete(...args),
  },
  // No signed-in admin in these tests: the page must treat every row as
  // manageable (the backend is the real authority).
  extractJwtUserId: () => null,
  getActiveAuthToken: () => null,
}));

import UserManagementPage from "./UserManagementPage";

const users = [
  {
    id: 2,
    fullName: "Alice Learner",
    email: "alice@test.com",
    role: "LEARNER",
    enabled: true,
    mentorVerified: false,
    createdAt: "2026-01-02T10:00:00Z",
  },
  {
    id: 3,
    fullName: "Bob Mentor",
    email: "bob@test.com",
    role: "MENTOR",
    enabled: false,
    mentorVerified: true,
    createdAt: "2026-01-03T10:00:00Z",
  },
];

const usersPage = (content = users) => ({
  content,
  totalElements: content.length,
  totalPages: 1,
  number: 0,
  size: 25,
});

const walletFor = (user) => ({
  userId: user.id,
  userName: user.fullName,
  balance: 0,
  currency: "INR",
  history: [],
});

const apiError = (status) =>
  Object.assign(new Error(`HTTP ${status}`), {
    response: { status, data: { data: { error: "Server said no" } } },
  });

function renderPage() {
  const notify = vi.fn();
  render(<UserManagementPage notify={notify} />);
  return { notify };
}

// Simulates the server: deleted ids are excluded from later list responses, so
// a refresh cannot bring a deleted user back.
let deletedIds = new Set();

describe("UserManagementPage — delete user", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deletedIds = new Set();
    window.confirm = vi.fn(() => true);
    mockGet.mockImplementation((url) => {
      if (/\/api\/v1\/admin\/users\/\d+\/wallet$/.test(url)) {
        const id = Number(url.match(/users\/(\d+)\/wallet/)[1]);
        const user = users.find((u) => u.id === id);
        return Promise.resolve({ data: { data: walletFor(user) } });
      }
      const visible = users.filter((u) => !deletedIds.has(u.id));
      return Promise.resolve({ data: { data: usersPage(visible) } });
    });
    mockDelete.mockImplementation((url) => {
      const id = Number(String(url).split("/").pop());
      deletedIds.add(id);
      return Promise.resolve({ data: { data: { deletedUserId: String(id) } } });
    });
  });

  it("deletes through the API, then reloads the list from the server", async () => {
    const user = userEvent.setup();
    const { notify } = renderPage();

    await screen.findByText("Alice Learner");

    await user.click(screen.getByRole("button", { name: "Delete Alice Learner" }));

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith("/api/v1/admin/users/2");
    });
    expect(window.confirm).toHaveBeenCalled();

    // The row disappears only after the request resolves…
    await waitFor(() => {
      expect(screen.queryByText("Alice Learner")).not.toBeInTheDocument();
    });
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: "success" }));

    // …and the page re-reads the server list instead of trusting local state.
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/admin/users?"),
      );
    });
    const listCalls = mockGet.mock.calls.filter(([url]) =>
      String(url).includes("/api/v1/admin/users?"),
    );
    expect(listCalls.length).toBeGreaterThanOrEqual(2);
  });

  it("does nothing when the confirmation is dismissed", async () => {
    window.confirm = vi.fn(() => false);
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Alice Learner");
    await user.click(screen.getByRole("button", { name: "Delete Alice Learner" }));

    expect(mockDelete).not.toHaveBeenCalled();
    expect(screen.getByText("Alice Learner")).toBeInTheDocument();
  });

  it("keeps the user visible and reports the error when deletion fails", async () => {
    mockDelete.mockRejectedValue(apiError(500));
    const user = userEvent.setup();
    const { notify } = renderPage();

    await screen.findByText("Alice Learner");
    await user.click(screen.getByRole("button", { name: "Delete Alice Learner" }));

    await waitFor(() => {
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({ type: "error", message: "Server said no" }),
      );
    });
    expect(screen.getByText("Alice Learner")).toBeInTheDocument();
  });

  it("sends only one DELETE when the button is clicked twice", async () => {
    let resolveDelete;
    mockDelete.mockImplementation(
      () => new Promise((resolve) => { resolveDelete = resolve; }),
    );
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Alice Learner");
    const button = screen.getByRole("button", { name: "Delete Alice Learner" });

    await user.click(button);
    await user.click(button); // guarded while the first request is in flight

    expect(mockDelete).toHaveBeenCalledTimes(1);
    deletedIds.add(2); // the server now excludes the account
    resolveDelete({ data: { data: {} } });
    await waitFor(() => expect(screen.queryByText("Alice Learner")).not.toBeInTheDocument());
  });

  it("clears the details panel when the selected user is deleted", async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Alice Learner");
    await user.click(screen.getByText("Alice Learner"));
    await waitFor(() => {
      expect(screen.getByRole("complementary", { name: "User details" })).toBeInTheDocument();
    });

    const panel = screen.getByRole("complementary", { name: "User details" });
    await user.click(within(panel).getByRole("button", { name: /Delete User/ }));

    await waitFor(() => {
      expect(screen.getByText("Select a user")).toBeInTheDocument();
    });
    expect(mockDelete).toHaveBeenCalledWith("/api/v1/admin/users/2");
  });

  it("still lists disabled (not deleted) accounts", async () => {
    renderPage();

    expect(await screen.findByText("Bob Mentor")).toBeInTheDocument();
    const row = screen.getByText("Bob Mentor").closest("tr");
    expect(row).not.toBeNull();
    expect(within(row).getByText("Disabled")).toBeInTheDocument();
  });
});

describe("UserManagementPage — enable/disable actions", () => {
  let mockPatch;

  beforeEach(() => {
    vi.clearAllMocks();
    window.confirm = vi.fn(() => true);
    mockPatch = vi.fn();
    mockGet.mockResolvedValue({ data: { data: usersPage() } });
  });

  // The module mock replaces the whole client object, so swap patch per test.
  beforeEach(async () => {
    const mod = await import("../api/client");
    mod.default.patch = (...args) => mockPatch(...args);
  });

  const renderPage = () => {
    const notify = vi.fn();
    render(<UserManagementPage notify={notify} />);
    return { notify };
  };

  it("shows Disable for active rows and Enable for disabled rows", async () => {
    renderPage();

    expect(
      await screen.findByRole("button", { name: "Disable Alice Learner" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Enable Bob Mentor" }),
    ).toBeInTheDocument();
  });

  it("confirms with a sign-out warning before disabling", async () => {
    mockPatch.mockResolvedValue({
      data: { data: { id: 2, enabled: false, fullName: "Alice Learner" } },
    });
    const user = userEvent.setup();
    const { notify } = renderPage();

    await user.click(
      await screen.findByRole("button", { name: "Disable Alice Learner" }),
    );

    expect(window.confirm).toHaveBeenCalledTimes(1);
    expect(String(window.confirm.mock.calls[0][0])).toContain("signed out");
    expect(mockPatch).toHaveBeenCalledWith(
      "/api/v1/admin/users/2/enabled",
      { enabled: false },
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Enable Alice Learner" }),
      ).toBeInTheDocument(),
    );
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: "success" }));
  });

  it("does not request anything when the disable confirmation is dismissed", async () => {
    window.confirm = vi.fn(() => false);
    const user = userEvent.setup();
    renderPage();

    await user.click(
      await screen.findByRole("button", { name: "Disable Alice Learner" }),
    );

    expect(mockPatch).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Disable Alice Learner" }),
    ).toBeInTheDocument();
  });

  it("enables without a confirmation", async () => {
    mockPatch.mockResolvedValue({
      data: { data: { id: 3, enabled: true, fullName: "Bob Mentor" } },
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(
      await screen.findByRole("button", { name: "Enable Bob Mentor" }),
    );

    expect(window.confirm).not.toHaveBeenCalled();
    expect(mockPatch).toHaveBeenCalledWith(
      "/api/v1/admin/users/3/enabled",
      { enabled: true },
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Disable Bob Mentor" }),
      ).toBeInTheDocument(),
    );
  });

  it("reflects the server's state rather than the requested one", async () => {
    // The backend refused the change (e.g. last enabled admin would be the
    // only source of truth) and returned enabled: true for a disable request.
    mockPatch.mockResolvedValue({
      data: { data: { id: 2, enabled: true, fullName: "Alice Learner" } },
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(
      await screen.findByRole("button", { name: "Disable Alice Learner" }),
    );

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Disable Alice Learner" }),
      ).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("button", { name: "Enable Alice Learner" }),
    ).not.toBeInTheDocument();
  });

  it("keeps the row unchanged and reports the server error on failure", async () => {
    mockPatch.mockRejectedValue(
      Object.assign(new Error("HTTP 400"), {
        response: {
          status: 400,
          data: { data: { error: "You cannot disable the last enabled admin account" } },
        },
      }),
    );
    const user = userEvent.setup();
    const { notify } = renderPage();

    await user.click(
      await screen.findByRole("button", { name: "Disable Alice Learner" }),
    );

    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "error",
          message: "You cannot disable the last enabled admin account",
        }),
      ),
    );
    expect(
      screen.getByRole("button", { name: "Disable Alice Learner" }),
    ).toBeInTheDocument();
  });

  it("filters by status without hiding disabled accounts by default", async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText("Alice Learner")).toBeInTheDocument();
    expect(screen.getByText("Bob Mentor")).toBeInTheDocument();

    await user.selectOptions(
      screen.getByLabelText("Filter by status"),
      "disabled",
    );

    await waitFor(() =>
      expect(screen.queryByText("Alice Learner")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Bob Mentor")).toBeInTheDocument();
    expect(
      screen.getByText(/Showing 1 of 2 on this page/),
    ).toBeInTheDocument();
  });

  it("shows an empty state when no account matches the status filter", async () => {
    const user = userEvent.setup();
    mockGet.mockResolvedValue({
      data: { data: usersPage([{ ...users[0], enabled: true }]) },
    });
    renderPage();

    await screen.findByText("Alice Learner");
    await user.selectOptions(
      screen.getByLabelText("Filter by status"),
      "disabled",
    );

    expect(
      await screen.findByText("No users match this filter"),
    ).toBeInTheDocument();
  });
});
