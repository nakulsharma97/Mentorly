import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock react-router ──
// Search params are per-test mutable so deep links (?tab=…&review=…) can be
// exercised without a full router.
const { mockSearchParams } = vi.hoisted(() => ({
  mockSearchParams: { current: new URLSearchParams() },
}));

vi.mock("react-router", () => ({
  Link: ({ children, to, ...props }) => (
    <a href={to} {...props}>{children}</a>
  ),
  useNavigate: () => vi.fn(),
  useSearchParams: () => [mockSearchParams.current, vi.fn()],
}));

// ── Mock API client ──
const mockGet = vi.fn();
const mockPut = vi.fn();
const mockPost = vi.fn();

vi.mock("../api/client", () => ({
  default: {
    get: (...args) => mockGet(...args),
    put: (...args) => mockPut(...args),
    post: (...args) => mockPost(...args),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("../hooks/useToasts", () => ({
  useToasts: () => ({ addToast: vi.fn(), removeToast: vi.fn() }),
}));

vi.mock("./BookingFlowPage", () => ({
  default: () => null,
}));

// ── Import after mocks ──
import LearnerSessionsPage from "./LearnerSessionsPage";

const makeBooking = (id, mentorName, title, overrides = {}) => ({
  id,
  bookingStatus: "CONFIRMED",
  paymentStatus: "PAID",
  totalAmount: "500.00",
  session: {
    id: 1000 + id,
    title,
    startTime: "2099-01-10T10:00:00Z",
    endTime: "2099-01-10T11:00:00Z",
    priceAmount: "500.00",
    currency: "INR",
    meetingLink: "https://meet.google.com/abc-defg-hij",
    sessionSkills: '[{"name":"React"},{"name":"JavaScript"}]',
    mentor: {
      id: 200 + id,
      fullName: mentorName,
      profileImageUrl: null,
      headline: "Senior Engineer",
      skills: "React, JavaScript",
    },
  },
  ...overrides,
});

const bookings = [
  makeBooking(1, "Zoe Carter", "React Fundamentals"),
  makeBooking(2, "Arun Mehta", "System Design Deep Dive"),
];

describe("LearnerSessionsPage — Booked Sessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams.current = new URLSearchParams();
    // apiGet() unwraps only ApiResponse-shaped bodies ({message, data}).
    mockGet.mockImplementation((path) => {
      if (path === "/api/v1/bookings") {
        return Promise.resolve({ data: { message: "ok", data: bookings } });
      }
      // /api/v1/sessions/private and /api/v1/sessions/public
      return Promise.resolve({ data: { message: "ok", data: [] } });
    });
  });

  it("renders the hero search field and both view toggles", async () => {
    render(<LearnerSessionsPage />);
    expect(screen.getByRole("textbox", { name: /search sessions/i })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /list view/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /grid view/i }).length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.getByText("React Fundamentals")).toBeTruthy());
  });

  it("filters booked sessions as you type (case-insensitive) and restores on clear", async () => {
    const user = userEvent.setup();
    render(<LearnerSessionsPage />);
    await waitFor(() => expect(screen.getByText("React Fundamentals")).toBeTruthy());
    expect(screen.getByText("System Design Deep Dive")).toBeTruthy();

    const input = screen.getByRole("textbox", { name: /search sessions/i });
    await user.type(input, "  zoe carter  ");

    await waitFor(() => expect(screen.queryByText("System Design Deep Dive")).toBeNull(), {
      timeout: 2000,
    });
    expect(screen.getByText("React Fundamentals")).toBeTruthy();

    await user.click(screen.getAllByRole("button", { name: /clear search/i })[0]);

    await waitFor(() => expect(screen.getByText("System Design Deep Dive")).toBeTruthy(), {
      timeout: 2000,
    });
  });

  it("shows the no-results empty state when nothing matches", async () => {
    const user = userEvent.setup();
    render(<LearnerSessionsPage />);
    await waitFor(() => expect(screen.getByText("React Fundamentals")).toBeTruthy());

    const input = screen.getByRole("textbox", { name: /search sessions/i });
    await user.type(input, "definitely-not-a-mentor");

    await waitFor(() => expect(screen.getByText(/no .*results/i)).toBeTruthy(), {
      timeout: 2000,
    });
    expect(screen.queryByText("React Fundamentals")).toBeNull();
  });

  it("switches between list and grid layouts", async () => {
    const user = userEvent.setup();
    render(<LearnerSessionsPage />);
    await waitFor(() => expect(screen.getByText("React Fundamentals")).toBeTruthy());

    const gridBtn = screen.getAllByRole("button", { name: /grid view/i })[0];
    const listBtn = screen.getAllByRole("button", { name: /list view/i })[0];

    expect(gridBtn.getAttribute("aria-pressed")).toBe("false");
    expect(listBtn.getAttribute("aria-pressed")).toBe("true");

    await user.click(gridBtn);
    expect(gridBtn.getAttribute("aria-pressed")).toBe("true");
    expect(document.querySelectorAll(".ls-grid").length).toBeGreaterThan(0);
    expect(document.querySelectorAll(".ls-list").length).toBe(0);

    await user.click(listBtn);
    expect(listBtn.getAttribute("aria-pressed")).toBe("true");
    expect(document.querySelectorAll(".ls-list").length).toBeGreaterThan(0);
    expect(document.querySelectorAll(".ls-grid").length).toBe(0);
  });

  it("focuses the search on "/" but ignores the shortcut while typing in a field", async () => {
    render(<LearnerSessionsPage />);
    const input = screen.getByRole("textbox", { name: /search sessions/i });
    await waitFor(() => expect(screen.getByText("React Fundamentals")).toBeTruthy());

    fireEvent.keyDown(document.body, { key: "/" });
    expect(document.activeElement).toBe(input);

    // Typing "/" inside the input must not steal focus or blur the field.
    fireEvent.change(input, { target: { value: "/" } });
    fireEvent.keyDown(input, { key: "/" });
    expect(document.activeElement).toBe(input);
  });
});

