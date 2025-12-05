import { describe, expect, it } from "vitest";
import { extractSlashContext, getSlashSuggestions } from "./slash";

describe("slash suggestions", () => {
  it("lists root commands on bare slash", () => {
    const suggestions = getSlashSuggestions([], 5);
    expect(suggestions.length).toBeGreaterThan(0);
  });

  it("prioritizes prefix match", () => {
    const suggestions = getSlashSuggestions(["st"], 5);
    expect(suggestions[0]?.value).toBe("stats");
  });

  it("returns children for stats", () => {
    const suggestions = getSlashSuggestions(["stats", "m"], 5);
    expect(suggestions.map((s) => s.value)).toContain("model");
  });

  it("builds full path for stats child", () => {
    const suggestion = getSlashSuggestions(["stats", "mo"], 5).find((s) => s.value === "model");
    expect(suggestion?.fullPath).toBe("/stats model");
  });

  it("returns children for set", () => {
    const suggestions = getSlashSuggestions(["set", "emo"], 5);
    expect(suggestions[0]?.value).toBe("emojifilter");
  });

  it("returns grandchildren for set emojifilter", () => {
    const suggestions = getSlashSuggestions(["set", "emojifilter", "a"], 5);
    expect(suggestions.some((s) => s.value === "auto")).toBe(true);
  });

  it("builds full path for deep set option", () => {
    const suggestion = getSlashSuggestions(["set", "emojifilter", "a"], 5).find((s) => s.value === "auto");
    expect(suggestion?.fullPath).toBe("/set emojifilter auto");
  });

  it("returns empty after completing leaf with trailing space", () => {
    const suggestions = getSlashSuggestions(["set", "emojifilter", "auto", ""], 5);
    expect(suggestions).toHaveLength(0);
  });
});

describe("extractSlashContext", () => {
  it("extracts at start of line", () => {
    const ctx = extractSlashContext("/st", 3);
    expect(ctx?.parts).toEqual(["st"]);
  });

  it("returns null when not preceded by space boundary", () => {
    expect(extractSlashContext("test/st", 6)).toBeNull();
  });
});
