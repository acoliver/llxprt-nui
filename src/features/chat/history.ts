import type { TextareaRenderable } from "@opentui/core";
import { useCallback, useEffect, useRef, type RefObject } from "react";
import type { PersistentHistoryService } from "./persistentHistory";

type Direction = "up" | "down";

export interface UsePromptHistoryOptions {
  /** Optional persistent history service for cross-session history */
  persistentHistory?: PersistentHistoryService | null;
}

export function usePromptHistory(
  textareaRef: RefObject<TextareaRenderable | null>,
  options?: UsePromptHistoryOptions
): {
  record: (prompt: string) => void;
  handleHistoryKey: (direction: Direction) => boolean;
} {
  // Session entries are stored oldest-first for easy navigation
  const sessionEntries = useRef<string[]>([]);
  // Combined history: persistent (newest-first reversed) + session entries
  const combinedEntries = useRef<string[]>([]);
  const index = useRef<number>(0);
  const lastKey = useRef<{ direction: Direction; time: number } | null>(null);
  const persistentHistoryRef = useRef(options?.persistentHistory);

  // Keep ref in sync
  useEffect(() => {
    persistentHistoryRef.current = options?.persistentHistory;
  }, [options?.persistentHistory]);

  // Load persistent history on mount or when service changes
  useEffect(() => {
    const persistent = options?.persistentHistory;
    if (persistent) {
      // Persistent history is newest-first, reverse it for our oldest-first array
      const persistentEntries = [...persistent.getHistory()].reverse();
      combinedEntries.current = [...persistentEntries, ...sessionEntries.current];
      index.current = combinedEntries.current.length;
    } else {
      combinedEntries.current = [...sessionEntries.current];
      index.current = combinedEntries.current.length;
    }
  }, [options?.persistentHistory]);

  const record = useCallback((prompt: string) => {
    // Add to session entries
    sessionEntries.current.push(prompt);

    // Update combined entries
    const persistent = persistentHistoryRef.current;
    if (persistent) {
      const persistentEntries = [...persistent.getHistory()].reverse();
      combinedEntries.current = [...persistentEntries, ...sessionEntries.current];
    } else {
      combinedEntries.current = [...sessionEntries.current];
    }
    index.current = combinedEntries.current.length;

    // Record to persistent storage (async, fire-and-forget)
    if (persistent) {
      void persistent.record(prompt);
    }
  }, []);

  const applyEntry = useCallback(
    (direction: Direction) => {
      if (combinedEntries.current.length === 0) {
        return false;
      }
      if (textareaRef.current == null) {
        return false;
      }
      if (direction === "up") {
        index.current = Math.max(0, index.current - 1);
      } else {
        index.current = Math.min(combinedEntries.current.length, index.current + 1);
      }
      const value = combinedEntries.current[index.current] ?? "";
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
