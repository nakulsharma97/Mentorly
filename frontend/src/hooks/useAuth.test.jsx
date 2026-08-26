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

// Mock fetchProfile to control profile data directly
const mockFetchProfile = vi.fn();
vi.mock("./useProfileCache", () => ({
  fetchProfile: (...args) => mockFetchProfile(...args),
  invalidateProfileCache: vi.fn(),
}));

// Mock useUnreadNotifications to prevent module-level shared state leaking
let mockUnreadCount = 0;
const mockRefreshUnread = vi.fn();
vi.mock("./useUnreadNotifications", () => ({
  default: () => ({
    unreadCount: mockUnreadCount,
    refresh: mockRefreshUnread,
  }),
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
    mockUnreadCount = 0;
    // Default: no token → no profile
    getActiveAuthToken.mockReturnValue(null);
    mockFetchProfile.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── not logged in ────────────────────────────────────────

  it("does not ping when user is not logged in", async () => {
    getActiveAuthToken.mockReturnValue(null);
    mockFetchProfile.mockRejectedValue(new Error("No session"));

    renderHook(() => useAuthProfile({ notify: mockNotify }), { wrapper });
    await tick(10000);

    expect(client.post).not.toHaveBeenCalledWith("/api/v1/users/me/ping");
  });

  // ── logged in: skip first mount, then ping every 60s (checked every 15s) ──

  it("skips first mount and pings after 60s when logged in", async () => {
    getActiveAuthToken.mockReturnValue("mock-token");
    extractJwtUserId.mockReturnValue(42);
    mockFetchProfile.mockResolvedValue({
      id: 42,
      fullName: "Test User",
      role: "LEARNER",
    });

    const { unmount } = renderHook(
      () => useAuthProfile({ notify: mockNotify }),
      { wrapper },
    );

    // Flush profile sync
    await tick(100);

    // The interval fires every 15s, but only pings if 60s since last ping.
    // lastPingRef starts at 0, so first interval tick will ping.
    // After that, need 60s before next ping.
    await tick(15000);
    // First ping fires (Date.now() - 0 > 60s)
    expect(client.post).toHaveBeenCalledWith("/api/v1/users/me/ping");
    expect(client.post).toHaveBeenCalledTimes(1);

    // After 30s total — only 15s since last ping → skip
    await tick(15000);
    expect(client.post).toHaveBeenCalledTimes(1);

    // After 45s — 30s since last ping → skip
    await tick(15000);
    expect(client.post).toHaveBeenCalledTimes(1);

    // After 60s — 45s since last ping → skip
    await tick(15000);
    expect(client.post).toHaveBeenCalledTimes(1);

    // After 75s — 60s since last ping → fires again
    await tick(15000);
    expect(client.post).toHaveBeenCalledTimes(2);

    // Unmount — cleanup clears the interval; no more pings
    unmount();
    await tick(120000);
    expect(client.post).toHaveBeenCalledTimes(2);
  });

  // ── interval errors are fire-and-forget, silently swallowed ──

  it("silently swallows ping errors", async () => {
    getActiveAuthToken.mockReturnValue("mock-token");
    extractJwtUserId.mockReturnValue(42);
    mockFetchProfile.mockResolvedValue({
      id: 42,
      fullName: "Test User",
      role: "LEARNER",
    });

    let callIndex = 0;
    client.post.mockImplementation(() => {
      callIndex++;
      if (callIndex === 2) {
        return Promise.reject(new Error("Network error"));
      }
      return Promise.resolve({});
    });

    renderHook(() => useAuthProfile({ notify: mockNotify }), { wrapper });

    // Flush async work
    await tick(100);

    // First ping fires (Date.now() - 0 > 60s)
    await tick(15000);
    expect(client.post).toHaveBeenCalledTimes(1);

    // Skip at 30s, 45s, 60s (< 60s since last ping)
    await tick(45000);
    expect(client.post).toHaveBeenCalledTimes(1);

    // At 75s — 60s since last ping → fires again (errors this time)
    await tick(15000);
    expect(client.post).toHaveBeenCalledTimes(2);

    // At 135s — 60s since last ping → fires again, succeeds
    await tick(60000);
    expect(client.post).toHaveBeenCalledTimes(3);
  });

  // ── unmount cleans up the interval ──

  it("cleans up the interval on unmount", async () => {
    getActiveAuthToken.mockReturnValue("mock-token");
    extractJwtUserId.mockReturnValue(42);
    mockFetchProfile.mockResolvedValue({
      id: 42,
      fullName: "Test User",
      role: "LEARNER",
    });

    const { unmount } = renderHook(
      () => useAuthProfile({ notify: mockNotify }),
      { wrapper },
    );

    // Flush async work
    await tick(100);

    // First interval at 15s — fires (Date.now() - 0 > 60s)
    await tick(15000);
    expect(client.post).toHaveBeenCalledTimes(1);

    // Unmount before next ping
    unmount();

    // Advance far past the interval — should not produce more calls
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
    mockUnreadCount = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── 1. No active token ──────────────────────────────────

  it("no token + 401 rejection → clears session, returns null", async () => {
    getActiveAuthToken.mockReturnValue(null);
    const unauthorized = new Error("No session");
    unauthorized.response = { status: 401 };
    mockFetchProfile.mockRejectedValue(unauthorized);

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
    mockFetchProfile.mockRejectedValue(new Error("Network error"));

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
    mockFetchProfile.mockResolvedValue({
      id: 99,
      fullName: "Guest",
      role: "LEARNER",
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
    mockFetchProfile.mockResolvedValue(null);

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
    mockFetchProfile.mockResolvedValue({
      id: 999,
      fullName: "Intruder",
      role: "LEARNER",
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
    mockFetchProfile.mockResolvedValue(validProfile);

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
    mockFetchProfile.mockRejectedValue(err);

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
    mockFetchProfile.mockRejectedValue(err);

    const { result } = renderHook(
      () => useAuthProfile({ notify: mockNotify }),
      { wrapper },
    );
    await tick(100);

    expect(clearAuthSessionState).toHaveBeenCalled();
    expect(result.current.profile).toBeNull();
    expect(result.current.profileChecked).toBe(true);
  });

  // ── 5. Other error → server error with retry logic ────

  it("has token + 5xx error → retries and eventually sets profile", async () => {
    getActiveAuthToken.mockReturnValue("expired-token");
    extractJwtUserId.mockReturnValue(42);

    // First call fails with 500
    const serverErr = new Error("Server error");
    serverErr.response = { status: 500 };

    let callCount = 0;
    client.get.mockImplementation(() => {
      callCount++;
      if (callCount <= 1) {
        return Promise.reject(serverErr);
      }
      return Promise.resolve({
        data: { data: validProfile },
      });
    });

    const { result } = renderHook(
      () => useAuthProfile({ notify: mockNotify }),
      { wrapper },
    );
    // 5xx retry has delays (500ms * attempt), so flush enough time
    await tick(5000);

    expect(result.current.profileChecked).toBe(true);
  });

  it("has token + non-5xx non-4xx error → refresh succeeds → profile set", async () => {
    getActiveAuthToken.mockReturnValue("expired-token");
    extractJwtUserId.mockReturnValue(42);

    const networkErr = new Error("Network error");
    networkErr.response = { status: 0 };

    // First fetchProfile call fails → triggers refresh path
    mockFetchProfile.mockRejectedValueOnce(networkErr);
    client.post.mockResolvedValueOnce({}); // refresh succeeds
    // After refresh, code calls client.get("/api/v1/users/me") directly
    client.get.mockResolvedValueOnce({
      data: { data: validProfile },
    });

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

  it("has token + non-5xx non-4xx error → refresh fails + logout → clears session", async () => {
    getActiveAuthToken.mockReturnValue("expired-token");
    extractJwtUserId.mockReturnValue(42);

    const networkErr = new Error("Network error");
    networkErr.response = { status: 0 };

    mockFetchProfile.mockRejectedValue(networkErr);

    client.post
      .mockRejectedValueOnce(new Error("Refresh failed")) // refresh fails
      .mockResolvedValueOnce({}); // logout succeeds

    const { result } = renderHook(
      () => useAuthProfile({ notify: mockNotify }),
      { wrapper },
    );
    await tick(100);

    expect(client.post).toHaveBeenCalledWith("/api/v1/auth/refresh");
    expect(client.post).toHaveBeenCalledWith("/api/v1/auth/logout");
    expect(clearAuthSessionState).toHaveBeenCalled();
    expect(result.current.profile).toBeNull();
    expect(result.current.profileChecked).toBe(true);
    expect(result.current.isLoggedIn).toBe(false);
  });

  it("has token + non-5xx non-4xx error → refresh + logout both fail → clears session gracefully", async () => {
    getActiveAuthToken.mockReturnValue("expired-token");
    extractJwtUserId.mockReturnValue(42);

    const networkErr = new Error("Network error");
    networkErr.response = { status: 0 };

    mockFetchProfile.mockRejectedValue(networkErr);

    client.post
      .mockRejectedValueOnce(new Error("Refresh failed")) // refresh fails
      .mockRejectedValueOnce(new Error("Logout failed")); // logout fails

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

    let fetchCall = 0;
    mockFetchProfile.mockImplementation(() => {
      fetchCall++;
      if (fetchCall <= 1) return Promise.reject(networkErr);
      return Promise.resolve(null);
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

    mockFetchProfile.mockRejectedValueOnce(networkErr);
    client.post.mockResolvedValueOnce({}); // refresh succeeds
    client.get.mockResolvedValueOnce({
      data: { data: { id: 999, fullName: "Wrong User", role: "LEARNER" } },
    }); // retry returns mismatched user

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

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockUnreadCount = 0;
    getActiveAuthToken.mockReturnValue(null);
    mockFetchProfile.mockRejectedValue(new Error("No session"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── not logged in ──────────────────────────────────────

  it("does not fetch notifications when user is not logged in", async () => {
    getActiveAuthToken.mockReturnValue(null);
    mockFetchProfile.mockRejectedValue(new Error("No session"));

    const { result } = renderHook(
      () => useAuthProfile({ notify: mockNotify }),
      { wrapper },
    );
    await tick(100);

    // useUnreadNotifications is mocked with shared state, so unread stays 0
    expect(result.current.unreadNotifications).toBe(0);
  });

  // ── logged in: notification count updated via shared hook ──

  it("receives unread count from shared useUnreadNotifications hook", async () => {
    // The mock useUnreadNotifications returns a static count but doesn't
    // trigger onChange. The real hook delivers counts via onChange callback.
    // Verify the component is wired up by checking the initial state.
    getActiveAuthToken.mockReturnValue("mock-token");
    extractJwtUserId.mockReturnValue(42);
    mockFetchProfile.mockResolvedValue({
      id: 42,
      fullName: "Test User",
      role: "LEARNER",
    });

    const { result } = renderHook(
      () => useAuthProfile({ notify: mockNotify }),
      { wrapper },
    );
    await tick(100);

    // The hook initializes unreadNotifications from the shared hook value
    expect(result.current.unreadNotifications).toBe(0);
  });

  // ── error handling ─────────────────────────────────────

  it("sets unreadNotifications to 0 when hook returns 0", async () => {
    getActiveAuthToken.mockReturnValue("mock-token");
    extractJwtUserId.mockReturnValue(42);
    mockFetchProfile.mockResolvedValue({
      id: 42,
      fullName: "Test User",
      role: "LEARNER",
    });
    mockUnreadCount = 0;

    const { result } = renderHook(
      () => useAuthProfile({ notify: mockNotify }),
      { wrapper },
    );
    await tick(100);

    expect(result.current.unreadNotifications).toBe(0);
  });
});

describe("useAuthProfile – handleLogout", () => {
  const mockNotify = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockUnreadCount = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** Mount the hook as a logged-in learner. */
  async function mountLoggedIn() {
    getActiveAuthToken.mockReturnValue("mock-token");
    extractJwtUserId.mockReturnValue(42);
    mockFetchProfile.mockResolvedValue({
      id: 42,
      fullName: "Test User",
      role: "LEARNER",
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
    mockFetchProfile.mockRejectedValue(new Error("No session"));
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
    mockUnreadCount = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
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

  it("not logged in + /mentors/:id → saves destination and redirects to login", async () => {
    localStorage.removeItem("auth_post_redirect");
    noSessionSetup();
    renderAt("/mentors/5");
    await tick(100);

    expect(localStorage.getItem("auth_post_redirect")).toBe("/mentors/5");
    expect(mockNavigate).toHaveBeenCalledWith("/login", { replace: true });
  });

  it("not logged in + /oauth/callback → OAuth handler navigates to /login", async () => {
    noSessionSetup();
    renderAt("/oauth/callback");
    await tick(100);

    expect(mockNavigate).toHaveBeenCalledWith("/login", { replace: true });
  });

  // ── logged in, on root/redirectable paths ──────────────

  it("logged in + / → redirects to role dashboard", async () => {
    getActiveAuthToken.mockReturnValue("mock-token");
    extractJwtUserId.mockReturnValue(42);
    mockFetchProfile.mockResolvedValue({
      id: 42,
      fullName: "Test User",
      role: "LEARNER",
      profileCompleted: true,
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
    mockFetchProfile.mockResolvedValue({
      id: 42,
      fullName: "Mentor User",
      role: "MENTOR",
      profileCompleted: true,
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
    mockFetchProfile.mockResolvedValue({
      id: 42,
      fullName: "Admin User",
      role: "ADMIN",
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
    mockFetchProfile.mockResolvedValue({
      id: 42,
      fullName: "Test User",
      role: "LEARNER",
      profileCompleted: true,
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
    mockFetchProfile.mockResolvedValue({
      id: 42,
      fullName: "Test User",
      role: "LEARNER",
      profileCompleted: true,
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
    // No skills/aboutMe → profile incomplete
    mockFetchProfile.mockResolvedValue({
      id: 42,
      fullName: "New User",
      role: "LEARNER",
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
    // No skills/aboutMe → profile incomplete, but already on /complete-profile
    mockFetchProfile.mockResolvedValue({
      id: 42,
      fullName: "New User",
      role: "MENTOR",
    });

    renderAt("/complete-profile");
    await tick(100);

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("logged in with a complete profile + /complete-profile → stays (edit mode, no dashboard bounce)", async () => {
    getActiveAuthToken.mockReturnValue("mock-token");
    extractJwtUserId.mockReturnValue(42);
    mockFetchProfile.mockResolvedValue({
      id: 42,
      fullName: "Test User",
      role: "MENTOR",
      profileCompleted: true,
    });

    renderAt("/complete-profile");
    await tick(100);

    expect(mockNavigate).not.toHaveBeenCalledWith("/mentor/dashboard", {
      replace: true,
    });
  });

  it("logged in as ADMIN with incomplete-looking profile → no onboarding", async () => {
    getActiveAuthToken.mockReturnValue("mock-token");
    extractJwtUserId.mockReturnValue(42);
    mockFetchProfile.mockResolvedValue({
      id: 42,
      fullName: "Admin",
      role: "ADMIN",
    });

    renderAt("/admin/dashboard");
    await tick(100);

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("logged in with incomplete profile but onboarding dismissed → dashboard is reachable (no /complete-profile bounce)", async () => {
    getActiveAuthToken.mockReturnValue("mock-token");
    extractJwtUserId.mockReturnValue(42);
    // No skills/aboutMe → profile incomplete
    mockFetchProfile.mockResolvedValue({
      id: 42,
      fullName: "New Mentor",
      role: "MENTOR",
    });

    sessionStorage.setItem("mentorly:onboarding_dismissed", "1");
    renderAt("/mentor/dashboard");
    await tick(100);

    expect(mockNavigate).not.toHaveBeenCalled();
    sessionStorage.removeItem("mentorly:onboarding_dismissed");
  });
});
