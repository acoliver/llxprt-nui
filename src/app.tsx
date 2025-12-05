import { appendFileSync } from "node:fs";
import path from "node:path";
import type { KeyBinding, KeyEvent, ScrollBoxRenderable, TextareaRenderable } from "@opentui/core";
import type { Dispatch, JSX, RefObject, SetStateAction } from "react";
import { useKeyboard } from "@opentui/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MAX_SUGGESTION_COUNT } from "./suggestions";
import { useCompletionManager, type CompletionSuggestion } from "./completions";
import { buildResponderLine, countWords, secureRandomBetween } from "./responder";
import { useModalManager } from "./modalManager";
type Role = "user" | "responder";
type StreamState = "idle" | "streaming";
interface ChatLine {
  id: string;
  role: Role;
  text: string;
}
type StateSetter<T> = Dispatch<SetStateAction<T>>;
interface RefHandle<T> {
  current: T;
}

const HEADER_TEXT = "New UI Demo 20251204";
const MIN_INPUT_LINES = 1;
const MAX_INPUT_LINES = 10;
const STREAM_MIN_LINES = 5;
const STREAM_MAX_LINES = 800;
const SCROLL_STEP = 2;
const PAGE_STEP = 10;
const KEY_LOG_PATH = path.resolve(process.cwd(), "key-events.log");

const TEXTAREA_KEY_BINDINGS: KeyBinding[] = [
  { name: "return", action: "submit" },
  { name: "return", shift: true, action: "newline" },
  { name: "return", ctrl: true, action: "newline" },
  { name: "return", meta: true, action: "newline" },
  { name: "return", alt: true, action: "newline" },
  { name: "kpenter", action: "submit" },
  { name: "kpplus", action: "submit" },
  { name: "linefeed", action: "newline" }
];
function useChatStore(makeLineId: () => string) {
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [promptCount, setPromptCount] = useState(0);
  const [responderWordCount, setResponderWordCount] = useState(0);
  const [streamState, setStreamState] = useState<StreamState>("idle");

  const appendLines = useCallback(
    (role: Role, textLines: string[]) => {
      setLines((prev) => [
        ...prev,
        ...textLines.map((text) => ({
          id: makeLineId(),
          role,
          text
        }))
      ]);
    },
    [makeLineId]
  );

  return {
    lines,
    appendLines,
    promptCount,
    setPromptCount,
    responderWordCount,
    setResponderWordCount,
    streamState,
    setStreamState
  };
}

function useStreamingResponder(
  appendLines: (role: Role, textLines: string[]) => void,
  setResponderWordCount: StateSetter<number>,
  setStreamState: StateSetter<StreamState>,
  streamRunId: RefHandle<number>,
  mountedRef: RefHandle<boolean>
) {
  return useCallback(async () => {
    streamRunId.current += 1;
    const currentRun = streamRunId.current;
    setStreamState("streaming");
    const total = secureRandomBetween(STREAM_MIN_LINES, STREAM_MAX_LINES);

    for (let index = 0; index < total; index += 1) {
      if (!mountedRef.current || streamRunId.current !== currentRun) {
        return;
      }
      const line = buildResponderLine();
      appendLines("responder", [line]);
      setResponderWordCount((count) => count + countWords(line));
      await sleep(secureRandomBetween(8, 28));
    }

    if (streamRunId.current === currentRun && mountedRef.current) {
      setStreamState("idle");
    }
  }, [appendLines, mountedRef, setResponderWordCount, setStreamState, streamRunId]);
}

