import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MentorReviewsPage from "./MentorReviewsPage";
import client from "../api/client";

vi.mock("../api/client", () => ({
  createIdempotencyKey: (prefix = "req") => `${prefix}-test-key`,
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

describe("MentorReviewsPage", () => {
  beforeEach(() => {
    client.get.mockReset();
    client.post.mockReset();
    client.patch.mockReset();

    client.get.mockImplementation((url) => {
      if (url.startsWith("/api/v1/reviews/mentor")) {
        return Promise.resolve({
          data: {
            data: {
              averageRating: 4.8,
              totalReviews: 2,
              recommendationRate: 95,
              fiveStarReviews: 1,
              distribution: { 5: 1, 4: 1 },
              reviews: [
                {
                  id: 1,
                  learnerName: "Ada",
                  rating: 5,
                  comment: "Fantastic session",
                  createdAt: "2026-01-01T00:00:00Z",
                  sessionTitle: "Interview prep",
                  skillName: "System design",
                  learnerVerified: true,
                  replyText: null,
                },
              ],
              page: 0,
              size: 10,
              totalPages: 1,
              totalElements: 2,
            },
          },
        });
      }
      return Promise.resolve({ data: { data: [] } });
    });
  });

  it("renders the reviews overview and summary cards", async () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <MentorReviewsPage
          profile={{ id: 7, fullName: "Mentor" }}
          notify={() => {}}
        />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /Reviews & Ratings/i }),
      ).toBeInTheDocument();
    });

    expect(screen.getByText("Average Rating")).toBeInTheDocument();
    expect(screen.getByText("Total Reviews")).toBeInTheDocument();
    expect(screen.getByText("Recommendation Rate")).toBeInTheDocument();
  });
});
