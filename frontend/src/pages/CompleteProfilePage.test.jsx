import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CompleteProfilePage from "./CompleteProfilePage";
import client from "../api/client";

// The page waits ~2.1s on the success screen before calling onCompleted, so
// the redirect assertion needs a generous budget on slower machines.
vi.setConfig({ testTimeout: 20000 });

vi.mock("../api/client", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const mentorProfile = { id: 1, role: "MENTOR", fullName: "Jane Doe" };
const learnerProfile = { id: 2, role: "LEARNER", fullName: "John Doe" };

describe("CompleteProfilePage", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders the onboarding title, subtitle and progress bar", () => {
    render(<CompleteProfilePage profile={mentorProfile} />);

    expect(
      screen.getByRole("heading", { name: "Complete Your Profile" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Please complete your profile before continuing to SkillSwap/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Logout/i })).toBeInTheDocument();
  });

  it("shows mentor-specific required fields", () => {
    render(<CompleteProfilePage profile={mentorProfile} />);

    expect(screen.getByLabelText(/Headline/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Hourly Price/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Portfolio URL/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Years of experience/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Additional months of experience/)).toBeInTheDocument();
  });

  it("shows learner-specific required fields", () => {
    render(<CompleteProfilePage profile={learnerProfile} />);

    expect(screen.getByLabelText(/Learning Goals/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Current Skill Level/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Hourly Price/)).not.toBeInTheDocument();
  });

  it("blocks empty submission with inline validation errors", async () => {
    render(<CompleteProfilePage profile={mentorProfile} />);

    fireEvent.click(
      screen.getByRole("button", { name: /Complete Profile/i }),
    );

    // fullName is prefilled from the profile, so the first empty required
    // field (Profile Photo) is the one flagged inline.
    expect(await screen.findByText("Profile Photo is required.")).toBeInTheDocument();
    expect(client.post).not.toHaveBeenCalled();
  });

  it("starts near 0% progress (prefilled fields count as filled)", () => {
    render(<CompleteProfilePage profile={mentorProfile} />);
    // Section-based mirror of the backend (5 sections × 20%):
    // basic 1/3 (fullName) + experience 1/1 (defaults to 0y/0m, a valid
    // fresher) + contact 1/5 (detected timezone) ≈ 30.7% → 31%.
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "31");
  });

  it("submits a complete profile, shows the success screen, and redirects via onGoDashboard", async () => {
    const onGoDashboard = vi.fn();
    const onViewProfile = vi.fn();
    const notify = vi.fn();
    client.post.mockResolvedValue({
      data: { data: { ...mentorProfile, profileCompleted: true } },
    });

    render(
      <CompleteProfilePage
        profile={mentorProfile}
        onGoDashboard={onGoDashboard}
        onViewProfile={onViewProfile}
        notify={notify}
      />,
    );

    const fill = (label, value) => {
      const el = screen.getByLabelText(new RegExp(label));
      fireEvent.change(el, { target: { value } });
    };

    fill("Profile Photo", "https://example.com/jane.jpg");
    fill("Full Name", "Jane Doe");
    fill("Headline", "React Mentor");
    fill("Bio", "I love teaching React.");
    // Experience: years + months dropdowns (6 years 6 months)
    fireEvent.change(screen.getByLabelText(/Years of experience/), {
      target: { value: "6" },
    });
    fireEvent.change(screen.getByLabelText(/Additional months of experience/), {
      target: { value: "6" },
    });
    expect(screen.getByText(/6 Years 6 Months/)).toBeInTheDocument();
    // Languages: chip input — add two chips
    const langInput = screen.getByPlaceholderText("Type a language and press Enter");
    fireEvent.change(langInput, { target: { value: "English" } });
    fireEvent.click(screen.getByRole("button", { name: /Add language/i }));
    fireEvent.change(langInput, { target: { value: "Hindi" } });
    fireEvent.click(screen.getByRole("button", { name: /Add language/i }));
    expect(screen.getByRole("button", { name: /Remove English/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Remove Hindi/i })).toBeInTheDocument();
    fill("Education", "B.Tech Computer Science");
    fill("LinkedIn URL", "https://linkedin.com/in/jane");
    fill("Portfolio URL", "https://jane.dev");
    fill("Hourly Price", "50");
    fill("Availability", "Weekdays 6-9 PM");
    fill("Country", "India");
    fill("State / Province", "Delhi");
    fill("City", "New Delhi");
    fill("Phone Number", "+91 98765 43210");

    // Add a skill chip
    fireEvent.change(
      screen.getByPlaceholderText("Type a skill and press Enter"),
      { target: { value: "React" } },
    );
    fireEvent.click(screen.getByRole("button", { name: /Add skill/i }));

    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");

    fireEvent.click(
      screen.getByRole("button", { name: /Complete Profile/i }),
    );

    expect(
      await screen.findByText(/Profile Completed Successfully/i),
    ).toBeInTheDocument();

    // Both success CTA buttons are available — no waiting required.
    expect(
      screen.getByRole("button", { name: /Go to Dashboard/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /View Profile/i }),
    ).toBeInTheDocument();

    await waitFor(
      () => expect(onGoDashboard).toHaveBeenCalledTimes(1),
      { timeout: 4000 },
    );

    expect(client.post).toHaveBeenCalledWith(
      "/api/v1/users/me/profile/complete",
      expect.objectContaining({
        fullName: "Jane Doe",
        country: "India",
        skills: expect.stringContaining("React"),
        languages: "English, Hindi",
        yearsOfExperience: 6,
        monthsOfExperience: 6,
      }),
    );
  });
});
