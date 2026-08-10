import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import App from "./App";
import client from "./api/client";

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
  createIdempotencyKey: vi.fn(() => "mock-idempotency-key"),
  API_BASE_URL: "http://localhost:8080",
  getActiveAuthToken: vi.fn(() => null),
  extractJwtUserId: vi.fn(() => null),
  persistAuthSession: vi.fn(() => "mock-token"),
  clearAuthSessionState: vi.fn(),
  onMaintenanceMode: vi.fn(() => vi.fn()),
}));

vi.mock("./pages/AuthPage", () => ({ default: () => <div>Auth Page</div> }));
vi.mock("./pages/AdminLoginPage", () => ({
  default: () => <div>Admin Login Page</div>,
}));
vi.mock("./pages/LearnerDashboard", () => ({
  default: () => <div>Learner Dashboard</div>,
}));
vi.mock("./pages/LearnerSessionsPage", () => ({
  default: () => <div>Learner Sessions Page</div>,
}));
vi.mock("./pages/MentorDashboard", () => ({
  default: () => <div>Mentor Dashboard</div>,
}));
vi.mock("./pages/RoleGuide", () => ({ default: () => <div>Role Guide</div> }));
vi.mock("./pages/AnalyticsPage", () => ({
  default: () => <div>Analytics Page</div>,
}));
vi.mock("./pages/ResourcesPage", () => ({
  default: () => <div>Resources Page</div>,
}));
vi.mock("./pages/TeachingPage", () => ({
  default: () => <div>Teaching Page</div>,
}));
vi.mock("./pages/ProfileSetup", () => ({
  default: () => <div>Profile Setup</div>,
}));
vi.mock("./pages/CompleteProfilePage", () => ({
  default: () => <div>Complete Profile Page</div>,
}));
vi.mock("./pages/MentorProfilePage", () => ({
  default: () => <div>Mentor Profile</div>,
}));
vi.mock("./pages/MessagesPage", () => ({
  default: () => <div>Messages Page</div>,
}));
vi.mock("./pages/NotFoundPage", () => ({
  default: () => <div>Not Found</div>,
}));
// Stub the global navbar but keep a clickable bell so tests can verify the
// onOpenNotifications navigation wiring without pulling in real styles/layout.
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
vi.mock("./pages/AdminNotificationsPage", () => ({
  default: () => <div>Admin Notifications Page</div>,
}));
vi.mock("./modules/admin/layouts/AdminLayout", () => {
  const { Outlet } = require("react-router");
  return {
    default: () => (
      <div>
        Admin Layout
        <Outlet />
      </div>
    ),
  };
});
vi.mock("./pages/AdminOperationsPage", () => ({
  default: () => <div>Admin Operations</div>,
}));
vi.mock("./pages/AdminDashboardPage", () => ({
  default: () => <div>Admin Dashboard</div>,
}));
vi.mock("./components/AuthModal", () => ({
  default: () => <div>Auth Modal</div>,
}));

