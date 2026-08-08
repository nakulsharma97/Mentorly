import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import useMentorGate, { resolveMentorGateMode } from "./useMentorGate";

const wrapper = ({ children }) => (
  <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    {children}
  </MemoryRouter>
);

describe("resolveMentorGateMode", () => {
  it("returns null for approved mentors", () => {
    expect(
      resolveMentorGateMode(
        { role: "MENTOR", profileCompleted: true, mentorVerified: true },
        null,
      ),
    ).toBeNull();
  });

  it("returns incomplete when profile is not completed", () => {
    expect(
      resolveMentorGateMode(
        { role: "MENTOR", profileCompleted: false, mentorVerified: false },
        null,
      ),
    ).toBe("incomplete");
  });

  it("returns pending when completed but not verified", () => {
    expect(
      resolveMentorGateMode(
        { role: "MENTOR", profileCompleted: true, mentorVerified: false },
        null,
      ),
    ).toBe("pending");
  });

  it("prefers explicit statuses from the verification API", () => {
    expect(
      resolveMentorGateMode(
        { role: "MENTOR", profileCompleted: true, mentorVerified: false },
        { verificationStatus: "REJECTED" },
      ),
    ).toBe("rejected");
    expect(
      resolveMentorGateMode(
        { role: "MENTOR", profileCompleted: true, mentorVerified: false },
        { verificationStatus: "SUSPENDED" },
      ),
    ).toBe("suspended");
    expect(
      resolveMentorGateMode(
        { role: "MENTOR", profileCompleted: true, mentorVerified: false },
        { verificationStatus: "PENDING" },
      ),
    ).toBe("pending");
    expect(
      resolveMentorGateMode(
        { role: "MENTOR", profileCompleted: true, mentorVerified: false },
        { verificationStatus: "MORE_INFORMATION_REQUIRED" },
      ),
    ).toBe("moreInfo");
  });

  it("returns null for non-mentors", () => {
    expect(resolveMentorGateMode({ role: "LEARNER" }, null)).toBeNull();
    expect(resolveMentorGateMode({ role: "ADMIN" }, null)).toBeNull();
  });
});

describe("useMentorGate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runs the action when the mentor is approved", () => {
    const { result } = renderHook(
      () =>
        useMentorGate(
          { role: "MENTOR", profileCompleted: true, mentorVerified: true },
          null,
        ),
      { wrapper },
    );
    const action = vi.fn();
    act(() => result.current.requestAction(action));
    expect(action).toHaveBeenCalledTimes(1);
    expect(result.current.gate.open).toBe(false);
  });

  it("opens the gate instead of running the action when blocked", () => {
    const { result } = renderHook(
      () =>
        useMentorGate(
          { role: "MENTOR", profileCompleted: false, mentorVerified: false },
          null,
        ),
      { wrapper },
    );
    const action = vi.fn();
    act(() => result.current.requestAction(action));
    expect(action).not.toHaveBeenCalled();
    expect(result.current.gate.open).toBe(true);
    expect(result.current.gate.mode).toBe("incomplete");
    expect(result.current.canUse).toBe(false);
  });

  it("closes the gate", () => {
    const { result } = renderHook(
      () =>
        useMentorGate(
          { role: "MENTOR", profileCompleted: false, mentorVerified: false },
          null,
        ),
      { wrapper },
    );
    act(() => result.current.requestAction(() => {}));
    expect(result.current.gate.open).toBe(true);
    act(() => result.current.gate.onClose());
    expect(result.current.gate.open).toBe(false);
  });
});
