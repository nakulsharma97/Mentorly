import { describe, it, expect } from "vitest";
import { ADMIN_DASHBOARD, messagesPath } from "./routeUtils";

describe("messagesPath", () => {
  it("sends learners to /learner/messages", () => {
    expect(messagesPath("LEARNER")).toBe("/learner/messages");
  });

  it("sends mentors to /mentor/messages", () => {
    expect(messagesPath("MENTOR")).toBe("/mentor/messages");
  });

  it("deep-links to a conversation for both roles", () => {
    expect(messagesPath("LEARNER", 42)).toBe("/learner/messages/42");
    expect(messagesPath("MENTOR", 42)).toBe("/mentor/messages/42");
    expect(messagesPath("MENTOR", "42")).toBe("/mentor/messages/42");
  });

  it("sends admins to their dashboard — they have no messages route", () => {
    expect(messagesPath("ADMIN")).toBe(ADMIN_DASHBOARD);
    expect(messagesPath("ADMIN", 42)).toBe(ADMIN_DASHBOARD);
  });

  it("falls back to the learner path when the role is unknown", () => {
    expect(messagesPath(undefined)).toBe("/learner/messages");
    expect(messagesPath(null, 5)).toBe("/learner/messages/5");
    expect(messagesPath("")).toBe("/learner/messages");
  });

  it("omits the conversation segment when no id is given", () => {
    expect(messagesPath("MENTOR", undefined)).toBe("/mentor/messages");
    expect(messagesPath("MENTOR", "")).toBe("/mentor/messages");
    expect(messagesPath("MENTOR", null)).toBe("/mentor/messages");
  });
});