function useInputManager(
  textareaRef: RefObject<TextareaRenderable>,
  appendLines: (role: Role, textLines: string[]) => void,
  setPromptCount: StateSetter<number>,
  setAutoFollow: StateSetter<boolean>,
  startStreamingResponder: () => Promise<void>,
  refreshCompletion: () => void,
  clearCompletion: () => void,
  applyCompletion: () => void,
  handleCommand: (command: string) => boolean
) {
  const [inputLineCount, setInputLineCount] = useState(MIN_INPUT_LINES);

  const enforceInputLineBounds = useCallback(() => {
    const editor = textareaRef.current;
    if (!editor) {
      return;
    }
    const clamped = clampInputLines(editor.lineCount);
    setInputLineCount(clamped);
    refreshCompletion();
  }, [refreshCompletion, textareaRef]);

  const handleSubmit = useCallback(() => {
    const editor = textareaRef.current;
    if (!editor) {
      return;
    }
    const raw = editor.plainText.trimEnd();
    if (raw.trim().length === 0) {
      return;
    }
    const trimmed = raw.trim();
    if (handleCommand(trimmed)) {
      editor.clear();
      setInputLineCount(MIN_INPUT_LINES);
      setAutoFollow(true);
      clearCompletion();
      editor.submit();
      return;
    }
    if (trimmed === "/quit") {
      process.exit(0);
    }
    const userLines = raw.split(/\r?\n/);
    appendLines("user", userLines);
    setPromptCount((count) => count + 1);
    editor.clear();
    setInputLineCount(MIN_INPUT_LINES);
    setAutoFollow(true);
    clearCompletion();
    editor.submit();
    void startStreamingResponder();
  }, [appendLines, clearCompletion, handleCommand, setAutoFollow, setPromptCount, startStreamingResponder, textareaRef]);

  const handleTabComplete = useCallback(
    () => {
      applyCompletion();
      refreshCompletion();
    },
    [applyCompletion, refreshCompletion]
  );

  return { inputLineCount, enforceInputLineBounds, handleSubmit, handleTabComplete };
}

function useScrollManagement(scrollRef: RefObject<ScrollBoxRenderable>) {
  const [autoFollow, setAutoFollow] = useState(true);

  const scrollToBottom = useCallback(() => {
    const scrollBox = scrollRef.current;
    if (!scrollBox) {
      return;
    }
    scrollBox.scrollTo({ x: 0, y: scrollBox.scrollHeight });
  }, [scrollRef]);

  const isAtBottom = useCallback((box: ScrollBoxRenderable): boolean => {
    const viewportHeight = box.viewport.height ?? 0;
    return box.scrollTop + viewportHeight >= box.scrollHeight - 1;
  }, []);

  const scrollBy = useCallback(
    (delta: number) => {
      const scrollBox = scrollRef.current;
      if (!scrollBox) {
        return;
      }
      scrollBox.scrollTo({ x: 0, y: scrollBox.scrollTop + delta });
      if (delta < 0) {
        setAutoFollow(false);
        return;
      }
      setAutoFollow(isAtBottom(scrollBox));
    },
    [isAtBottom, scrollRef]
  );

  const jumpToBottom = useCallback(() => {
    scrollToBottom();
    setAutoFollow(true);
  }, [scrollToBottom]);

  const handleContentChange = useCallback(() => {
    if (autoFollow) {
      scrollToBottom();
    }
  }, [autoFollow, scrollToBottom]);

  const handleMouseScroll = useCallback(
    (event: { type: string }) => {
      if (event.type !== "scroll") {
        return;
      }
      const scrollBox = scrollRef.current;
      if (!scrollBox) {
        return;
      }
      setAutoFollow(isAtBottom(scrollBox));
    },
    [isAtBottom, scrollRef]
  );

  useKeyboard((key) => {
    if (key.name === "pageup" || (key.ctrl && key.name === "up")) {
      scrollBy(-PAGE_STEP);
    } else if (key.name === "pagedown" || (key.ctrl && key.name === "down")) {
      scrollBy(PAGE_STEP);
    } else if (key.name === "end") {
      jumpToBottom();
    } else if (key.name === "home") {
      setAutoFollow(false);
      const scrollBox = scrollRef.current;
      scrollBox?.scrollTo({ y: 0 });
    } else if (key.ctrl && key.name === "b") {
      scrollBy(-SCROLL_STEP);
    } else if (key.ctrl && key.name === "f") {
      scrollBy(SCROLL_STEP);
    }
  });

  return { autoFollow, setAutoFollow, scrollBy, jumpToBottom, handleContentChange, handleMouseScroll };
}

