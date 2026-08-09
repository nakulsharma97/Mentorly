import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { http, HttpResponse } from "msw";
import MentorDashboard from "./MentorDashboard";
import { server } from "../test/mocks/server";

const profile = { fullName: "Mentor Prime" };

function renderMentorDashboard() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <MentorDashboard profile={profile} />
    </MemoryRouter>,
  );
}

describe("MentorDashboard", () => {
  it("renders mentor name with greeting", async () => {
    renderMentorDashboard();

    await waitFor(() => {
      expect(screen.getByText(/Good (Morning|Afternoon|Evening)/i)).toBeInTheDocument();
    });

    const heading = screen.getByText(/Good (Morning|Afternoon|Evening)/i);
    expect(heading.textContent).toContain("Mentor");
  });

  it("renders KPI stat cards from real data", async () => {
    renderMentorDashboard();

    await waitFor(() => {
      expect(screen.getByText("Total Sessions")).toBeInTheDocument();
    });

    expect(screen.getByText("Total Students")).toBeInTheDocument();
    expect(screen.getByText("Rating")).toBeInTheDocument();
    expect(screen.getByText("Earnings")).toBeInTheDocument();

    // Earnings derived from the completed booking (₹1000 − 10% platform fee)
    expect(screen.getAllByText("₹900").length).toBeGreaterThanOrEqual(1);
    // Rating comes from the review summary object
    expect(screen.getByText("4.8")).toBeInTheDocument();
    expect(screen.getByText("1 review")).toBeInTheDocument();
  });

  it("renders upcoming sessions with student names", async () => {
    renderMentorDashboard();

    await waitFor(() => {
      expect(screen.getByText("Upcoming Sessions")).toBeInTheDocument();
    });

    // Accepted future booking (mock id 103) — topic (first session skill) + learner name
    expect(screen.getAllByText("System Design").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Learner Three").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Accepted")).toBeInTheDocument();
  });

  it("renders session requests with accept/decline actions", async () => {
    renderMentorDashboard();

    await waitFor(() => {
      expect(screen.getByText("Session Requests")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Accept" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Decline" })).toBeInTheDocument();
  });

  it("renders session overview donut with status distribution", async () => {
    renderMentorDashboard();

    await waitFor(() => {
      expect(screen.getByText("Session Overview")).toBeInTheDocument();
    });

    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("Upcoming")).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByText("Cancelled")).toBeInTheDocument();
  });

  it("renders recent students", async () => {
    renderMentorDashboard();

    await waitFor(() => {
      expect(screen.getByText("Recent Students")).toBeInTheDocument();
    });

    expect(screen.getAllByText("Learner One").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Learner Two").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Learner Three").length).toBeGreaterThanOrEqual(1);
  });

  it("renders recent reviews from the review summary", async () => {
    renderMentorDashboard();

    await waitFor(() => {
      expect(screen.getByText("Recent Reviews")).toBeInTheDocument();
    });

    expect(screen.getByText("Great session!")).toBeInTheDocument();
  });

  it("renders monthly earnings in INR", async () => {
    renderMentorDashboard();

    await waitFor(() => {
      expect(screen.getAllByText("Monthly Earnings").length).toBeGreaterThanOrEqual(1);
    });

    // Rupee symbol everywhere — no $, USD or credits
    expect(screen.getAllByText("₹900").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/credit|coin|token/i)).not.toBeInTheDocument();
  });

  it("renders invite friends card", async () => {
    renderMentorDashboard();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Invite Friends/i })).toBeInTheDocument();
    });

    expect(
      screen.getByText(/Know someone who wants to learn from experienced mentors/i),
    ).toBeInTheDocument();
  });

  it("accepts a session request in place without reloading", async () => {
    server.use(
      http.patch("*/api/v1/bookings/101/status", () =>
        HttpResponse.json({ data: { id: 101, bookingStatus: "ACCEPTED" } }),
      ),
    );
    const notify = vi.fn();
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <MentorDashboard profile={profile} notify={notify} />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Session Requests")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Accept" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Accept" }));

    // The request card (and its buttons) disappears in place — no reload.
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "Accept" }),
      ).not.toBeInTheDocument();
    });
    expect(
      screen.queryByRole("button", { name: "Decline" }),
    ).not.toBeInTheDocument();
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "success",
        title: "Session request accepted",
      }),
    );
  });

  it("declines a session request in place without reloading", async () => {
    server.use(
      http.patch("*/api/v1/bookings/101/status", () =>
        HttpResponse.json({ data: { id: 101, bookingStatus: "CANCELLED" } }),
      ),
    );
    const notify = vi.fn();
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <MentorDashboard profile={profile} notify={notify} />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Session Requests")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Decline" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Decline" }));

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "Decline" }),
      ).not.toBeInTheDocument();
    });
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "success",
        title: "Session request declined",
      }),
    );
  });

  it("keeps the request and shows an error when accept fails", async () => {
    server.use(
      http.patch("*/api/v1/bookings/101/status", () =>
        HttpResponse.json(
          {
            // Real ApiResponse error shape — the detail is nested in `data`.
            message: "Request failed",
            data: {
              code: "BAD_REQUEST",
              error: "Insufficient wallet balance to accept this booking",
              message: "Insufficient wallet balance to accept this booking",
              retryable: false,
            },
          },
          { status: 400 },
        ),
      ),
    );
    const notify = vi.fn();
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <MentorDashboard profile={profile} notify={notify} />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Accept" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Accept" }));

    await waitFor(() => {
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "error",
          title: "Unable to accept this session request",
          // The real nested backend reason must surface (not the generic
          // "Request failed" wrapper), with the HTTP status for debugging.
          message: expect.stringContaining(
            "Insufficient wallet balance to accept this booking",
          ),
        }),
      );
    });
    // The optimistic update is rolled back — the request must come back.
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Accept" })).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Decline" })).toBeInTheDocument();
  });

  it("shows compact onboarding state when no data exists", async () => {
    server.use(
      http.get("*/api/v1/sessions", () => HttpResponse.json({ data: [] })),
      http.get("*/api/v1/bookings", () => HttpResponse.json({ data: [] })),
      http.get("*/api/v1/reviews/mentor", () =>
        HttpResponse.json({ data: { averageRating: 0, totalReviews: 0, reviews: [] } }),
      ),
    );

    renderMentorDashboard();

    await waitFor(() => {
      expect(
        screen.getByText(/Welcome to Your Mentor Dashboard/i),
      ).toBeInTheDocument();
    });
  });
});
