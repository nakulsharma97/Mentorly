import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockNavigate = vi.fn();

vi.mock("react-router", () => ({
  useNavigate: () => mockNavigate,
}));

// Mock usePublicData to control mentor data directly.
const mockPublicData = vi.fn(() => ({
  mentors: [],
  mentorsLoading: false,
  testimonials: [],
  testimonialsLoading: false,
}));
vi.mock("../hooks/usePublicData", () => ({
  default: (...args) => mockPublicData(...args),
}));

// Stub heavy landing sections so the test only exercises the mentor grid.
vi.mock("../components/OptimizedImage", () => ({
  default: () => null,
}));
vi.mock("../components/CommunityStats", () => ({
  default: () => null,
}));
vi.mock("../components/Testimonials", () => ({
  default: () => null,
}));
vi.mock("../components/PremiumFooter", () => ({
  default: () => null,
}));

import AuthPage from "./AuthPage";

const MENTORS = [
  {
    id: 1,
    fullName: "Emma Wilson",
    username: "emma",
    skills: '[{"name":"DevOps","level":"Advanced"},{"name":"AWS","level":"Advanced"}]',
    profileImageUrl: null,
    averageRating: 5.0,
    totalReviews: 1,
    liveNow: false,
  },
  {
    id: 2,
    fullName: "Pritil",
    username: "pritil",
    skills: "Java, Python",
    profileImageUrl: null,
    averageRating: 4.2,
    totalReviews: 3,
    liveNow: true,
  },
];

describe("AuthPage — mentor cards", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // jsdom has no IntersectionObserver. Reveal observed elements immediately
    // (as if already in viewport) so `.is-visible` is applied.
    class IntersectionObserverMock {
      constructor(callback) {
        this.callback = callback;
      }
      observe(element) {
        this.callback(
          [{ isIntersecting: true, target: element }],
          this,
        );
      }
      unobserve() {}
      disconnect() {}
    }
    globalThis.IntersectionObserver = IntersectionObserverMock;

    mockPublicData.mockReturnValue({
      mentors: MENTORS,
      mentorsLoading: false,
      testimonials: [],
      testimonialsLoading: false,
    });
  });

  it("renders real mentor cards and reveals them after loading", async () => {
    const { container } = render(<AuthPage onSelectLogin={vi.fn()} onSelectSignup={vi.fn()} />);

    // Real cards appear with mentors data from usePublicData mock.
    expect(await screen.findByText("Emma Wilson")).toBeInTheDocument();
    expect(screen.getByText("Pritil")).toBeInTheDocument();

    await waitFor(() => {
      const cards = container.querySelectorAll(".landing-mentor-card");
      expect(cards.length).toBe(MENTORS.length);
      cards.forEach((card) => {
        expect(card.classList.contains("is-visible")).toBe(true);
      });
    });
  });

  it("shows a professional empty state when no mentors exist", async () => {
    mockPublicData.mockReturnValue({
      mentors: [],
      mentorsLoading: false,
      testimonials: [],
      testimonialsLoading: false,
    });

    render(<AuthPage onSelectLogin={vi.fn()} onSelectSignup={vi.fn()} />);

    expect(
      await screen.findByText("No verified mentors available yet."),
    ).toBeInTheDocument();
  });
});