interface ChatLayoutProps {
  readonly headerText: string;
  readonly lines: ChatLine[];
  readonly scrollRef: RefObject<ScrollBoxRenderable>;
  readonly autoFollow: boolean;
  readonly textareaRef: RefObject<TextareaRenderable>;
  readonly inputLineCount: number;
  readonly enforceInputLineBounds: () => void;
  readonly handleSubmit: () => void;
  readonly statusLabel: string;
  readonly promptCount: number;
  readonly responderWordCount: number;
  readonly streamState: StreamState;
  readonly onScroll: (event: { type: string }) => void;
  readonly suggestions: CompletionSuggestion[];
  readonly selectedSuggestion: number;
}

interface InputAreaProps {
  readonly textareaRef: RefObject<TextareaRenderable>;
  readonly containerHeight: number;
  readonly textareaHeight: number;
  readonly handleSubmit: () => void;
  readonly enforceInputLineBounds: () => void;
}

interface SuggestionPanelProps {
  readonly suggestions: CompletionSuggestion[];
  readonly selectedIndex: number;
}

interface ScrollbackProps {
  readonly lines: ChatLine[];
  readonly scrollRef: RefObject<ScrollBoxRenderable>;
  readonly autoFollow: boolean;
  readonly onScroll: (event: { type: string }) => void;
}

interface StatusBarProps {
  readonly statusLabel: string;
  readonly promptCount: number;
  readonly responderWordCount: number;
  readonly streamState: StreamState;
}

function HeaderBar({ text }: { readonly text: string }): JSX.Element {
  return (
    <box style={{ minHeight: 1, maxHeight: 5, border: true, padding: 1 }}>
      <text>{text}</text>
    </box>
  );
}

function ScrollbackView(props: ScrollbackProps): JSX.Element {
  return (
    <scrollbox
      ref={props.scrollRef}
      style={{ flexGrow: 1, border: true, paddingTop: 0, paddingBottom: 0, paddingLeft: 0, paddingRight: 0 }}
      contentOptions={{ paddingLeft: 2, paddingRight: 2 }}
      scrollX={false}
      stickyScroll={props.autoFollow}
      stickyStart="bottom"
      scrollY
      onMouse={props.onScroll}
      focused
    >
      <box flexDirection="column" style={{ gap: 0, width: "100%" }}>
        {props.lines.map((line) => (
          <text key={line.id} fg={line.role === "user" ? "#7dd3fc" : "#facc15"}>
            [{line.role}] {line.text}
          </text>
        ))}
      </box>
    </scrollbox>
  );
}

function InputArea(props: InputAreaProps): JSX.Element {
  return (
    <box
      style={{
        height: props.containerHeight,
        minHeight: MIN_INPUT_LINES + 2,
        maxHeight: MAX_INPUT_LINES + 2,
        border: true,
        paddingTop: 0,
        paddingBottom: 0,
        paddingLeft: 0,
        paddingRight: 0,
        flexDirection: "column",
        gap: 0
      }}
    >
      <textarea
        ref={props.textareaRef}
        focused
        placeholder="Type a thought, then submit with Enter"
        keyBindings={TEXTAREA_KEY_BINDINGS}
        onSubmit={props.handleSubmit}
        onContentChange={props.enforceInputLineBounds}
        onCursorChange={props.enforceInputLineBounds}
        wrapMode="word"
        style={{
          height: props.textareaHeight,
          minHeight: props.textareaHeight,
          maxHeight: props.textareaHeight,
          width: "100%",
          paddingLeft: 1,
          paddingRight: 1,
          paddingTop: 0,
          paddingBottom: 0
        }}
      />
    </box>
  );
}

