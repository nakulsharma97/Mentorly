import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import AdminDashboardPage from "./AdminDashboardPage";
import client from "../api/client";

vi.mock("../api/client", () => ({
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
}));

vi.mock("../modules/common/dashboard/StatsCard", () => ({
  default: ({ icon, label, value, description }) => (
    <div data-testid={`stat-${label}`}>
      <span>{icon}</span>
      <strong>{label}</strong>
      <em>{value}</em>
      <small>{description}</small>
    </div>
  ),
}));

vi.mock("../modules/common/dashboard/SectionCard", () => ({
  default: ({ title, children }) => (
    <section>
      <h3>{title}</h3>
      {children}
    </section>
  ),
}));

vi.mock("../modules/common/dashboard/TrendChart", () => ({
  default: () => <div>TrendChart</div>,
}));

vi.mock("../modules/common/dashboard/Icon", () => ({
  default: ({ name }) => <span>icon:{name}</span>,
}));

const mockDashboardResponse = {
  data: {
    data: {
      signupTrend: [
        { label: "Jan", value: 5 },
        { label: "Feb", value: 8 },
      ],
      sessionTrend: [{ label: "Jan", value: 3 }],
      revenueTrend: [{ label: "Jan", value: 500 }],
      health: {
        totalUsers: 100,
        totalMentors: 20,
        totalLearners: 79,
        totalSessions: 55,
        totalBookings: 60,
        completedSessions: 40,
        completionRate: 72.7,
        activeUsers7d: 33,
        mentorRatio: 20,
        joinedToday: 4,
        joinedThisWeek: 12,
        platformFees: 1500,
        totalReleasedAmount: 12000,
        pendingVerifications: 7,
      },
    },
  },
};

const mockSkillsResponse = { data: { data: [{ id: 1 }, { id: 2 }, { id: 3 }] } };

describe("AdminDashboardPage", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows a loading skeleton while fetching data", () => {
    client.get.mockImplementation(() => new Promise(() => {}));
    render(<AdminDashboardPage notify={() => {}} />);

    expect(screen.getByText(/admin dashboard/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/loading dashboard cards/i)).toBeInTheDocument();
  });

  it("renders the seven KPI cards with real backend values", async () => {
    client.get.mockImplementation((url) => {
      if (url === "/api/v1/admin/dashboard?months=6") {
        return Promise.resolve(mockDashboardResponse);
      }
      if (url === "/api/v1/skills") {
        return Promise.resolve(mockSkillsResponse);
      }
      return Promise.resolve({ data: { data: [] } });
    });

    render(<AdminDashboardPage notify={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText("Total Users")).toBeInTheDocument();
    });

    expect(screen.getByText("Total Users")).toBeInTheDocument();
    expect(screen.getByText("Total Mentors")).toBeInTheDocument();
    expect(screen.getByText("Total Learners")).toBeInTheDocument();
    expect(screen.getByText("Total Skills")).toBeInTheDocument();
    expect(screen.getByText("Total Sessions")).toBeInTheDocument();
    expect(screen.getByText("Completed Bookings")).toBeInTheDocument();
    expect(screen.getByText("Pending Requests")).toBeInTheDocument();

    // Real values (not hardcoded) from the mocked backend responses
    expect(screen.getByText("100")).toBeInTheDocument(); // total users
    expect(screen.getByText("20")).toBeInTheDocument(); // total mentors
    expect(screen.getByText("79")).toBeInTheDocument(); // total learners
    expect(screen.getByText("3")).toBeInTheDocument(); // skills count
    expect(screen.getByText("55")).toBeInTheDocument(); // total sessions (real session count)
    expect(screen.getByText("40")).toBeInTheDocument(); // completed sessions
    expect(screen.getByText("7")).toBeInTheDocument(); // pending requests

    expect(screen.getByText(/signups \(6 months\)/i)).toBeInTheDocument();
    expect(screen.getAllByText("TrendChart").length).toBeGreaterThan(0);
  });

  it("renders an empty state when all metrics are zero", async () => {
    client.get.mockImplementation((url) => {
      if (url === "/api/v1/admin/dashboard?months=6") {
        return Promise.resolve({
          data: {
            data: {
              signupTrend: [],
              sessionTrend: [],
              revenueTrend: [],
              health: {},
            },
          },
        });
      }
      if (url === "/api/v1/skills") {
        return Promise.resolve({ data: { data: [] } });
      }
      return Promise.resolve({ data: { data: [] } });
    });

    render(<AdminDashboardPage notify={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText(/no platform data yet/i)).toBeInTheDocument();
    });
  });

  it("renders an error state and recovers on retry", async () => {
    let shouldFail = true;
    client.get.mockImplementation((url) => {
      if (shouldFail) {
        return Promise.reject({ response: { status: 500 } });
      }
      if (url === "/api/v1/admin/dashboard?months=6") {
        return Promise.resolve(mockDashboardResponse);
      }
      if (url === "/api/v1/skills") {
        return Promise.resolve(mockSkillsResponse);
      }
      return Promise.resolve({ data: { data: [] } });
    });

    const notify = vi.fn();
    render(<AdminDashboardPage notify={notify} />);

    await waitFor(() => {
      expect(screen.getByText(/dashboard unavailable/i)).toBeInTheDocument();
    });
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ type: "error" }),
    );

    // Retry after fixing the backend
    shouldFail = false;
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));

    await waitFor(() => {
      expect(screen.getByText("Total Users")).toBeInTheDocument();
    });
  });
});
