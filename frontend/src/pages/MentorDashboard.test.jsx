import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { http, HttpResponse } from "msw";
import MentorDashboard from "./MentorDashboard";
import { server } from "../test/mocks/server";

const profile = { fullName: "Mentor Prime" };

function renderMentorDashboard() {
  return render(
    <MemoryRouter>
      <MentorDashboard profile={profile} />
    </MemoryRouter>,
  );
}

describe("MentorDashboard", () => {
  it("renders mentor name from profile prop", async () => {
    renderMentorDashboard();

    await waitFor(() => {
      expect(screen.getByText(/Welcome back/i)).toBeInTheDocument();
    });

    // The heading contains "Welcome back, Mentor" split across elements
    const heading = screen.getByRole('heading', { name: /Welcome back/i });
    expect(heading.textContent).toContain('Mentor');
  });

  it("renders pending requests section", async () => {
    renderMentorDashboard();

    await waitFor(() => {
      expect(screen.getByText(/Pending Requests/i)).toBeInTheDocument();
    });
  });

  it("renders total sessions stat", async () => {
    renderMentorDashboard();

    await waitFor(() => {
      expect(screen.getByText("Total Sessions")).toBeInTheDocument();
    });
  });

  it("renders average rating stat", async () => {
    renderMentorDashboard();

    await waitFor(() => {
      expect(screen.getByText("Average Rating")).toBeInTheDocument();
    });
  });

  it("renders referral section with rewards", async () => {
    renderMentorDashboard();

    await waitFor(() => {
      expect(screen.getByText(/Referral Rewards/i)).toBeInTheDocument();
    });

    expect(screen.getByText("SKILLSWAP")).toBeInTheDocument();
    expect(
      screen.getByText(/Invite Learners, Earn Credits/i),
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
});
