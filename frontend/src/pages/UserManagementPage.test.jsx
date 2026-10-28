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
    expect(screen.getByText("Disabled")).toBeInTheDocument();
  });
});
