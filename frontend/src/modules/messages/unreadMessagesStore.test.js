import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getUnreadMessages,
  setUnreadMessages,
  subscribeUnreadMessages,
  formatUnreadCount,
  formatTabTitle,
} from "./unreadMessagesStore";

describe("unreadMessagesStore", () => {
  beforeEach(() => {
    // reset store state between tests
    setUnreadMessages(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts at zero", () => {
    expect(getUnreadMessages()).toBe(0);
  });

  it("stores the count and clamps negatives", () => {
    setUnreadMessages(5);
    expect(getUnreadMessages()).toBe(5);
    setUnreadMessages(-3);
    expect(getUnreadMessages()).toBe(0);
    setUnreadMessages("7");
    expect(getUnreadMessages()).toBe(7);
  });

  it("notifies subscribers on change", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeUnreadMessages(listener);
    // subscription fires immediately with the current value
    expect(listener).toHaveBeenCalledWith(0);

    setUnreadMessages(3);
    expect(listener).toHaveBeenLastCalledWith(3);

    unsubscribe();
    setUnreadMessages(9);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("does not notify when the value is unchanged", () => {
    setUnreadMessages(4);
    const listener = vi.fn();
    subscribeUnreadMessages(listener);
    listener.mockClear();

    setUnreadMessages(4);
    expect(listener).not.toHaveBeenCalled();
  });

  it("formats counts with a 99+ cap", () => {
    expect(formatUnreadCount(1)).toBe("1");
    expect(formatUnreadCount(99)).toBe("99");
    expect(formatUnreadCount(100)).toBe("99+");
    expect(formatUnreadCount(0)).toBe("0");
    expect(formatUnreadCount(undefined)).toBe("0");
  });

  it("leaves the tab title untouched when there are no unread messages", () => {
    expect(formatTabTitle("Reviews & Ratings | Mentorly Mentor", 0)).toBe(
      "Reviews & Ratings | Mentorly Mentor",
    );
    expect(formatTabTitle("", 0)).toBe("Mentorly");
  });

  it("prefixes the tab title with the unread count", () => {
    expect(formatTabTitle("Dashboard | Mentorly", 3)).toBe(
      "(3) Dashboard | Mentorly",
    );
    expect(formatTabTitle("Dashboard | Mentorly", 150)).toBe(
      "(99+) Dashboard | Mentorly",
    );
  });

  it("strips a stale prefix before re-applying (idempotent)", () => {
    expect(formatTabTitle("(3) Dashboard | Mentorly", 5)).toBe(
      "(5) Dashboard | Mentorly",
    );
    expect(formatTabTitle("(99+) Dashboard | Mentorly", 0)).toBe(
      "Dashboard | Mentorly",
    );
    expect(formatTabTitle("(3) Dashboard | Mentorly", 3)).toBe(
      "(3) Dashboard | Mentorly",
    );
  });
});
