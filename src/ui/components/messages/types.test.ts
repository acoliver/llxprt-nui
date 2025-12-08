import { describe, expect, it } from "vitest";
import type { MessageRole } from "./types";
import { migrateRole } from "./types";

describe("MessageRole type", () => {
  it("should include user role", () => {
    const role: MessageRole = "user";
    expect(role).toBe("user");
  });

  it("should include model role", () => {
    const role: MessageRole = "model";
    expect(role).toBe("model");
  });

  it("should include system role", () => {
    const role: MessageRole = "system";
    expect(role).toBe("system");
  });

  it("should include thinking role", () => {
    const role: MessageRole = "thinking";
    expect(role).toBe("thinking");
  });
});

describe("migrateRole", () => {
  it("should convert responder to model", () => {
    expect(migrateRole("responder")).toBe("model");
  });

  it("should pass through user unchanged", () => {
    expect(migrateRole("user")).toBe("user");
  });

  it("should pass through thinking unchanged", () => {
    expect(migrateRole("thinking")).toBe("thinking");
  });

  it("should pass through system unchanged", () => {
    expect(migrateRole("system")).toBe("system");
  });

  it("should pass through model unchanged", () => {
    expect(migrateRole("model")).toBe("model");
  });
});
