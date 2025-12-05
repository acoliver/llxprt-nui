import { appendFileSync } from "node:fs";
import path from "node:path";
import type { KeyBinding, KeyEvent, ScrollBoxRenderable, TextareaRenderable } from "@opentui/core";
import type { Dispatch, JSX, RefObject, SetStateAction } from "react";
import { useKeyboard, useRenderer } from "@opentui/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clipboard from "clipboardy";
import { MAX_SUGGESTION_COUNT } from "./suggestions";
import { useCompletionManager, type CompletionSuggestion } from "./completions";
import { buildResponderLine, buildThinkingLine, countWords, maybeBuildToolCalls } from "./responder";
import { secureRandomBetween } from "./random";
import { useModalManager } from "./modalManager";
import { usePromptHistory } from "./history";
type Role = "user" | "responder" | "thinking";
type StreamState = "idle" | "streaming";
interface ChatLine {
  id: string;
  kind: "line";
  role: Role;
  text: string;
}
interface ToolBlock {
  id: string;
  kind: "tool";
  lines: string[];
  isBatch: boolean;
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
  { name: "return", super: true, action: "newline" },
  { name: "kpenter", action: "submit" },
  { name: "kpplus", action: "submit" },
  { name: "linefeed", action: "newline" }
];
function useChatStore(makeLineId: () => string) {
  const [lines, setLines] = useState<(ChatLine | ToolBlock)[]>([]);
  const [promptCount, setPromptCount] = useState(0);
  const [responderWordCount, setResponderWordCount] = useState(0);
  const [streamState, setStreamState] = useState<StreamState>("idle");

  const appendLines = useCallback(
    (role: Role, textLines: string[]) => {
      setLines((prev) => [
        ...prev,
        ...textLines.map((text) => ({
          id: makeLineId(),
          kind: "line" as const,
          role,
          text
        }))
      ]);
    },
    [makeLineId]
  );

  const appendToolBlock = useCallback(
    (tool: { lines: string[]; isBatch: boolean }) => {
      setLines((prev) => [
        ...prev,
        {
          id: makeLineId(),
          kind: "tool",
          lines: tool.lines,
          isBatch: tool.isBatch
        }
      ]);
    },
    [makeLineId]
  );

  return {
    lines,
    appendLines,
    appendToolBlock,
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
  appendToolBlock: (tool: { lines: string[]; isBatch: boolean }) => void,
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
      if (secureRandomBetween(0, 4) === 0) {
        const thoughtCount = secureRandomBetween(1, 2);
        for (let t = 0; t < thoughtCount; t += 1) {
          const thought = buildThinkingLine();
          appendLines("thinking", [thought]);
          setResponderWordCount((count) => count + countWords(thought));
        }
      }
      const toolBlock = maybeBuildToolCalls();
      if (toolBlock) {
        appendToolBlock(toolBlock);
      }
      const line = buildResponderLine();
      appendLines("responder", [line]);
      setResponderWordCount((count) => count + countWords(line));
      await sleep(secureRandomBetween(8, 28));
    }

    if (streamRunId.current === currentRun && mountedRef.current) {
      setStreamState("idle");
    }
  }, [appendLines, appendToolBlock, mountedRef, setResponderWordCount, setStreamState, streamRunId]);
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
  handleCommand: (command: string) => boolean,
  recordHistory: (prompt: string) => void
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
      recordHistory(raw);
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
    recordHistory(raw);
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
  readonly lines: (ChatLine | ToolBlock)[];
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
  readonly onMouseUp?: () => void;
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
          {props.lines.map((entry) =>
            entry.kind === "line" ? renderChatLine(entry) : renderToolBlock(entry)
          )}
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
    <box flexDirection="column" style={{ width: "100%", height: "100%", padding: 1, gap: 1 }} onMouseUp={props.onMouseUp}>
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

function renderChatLine(line: ChatLine): JSX.Element {
  const color = roleColor(line.role);
  return (
    <text key={line.id} fg={color}>
      [{line.role}] {line.text}
    </text>
  );
}

function roleColor(role: Role): string {
  if (role === "user") {
    return "#7dd3fc";
  }
  if (role === "thinking") {
    return "#94a3b8";
  }
  return "#facc15";
}

function renderToolBlock(block: ToolBlock): JSX.Element {
  return (
    <box
      key={block.id}
      border
      style={{
        padding: 1,
        marginTop: 0,
        marginBottom: 0,
        width: "100%",
        flexDirection: "column",
        gap: 0,
        borderStyle: block.isBatch ? "rounded" : "single"
      }}
    >
      {block.lines.map((line, index) => (
        <text key={`${block.id}-line-${index}`} fg="#c084fc">
          {line}
        </text>
      ))}
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
  cancelStreaming: () => void,
  clearInput: () => void,
  isStreaming: () => boolean
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
      if (isStreaming()) {
        cancelStreaming();
      } else {
        clearInput();
      }
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
  const { modalOpen, modalElement, handleCommand } = useModalManager(appendLines, () => textareaRef.current?.focus());

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
    mountedRef
  );

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
    handleCommand,
    recordHistory
  );

  const statusLabel = useMemo(() => buildStatusLabel(streamState, autoFollow), [autoFollow, streamState]);
  const handleMouseUp = useSelectionClipboard(renderer);

  useEnterSubmit(handleSubmit, modalOpen);
  useKeyPressLogging();
  useSuggestionKeybindings(
    modalOpen ? 0 : suggestions.length,
    moveSelection,
    handleTabComplete,
    cancelStreaming,
    () => {
      textareaRef.current?.clear();
      enforceInputLineBounds();
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
        key.preventDefault?.();
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
        handleSubmit={handleSubmit}
        statusLabel={statusLabel}
        promptCount={promptCount}
        responderWordCount={responderWordCount}
        streamState={streamState}
        onScroll={handleMouseScroll}
        onMouseUp={handleMouseUp}
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

function useSelectionClipboard(renderer: unknown): () => void {
  return useCallback(() => {
    const selection = (renderer as { getSelection?: () => { getSelectedText?: () => string | null } | null })?.getSelection?.();
    const text = selection?.getSelectedText?.() ?? "";
    if (!text) {
      return;
    }
    const osc = buildOsc52(text);
    try {
      (renderer as { writeOut?: (chunk: string) => void })?.writeOut?.(osc);
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
