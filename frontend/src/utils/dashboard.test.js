import { describe, expect, it } from "vitest";
import { getBookingStatusMeta, getRoadmapMilestoneCount } from "./dashboard";

describe("dashboard helpers", () => {
  it("normalizes learner booking status labels", () => {
    expect(getBookingStatusMeta({ bookingStatus: "pending" })).toMatchObject({
      label: "Requested",
      action: "Wait for mentor confirmation",
    });
  });

  it("counts roadmap milestones from stored text blocks", () => {
    expect(getRoadmapMilestoneCount({ milestones: "A\nB\nC" })).toBe(3);
  });
});
