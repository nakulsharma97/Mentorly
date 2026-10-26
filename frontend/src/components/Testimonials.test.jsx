import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import Testimonials from "./Testimonials";

const mockPublicData = vi.hoisted(() => ({
  testimonials: [],
  testimonialsLoading: false,
}));

vi.mock("../hooks/usePublicData", () => ({
  default: () => ({
    testimonials: mockPublicData.testimonials,
    testimonialsLoading: mockPublicData.testimonialsLoading,
  }),
}));

const sampleReview = {
  reviewId: 1,
  reviewerName: "Jane Doe",
  reviewerRole: "LEARNER",
  reviewerVerified: true,
  completedSwaps: 4,
  skillExchanged: "React",
  reviewText: "Mentorly changed how I learn.",
  reviewDate: "2026-01-15",
  rating: 5,
};

describe("Testimonials — Share your review CTA", () => {
  beforeEach(() => {
    mockPublicData.testimonials = [];
    mockPublicData.testimonialsLoading = false;
  });

  it("shows the CTA in the empty state and forwards clicks to onShareReview", () => {
    const onShareReview = vi.fn();
    render(<Testimonials onShareReview={onShareReview} />);

    const cta = screen.getByRole("button", { name: /share your review/i });
    fireEvent.click(cta);

    expect(onShareReview).toHaveBeenCalledTimes(1);
  });

  it("shows the CTA alongside existing reviews and forwards clicks", () => {
    mockPublicData.testimonials = [sampleReview];
    const onShareReview = vi.fn();
    render(<Testimonials onShareReview={onShareReview} />);

    expect(
      screen.getByText("Mentorly changed how I learn."),
    ).toBeInTheDocument();
    const cta = screen.getByRole("button", { name: /share your review/i });
    fireEvent.click(cta);

    expect(onShareReview).toHaveBeenCalledTimes(1);
  });

  it("does not render the CTA while testimonials are loading", () => {
    mockPublicData.testimonialsLoading = true;
    render(<Testimonials onShareReview={vi.fn()} />);

    expect(
      screen.queryByRole("button", { name: /share your review/i }),
    ).toBeNull();
  });

  // ── React keys — legacy payloads may mix sources with colliding ids ──

  it("renders cards with colliding reviewIds across sources without duplicate-key warnings", () => {
    // The endpoint now returns only SITE rows; older payloads (and the
    // index fallback below) must still render without key collisions.
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockPublicData.testimonials = [
      { ...sampleReview, source: "SITE", reviewText: "A platform review." },
      {
        ...sampleReview,
        source: "SITE",
        reviewId: 2,
        reviewText: "A second platform review.",
      },
    ];
    render(<Testimonials onShareReview={vi.fn()} />);

    expect(screen.getByText("A platform review.")).toBeInTheDocument();
    expect(screen.getByText("A second platform review.")).toBeInTheDocument();
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("keeps keys unique for legacy payloads without a source (index fallback)", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockPublicData.testimonials = [
      { ...sampleReview, reviewText: "First legacy review." },
      { ...sampleReview, reviewText: "Second legacy review." },
    ];
    render(<Testimonials onShareReview={vi.fn()} />);

    expect(screen.getByText("First legacy review.")).toBeInTheDocument();
    expect(screen.getByText("Second legacy review.")).toBeInTheDocument();
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
