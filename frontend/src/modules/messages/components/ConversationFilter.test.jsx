import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ConversationFilter from "./ConversationFilter";

describe("ConversationFilter — shared tab bar", () => {
  const onTab = vi.fn();
  const onQuickFilter = vi.fn();
  const onSort = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders every filter tab fully with no truncation markers", () => {
    render(
      <ConversationFilter
        tab="all"
        onTab={onTab}
        quickFilter=""
        onQuickFilter={onQuickFilter}
        sort="recent"
        onSort={onSort}
      />,
    );

    // Every tab label must render in full — never "Mento…" / "Stu…".
    for (const label of ["All", "Unread", "Students", "Mentors", "Archived"]) {
      const btn = screen.getByRole("tab", { name: label });
      expect(btn).toBeInTheDocument();
      expect(btn.textContent).toBe(label);
      expect(btn.className).toContain("ms-tab-v2__btn");
    }
  });

  it("marks the active tab and switches on click", () => {
    render(
      <ConversationFilter
        tab="unread"
        onTab={onTab}
        quickFilter=""
        onQuickFilter={onQuickFilter}
        sort="recent"
        onSort={onSort}
      />,
    );

    const unread = screen.getByRole("tab", { name: "Unread" });
    expect(unread.className).toContain("is-active");
    expect(unread.getAttribute("aria-selected")).toBe("true");

    fireEvent.click(screen.getByRole("tab", { name: "Mentors" }));
    expect(onTab).toHaveBeenCalledWith("mentors");
  });

  it("opens the advanced filter dropdown and toggles quick filters", () => {
    render(
      <ConversationFilter
        tab="all"
        onTab={onTab}
        quickFilter="pinned"
        onQuickFilter={onQuickFilter}
        sort="recent"
        onSort={onSort}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Filter/i }));
    const menu = screen.getByRole("menu");
    expect(menu).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Pinned/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("menuitem", { name: /Blocked/i }));
    expect(onQuickFilter).toHaveBeenCalledWith("blocked");
  });
});
