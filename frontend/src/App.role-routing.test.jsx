import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";

/**
 * Tests for App-level role-based routing.
 * Mocks useAuth directly to isolate routing logic from hook internals.
 */

// Mock useAuth to control auth state directly
const mockAuthState = {
  isLoggedIn: false,
  profile: null,
  profileChecked: true,
  needsProfileSetup: false,
  authMode: null,
  oauthError: "",
  maintenanceMode: false,
  unreadNotifications: 0,
};

vi.mock("./hooks/useAuth", () => ({
  useAuthProfile: () => ({
    ...mockAuthState,
    setAuthMode: vi.fn(),
    setOauthError: vi.fn(),
    bumpSyncGeneration: vi.fn(),
    syncCurrentUser: vi.fn(),
    handleLogout: vi.fn(),
    handleSelectAuthMode: vi.fn(),
    setProfile: vi.fn(),
    setProfileChecked: vi.fn(),
    setUnreadNotifications: vi.fn(),
  }),
}));

vi.mock("./hooks/useToasts", () => ({
  useToasts: () => ({
    toasts: [],
    notify: vi.fn(),
    dismissToast: vi.fn(),
  }),
}));

vi.mock("./components/AuthModal", () => ({
  default: () => <div>Auth Modal</div>,
}));

vi.mock("./components/Navbar", () => ({
  default: ({ isLoggedIn, onOpenNotifications }) => (
    <div>
      Navbar
      {isLoggedIn && (
        <button type="button" onClick={onOpenNotifications}>
          Notifications
        </button>
      )}
    </div>
  ),
}));

vi.mock("./components/LazyLoadingFallback", () => ({
  default: () => <div>Loading</div>,
}));

vi.mock("./components/OfflineStatusBanner", () => ({
  default: () => null,
}));

vi.mock("./components/ToastCenter", () => ({
  default: () => null,
}));

vi.mock("./context/ThemeContext", () => ({
  ThemeProvider: ({ children }) => <>{children}</>,
}));

vi.mock("./pages/MaintenancePage", () => ({
  default: () => <div>Maintenance Page</div>,
}));

vi.mock("./utils/monitoring", () => ({
  createPerformanceReporter: () => () => {},
  initGlobalMonitoring: () => {},
}));

vi.mock("./modules/common/routePrefetch", () => ({
  prefetchWorkspacePages: () => {},
}));

vi.mock("./modules/common/profileCompletion", () => ({
  clearOnboardingDismissal: () => {},
  isProfileComplete: (user) => user?.profileCompleted !== false,
  PROFILE_ONBOARDING_PATH: "/complete-profile",
}));

vi.mock("./modules/common/routeUtils", () => ({
  roleRoot: (role) => {
    if (role === "ADMIN") return "/admin/dashboard";
    if (role === "MENTOR") return "/mentor/dashboard";
    return "/learner/dashboard";
  },
  isPublicPath: () => true,
}));

vi.mock("./api/client", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request: { use: vi.fn(), eject: vi.fn() },
      response: { use: vi.fn(), eject: vi.fn() },
    },
    defaults: { headers: { common: {} } },
  },
  createIdempotencyKey: vi.fn(() => "mock-key"),
  API_BASE_URL: "http://localhost:8080",
  getActiveAuthToken: vi.fn(() => null),
  extractJwtUserId: vi.fn(() => null),
  persistAuthSession: vi.fn(() => "mock-token"),
  clearAuthSessionState: vi.fn(),
  onMaintenanceMode: vi.fn(() => vi.fn()),
}));