function SuggestionPanel(props: SuggestionPanelProps): JSX.Element | null {
  if (props.suggestions.length === 0) {
    return null;
  }

  const pageSize = MAX_SUGGESTION_COUNT;
  const totalPages = Math.max(1, Math.ceil(props.suggestions.length / pageSize));
  const pageIndex = Math.floor(props.selectedIndex / pageSize);
  const pageStart = pageIndex * pageSize;
  const pageItems = props.suggestions.slice(pageStart, pageStart + pageSize);
  const maxLabel = pageItems.reduce(
    (max, item) => Math.max(max, item.value.length + (item.mode === "slash" ? 1 : 0)),
    0
  );
  const indicatorNeeded = props.suggestions.length > pageSize;
  const height = pageItems.length + (indicatorNeeded ? 1 : 0);

  return (
    <box
      style={{
        height,
        minHeight: height,
        maxHeight: height,
        paddingLeft: 1,
        paddingRight: 1,
        paddingTop: 0,
        paddingBottom: 0,
        flexDirection: "column"
      }}
    >
      {pageItems.map((item, index) =>
        renderSuggestionRow(item, pageStart + index, props.selectedIndex, maxLabel)
      )}
      {indicatorNeeded ? <text fg="#94a3b8">{`▼ page ${pageIndex + 1}/${totalPages} ▲`}</text> : null}
    </box>
  );
}

function renderSuggestionRow(
  item: CompletionSuggestion,
  globalIndex: number,
  selectedIndex: number,
  maxLabel: number
): JSX.Element {
  const isSelected = globalIndex === selectedIndex;
  const prefix = item.mode === "slash" && item.displayPrefix !== false ? "/" : "";
  const label = `${prefix}${item.value}`.padEnd(maxLabel + 1, " ");
  const description = item.description ? ` ${item.description}` : "";
  const rowText = `${label}${description}`;
  return (
    <text key={`suggestion-${globalIndex}`} bg={isSelected ? "#334155" : undefined} fg={isSelected ? "#a3e635" : undefined}>
      {rowText}
    </text>
  );
}

function StatusBar(props: StatusBarProps): JSX.Element {
  return (
    <box
      style={{ minHeight: 1, maxHeight: 3, paddingLeft: 1, paddingRight: 1, flexDirection: "row", justifyContent: "space-between" }}
    >
      <text>{props.statusLabel}</text>
      <text fg="#a3e635">
        {`prompts: ${props.promptCount} | words: ${props.responderWordCount} | ${props.streamState}`}
      </text>
    </box>
  );
}

