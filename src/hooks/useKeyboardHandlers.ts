import type { KeyEvent, TextareaRenderable } from "@opentui/core";
import type { RefObject } from "react";
import { useKeyboard } from "@opentui/react";
import { useCallback, useEffect, useRef } from "react";

function isEnterKey(key: KeyEvent): boolean {
  return (
    key.name === "return" ||
    key.name === "enter" ||
    key.name === "kpenter" ||
    key.sequence === "\r" ||
    key.sequence === "\n"
  );
}

export function useEnterSubmit(onSubmit: () => void, isBlocked: boolean): void {
  useKeyboard((key) => {
    if (!isEnterKey(key) || isBlocked) return;
    const hasModifier = key.shift === true || key.ctrl === true || key.meta === true || key.option === true || key.super === true;
    if (!hasModifier) {
      key.preventDefault();
      onSubmit();
    }
  });
}

export function useFocusAndMount(textareaRef: RefObject<TextareaRenderable | null>, mountedRef: RefObject<boolean>): void {
  useEffect(() => {
    textareaRef.current?.focus();
    return () => {
      mountedRef.current = false;
    };
  }, [mountedRef, textareaRef]);
}

export function useSuggestionKeybindings(
  suggestionCount: number,
  moveSelection: (delta: number) => void,
  handleTabComplete: () => void,
  cancelStreaming: () => void,
  clearInput: () => Promise<void>,
  isStreaming: () => boolean
): void {
  const hasSuggestions = suggestionCount > 0;
  useKeyboard((key) => {
    if (hasSuggestions && key.name === "down") {
      key.preventDefault();
      moveSelection(1);
    } else if (hasSuggestions && key.name === "up") {
      key.preventDefault();
      moveSelection(-1);
    } else if (hasSuggestions && key.name === "tab") {
      key.preventDefault();
      handleTabComplete();
    } else if (key.name === "escape") {
      if (isStreaming()) {
        cancelStreaming();
      } else {
        void clearInput();
      }
    }
  });
}

export function useLineIdGenerator(): () => string {
  const nextLineId = useRef(0);
  return useCallback((): string => {
    nextLineId.current += 1;
    return `line-${nextLineId.current}`;
  }, []);
}

export function useHistoryNavigation(
  modalOpen: boolean,
  suggestionCount: number,
  handleHistoryKey: (direction: "up" | "down") => boolean
): void {
  useKeyboard((key) => {
    if (modalOpen || suggestionCount > 0 || key.eventType !== "press") {
      return;
    }
    if (key.name === "up" || key.name === "down") {
      const handled = handleHistoryKey(key.name);
      if (handled) {
        key.preventDefault();
      }
    }
  });
}
