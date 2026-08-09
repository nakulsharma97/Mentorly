import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router";
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

  it("closes the Review Details drawer via Escape", async () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <MentorReviewsPage
          profile={{ id: 7, fullName: "Mentor" }}
          notify={() => {}}
        />
      </MemoryRouter>,
    );

    // Wait for reviews to render, then open the drawer from a review card.
    await waitFor(() => {
      expect(screen.getByText("Fantastic session")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Fantastic session"));
    expect(screen.getByText("Review details")).toBeInTheDocument();

    // Escape dismisses the drawer.
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByText("Review details")).not.toBeInTheDocument();
    });
  });

  it("saves a reply optimistically and syncs silently", async () => {
    client.post.mockImplementation((url) =>
      url.startsWith("/api/v1/reviews/1/reply")
        ? Promise.resolve({ data: { data: { id: 1, replyText: "Thanks!" } } })
        : Promise.resolve({ data: { data: {} } }),
    );
    const notify = vi.fn();
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <MentorReviewsPage
          profile={{ id: 7, fullName: "Mentor" }}
          notify={notify}
        />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Fantastic session")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Fantastic session"));
    expect(screen.getByText("Review details")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/write a thoughtful reply/i), {
      target: { value: "Thanks for the feedback!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Reply to review" }));

    // Optimistic — the reply text is visible immediately (drawer + card preview).
    expect(
      screen.getAllByText("Thanks for the feedback!").length,
    ).toBeGreaterThanOrEqual(1);

    await waitFor(() => {
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({ type: "success", title: "Reply saved" }),
      );
    });
  });

  it("rolls back the reply when saving fails", async () => {
    client.post.mockImplementation((url) =>
      url.startsWith("/api/v1/reviews/1/reply")
        ? Promise.reject({
            response: { data: { message: "Could not save your reply" } },
          })
        : Promise.resolve({ data: { data: {} } }),
    );
    const notify = vi.fn();
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <MentorReviewsPage
          profile={{ id: 7, fullName: "Mentor" }}
          notify={notify}
        />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Fantastic session")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Fantastic session"));

    fireEvent.change(screen.getByPlaceholderText(/write a thoughtful reply/i), {
      target: { value: "Thanks!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Reply to review" }));

    await waitFor(() => {
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({ type: "error", title: "Reply failed" }),
      );
    });
    // The optimistic reply is rolled back — the drawer returns to "No reply yet."
    await waitFor(() => {
      expect(screen.getByText("No reply yet.")).toBeInTheDocument();
    });
  });
});