function ChatLayout(props: ChatLayoutProps): JSX.Element {
  const visibleInputLines = Math.min(MAX_INPUT_LINES, clampInputLines(props.inputLineCount));
  const containerHeight = Math.min(MAX_INPUT_LINES + 2, Math.max(MIN_INPUT_LINES + 2, visibleInputLines + 2));
  const textareaHeight = Math.max(3, containerHeight - 2);

  return (
    <box flexDirection="column" style={{ width: "100%", height: "100%", padding: 1, gap: 1 }}>
      <HeaderBar text={props.headerText} />
      <ScrollbackView
        lines={props.lines}
        scrollRef={props.scrollRef}
        autoFollow={props.autoFollow}
        onScroll={props.onScroll}
      />
      <InputArea
        textareaRef={props.textareaRef}
        containerHeight={containerHeight}
        textareaHeight={textareaHeight}
        handleSubmit={props.handleSubmit}
        enforceInputLineBounds={props.enforceInputLineBounds}
      />
      <SuggestionPanel suggestions={props.suggestions} selectedIndex={props.selectedSuggestion} />
      <StatusBar
        statusLabel={props.statusLabel}
        promptCount={props.promptCount}
        responderWordCount={props.responderWordCount}
        streamState={props.streamState}
      />
    </box>
  );
}

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
      const hasModifier = key.shift || key.ctrl || key.meta || key.option || key.super;
      if (!hasModifier) {
        key.preventDefault?.();
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

function useFocusAndMount(textareaRef: RefObject<TextareaRenderable>, mountedRef: RefObject<boolean>): void {
  useEffect(() => {
    textareaRef.current?.focus();
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
  cancelStreaming: () => void
): void {
  const hasSuggestions = suggestionCount > 0;
  useKeyboard((key) => {
    if (hasSuggestions && key.name === "down") {
      key.preventDefault?.();
      moveSelection(1);
    } else if (hasSuggestions && key.name === "up") {
      key.preventDefault?.();
      moveSelection(-1);
    } else if (hasSuggestions && key.name === "tab") {
      key.preventDefault?.();
      handleTabComplete();
    } else if (key.name === "escape") {
      cancelStreaming();
    }
  });
}

function buildStatusLabel(streamState: StreamState, autoFollow: boolean): string {
  const streamingPart = streamState === "streaming" ? "streaming" : "waiting";
  const scrollPart = autoFollow ? "follow" : "scroll lock";
  return `${streamingPart} | ${scrollPart}`;
}

function useLineIdGenerator(): () => string {
  const nextLineId = useRef(0);
  return useCallback((): string => {
    nextLineId.current += 1;
    return `line-${nextLineId.current}`;
  }, []);
}

export function App(): JSX.Element {
  const scrollRef = useRef<ScrollBoxRenderable>(null);
  const textareaRef = useRef<TextareaRenderable>(null);
  const streamRunId = useRef(0);
  const mountedRef = useRef(true);
  const { suggestions, selectedIndex, refresh: refreshCompletion, clear: clearCompletion, moveSelection, applySelection } =
    useCompletionManager(textareaRef);

  useFocusAndMount(textareaRef, mountedRef);

  const makeLineId = useLineIdGenerator();

  const { lines, appendLines, promptCount, setPromptCount, responderWordCount, setResponderWordCount, streamState, setStreamState } =
    useChatStore(makeLineId);
  const { modalOpen, modalElement, handleCommand } = useModalManager(appendLines, () => textareaRef.current?.focus());

  const { autoFollow, setAutoFollow, handleContentChange, handleMouseScroll } = useScrollManagement(scrollRef);

  useEffect(() => {
    handleContentChange();
  }, [handleContentChange, lines.length]);

  const startStreamingResponder = useStreamingResponder(appendLines, setResponderWordCount, setStreamState, streamRunId, mountedRef);

  const cancelStreaming = useCallback(() => {
    streamRunId.current += 1;
    setStreamState("idle");
  }, [setStreamState]);

  const { inputLineCount, enforceInputLineBounds, handleSubmit, handleTabComplete } = useInputManager(
    textareaRef,
    appendLines,
    setPromptCount,
    setAutoFollow,
    startStreamingResponder,
    refreshCompletion,
    clearCompletion,
    applySelection,
    handleCommand
  );

  const statusLabel = useMemo(() => buildStatusLabel(streamState, autoFollow), [autoFollow, streamState]);

  useEnterSubmit(handleSubmit, modalOpen);
  useKeyPressLogging();
  useSuggestionKeybindings(modalOpen ? 0 : suggestions.length, moveSelection, handleTabComplete, cancelStreaming);

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
        handleSubmit={handleSubmit}
        statusLabel={statusLabel}
        promptCount={promptCount}
        responderWordCount={responderWordCount}
        streamState={streamState}
        onScroll={handleMouseScroll}
        suggestions={suggestions}
        selectedSuggestion={selectedIndex}
      />
      {modalElement}
    </>
  );
}

function clampInputLines(value: number): number {
  return Math.min(MAX_INPUT_LINES, Math.max(MIN_INPUT_LINES, value));
}
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
