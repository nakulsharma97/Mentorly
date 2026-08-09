import { describe, expect, it } from "vitest";
import { getBookingStatusMeta } from "./dashboard";

describe("dashboard helpers", () => {
  it("normalizes learner booking status labels", () => {
    expect(getBookingStatusMeta({ bookingStatus: "pending" })).toMatchObject({
      label: "Requested",
      action: "Wait for mentor confirmation",
    });
  });
});
