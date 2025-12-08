import { describe, expect, it } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useChatStore } from "./useChatStore";

describe("useChatStore role migration", () => {
  let idCounter = 0;
  const makeLineId = () => `test-${idCounter++}`;

  it("should accept system role in appendLines", () => {
    const { result } = renderHook(() => useChatStore(makeLineId));

    act(() => {
      result.current.appendLines("system", ["System notification"]);
    });

    expect(result.current.lines).toHaveLength(1);
    expect(result.current.lines[0]).toMatchObject({
      kind: "line",
      role: "system",
      text: "System notification",
    });
  });

  it("should accept model role in appendLines", () => {
    const { result } = renderHook(() => useChatStore(makeLineId));

    act(() => {
      result.current.appendLines("model", ["Model response"]);
    });

    expect(result.current.lines).toHaveLength(1);
    expect(result.current.lines[0]).toMatchObject({
      kind: "line",
      role: "model",
      text: "Model response",
    });
  });

  it("should store lines with correct role", () => {
    const { result } = renderHook(() => useChatStore(makeLineId));

    act(() => {
      result.current.appendLines("user", ["User input"]);
      result.current.appendLines("model", ["Model response"]);
      result.current.appendLines("thinking", ["Model thinking"]);
      result.current.appendLines("system", ["System message"]);
    });

    expect(result.current.lines).toHaveLength(4);
    expect(result.current.lines[0].role).toBe("user");
    expect(result.current.lines[1].role).toBe("model");
    expect(result.current.lines[2].role).toBe("thinking");
    expect(result.current.lines[3].role).toBe("system");
  });
});
