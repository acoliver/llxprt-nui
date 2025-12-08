import type { TextareaRenderable } from "@opentui/core";
import { useCallback, useRef, type RefObject } from "react";

type Direction = "up" | "down";

export function usePromptHistory(textareaRef: RefObject<TextareaRenderable | null>): {
  record: (prompt: string) => void;
  handleHistoryKey: (direction: Direction) => boolean;
} {
  const entries = useRef<string[]>([]);
  const index = useRef<number>(0);
  const lastKey = useRef<{ direction: Direction; time: number } | null>(null);

  const record = useCallback((prompt: string) => {
    entries.current.push(prompt);
    index.current = entries.current.length;
  }, []);

  const applyEntry = useCallback(
    (direction: Direction) => {
      if (entries.current.length === 0) {
        return false;
      }
      if (textareaRef.current == null) {
        return false;
      }
      if (direction === "up") {
        index.current = Math.max(0, index.current - 1);
      } else {
        index.current = Math.min(entries.current.length, index.current + 1);
      }
      const value = entries.current[index.current] ?? "";
      textareaRef.current.setText(value);
      textareaRef.current.cursorOffset = value.length;
      return true;
    },
    [textareaRef]
  );

  const handleHistoryKey = useCallback(
    (direction: Direction): boolean => {
      const now = Date.now();
      if (lastKey.current?.direction === direction && now - lastKey.current.time < 400) {
        const applied = applyEntry(direction);
        lastKey.current = null;
        return applied;
      }
      lastKey.current = { direction, time: now };
      return false;
    },
    [applyEntry]
  );

  return { record, handleHistoryKey };
}
