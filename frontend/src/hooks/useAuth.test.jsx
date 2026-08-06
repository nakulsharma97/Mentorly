import { act, renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { useAuthProfile } from "./useAuth";
import client, {
  clearAuthSessionState,
  extractJwtUserId,
  getActiveAuthToken,
} from "../api/client";

const { mockNavigate } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
}));

vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("../api/client", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
  clearAuthSessionState: vi.fn(),
  extractJwtUserId: vi.fn(),
  getActiveAuthToken: vi.fn(),
  onMaintenanceMode: vi.fn(() => () => {}),
}));

/** Wraps the hook in a MemoryRouter so useLocation/useNavigate work. */
const wrapper = ({ children }) => (
  <MemoryRouter initialEntries={["/"]}>{children}</MemoryRouter>
);

/**
 * Helper: advance fake timers inside act() so React processes any
 * pending state updates (from resolved async callbacks) and flushes
 * effect re-runs synchronously before the assertion.
 */
async function tick(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("useAuthProfile – activity ping", () => {
  const mockNotify = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── not logged in ────────────────────────────────────────

  it("does not ping when user is not logged in", async () => {
    getActiveAuthToken.mockReturnValue(null);
    client.get.mockRejectedValue(new Error("No session"));

    renderHook(() => useAuthProfile({ notify: mockNotify }), { wrapper });

    // Flush microtasks + pending state updates
    await tick(10000);

    expect(client.post).not.toHaveBeenCalled();
  });

  // ── logged in: immediate ping + 60s interval ────────────

  it("pings immediately on mount and every 60 s when logged in", async () => {
    getActiveAuthToken.mockReturnValue("mock-token");
    extractJwtUserId.mockReturnValue(42);
    client.get.mockResolvedValue({
      data: { data: { id: 42, fullName: "Test User", role: "LEARNER" } },
    });

    const { unmount } = renderHook(
      () => useAuthProfile({ notify: mockNotify }),
      { wrapper },
    );

    // Flush: syncCurrentUser resolves → profile set → re-render →
    // activity-ping effect fires → client.post called
    await tick(100);

    expect(client.post).toHaveBeenCalledWith("/api/v1/users/me/ping");
    expect(client.post).toHaveBeenCalledTimes(1);

    // Advance 60 s – interval fires once more
    await tick(60000);
    expect(client.post).toHaveBeenCalledTimes(2);

    // Advance another 60 s – fires again
    await tick(60000);
    expect(client.post).toHaveBeenCalledTimes(3);

    // Unmount – cleanup clears the interval; no more pings
    unmount();
    await tick(120000);
    expect(client.post).toHaveBeenCalledTimes(3);
  });

  // ── interval errors are fire-and-forget, silently swallowed ──

  it("silently swallows ping errors", async () => {
    getActiveAuthToken.mockReturnValue("mock-token");
    extractJwtUserId.mockReturnValue(42);
    client.get.mockResolvedValue({
      data: { data: { id: 42, fullName: "Test User", role: "LEARNER" } },
    });

    // Use a counter-based implementation instead of mockResolvedValueOnce
    // (which can introduce extra microtask ticks that interfere with
    // React state-update timing under fake timers).
    let callIndex = 0;
    client.post.mockImplementation(() => {
      callIndex++;
      if (callIndex === 2) {
        return Promise.reject(new Error("Network error"));
      }
      return Promise.resolve({});
    });

    renderHook(() => useAuthProfile({ notify: mockNotify }), { wrapper });

    // Flush async work → first ping fires
    await tick(100);
    expect(client.post).toHaveBeenCalledTimes(1);

    // Advance 60 s – second ping fails, error swallowed
    await tick(60000);
    expect(client.post).toHaveBeenCalledTimes(2);

    // Advance another 60 s – third ping succeeds
    await tick(60000);
    expect(client.post).toHaveBeenCalledTimes(3);
  });

  // ── unmount cleans up the interval ──

  it("cleans up the interval on unmount", async () => {
    getActiveAuthToken.mockReturnValue("mock-token");
    extractJwtUserId.mockReturnValue(42);
    client.get.mockResolvedValue({
      data: { data: { id: 42, fullName: "Test User", role: "LEARNER" } },
    });

    const { unmount } = renderHook(
      () => useAuthProfile({ notify: mockNotify }),
      { wrapper },
    );

    // Flush async work → first ping fires
    await tick(100);
    expect(client.post).toHaveBeenCalledTimes(1);

    // Unmount before any interval fires
    unmount();

    // Advance far past the 60 s interval – should not produce more calls
    await tick(120000);
    expect(client.post).toHaveBeenCalledTimes(1);
  });
});

describe("useAuthProfile – syncCurrentUser", () => {
  const mockNotify = vi.fn();

  const validProfile = {
    id: 42,
    fullName: "Test User",
    email: "test@example.com",
    role: "LEARNER",
    skills: "React, Node.js",
    aboutMe: "I love coding",
    githubUrl: "https://github.com/test",
    linkedinUrl: "https://linkedin.com/in/test",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── 1. No active token ──────────────────────────────────

  it("no token + 401 rejection → clears session, returns null", async () => {
    getActiveAuthToken.mockReturnValue(null);
    const unauthorized = new Error("No session");
    unauthorized.response = { status: 401 };
    client.get.mockRejectedValue(unauthorized);

    const { result } = renderHook(
      () => useAuthProfile({ notify: mockNotify }),
      { wrapper },
    );
    await tick(100);

    expect(clearAuthSessionState).toHaveBeenCalled();
    expect(result.current.profile).toBeNull();
    expect(result.current.profileChecked).toBe(true);
    expect(result.current.isLoggedIn).toBe(false);
  });

  it("no token + network error → does NOT clear session (transient), returns null", async () => {
    getActiveAuthToken.mockReturnValue(null);
    client.get.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(
      () => useAuthProfile({ notify: mockNotify }),
      { wrapper },
    );
    await tick(100);

    expect(clearAuthSessionState).not.toHaveBeenCalled();
    expect(result.current.profile).toBeNull();
    expect(result.current.profileChecked).toBe(true);
    expect(result.current.isLoggedIn).toBe(false);
  });

  it("no token + anonymous profile found → sets profile", async () => {
    getActiveAuthToken.mockReturnValue(null);
    client.get.mockResolvedValue({
      data: { data: { id: 99, fullName: "Guest", role: "LEARNER" } },
    });

    const { result } = renderHook(
      () => useAuthProfile({ notify: mockNotify }),
      { wrapper },
    );
    await tick(100);

    expect(result.current.profile).toEqual({
      id: 99,
      fullName: "Guest",
      role: "LEARNER",
    });
    expect(result.current.profileChecked).toBe(true);
    expect(result.current.isLoggedIn).toBe(true);
  });

  // ── 2. Has token but cannot extract user ID ────────────

  it("has token + extractJwtUserId returns null → clears session", async () => {
    getActiveAuthToken.mockReturnValue("invalid-jwt");
    extractJwtUserId.mockReturnValue(null);

    const { result } = renderHook(
      () => useAuthProfile({ notify: mockNotify }),
      { wrapper },
    );
    await tick(100);

    expect(clearAuthSessionState).toHaveBeenCalled();
    expect(result.current.profile).toBeNull();
    expect(result.current.profileChecked).toBe(true);
    expect(result.current.isLoggedIn).toBe(false);
  });

  // ── 3. Has token + valid user ID ───────────────────────

  it("has token + /users/me returns empty → clears session", async () => {
    getActiveAuthToken.mockReturnValue("valid-token");
    extractJwtUserId.mockReturnValue(42);
    client.get.mockResolvedValue({
      data: { data: null },
    });

    const { result } = renderHook(
      () => useAuthProfile({ notify: mockNotify }),
      { wrapper },
    );
    await tick(100);

    expect(clearAuthSessionState).toHaveBeenCalled();
    expect(result.current.profile).toBeNull();
    expect(result.current.profileChecked).toBe(true);
  });

  it("has token + profile ID mismatches token → clears session", async () => {
    getActiveAuthToken.mockReturnValue("valid-token");
    extractJwtUserId.mockReturnValue(42);
    client.get.mockResolvedValue({
      data: { data: { id: 999, fullName: "Intruder", role: "LEARNER" } },
    });

    const { result } = renderHook(
      () => useAuthProfile({ notify: mockNotify }),
      { wrapper },
    );
    await tick(100);

    expect(clearAuthSessionState).toHaveBeenCalled();
    expect(result.current.profile).toBeNull();
    expect(result.current.profileChecked).toBe(true);
  });

  it("has token + valid profile → sets profile", async () => {
    getActiveAuthToken.mockReturnValue("valid-token");
    extractJwtUserId.mockReturnValue(42);
    client.get.mockResolvedValue({
      data: { data: validProfile },
    });

    const { result } = renderHook(
      () => useAuthProfile({ notify: mockNotify }),
      { wrapper },
    );
    await tick(100);

    expect(result.current.profile).toEqual(validProfile);
    expect(result.current.profileChecked).toBe(true);
    expect(result.current.isLoggedIn).toBe(true);
  });

  // ── 4. Has token + server error (401 / 403) ────────────

  it("has token + 401 error → clears session", async () => {
    getActiveAuthToken.mockReturnValue("expired-token");
    extractJwtUserId.mockReturnValue(42);
    const err = new Error("Unauthorized");
    err.response = { status: 401 };
    client.get.mockRejectedValue(err);

    const { result } = renderHook(
      () => useAuthProfile({ notify: mockNotify }),
      { wrapper },
    );
    await tick(100);

    expect(clearAuthSessionState).toHaveBeenCalled();
    expect(result.current.profile).toBeNull();
    expect(result.current.profileChecked).toBe(true);
    expect(result.current.isLoggedIn).toBe(false);
  });

  it("has token + 403 error → clears session", async () => {
    getActiveAuthToken.mockReturnValue("expired-token");
    extractJwtUserId.mockReturnValue(42);
    const err = new Error("Forbidden");
    err.response = { status: 403 };
    client.get.mockRejectedValue(err);

    const { result } = renderHook(
      () => useAuthProfile({ notify: mockNotify }),
      { wrapper },
    );
    await tick(100);

    expect(clearAuthSessionState).toHaveBeenCalled();
    expect(result.current.profile).toBeNull();
    expect(result.current.profileChecked).toBe(true);
  });

  // ── 5. Other error → refresh token flow ───────────────

  it("has token + server error → refresh succeeds → profile set", async () => {
    getActiveAuthToken.mockReturnValue("expired-token");
    extractJwtUserId.mockReturnValue(42);

    // First call fails (network error), then refresh succeeds, retry returns profile
    const networkErr = new Error("Network error");
    networkErr.response = { status: 0 };

    client.get
      .mockRejectedValueOnce(networkErr)
      .mockResolvedValueOnce({
        data: { data: validProfile },
      });
    client.post.mockResolvedValueOnce({}); // refresh succeeds

    const { result } = renderHook(
      () => useAuthProfile({ notify: mockNotify }),
      { wrapper },
    );
    await tick(100);

    // Should have called refresh endpoint
    expect(client.post).toHaveBeenCalledWith("/api/v1/auth/refresh");
    // Should have the valid profile
    expect(result.current.profile).toEqual(validProfile);
    expect(result.current.profileChecked).toBe(true);
    expect(result.current.isLoggedIn).toBe(true);
  });

  it("has token + server error → refresh fails + logout → clears session", async () => {
    getActiveAuthToken.mockReturnValue("expired-token");
    extractJwtUserId.mockReturnValue(42);

    const networkErr = new Error("Network error");
    networkErr.response = { status: 0 };

    client.get.mockRejectedValueOnce(networkErr);
    client.post
      .mockRejectedValueOnce(new Error("Refresh failed")) // refresh fails
      .mockResolvedValueOnce({}); // logout succeeds

    const { result } = renderHook(
      () => useAuthProfile({ notify: mockNotify }),
      { wrapper },
    );
    await tick(100);

    // refresh and logout should have been called
    expect(client.post).toHaveBeenCalledWith("/api/v1/auth/refresh");
    expect(client.post).toHaveBeenCalledWith("/api/v1/auth/logout");
    expect(clearAuthSessionState).toHaveBeenCalled();
    expect(result.current.profile).toBeNull();
    expect(result.current.profileChecked).toBe(true);
    expect(result.current.isLoggedIn).toBe(false);
  });

  it("has token + server error → refresh + logout both fail → clears session gracefully", async () => {
    getActiveAuthToken.mockReturnValue("expired-token");
    extractJwtUserId.mockReturnValue(42);

    const networkErr = new Error("Network error");
    networkErr.response = { status: 0 };

    client.get.mockRejectedValueOnce(networkErr);
    client.post
      .mockRejectedValueOnce(new Error("Refresh failed"))  // refresh fails
      .mockRejectedValueOnce(new Error("Logout failed"));  // logout fails too

    const { result } = renderHook(
      () => useAuthProfile({ notify: mockNotify }),
      { wrapper },
    );
    await tick(100);

    // Even with both failures, should still clear auth state
    expect(clearAuthSessionState).toHaveBeenCalled();
    expect(result.current.profile).toBeNull();
    expect(result.current.profileChecked).toBe(true);
  });

  // ── 6. Refresh succeeds but retry yields no profile or mismatched ID ──

  it("refresh succeeds but retry returns null → clears session", async () => {
    getActiveAuthToken.mockReturnValue("expired-token");
    extractJwtUserId.mockReturnValue(42);

    const networkErr = new Error("Network error");
    networkErr.response = { status: 0 };

    client.get
      .mockRejectedValueOnce(networkErr)   // first call fails
      .mockResolvedValueOnce({             // retry returns empty
        data: { data: null },
      });
    client.post.mockResolvedValueOnce({}); // refresh succeeds

    const { result } = renderHook(
      () => useAuthProfile({ notify: mockNotify }),
      { wrapper },
    );
    await tick(100);

    expect(clearAuthSessionState).toHaveBeenCalled();
    expect(result.current.profile).toBeNull();
    expect(result.current.profileChecked).toBe(true);
  });

  it("refresh succeeds but retry profile ID mismatches → clears session", async () => {
    getActiveAuthToken.mockReturnValue("expired-token");
    extractJwtUserId.mockReturnValue(42);

    const networkErr = new Error("Network error");
    networkErr.response = { status: 0 };

    client.get
      .mockRejectedValueOnce(networkErr)   // first call fails
      .mockResolvedValueOnce({             // retry returns mismatched user
        data: { data: { id: 999, fullName: "Wrong User", role: "LEARNER" } },
      });
    client.post.mockResolvedValueOnce({}); // refresh succeeds

    const { result } = renderHook(
      () => useAuthProfile({ notify: mockNotify }),
      { wrapper },
    );
    await tick(100);

    expect(clearAuthSessionState).toHaveBeenCalled();
    expect(result.current.profile).toBeNull();
    expect(result.current.profileChecked).toBe(true);
  });
});

describe("useAuthProfile – notification polling", () => {
  const mockNotify = vi.fn();

  const loggedInSetup = () => {
    getActiveAuthToken.mockReturnValue("mock-token");
    extractJwtUserId.mockReturnValue(42);
    // First client.get call returns profile (syncCurrentUser),
    // subsequent calls return the unread notification count.
    client.get
      .mockResolvedValueOnce({
        data: { data: { id: 42, fullName: "Test User", role: "LEARNER" } },
      })
      .mockResolvedValue({ data: { data: 3 } });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── not logged in ──────────────────────────────────────

  it("does not fetch notifications when user is not logged in", async () => {
    getActiveAuthToken.mockReturnValue(null);
    client.get.mockRejectedValue(new Error("No session"));

    const { result } = renderHook(
      () => useAuthProfile({ notify: mockNotify }),
      { wrapper },
    );
    await tick(100);

    // Should NOT have called the notifications endpoint
    expect(
      client.get.mock.calls.filter(([url]) =>
        url === "/api/v1/notifications/unread-count",
      ),
    ).toHaveLength(0);
    expect(result.current.unreadNotifications).toBe(0);
  });

  // ── logged in: immediate fetch + 15s interval ─────────

  it("fetches on mount and every 15 s when logged in", async () => {
    loggedInSetup();

    const { result, unmount } = renderHook(
      () => useAuthProfile({ notify: mockNotify }),
      { wrapper },
    );
    await tick(100);

    // Initial fetch should have happened (after profile sync)
    expect(client.get).toHaveBeenCalledWith(
      "/api/v1/notifications/unread-count",
    );
    expect(result.current.unreadNotifications).toBe(3);

    const getCallsAfterProfile = () =>
      client.get.mock.calls.filter(
        ([url]) => url === "/api/v1/notifications/unread-count",
      ).length;

    // Advance 15 s – interval fires once more
    await tick(15000);
    expect(getCallsAfterProfile()).toBe(2);

    // Advance another 15 s – fires again
    await tick(15000);
    expect(getCallsAfterProfile()).toBe(3);

    // Unmount – cleanup clears the interval
    unmount();
    await tick(30000);
    expect(getCallsAfterProfile()).toBe(3);
  });

  // ── error handling ─────────────────────────────────────

  it("sets unreadNotifications to 0 on fetch error", async () => {
    getActiveAuthToken.mockReturnValue("mock-token");
    extractJwtUserId.mockReturnValue(42);
    // profile sync succeeds, but notification fetch fails
    client.get
      .mockResolvedValueOnce({
        data: { data: { id: 42, fullName: "Test User", role: "LEARNER" } },
      })
      .mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(
      () => useAuthProfile({ notify: mockNotify }),
      { wrapper },
    );
    await tick(100);

    // Should have tried to fetch
    expect(client.get).toHaveBeenCalledWith(
      "/api/v1/notifications/unread-count",
    );
    // Error should be swallowed, unread set to 0
    expect(result.current.unreadNotifications).toBe(0);
  });

  // ── unmount cleans up the interval ─────────────────────

  it("cleans up the interval on unmount", async () => {
    loggedInSetup();

    const { result, unmount } = renderHook(
      () => useAuthProfile({ notify: mockNotify }),
      { wrapper },
    );
    await tick(100);

    // Initial fetch happened
    expect(result.current.unreadNotifications).toBe(3);

    // Unmount before any interval fires
    unmount();
    await tick(30000);

    // Only the initial fetch + profile call (no interval pings after unmount)
    expect(client.get).toHaveBeenCalledWith(
      "/api/v1/notifications/unread-count",
    );
    const filterNotif = client.get.mock.calls.filter(
      ([url]) => url === "/api/v1/notifications/unread-count",
    );
    expect(filterNotif).toHaveLength(1);
  });
});

describe("useAuthProfile – handleLogout", () => {
  const mockNotify = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** Mount the hook as a logged-in learner. */
  async function mountLoggedIn() {
    getActiveAuthToken.mockReturnValue("mock-token");
    extractJwtUserId.mockReturnValue(42);
    client.get.mockResolvedValue({
      data: { data: { id: 42, fullName: "Test User", role: "LEARNER" } },
    });

    const { result } = renderHook(
      () => useAuthProfile({ notify: mockNotify }),
      { wrapper },
    );
    await tick(100);
    return result;
  }

  // ── logout API succeeds ────────────────────────────────

  it("clears auth state, notifies, and navigates to / when API succeeds", async () => {
    client.post.mockResolvedValue({});
    const result = await mountLoggedIn();

    await act(async () => {
      await result.current.handleLogout();
    });

    expect(client.post).toHaveBeenCalledWith("/api/v1/auth/logout");
    expect(clearAuthSessionState).toHaveBeenCalled();
    expect(result.current.profile).toBeNull();
    expect(result.current.profileChecked).toBe(true);
    expect(result.current.isLoggedIn).toBe(false);
    expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
    expect(mockNotify).toHaveBeenCalledWith({
      type: "info",
      title: "Logged out",
      message: "You have been signed out successfully.",
    });
  });

  // ── logout API fails ───────────────────────────────────

  it("still clears state and navigates even when API call fails", async () => {
    client.post.mockRejectedValue(new Error("Server error"));
    const result = await mountLoggedIn();

    // Should NOT throw despite the API error
    await act(async () => {
      await result.current.handleLogout();
    });

    // API was called (even though it failed)
    expect(client.post).toHaveBeenCalledWith("/api/v1/auth/logout");
    // State clearing and navigation still happen
    expect(clearAuthSessionState).toHaveBeenCalled();
    expect(result.current.profile).toBeNull();
    expect(result.current.isLoggedIn).toBe(false);
    expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
    expect(mockNotify).toHaveBeenCalled();
  });
});

describe("useAuthProfile – route protection", () => {
  const mockNotify = vi.fn();

  const noSessionSetup = () => {
    getActiveAuthToken.mockReturnValue(null);
    client.get.mockRejectedValue(new Error("No session"));
  };

  /** Render alongside a specific initial path. */
  function renderAt(path) {
    return renderHook(() => useAuthProfile({ notify: mockNotify }), {
      wrapper: ({ children }) => (
        <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>
      ),
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── not logged in ──────────────────────────────────────

  it("not logged in + protected path → redirects to /", async () => {
    noSessionSetup();
    renderAt("/learner/dashboard");
    await tick(100);

    expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
  });

  it("not logged in + public path → no redirect", async () => {
    noSessionSetup();
    renderAt("/");
    await tick(100);

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("not logged in + /mentors/:id → no redirect (public profile)", async () => {
    noSessionSetup();
    renderAt("/mentors/5");
    await tick(100);

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("not logged in + /oauth/callback → OAuth handler navigates to /login", async () => {
    noSessionSetup();
    renderAt("/oauth/callback");
    await tick(100);

    // OAuth callback effect handles unauthenticated users on this path
    expect(mockNavigate).toHaveBeenCalledWith("/login", { replace: true });
  });

  // ── logged in, on root/redirectable paths ──────────────

  it("logged in + / → redirects to role dashboard", async () => {
    getActiveAuthToken.mockReturnValue("mock-token");
    extractJwtUserId.mockReturnValue(42);

    // LEARNER role with complete profile → redirect to /learner/dashboard
    // (needs skills, aboutMe, githubUrl, linkedinUrl so isProfileComplete returns true
    //  and needsProfileSetup is false, allowing the redirect)
    client.get.mockResolvedValue({
      data: {
        data: {
          id: 42,
          fullName: "Test User",
          role: "LEARNER",
          skills: "React",
          aboutMe: "Developer",
          githubUrl: "https://github.com/test",
          linkedinUrl: "https://linkedin.com/in/test",
        },
      },
    });

    renderAt("/");
    await tick(100);

    expect(mockNavigate).toHaveBeenCalledWith("/learner/dashboard", {
      replace: true,
    });
  });

  it("logged in as MENTOR + / → redirects to /mentor/dashboard", async () => {
    getActiveAuthToken.mockReturnValue("mock-token");
    extractJwtUserId.mockReturnValue(42);
    client.get.mockResolvedValue({
      data: {
        data: {
          id: 42,
          fullName: "Mentor User",
          role: "MENTOR",
          skills: "Mentoring",
          aboutMe: "Expert",
          githubUrl: "https://github.com/mentor",
          linkedinUrl: "https://linkedin.com/in/mentor",
        },
      },
    });

    renderAt("/");
    await tick(100);

    expect(mockNavigate).toHaveBeenCalledWith("/mentor/dashboard", {
      replace: true,
    });
  });

  it("logged in as ADMIN + / → redirects to /admin/dashboard", async () => {
    getActiveAuthToken.mockReturnValue("mock-token");
    extractJwtUserId.mockReturnValue(42);
    client.get.mockResolvedValue({
      data: { data: { id: 42, fullName: "Admin User", role: "ADMIN" } },
    });

    renderAt("/");
    await tick(100);

    expect(mockNavigate).toHaveBeenCalledWith("/admin/dashboard", {
      replace: true,
    });
  });

  it("logged in + /login → redirects to role dashboard", async () => {
    getActiveAuthToken.mockReturnValue("mock-token");
    extractJwtUserId.mockReturnValue(42);
    client.get.mockResolvedValue({
      data: {
        data: {
          id: 42,
          fullName: "Test User",
          role: "LEARNER",
          skills: "React",
          aboutMe: "Developer",
          githubUrl: "https://github.com/test",
          linkedinUrl: "https://linkedin.com/in/test",
        },
      },
    });

    renderAt("/login");
    await tick(100);

    expect(mockNavigate).toHaveBeenCalledWith("/learner/dashboard", {
      replace: true,
    });
  });

  it("logged in with a complete profile + already at learner dashboard → no redirect", async () => {
    getActiveAuthToken.mockReturnValue("mock-token");
    extractJwtUserId.mockReturnValue(42);
    client.get.mockResolvedValue({
      data: {
        data: {
          id: 42,
          fullName: "Test User",
          role: "LEARNER",
          skills: "React",
          aboutMe: "Developer",
          githubUrl: "https://github.com/test",
          linkedinUrl: "https://linkedin.com/in/test",
        },
      },
    });

    renderAt("/learner/dashboard");
    await tick(100);

    // Already at the correct place, no redirect
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  // ── mandatory onboarding gating ──────────────────────────

  it("logged in with incomplete profile + protected path → redirects to /complete-profile", async () => {
    getActiveAuthToken.mockReturnValue("mock-token");
    extractJwtUserId.mockReturnValue(42);
    // No skills/aboutMe and no profileCompleted → onboarding required.
    client.get.mockResolvedValue({
      data: { data: { id: 42, fullName: "New User", role: "LEARNER" } },
    });

    renderAt("/learner/dashboard");
    await tick(100);

    expect(mockNavigate).toHaveBeenCalledWith("/complete-profile", {
      replace: true,
    });
  });

  it("logged in with incomplete profile + /complete-profile → stays (no redirect loop)", async () => {
    getActiveAuthToken.mockReturnValue("mock-token");
    extractJwtUserId.mockReturnValue(42);
    client.get.mockResolvedValue({
      data: { data: { id: 42, fullName: "New User", role: "MENTOR" } },
    });

    renderAt("/complete-profile");
    await tick(100);

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("logged in with a complete profile + /complete-profile → redirects to role dashboard", async () => {
    getActiveAuthToken.mockReturnValue("mock-token");
    extractJwtUserId.mockReturnValue(42);
    client.get.mockResolvedValue({
      data: {
        data: {
          id: 42,
          fullName: "Test User",
          role: "MENTOR",
          skills: "Java",
          aboutMe: "Mentor",
          githubUrl: "https://github.com/m",
          linkedinUrl: "https://linkedin.com/in/m",
        },
      },
    });

    renderAt("/complete-profile");
    await tick(100);

    // Onboarding must never be shown again once complete.
    expect(mockNavigate).toHaveBeenCalledWith("/mentor/dashboard", {
      replace: true,
    });
  });

  it("logged in as ADMIN with incomplete-looking profile → no onboarding", async () => {
    getActiveAuthToken.mockReturnValue("mock-token");
    extractJwtUserId.mockReturnValue(42);
    client.get.mockResolvedValue({
      data: { data: { id: 42, fullName: "Admin", role: "ADMIN" } },
    });

    renderAt("/admin/dashboard");
    await tick(100);

    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

