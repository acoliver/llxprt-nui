import { appendFileSync } from "node:fs";
import path from "node:path";
import type { KeyEvent, ScrollBoxRenderable, TextareaRenderable } from "@opentui/core";
import type { JSX, RefObject } from "react";
import { useKeyboard, useRenderer } from "@opentui/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clipboard from "clipboardy";
import { useCompletionManager } from "./completions";
import { useModalManager } from "./modalManager";
import { usePromptHistory } from "./history";
import { findTheme } from "./theme";
import { useThemeManager } from "./themeManager";
import { setThemeSuggestions, setProfileSuggestions } from "./slash";
import type { SessionConfig } from "./llxprtAdapter";
import { listModels, listProviders } from "./llxprtAdapter";
import { applyConfigCommand, listAvailableProfiles, validateSessionConfig } from "./llxprtConfig";
import { useChatStore } from "./hooks/useChatStore";
import { useInputManager } from "./hooks/useInputManager";
import { useScrollManagement } from "./hooks/useScrollManagement";
import { useStreamingResponder } from "./hooks/useStreamingResponder";
import { ChatLayout } from "./components/ChatLayout";
import { buildStatusLabel } from "./components/StatusBar";

const HEADER_TEXT = "LLxprt Code - I'm here to help";
const KEY_LOG_PATH = path.resolve(process.cwd(), "key-events.log");

function isEnterKey(key: KeyEvent): boolean {
  return (
    key.name === "return" ||
    key.name === "enter" ||
    key.name === "kpenter" ||
    key.name === "kpplus" ||
    key.code === "[57415u" ||
    key.code === "[57414u" ||
    key.sequence === "\r" ||
      key.sequence === "\n"
  );
}

function useEnterSubmit(onSubmit: () => void, isBlocked: boolean): void {
  useKeyboard((key) => {
    const isEnterLike = isEnterKey(key);
    if (isEnterLike) {
      logEnterKey(key);
    }
    if (isEnterLike && !isBlocked) {
      const hasModifier = key.shift === true || key.ctrl === true || key.meta === true || key.option === true || key.super === true;
      if (!hasModifier) {
        key.preventDefault();
        onSubmit();
      }
    }
  });
}

function logEnterKey(key: KeyEvent): void {
  try {
    const line = `${new Date().toISOString()}|${key.name}|${key.code ?? ""}|${JSON.stringify(key)}\n`;
    appendFileSync(KEY_LOG_PATH, line, "utf8");
  } catch {
    // ignore logging errors
  }
}

function logAnyKey(key: KeyEvent): void {
  try {
    const line = `${new Date().toISOString()}|${key.name}|${key.code ?? ""}|${key.sequence}|${key.raw}|${
      key.source
    }\n`;
    appendFileSync(KEY_LOG_PATH, line, "utf8");
  } catch {
    // ignore logging errors
  }
}

function useFocusAndMount(textareaRef: RefObject<TextareaRenderable | null>, mountedRef: RefObject<boolean>): void {
  useEffect(() => {
    if (textareaRef.current != null) {
      textareaRef.current.focus();
    }
    return () => {
      mountedRef.current = false;
    };
  }, [mountedRef, textareaRef]);
}

function useKeyPressLogging(): void {
  useKeyboard((key) => {
    if (key.eventType === "press") {
      logAnyKey(key);
    }
  });
}