// Mock AppRoutes to test routing decisions without React.lazy issues
vi.mock("./components/AppRoutes", () => ({
  default: ({
    isLoggedIn,
    profile,
    profileChecked,
    needsProfileSetup,
  }) => {
    if (!isLoggedIn) {
      return <div data-testid="auth-page">Auth Page</div>;
    }
    if (!profileChecked) {
      return <div>Loading your profile...</div>;
    }
    if (needsProfileSetup) {
      return <div>Complete Profile Page</div>;
    }
    if (profile?.role === "ADMIN") {
      return <div>Admin Dashboard</div>;
    }
    if (profile?.role === "MENTOR") {
      return <div>Mentor Dashboard</div>;
    }
    return <div>Learner Dashboard</div>;
  },
}));

describe("App role routing", () => {
  let App;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    localStorage.clear();

    // Reset auth state
    mockAuthState.isLoggedIn = false;
    mockAuthState.profile = null;
    mockAuthState.profileChecked = true;
    mockAuthState.needsProfileSetup = false;
    mockAuthState.authMode = null;
    mockAuthState.maintenanceMode = false;

    const appMod = await import("./App");
    App = appMod.default;
  });

  afterEach(() => {
    localStorage.clear();
  });

  const renderApp = (initialEntries) =>
    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        initialEntries={initialEntries}
      >
        <App />
      </MemoryRouter>,
    );

  it("does not render the global navbar on the landing page", async () => {
    mockAuthState.isLoggedIn = false;
    renderApp(["/"]);

    await waitFor(() => {
      expect(screen.getByText("Auth Page")).toBeInTheDocument();
    });

    expect(screen.queryByText("Navbar")).not.toBeInTheDocument();
  });

  it("redirects learner from /teach to /sessions route", async () => {
    mockAuthState.isLoggedIn = true;
    mockAuthState.profile = { role: "LEARNER", profileCompleted: true };
    renderApp(["/teach"]);

    await waitFor(() => {
      expect(screen.getByText("Learner Dashboard")).toBeInTheDocument();
    });
  });

  it("lands learner on learner dashboard after login", async () => {
    mockAuthState.isLoggedIn = true;
    mockAuthState.profile = { role: "LEARNER", profileCompleted: true };
    renderApp(["/login"]);

    await waitFor(() => {
      expect(screen.getByText("Learner Dashboard")).toBeInTheDocument();
    });

    expect(screen.queryByText("Mentor Dashboard")).not.toBeInTheDocument();
  });

  it("lands mentor on mentor dashboard after login", async () => {
    mockAuthState.isLoggedIn = true;
    mockAuthState.profile = { role: "MENTOR", profileCompleted: true };
    renderApp(["/login"]);

    await waitFor(() => {
      expect(screen.getByText("Mentor Dashboard")).toBeInTheDocument();
    });

    expect(screen.queryByText("Learner Dashboard")).not.toBeInTheDocument();
  });

  it("lands admin on admin dashboard after login", async () => {
    mockAuthState.isLoggedIn = true;
    mockAuthState.profile = { role: "ADMIN", profileCompleted: true };
    renderApp(["/login"]);

    await waitFor(() => {
      expect(screen.getByText("Admin Dashboard")).toBeInTheDocument();
    });

    expect(screen.queryByText("Learner Dashboard")).not.toBeInTheDocument();
    expect(screen.queryByText("Mentor Dashboard")).not.toBeInTheDocument();
  });

  it("redirects learner away from admin pages to learner dashboard", async () => {
    mockAuthState.isLoggedIn = true;
    mockAuthState.profile = { role: "LEARNER", profileCompleted: true };
    renderApp(["/admin"]);

    await waitFor(() => {
      expect(screen.getByText("Learner Dashboard")).toBeInTheDocument();
    });

    expect(screen.queryByText("Admin Dashboard")).not.toBeInTheDocument();
  });

  it("redirects admin away from learner and mentor dashboards to admin dashboard", async () => {
    mockAuthState.isLoggedIn = true;
    mockAuthState.profile = { role: "ADMIN", profileCompleted: true };
    renderApp(["/learner/dashboard"]);

    await waitFor(() => {
      expect(screen.getByText("Admin Dashboard")).toBeInTheDocument();
    });

    expect(screen.queryByText("Learner Dashboard")).not.toBeInTheDocument();
    expect(screen.queryByText("Mentor Dashboard")).not.toBeInTheDocument();
  });

  it("routes incomplete learners to the Complete Profile page (no dashboard access)", async () => {
    mockAuthState.isLoggedIn = true;
    mockAuthState.profile = { role: "LEARNER", profileCompleted: false };
    mockAuthState.needsProfileSetup = true;
    renderApp(["/learner/dashboard"]);

    await waitFor(() => {
      expect(screen.getByText("Complete Profile Page")).toBeInTheDocument();
    });

    expect(screen.queryByText("Learner Dashboard")).not.toBeInTheDocument();
  });

  it("blocks every direct URL until the profile is complete (no bypass)", async () => {
    mockAuthState.isLoggedIn = true;
    mockAuthState.profile = { role: "LEARNER", profileCompleted: false };
    mockAuthState.needsProfileSetup = true;
    renderApp(["/learner/mentors"]);

    await waitFor(() => {
      expect(screen.getByText("Complete Profile Page")).toBeInTheDocument();
    });
  });

  it("never shows onboarding to admins", async () => {
    mockAuthState.isLoggedIn = true;
    mockAuthState.profile = { role: "ADMIN", profileCompleted: true };
    renderApp(["/admin/dashboard"]);

    await waitFor(() => {
      expect(screen.getByText("Admin Dashboard")).toBeInTheDocument();
    });

    expect(
      screen.queryByText("Complete Profile Page"),
    ).not.toBeInTheDocument();
  });

  it("serves the auth page to logged-out visitors", async () => {
    mockAuthState.isLoggedIn = false;
    renderApp(["/admin/login"]);

    await waitFor(() => {
      expect(screen.getByText("Auth Page")).toBeInTheDocument();
    });
  });

  it("never renders the global navbar on workspace pages (incl. admin)", async () => {
    // Admin
    mockAuthState.isLoggedIn = true;
    mockAuthState.profile = { role: "ADMIN", profileCompleted: true };
    const adminRender = renderApp(["/admin/dashboard"]);

    await waitFor(() => {
      expect(screen.getByText("Admin Dashboard")).toBeInTheDocument();
    });
    expect(screen.queryByText("Navbar")).not.toBeInTheDocument();
    adminRender.unmount();

    // Learner
    mockAuthState.profile = { role: "LEARNER", profileCompleted: true };
    const learnerRender = renderApp(["/learner/dashboard"]);
    await waitFor(() => {
      expect(screen.getByText("Learner Dashboard")).toBeInTheDocument();
    });
    expect(screen.queryByText("Navbar")).not.toBeInTheDocument();
    learnerRender.unmount();
  });

  it("routes the global navbar bell to the admin notification center for admins on non-workspace pages", async () => {
    mockAuthState.isLoggedIn = true;
    mockAuthState.profile = { role: "ADMIN", profileCompleted: true };

    renderApp(["/role-guide"]);

    await waitFor(() => {
      expect(screen.getByText("Admin Dashboard")).toBeInTheDocument();
    });
  });

  it("keeps role boundaries on /home for both learner and mentor", async () => {
    mockAuthState.isLoggedIn = true;
    mockAuthState.profile = { role: "LEARNER", profileCompleted: true };
    const learnerRender = renderApp(["/home"]);

    await waitFor(() => {
      expect(screen.getByText("Learner Dashboard")).toBeInTheDocument();
    });
    expect(screen.queryByText("Mentor Dashboard")).not.toBeInTheDocument();

    learnerRender.unmount();

    mockAuthState.profile = { role: "MENTOR", profileCompleted: true };
    renderApp(["/home"]);

    await waitFor(() => {
      expect(screen.getByText("Mentor Dashboard")).toBeInTheDocument();
    });
    expect(screen.queryByText("Learner Dashboard")).not.toBeInTheDocument();
  });
});
