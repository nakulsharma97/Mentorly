import { describe, it, expect, vi, afterEach } from "vitest";
import { readSpringPage, readList, readObject } from "./adminResponses";

const springPage = {
  content: [{ id: 1 }, { id: 2 }],
  totalElements: 7,
  totalPages: 4,
  number: 0,
  size: 2,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("readSpringPage", () => {
  // Regression: GET /api/v1/admin/reports answers with a Spring Page body. The
  // admin Overview/Reports tabs used to assign that object to a list state and
  // then call `.map()` on it → "d.map is not a function" on the live build.
  it("unwraps a Spring Page object into its content array", () => {
    const page = readSpringPage(springPage, "GET /api/v1/admin/reports");
    expect(page.items).toEqual([{ id: 1 }, { id: 2 }]);
    expect(page.totalElements).toBe(7);
    expect(page.totalPages).toBe(4);
    expect(page.page).toBe(0);
    expect(Array.isArray(page.items)).toBe(true);
  });

  it("renders an empty page without throwing", () => {
    const page = readSpringPage(
      { content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 },
      "GET /api/v1/admin/reports",
    );
    expect(page.items).toEqual([]);
    expect(page.totalElements).toBe(0);
    expect(page.totalPages).toBe(0);
  });

  it("derives paging metadata when the page omits it", () => {
    const page = readSpringPage({ content: [{ id: 1 }, { id: 2 }, { id: 3 }] });
    expect(page.totalElements).toBe(3);
    expect(page.size).toBe(3);
    expect(page.totalPages).toBe(1);
  });

  it("accepts a bare list and warns about the contract mismatch", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const page = readSpringPage([{ id: 1 }], "GET /api/v1/admin/reports");
    expect(page.items).toEqual([{ id: 1 }]);
    expect(page.totalElements).toBe(1);
    expect(warn).toHaveBeenCalled();
  });

  it.each([
    ["undefined", undefined],
    ["null", null],
    ["a number", 42],
    ["an object without content", { totalElements: 3 }],
    ["a page with a non-array content", { content: "nope" }],
  ])("returns an empty page for %s", (_label, payload) => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const page = readSpringPage(payload, "GET /api/v1/admin/reports");
    expect(page.items).toEqual([]);
    expect(page.totalElements).toBe(0);
  });
});

describe("readList", () => {
  it("returns the array unchanged for list endpoints", () => {
    expect(readList([{ id: 1 }, { id: 2 }], "GET /api/v1/admin/conversations")).toHaveLength(2);
  });

  it("falls back to an empty array for a page-shaped body and warns", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(readList(springPage, "GET /api/v1/admin/conversations")).toEqual([]);
    expect(warn).toHaveBeenCalled();
  });

  it.each([
    ["undefined", undefined],
    ["null", null],
    ["an object", { message: "nope" }],
    ["a string", "nope"],
  ])("returns an empty array for %s", (_label, payload) => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(readList(payload, "GET /api/v1/admin/conversations")).toEqual([]);
  });
});

describe("readObject", () => {
  it("returns the object body for DTO endpoints", () => {
    expect(readObject({ totalUsers: 4 }, "GET /api/v1/admin/summary")).toEqual({ totalUsers: 4 });
  });

  it.each([
    ["undefined", undefined],
    ["null", null],
    ["an array", [{ totalUsers: 4 }]],
    ["a string", "nope"],
  ])("returns null for %s", (_label, payload) => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(readObject(payload, "GET /api/v1/admin/summary")).toBeNull();
  });
});
