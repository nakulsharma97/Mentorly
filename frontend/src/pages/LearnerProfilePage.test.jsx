import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, it, expect, vi } from "vitest";
import LearnerProfilePage from "./LearnerProfilePage";

vi.mock("./learner-utils", () => ({
  useDocumentTitle: () => {},
  useLearnerLearningData: () => ({
    loading: false,
    error: null,
    data: {
      profile: {
        fullName: "Jane Doe",
        email: "jane@mentorly.test",
        skills: "React, Node.js",
        aboutMe: "Learning full-stack development.",
        profileCompletionPercent: 100,
      },
      certifications: [],
      savedMentors: [],
      savedSkills: [],
    },
  }),
  formatDate: (value) => String(value ?? ""),
}));

const wrapper = ({ children }) => <MemoryRouter>{children}</MemoryRouter>;

describe("LearnerProfilePage — Edit Profile", () => {
  it("shows the learner's current profile data", () => {
    render(<LearnerProfilePage />, { wrapper });

    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText("jane@mentorly.test")).toBeInTheDocument();
    expect(screen.getByText("React, Node.js")).toBeInTheDocument();
  });

  it("renders an Edit Profile button linking to the existing edit form", () => {
    render(<LearnerProfilePage />, { wrapper });

    const link = screen.getByRole("link", { name: /edit profile/i });
    expect(link).toHaveAttribute("href", "/complete-profile");
  });
});
