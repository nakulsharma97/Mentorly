import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import ProfileGateModal from "./ProfileGateModal";

const wrapper = ({ children }) => (
  <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    {children}
  </MemoryRouter>
);

describe("ProfileGateModal", () => {
  it("renders the incomplete-profile gate with Complete Profile CTA", () => {
    const onClose = vi.fn();
    render(
      <ProfileGateModal open mode="incomplete" onClose={onClose} />,
      { wrapper },
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByText("Complete Your Profile First"),
    ).toBeInTheDocument();
    expect(screen.getByText(/must complete your profile/i)).toBeInTheDocument();
    // Primary CTA deep-links to the onboarding page.
    expect(screen.getByRole("link", { name: /Complete Profile/i })).toHaveAttribute(
      "href",
      "/complete-profile",
    );
  });

  it("renders the pending gate with a Pending Verification badge", () => {
    render(<ProfileGateModal open mode="pending" onClose={() => {}} />, {
      wrapper,
    });

    expect(screen.getByText("Verification in Progress")).toBeInTheDocument();
    expect(screen.getByText("Pending Verification")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View Status/i })).toHaveAttribute(
      "href",
      "/mentor/dashboard",
    );
  });

  it("renders the more-info gate with an Update Profile CTA", () => {
    render(<ProfileGateModal open mode="moreInfo" onClose={() => {}} />, {
      wrapper,
    });

    expect(
      screen.getByText("Additional Information Required"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/requested additional information/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Update Profile/i })).toHaveAttribute(
      "href",
      "/complete-profile",
    );
  });

  it("renders the rejected gate", () => {
    render(<ProfileGateModal open mode="rejected" onClose={() => {}} />, {
      wrapper,
    });

    expect(
      screen.getByText("Profile Verification Rejected"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Update Profile/i })).toHaveAttribute(
      "href",
      "/complete-profile",
    );
  });

  it("closes via the X button and Escape", () => {
    const onClose = vi.fn();
    render(
      <ProfileGateModal open mode="incomplete" onClose={onClose} />,
      { wrapper },
    );

    fireEvent.click(screen.getByRole("button", { name: /Close dialog/i }));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("renders nothing when closed", () => {
    const { container } = render(
      <ProfileGateModal open={false} onClose={() => {}} />,
      { wrapper },
    );
    expect(container.firstChild).toBeNull();
  });
});