describe("App role routing", () => {
  const mockProfileForRole = (role) => {
    client.get.mockImplementation((url) => {
      if (url === "/api/v1/users/me") {
        return Promise.resolve({
          data: {
            data: {
              id: 1,
              role,
              // Authoritative completion flag under the unified
              // ProfileCompletionService — the old skills/aboutMe heuristic
              // no longer decides onboarding.
              profileCompleted: true,
              skills: role === "MENTOR" ? "Java,Spring Boot" : "React",
              aboutMe: role === "MENTOR" ? "Mentor profile" : "Learner profile",
              githubUrl:
                role === "MENTOR"
                  ? "https://github.com/mentor"
                  : "https://github.com/learner",
              linkedinUrl:
                role === "MENTOR"
                  ? "https://linkedin.com/in/mentor"
                  : "https://linkedin.com/in/learner",
            },
          },
        });
      }
      if (url === "/api/v1/notifications/unread-count") {
        return Promise.resolve({ data: { data: 0 } });
      }
      return Promise.resolve({ data: { message: "OK", data: [] } });
    });
  };

  beforeEach(() => {
    mockProfileForRole("LEARNER");

    client.post.mockResolvedValue({ data: { data: null } });
  });

  const mockNoProfile = () => {
    client.get.mockResolvedValue({ data: { message: "OK", data: null } });
  };

  /** Profile whose server-persisted profileCompleted flag is false. */
  const mockIncompleteProfile = () => {
    client.get.mockImplementation((url) => {
      if (url === "/api/v1/users/me") {
        return Promise.resolve({
          data: {
            data: {
              id: 1,
              role: "LEARNER",
              fullName: "New Learner",
              profileCompleted: false,
            },
          },
        });
      }
      if (url === "/api/v1/notifications/unread-count") {
        return Promise.resolve({ data: { data: 0 } });
      }
      return Promise.resolve({ data: { message: "OK", data: [] } });
    });
  };

  afterEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("does not render the global navbar on the landing page", async () => {
    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        initialEntries={["/"]}
      >
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Auth Page")).toBeInTheDocument();
    });

    expect(screen.queryByText("Navbar")).not.toBeInTheDocument();
  });

  it("redirects learner from /teach to /sessions route", async () => {
    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        initialEntries={["/teach"]}
      >
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Learner Sessions Page")).toBeInTheDocument();
    });

    expect(screen.queryByText("Teaching Page")).not.toBeInTheDocument();
  });

  it("lands learner on learner dashboard after login", async () => {
    mockProfileForRole("LEARNER");

    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        initialEntries={["/login"]}
      >
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Learner Dashboard")).toBeInTheDocument();
    });

    expect(screen.queryByText("Mentor Dashboard")).not.toBeInTheDocument();
  });

  it("lands mentor on mentor dashboard after login", async () => {
    mockProfileForRole("MENTOR");

    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        initialEntries={["/login"]}
      >
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Mentor Dashboard")).toBeInTheDocument();
    });

    expect(screen.queryByText("Learner Dashboard")).not.toBeInTheDocument();
  });

  it("lands admin on admin dashboard after login", async () => {
    mockProfileForRole("ADMIN");

    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        initialEntries={["/login"]}
      >
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Admin Dashboard")).toBeInTheDocument();
    });

    expect(screen.queryByText("Learner Dashboard")).not.toBeInTheDocument();
    expect(screen.queryByText("Mentor Dashboard")).not.toBeInTheDocument();
  });

  it("redirects learner away from admin pages to learner dashboard", async () => {
    mockProfileForRole("LEARNER");

    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        initialEntries={["/admin"]}
      >
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Learner Dashboard")).toBeInTheDocument();
    });

    expect(screen.queryByText("Admin Dashboard")).not.toBeInTheDocument();
  });

  it("redirects admin away from learner and mentor dashboards to admin dashboard", async () => {
    mockProfileForRole("ADMIN");

    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        initialEntries={["/learner/dashboard"]}
      >
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Admin Dashboard")).toBeInTheDocument();
    });

    expect(screen.queryByText("Learner Dashboard")).not.toBeInTheDocument();
    expect(screen.queryByText("Mentor Dashboard")).not.toBeInTheDocument();
  });

  it("routes incomplete learners to the Complete Profile page (no dashboard access)", async () => {
    mockIncompleteProfile();

    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        initialEntries={["/learner/dashboard"]}
      >
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Complete Profile Page")).toBeInTheDocument();
    });

    expect(screen.queryByText("Learner Dashboard")).not.toBeInTheDocument();
  });

  it("blocks every direct URL until the profile is complete (no bypass)", async () => {
    mockIncompleteProfile();

    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        initialEntries={["/learner/mentors"]}
      >
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Complete Profile Page")).toBeInTheDocument();
    });
  });

  it("never shows onboarding to admins", async () => {
    mockProfileForRole("ADMIN");

    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        initialEntries={["/admin/dashboard"]}
      >
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Admin Dashboard")).toBeInTheDocument();
    });

    expect(screen.queryByText("Complete Profile Page")).not.toBeInTheDocument();
  });

  it("serves the admin login page to logged-out visitors", async () => {
    mockNoProfile();

    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        initialEntries={["/admin/login"]}
      >
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Admin Login Page")).toBeInTheDocument();
    });

    expect(screen.queryByText("Auth Page")).not.toBeInTheDocument();
  });

  it("never renders the global navbar on workspace pages (incl. admin)", async () => {
    // Admin — the admin workspace topbar owns the notification bell, which
    // opens the shared NotificationCenter dropdown instead of navigating.
    mockProfileForRole("ADMIN");
    const adminRender = render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        initialEntries={["/admin/dashboard"]}
      >
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Admin Dashboard")).toBeInTheDocument();
    });
    expect(screen.queryByText("Navbar")).not.toBeInTheDocument();
    adminRender.unmount();

    // Learner
    mockProfileForRole("LEARNER");
    const learnerRender = render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        initialEntries={["/learner/dashboard"]}
      >
        <App />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText("Learner Dashboard")).toBeInTheDocument();
    });
    expect(screen.queryByText("Navbar")).not.toBeInTheDocument();
    learnerRender.unmount();
  });

  it("routes the global navbar bell to the admin notification center for admins on non-workspace pages", async () => {
    mockProfileForRole("ADMIN");

    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        initialEntries={["/role-guide"]}
      >
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Role Guide")).toBeInTheDocument();
    });

    // The global navbar bell must NOT drop admins into a learner-only page —
    // it should route to their own notification-center.
    fireEvent.click(screen.getByText("Notifications"));

    await waitFor(() => {
      expect(screen.getByText("Admin Notifications Page")).toBeInTheDocument();
    });
    expect(screen.queryByText("Role Guide")).not.toBeInTheDocument();
  });

  it("keeps role boundaries on /home for both learner and mentor", async () => {
    mockProfileForRole("LEARNER");
    const learnerRender = render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        initialEntries={["/home"]}
      >
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Learner Dashboard")).toBeInTheDocument();
    });
    expect(screen.queryByText("Mentor Dashboard")).not.toBeInTheDocument();

    learnerRender.unmount();

    mockProfileForRole("MENTOR");
    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        initialEntries={["/home"]}
      >
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Mentor Dashboard")).toBeInTheDocument();
    });
    expect(screen.queryByText("Learner Dashboard")).not.toBeInTheDocument();
  });
});
