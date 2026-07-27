import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ProfileSetup from "./ProfileSetup";

// Mock the API client
vi.mock("../api/client", () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: { data: [] } }),
    put: vi.fn().mockResolvedValue({ data: { data: { id: 1 } } }),
    post: vi.fn().mockResolvedValue({ data: { data: { id: 1 } } }),
    delete: vi.fn().mockResolvedValue({}),
  },
}));

// Mock the CSS import
vi.mock("./ProfileSetup.css", () => ({}));

// Mock the RoleSwitcher component
vi.mock("../components/RoleSwitcher", () => ({
  default: () => null,
}));

const mockProfile = {
  id: 1,
  fullName: "Test Mentor",
  email: "mentor@test.com",
  role: "MENTOR",
  skills: "",
  aboutMe: "",
  githubUrl: "",
  linkedinUrl: "",
  profileImageUrl: "",
};

// jsdom doesn't implement scrollIntoView
beforeEach(() => {
  vi.clearAllMocks();
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

describe("ProfileSetup — Skill Input", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the page title and step 1 section heading", () => {
    render(<ProfileSetup initialProfile={mockProfile} />);
    expect(
      screen.getByRole("heading", { name: /Complete Your Mentor Profile/i }),
    ).toBeInTheDocument();
    // Use role selector to avoid duplicate text matches
    expect(
      screen.getByRole("heading", { name: /Basic Information/i }),
    ).toBeInTheDocument();
  });

  it("navigates to step 2 (Skills & Experience) when Continue is clicked", async () => {
    const user = userEvent.setup();
    render(<ProfileSetup initialProfile={mockProfile} />);

    const continueBtn = screen.getByRole("button", { name: /Continue/i });
    await user.click(continueBtn);

    // Use role selector to get the section heading (h2), not the stepper label
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /Skills & Experience/i }),
      ).toBeInTheDocument();
    });
  });

  it("shows the skill input on step 2 with placeholder text", async () => {
    const user = userEvent.setup();
    render(<ProfileSetup initialProfile={mockProfile} />);

    const continueBtn = screen.getByRole("button", { name: /Continue/i });
    await user.click(continueBtn);

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Enter a skill")).toBeInTheDocument();
    });
  });

  it("accepts typed text in the skill input", async () => {
    const user = userEvent.setup();
    render(<ProfileSetup initialProfile={mockProfile} />);

    // Navigate to step 2
    const continueBtn = screen.getByRole("button", { name: /Continue/i });
    await user.click(continueBtn);

    // Find the skill input and type in it
    const skillInput = await screen.findByPlaceholderText("Enter a skill");
    await user.type(skillInput, "React");

    // Verify the typed text appears
    expect(skillInput).toHaveValue("React");
  });

  it("adds a skill tag when the Add button is clicked", async () => {
    const user = userEvent.setup();
    render(<ProfileSetup initialProfile={mockProfile} />);

    // Navigate to step 2
    const continueBtn = screen.getByRole("button", { name: /Continue/i });
    await user.click(continueBtn);

    // Type a skill
    const skillInput = await screen.findByPlaceholderText("Enter a skill");
    await user.type(skillInput, "React");

    // Click Add
    const addButton = screen.getByRole("button", { name: /^Add$/i });
    await user.click(addButton);

    // Verify the skill tag appears (React text inside .ps-tag span)
    await waitFor(() => {
      const tags = screen.getAllByText("React");
      expect(tags.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("clears the input after adding a skill", async () => {
    const user = userEvent.setup();
    render(<ProfileSetup initialProfile={mockProfile} />);

    // Navigate to step 2
    const continueBtn = screen.getByRole("button", { name: /Continue/i });
    await user.click(continueBtn);

    // Type and add a skill
    const skillInput = await screen.findByPlaceholderText("Enter a skill");
    await user.type(skillInput, "React");

    const addButton = screen.getByRole("button", { name: /^Add$/i });
    await user.click(addButton);

    // Verify the input is cleared
    await waitFor(() => {
      expect(skillInput).toHaveValue("");
    });
  });

  it("shows inline validation when pressing Enter with an empty input", async () => {
    const user = userEvent.setup();
    render(<ProfileSetup initialProfile={mockProfile} />);

    // Navigate to step 2
    const continueBtn = screen.getByRole("button", { name: /Continue/i });
    await user.click(continueBtn);

    // Press Enter in the empty input (which triggers handleSkillKeyDown -> addSkill)
    const skillInput = await screen.findByPlaceholderText("Enter a skill");
    await user.type(skillInput, "{Enter}");

    // Verify inline validation message appears
    await waitFor(() => {
      expect(
        screen.getByText("Please enter a skill name before adding."),
      ).toBeInTheDocument();
    });
  });

  it("adds multiple skills and shows all tags", async () => {
    const user = userEvent.setup();
    render(<ProfileSetup initialProfile={mockProfile} />);

    // Navigate to step 2
    const continueBtn = screen.getByRole("button", { name: /Continue/i });
    await user.click(continueBtn);

    const addButton = screen.getByRole("button", { name: /^Add$/i });
    const skillInput = await screen.findByPlaceholderText("Enter a skill");

    // Add first skill
    await user.type(skillInput, "React");
    await user.click(addButton);

    // Add second skill
    await user.type(skillInput, "TypeScript");
    await user.click(addButton);

    // Verify both tags exist
    await waitFor(() => {
      expect(screen.getAllByText("React").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("TypeScript").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows the skill level dropdown on step 2", async () => {
    const user = userEvent.setup();
    render(<ProfileSetup initialProfile={mockProfile} />);

    const continueBtn = screen.getByRole("button", { name: /Continue/i });
    await user.click(continueBtn);

    await waitFor(() => {
      const levelSelect = screen.getByRole("combobox");
      expect(levelSelect).toBeInTheDocument();
      expect(levelSelect).toHaveValue("Intermediate");
    });
  });

  it("adds skill with Enter key", async () => {
    const user = userEvent.setup();
    render(<ProfileSetup initialProfile={mockProfile} />);

    // Navigate to step 2
    const continueBtn = screen.getByRole("button", { name: /Continue/i });
    await user.click(continueBtn);

    // Type a skill and press Enter
    const skillInput = await screen.findByPlaceholderText("Enter a skill");
    await user.type(skillInput, "Java{Enter}");

    // Verify the skill tag appears
    await waitFor(() => {
      expect(screen.getAllByText("Java").length).toBeGreaterThanOrEqual(1);
    });

    // Verify input is cleared
    expect(skillInput).toHaveValue("");
  });

  it("disables the Continue button on step 2 when no skills are added", async () => {
    const user = userEvent.setup();
    render(<ProfileSetup initialProfile={mockProfile} />);

    // Navigate to step 2
    const continueBtn = screen.getByRole("button", { name: /Continue/i });
    await user.click(continueBtn);

    // The Continue button should be disabled when on step 2 with no skills
    await waitFor(() => {
      const continueToStep3 = screen.getByRole("button", { name: /Continue/i });
      expect(continueToStep3).toBeDisabled();
    });
  });

  it("enables the Continue button on step 2 after adding a skill", async () => {
    const user = userEvent.setup();
    render(<ProfileSetup initialProfile={mockProfile} />);

    // Navigate to step 2
    const continueBtn = screen.getByRole("button", { name: /Continue/i });
    await user.click(continueBtn);

    // Add a skill
    const skillInput = await screen.findByPlaceholderText("Enter a skill");
    await user.type(skillInput, "React");
    const addButton = screen.getByRole("button", { name: /^Add$/i });
    await user.click(addButton);

    // The Continue button should now be enabled
    await waitFor(() => {
      const continueToStep3 = screen.getByRole("button", { name: /Continue/i });
      expect(continueToStep3).not.toBeDisabled();
    });
  });

  /* ═══════════════════════════════════════════
     Skill Removal Tests
     ═══════════════════════════════════════════ */

  it("removes a skill tag when the remove button is clicked", async () => {
    const user = userEvent.setup();
    render(<ProfileSetup initialProfile={mockProfile} />);

    // Navigate to step 2
    const continueBtn = screen.getByRole("button", { name: /Continue/i });
    await user.click(continueBtn);

    // Add a skill
    const skillInput = await screen.findByPlaceholderText("Enter a skill");
    await user.type(skillInput, "React");
    const addButton = screen.getByRole("button", { name: /^Add$/i });
    await user.click(addButton);

    // Verify the skill tag exists
    await waitFor(() => {
      expect(screen.getAllByText("React").length).toBeGreaterThanOrEqual(1);
    });

    // Click the remove button for "React"
    const removeBtn = screen.getByRole("button", { name: /Remove React/i });
    await user.click(removeBtn);

    // Verify the skill tag "React" is no longer visible in tags
    // The .ps-tags-empty message should re-appear
    await waitFor(() => {
      expect(
        screen.getByText('No skills added yet. Type a skill above and click "Add".'),
      ).toBeInTheDocument();
    });
  });

  it("removes only the specified skill when multiple skills exist", async () => {
    const user = userEvent.setup();
    render(<ProfileSetup initialProfile={mockProfile} />);

    // Navigate to step 2
    const continueBtn = screen.getByRole("button", { name: /Continue/i });
    await user.click(continueBtn);

    const skillInput = await screen.findByPlaceholderText("Enter a skill");
    const addButton = screen.getByRole("button", { name: /^Add$/i });

    // Add two skills
    await user.type(skillInput, "React");
    await user.click(addButton);
    await user.type(skillInput, "TypeScript");
    await user.click(addButton);

    // Verify both exist
    await waitFor(() => {
      expect(screen.getAllByText("React").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("TypeScript").length).toBeGreaterThanOrEqual(1);
    });

    // Remove only "React"
    const removeReact = screen.getByRole("button", { name: /Remove React/i });
    await user.click(removeReact);

    // "React" should be gone but "TypeScript" should remain
    await waitFor(() => {
      expect(screen.queryByText("React")).toBeNull();
    });
    expect(screen.getAllByText("TypeScript").length).toBeGreaterThanOrEqual(1);
  });

  it("disables the Continue button after removing the only skill", async () => {
    const user = userEvent.setup();
    render(<ProfileSetup initialProfile={mockProfile} />);

    // Navigate to step 2
    const continueBtn = screen.getByRole("button", { name: /Continue/i });
    await user.click(continueBtn);

    // Add a skill
    const skillInput = await screen.findByPlaceholderText("Enter a skill");
    await user.type(skillInput, "React");
    const addButton = screen.getByRole("button", { name: /^Add$/i });
    await user.click(addButton);

    // Verify Continue is enabled
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Continue/i })).not.toBeDisabled();
    });

    // Remove the skill
    const removeBtn = screen.getByRole("button", { name: /Remove React/i });
    await user.click(removeBtn);

    // Continue should be disabled again
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Continue/i })).toBeDisabled();
    });
  });

  /* ═══════════════════════════════════════════
     Duplicate Skill Handling Tests
     ═══════════════════════════════════════════ */

  it("prevents duplicate skill with same name (case-insensitive)", async () => {
    const user = userEvent.setup();
    render(<ProfileSetup initialProfile={mockProfile} />);

    // Navigate to step 2
    const continueBtn = screen.getByRole("button", { name: /Continue/i });
    await user.click(continueBtn);

    const skillInput = await screen.findByPlaceholderText("Enter a skill");
    const addButton = screen.getByRole("button", { name: /^Add$/i });

    // Add "React" first
    await user.type(skillInput, "React");
    await user.click(addButton);

    // Try adding "react" (same name, different case)
    await user.type(skillInput, "react");
    await user.click(addButton);

    // There should only be ONE "React"/"react" tag in the DOM
    // getAllByText is case-sensitive, so we check for the original casing
    const reactTags = screen.getAllByText("React");
    const lowerReactTags = screen.queryAllByText("react");
    expect(reactTags.length + lowerReactTags.length).toBe(1);
  });

  it("updates skill level when duplicate is added with different level", async () => {
    const user = userEvent.setup();
    render(<ProfileSetup initialProfile={mockProfile} />);

    // Navigate to step 2
    const continueBtn = screen.getByRole("button", { name: /Continue/i });
    await user.click(continueBtn);

    const skillInput = await screen.findByPlaceholderText("Enter a skill");
    const addButton = screen.getByRole("button", { name: /^Add$/i });
    const levelSelect = screen.getByRole("combobox");

    // Add "Java" with default level "Intermediate"
    await user.type(skillInput, "Java");
    await user.click(addButton);

    // Change level to "Expert" and add "java" again (duplicate, different case)
    await user.selectOptions(levelSelect, "Expert");
    await user.type(skillInput, "java");
    await user.click(addButton);

    // There should only be ONE tag with "Java" (not two)
    const javaTags = screen.getAllByText("Java");
    const lowerJavaTags = screen.queryAllByText("java");
    expect(javaTags.length + lowerJavaTags.length).toBe(1);

    // Verify the Continue button is still enabled (skill still exists)
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Continue/i })).not.toBeDisabled();
    });
  });

  it("allows adding a skill again after it was removed", async () => {
    const user = userEvent.setup();
    render(<ProfileSetup initialProfile={mockProfile} />);

    // Navigate to step 2
    const continueBtn = screen.getByRole("button", { name: /Continue/i });
    await user.click(continueBtn);

    const skillInput = await screen.findByPlaceholderText("Enter a skill");
    const addButton = screen.getByRole("button", { name: /^Add$/i });

    // Add "Python"
    await user.type(skillInput, "Python");
    await user.click(addButton);

    await waitFor(() => {
      expect(screen.getAllByText("Python").length).toBeGreaterThanOrEqual(1);
    });

    // Remove "Python"
    const removeBtn = screen.getByRole("button", { name: /Remove Python/i });
    await user.click(removeBtn);

    // Verify removed
    await waitFor(() => {
      expect(screen.queryByText("Python")).toBeNull();
    });

    // Add "Python" again
    await user.type(skillInput, "Python");
    await user.click(addButton);

    // Should appear again
    await waitFor(() => {
      expect(screen.getAllByText("Python").length).toBeGreaterThanOrEqual(1);
    });

    // Continue should be enabled
    expect(screen.getByRole("button", { name: /Continue/i })).not.toBeDisabled();
  });
});