describe("LearnerSessionsPage — Share Your Review deep link", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams.current = new URLSearchParams();
    mockGet.mockImplementation((path) => {
      if (path === "/api/v1/bookings") {
        return Promise.resolve({ data: { message: "ok", data: bookings } });
      }
      return Promise.resolve({ data: { message: "ok", data: [] } });
    });
  });

  it("?tab=completed&review=1 opens the Completed tab with review guidance", async () => {
    const completedBooking = makeBooking(3, "Meera Rao", "Advanced React Patterns", {
      bookingStatus: "COMPLETED",
      paymentStatus: "RELEASED",
    });
    mockSearchParams.current = new URLSearchParams("tab=completed&review=1");
    mockGet.mockImplementation((path) => {
      if (path === "/api/v1/bookings") {
        return Promise.resolve({ data: { message: "ok", data: [completedBooking] } });
      }
      return Promise.resolve({ data: { message: "ok", data: [] } });
    });

    render(<LearnerSessionsPage />);
    await waitFor(() => expect(screen.getByText("Advanced React Patterns")).toBeTruthy());

    // The Completed pill is the active tab.
    const activePill = document.querySelector(".ls-pill.is-active");
    expect(activePill).toBeTruthy();
    expect(activePill.textContent).toMatch(/completed/i);

    // Review guidance banner tells the learner to leave a review.
    const banner = screen.getByRole("status");
    expect(banner.textContent).toMatch(/share your experience/i);
    expect(banner.textContent).toMatch(/leave review/i);
  });

  it("?review=1 without a tab defaults to Completed and shows the empty-state guidance", async () => {
    // Default fixtures are all CONFIRMED (upcoming) — no completed sessions.
    mockSearchParams.current = new URLSearchParams("review=1");

    render(<LearnerSessionsPage />);
    // The Completed tab is empty, so wait for the guidance banner itself.
    await waitFor(() =>
      expect(screen.getByText("No completed sessions yet")).toBeTruthy(),
    );

    const activePill = document.querySelector(".ls-pill.is-active");
    expect(activePill).toBeTruthy();
    expect(activePill.textContent).toMatch(/completed/i);

    const banner = screen.getByRole("status");
    expect(banner.textContent).toMatch(/no completed sessions yet/i);
    // Empty state offers a way forward (scoped to the banner — the sidebar
    // also has a "Find Mentors" link).
    const findMentors = banner.querySelector('a[href="/learner/mentors"]');
    expect(findMentors).toBeTruthy();
    expect(findMentors.textContent).toMatch(/find mentors/i);
  });

  it("falls back to the default tab when ?tab= is unknown and shows no banner", async () => {
    mockSearchParams.current = new URLSearchParams("tab=bogus&review=0");

    render(<LearnerSessionsPage />);
    await waitFor(() => expect(screen.getByText("React Fundamentals")).toBeTruthy());

    const activePill = document.querySelector(".ls-pill.is-active");
    expect(activePill).toBeTruthy();
    expect(activePill.textContent).toMatch(/upcoming/i);
    expect(screen.queryByRole("status")).toBeNull();
  });
});
