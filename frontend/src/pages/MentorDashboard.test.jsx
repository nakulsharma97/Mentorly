import { render, screen, waitFor } from "@testing-library/react";
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

  it("renders pending requests section", async () => {
    renderMentorDashboard();

    await waitFor(() => {
      expect(screen.getByText(/Session Requests/i)).toBeInTheDocument();
    });
  });

  it("renders upcoming sessions stat", async () => {
    renderMentorDashboard();

    await waitFor(() => {
      const sessions = screen.getAllByText("Upcoming Sessions");
      expect(sessions.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("renders average rating stat", async () => {
    renderMentorDashboard();

    await waitFor(() => {
      // Average Rating appears in both hero floating stats and analytics
      const ratings = screen.getAllByText("Average Rating");
      expect(ratings.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("renders referral section with rewards", async () => {
    renderMentorDashboard();

    await waitFor(() => {
      expect(screen.getByText(/Referral Rewards/i)).toBeInTheDocument();
    });

    expect(screen.getByText("SKILLSWAP")).toBeInTheDocument();
    expect(
      screen.getByText(/Friends Referred/i),
    ).toBeInTheDocument();
  });

  it("shows empty state when no sessions exist", async () => {
    server.use(
      http.get("*/api/v1/sessions", () => HttpResponse.json({ data: [] })),
      http.get("*/api/v1/bookings", () => HttpResponse.json({ data: [] })),
      http.get("*/api/v1/reviews/mentor", () => HttpResponse.json({ data: [] })),
    );

    renderMentorDashboard();

    await waitFor(() => {
      expect(
        screen.getByText(/Welcome to Your Mentor Dashboard/i),
      ).toBeInTheDocument();
    });
  });

  it("renders the today's schedule section", async () => {
    renderMentorDashboard();

    await waitFor(() => {
      expect(screen.getByText(/Today's Schedule/i)).toBeInTheDocument();
    });
  });

  it("renders quick action cards", async () => {
    renderMentorDashboard();

    await waitFor(() => {
      const sessions = screen.getAllByText("Create Session");
      expect(sessions.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("renders mentor progress section", async () => {
    renderMentorDashboard();

    await waitFor(() => {
      expect(screen.getByText(/Mentor Progress/i)).toBeInTheDocument();
    });
  });
});