function useSuggestionKeybindings(
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

function useLineIdGenerator(): () => string {
  const nextLineId = useRef(0);
  return useCallback((): string => {
    nextLineId.current += 1;
    return `line-${nextLineId.current}`;
  }, []);
}

export function App(): JSX.Element {
  const scrollRef = useRef<ScrollBoxRenderable | null>(null);
  const textareaRef = useRef<TextareaRenderable | null>(null);
  const streamRunId = useRef(0);
  const mountedRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);
  const [sessionConfig, setSessionConfig] = useState<SessionConfig>({ provider: "openai" });
  const { themes, theme, setThemeBySlug } = useThemeManager();
  const renderer = useRenderer();
  const { suggestions, selectedIndex, refresh: refreshCompletion, clear: clearCompletion, moveSelection, applySelection } =
    useCompletionManager(textareaRef);
  const { record: recordHistory, handleHistoryKey } = usePromptHistory(textareaRef);

  useFocusAndMount(textareaRef, mountedRef);

  const makeLineId = useLineIdGenerator();

  const {
    lines,
    appendLines,
    appendToolBlock,
    promptCount,
    setPromptCount,
    responderWordCount,
    setResponderWordCount,
    streamState,
    setStreamState
  } = useChatStore(makeLineId);

  useEffect(() => {
    setThemeSuggestions(themes.map((entry) => ({ slug: entry.slug, name: entry.name })));
  }, [themes]);

  useEffect(() => {
    listAvailableProfiles()
      .then((profiles) => setProfileSuggestions(profiles))
      .catch(() => {
        return;
      });
  }, []);

  const fetchModelItems = useCallback(async () => {
    const missing = validateSessionConfig(sessionConfig, { requireModel: false });
    if (missing.length > 0) {
      return { items: [], messages: missing };
    }
    try {
      const models = await listModels(sessionConfig);
      const items = models.map((model) => ({ id: model.id, label: model.name || model.id }));
      return { items };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { items: [], messages: [`Failed to load models: ${message}`] };
    }
  }, [sessionConfig]);

  const fetchProviderItems = useCallback(async () => {
    try {
      const providers = await Promise.resolve(listProviders());
      const items = providers.map((p) => ({ id: p.id, label: p.label }));
      return { items };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { items: [], messages: [`Failed to load providers: ${message}`] };
    }
  }, []);

  const { modalOpen, modalElement, handleCommand: handleModalCommand } = useModalManager(
    appendLines,
    () => {
      if (textareaRef.current != null) {
        textareaRef.current.focus();
      }
    },
    themes,
    theme,
    (next) => setThemeBySlug(next.slug),
    sessionConfig,
    setSessionConfig,
    fetchModelItems,
    fetchProviderItems
  );

  const { autoFollow, setAutoFollow, handleContentChange, handleMouseScroll } = useScrollManagement(scrollRef);

  useEffect(() => {
    handleContentChange();
  }, [handleContentChange, lines.length]);

  const startStreamingResponder = useStreamingResponder(
    appendLines,
    appendToolBlock,
    setResponderWordCount,
    setStreamState,
    streamRunId,
    mountedRef,
    abortRef
  );

  const applyTheme = useCallback(
    (key: string) => {
      const match = findTheme(themes, key);
      if (!match) {
        appendLines("responder", [`Theme not found: ${key}`]);
        return;
      }
      setThemeBySlug(match.slug);
      appendLines("responder", [`Theme set to ${match.name}`]);
    },
    [appendLines, setThemeBySlug, themes]
  );

  const handleCommand = useCallback(
    async (command: string) => {
      const configResult = await applyConfigCommand(command, sessionConfig);
      if (configResult.handled) {
        setSessionConfig(configResult.nextConfig);
        if (configResult.messages.length > 0) {
          appendLines("responder", configResult.messages);
        }
        return true;
      }
      if (command.startsWith("/theme")) {
        const parts = command.trim().split(/\s+/);
        if (parts.length === 1) {
          return handleModalCommand("/theme");
        }
        const target = parts.slice(1).join(" ");
        applyTheme(target);
        return true;
      }
      return handleModalCommand(command);
    },
    [appendLines, applyTheme, handleModalCommand, sessionConfig]
  );

  const cancelStreaming = useCallback(() => {
    streamRunId.current += 1;
    if (abortRef.current != null) {
      abortRef.current.abort();
    }
    setStreamState("idle");
  }, [setStreamState]);

  const { inputLineCount, enforceInputLineBounds, handleSubmit, handleTabComplete } = useInputManager(
    textareaRef,
    appendLines,
    setPromptCount,
    setAutoFollow,
    (prompt) => startStreamingResponder(prompt, sessionConfig),
    refreshCompletion,
    clearCompletion,
    applySelection,
    handleCommand,
    recordHistory
  );

  const statusLabel = useMemo(() => buildStatusLabel(streamState, autoFollow), [autoFollow, streamState]);
  const handleMouseUp = useSelectionClipboard(renderer);

  const handleSubmitWrapped = useCallback(() => {
    void handleSubmit();
  }, [handleSubmit]);

  useEnterSubmit(() => void handleSubmit(), modalOpen);
  useKeyPressLogging();
  useSuggestionKeybindings(
    modalOpen ? 0 : suggestions.length,
    moveSelection,
    handleTabComplete,
    cancelStreaming,
    () => {
      if (textareaRef.current != null) {
        textareaRef.current.clear();
      }
      enforceInputLineBounds();
      return Promise.resolve();
    },
    () => streamState === "streaming"
  );
  useKeyboard((key) => {
    if (modalOpen || suggestions.length > 0 || key.eventType !== "press") {
      return;
    }
    if (key.name === "up" || key.name === "down") {
      const handled = handleHistoryKey(key.name);
      if (handled) {
        key.preventDefault();
      }
    }
  });

  return (
    <>
      <ChatLayout
        headerText={HEADER_TEXT}
        lines={lines}
        scrollRef={scrollRef}
        autoFollow={autoFollow}
        textareaRef={textareaRef}
        inputLineCount={inputLineCount}
        enforceInputLineBounds={enforceInputLineBounds}
        handleSubmit={handleSubmitWrapped}
        statusLabel={statusLabel}
        promptCount={promptCount}
        responderWordCount={responderWordCount}
        streamState={streamState}
        onScroll={handleMouseScroll}
        onMouseUp={handleMouseUp}
        suggestions={suggestions}
        selectedSuggestion={selectedIndex}
        theme={theme}
      />
      {modalElement}
    </>
  );
}

function useSelectionClipboard(renderer: unknown): () => void {
  return useCallback(() => {
    const rendererWithSelection = renderer as { getSelection?: () => { getSelectedText?: () => string | null } | null };
    if (rendererWithSelection.getSelection == null) {
      return;
    }
    const selection = rendererWithSelection.getSelection();
    if (selection?.getSelectedText == null) {
      return;
    }
    const text = selection.getSelectedText() ?? "";
    if (text.length === 0) {
      return;
    }
    const osc = buildOsc52(text);
    try {
      const rendererWithWrite = renderer as { writeOut?: (chunk: string) => void };
      if (rendererWithWrite.writeOut != null) {
        rendererWithWrite.writeOut(osc);
      }
    } catch {
      // ignore renderer write failures
    }
    void clipboard.write(text).catch(() => {
      return;
    });
  }, [renderer]);
}

function buildOsc52(text: string): string {
  const base64 = Buffer.from(text).toString("base64");
  const osc52 = `\u001b]52;c;${base64}\u0007`;
  if (process.env.TMUX) {
    return `\u001bPtmux;\u001b${osc52}\u001b\\`;
  }
  return osc52;
}
