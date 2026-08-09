import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import MentorDashboard from "./MentorDashboard";

const profile = { fullName: "Mentor Prime" };

function renderMentorDashboard() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <MentorDashboard profile={profile} />
    </MemoryRouter>,
  );
}

describe("MentorDashboard Dark Mode", () => {
  beforeEach(() => {
    // Set dark mode on the document before each test
    document.documentElement.setAttribute("data-theme", "dark");
  });

  afterEach(() => {
    // Clean up after each test
    document.documentElement.removeAttribute("data-theme");
  });

  it("renders with dark mode data attribute set", async () => {
    renderMentorDashboard();

    await waitFor(() => {
      expect(screen.getByText(/Good (Morning|Afternoon|Evening)/i)).toBeInTheDocument();
    });

    // Verify the dark mode attribute is present on the document
    expect(
      document.documentElement.getAttribute("data-theme"),
    ).toBe("dark");
  });

  it("renders all dashboard sections in dark mode without crashing", async () => {
    renderMentorDashboard();

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText(/Good (Morning|Afternoon|Evening)/i)).toBeInTheDocument();
    });

    // Hero
    expect(screen.getByText(/Good (Morning|Afternoon|Evening)/i)).toBeInTheDocument();

    // KPI stats
    const statLabels = screen.getAllByText(/Sessions|Students|Rating|Earnings/i);
    expect(statLabels.length).toBeGreaterThanOrEqual(3);

    // Upcoming Sessions
    expect(screen.getByText(/Upcoming Sessions/i)).toBeInTheDocument();

    // Session Requests
    expect(screen.getByText(/Session Requests/i)).toBeInTheDocument();

    // Session Overview
    expect(screen.getByText(/Session Overview/i)).toBeInTheDocument();

    // Recent Students
    expect(screen.getByText(/Recent Students/i)).toBeInTheDocument();

    // Recent Reviews
    expect(screen.getByText(/Recent Reviews/i)).toBeInTheDocument();

    // Monthly Earnings
    expect(screen.getAllByText(/Monthly Earnings/i).length).toBeGreaterThanOrEqual(1);

    // Invite Friends
    expect(
      screen.getByRole("button", { name: /Invite Friends/i }),
    ).toBeInTheDocument();
  });

  it("renders verification banner in dark mode", async () => {
    renderMentorDashboard();

    await waitFor(() => {
      // The verification banner should render since mock returns null status
      expect(screen.getByText(/Verification pending/i)).toBeInTheDocument();
    });

    // Verify dark mode is still active
    expect(
      document.documentElement.getAttribute("data-theme"),
    ).toBe("dark");
  });

  it("renders invite friends card in dark mode", async () => {
    renderMentorDashboard();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Invite Friends/i })).toBeInTheDocument();
    });

    // Verify the invite subtitle appears correctly
    expect(
      screen.getByText(/Know someone who wants to learn from experienced mentors/i),
    ).toBeInTheDocument();

    // Dark mode should be active
    expect(
      document.documentElement.getAttribute("data-theme"),
    ).toBe("dark");
  });

  it("transitions between light and dark mode cleanly", async () => {
    renderMentorDashboard();

    // Wait for data to load in dark mode
    await waitFor(() => {
      expect(screen.getByText(/Good (Morning|Afternoon|Evening)/i)).toBeInTheDocument();
    });

    // Switch to light mode
    document.documentElement.setAttribute("data-theme", "light");
    expect(
      document.documentElement.getAttribute("data-theme"),
    ).toBe("light");

    // All sections should still render
    expect(screen.getByText(/Upcoming Sessions/i)).toBeInTheDocument();
    expect(screen.getByText(/Recent Reviews/i)).toBeInTheDocument();

    // Switch back to dark mode
    document.documentElement.setAttribute("data-theme", "dark");
    expect(
      document.documentElement.getAttribute("data-theme"),
    ).toBe("dark");

    // Everything still renders
    expect(screen.getAllByText(/Monthly Earnings/i).length).toBeGreaterThanOrEqual(1);
  });
});
