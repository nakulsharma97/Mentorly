import { describe, expect, it } from "vitest";
import normalizeSkills, { firstSkill, normalizeSkills as named, skillsMatchQuery } from "./skills";

// normalizeSkills must NEVER throw and must ALWAYS return an array — this is
// the crash-guard behind the Booked Sessions page (mentor.skills is a CSV
// string in production, but can arrive as an array, JSON string, or null).
describe("normalizeSkills", () => {
  it("passes through and cleans real arrays", () => {
    expect(normalizeSkills(["Java", " Spring Boot ", "", "React", null])).toEqual([
      "Java",
      "Spring Boot",
      "React",
    ]);
  });

  it("splits comma-separated CSV strings (the production crash case)", () => {
    expect(normalizeSkills("Java,Spring Boot,React")).toEqual([
      "Java",
      "Spring Boot",
      "React",
    ]);
  });

  it("handles messy delimiters and surrounding whitespace", () => {
    expect(normalizeSkills(" Java ; React\nSQL | AWS ")).toEqual([
      "Java",
      "React",
      "SQL",
      "AWS",
    ]);
  });

  it("parses JSON array strings", () => {
    expect(normalizeSkills('["Java","Spring Boot","React"]')).toEqual([
      "Java",
      "Spring Boot",
      "React",
    ]);
  });

  it("parses object-array JSON strings ({name} shape)", () => {
    expect(normalizeSkills('[{"name":"Java"},{"name":"Spring Boot"}]')).toEqual([
      "Java",
      "Spring Boot",
    ]);
  });

  it("parses JSON object arrays already parsed by JSON.parse callers", () => {
    expect(normalizeSkills([{ name: "Java" }, { label: "React" }])).toEqual([
      "Java",
      "React",
    ]);
  });

  it("handles empty JSON arrays / empty strings gracefully", () => {
    expect(normalizeSkills("[]")).toEqual([]);
    expect(normalizeSkills("[ ]")).toEqual([]);
    expect(normalizeSkills("")).toEqual([]);
    expect(normalizeSkills("   ")).toEqual([]);
  });

  it("returns [] for null, undefined, numbers and plain objects", () => {
    expect(normalizeSkills(null)).toEqual([]);
    expect(normalizeSkills(undefined)).toEqual([]);
    expect(normalizeSkills(42)).toEqual([]);
    expect(normalizeSkills({ not: "an array" })).toEqual([]);
  });

  it("deduplicates case-insensitively", () => {
    expect(normalizeSkills(["React", "react", "REACT"])).toEqual(["React"]);
  });

  it("respects the limit option", () => {
    expect(normalizeSkills("a,b,c,d,e,f", { limit: 4 })).toEqual(["a", "b", "c", "d"]);
  });

  it("flattens nested arrays (legacy recursive splitSkills behavior)", () => {
    expect(normalizeSkills([[["Java", "Spring Boot"]], ["React"]])).toEqual([
      "Java",
      "Spring Boot",
      "React",
    ]);
  });

  it("does not truncate at the old 12-chip cap by default", () => {
    const many = Array.from({ length: 20 }, (_, i) => `Skill ${i + 1}`).join(",");
    expect(normalizeSkills(many).length).toBe(20);
  });

  it("never throws on garbage input", () => {
    expect(() => normalizeSkills('["unclosed')).not.toThrow();
    expect(() => normalizeSkills({ toString: null })).not.toThrow();
  });
});

describe("skillsMatchQuery", () => {
  it("matches normalized skills case-insensitively", () => {
    expect(skillsMatchQuery("Java, Spring Boot", "spring")).toBe(true);
    expect(skillsMatchQuery("Java, Spring Boot", "php")).toBe(false);
  });

  it("returns true when the query is empty", () => {
    expect(skillsMatchQuery(null, "")).toBe(true);
    expect(skillsMatchQuery(null, "   ")).toBe(true);
  });
});

describe("firstSkill", () => {
  it("returns the first skill or the fallback", () => {
    expect(firstSkill("Java, Spring Boot")).toBe("Java");
    expect(firstSkill(null, "No skills available")).toBe("No skills available");
  });
});

// The named export must be the same function (default export compatibility).
it("exposes normalizeSkills as both default and named export", () => {
  expect(named).toBe(normalizeSkills);
});
