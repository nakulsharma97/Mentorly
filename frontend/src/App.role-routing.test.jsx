import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
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
}));

vi.mock("./pages/AuthPage", () => ({ default: () => <div>Auth Page</div> }));
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
vi.mock("./pages/MentorProfilePage", () => ({
  default: () => <div>Mentor Profile</div>,
}));
vi.mock("./pages/MessagesPage", () => ({
  default: () => <div>Messages Page</div>,
}));
vi.mock("./pages/NotFoundPage", () => ({
  default: () => <div>Not Found</div>,
}));
vi.mock("./components/Navbar", () => ({ default: () => <div>Navbar</div> }));
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
