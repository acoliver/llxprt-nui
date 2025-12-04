import { randomInt } from "node:crypto";
import type { KeyBinding, ScrollBoxRenderable, TextareaRenderable } from "@opentui/core";
import type { Dispatch, JSX, RefObject, SetStateAction } from "react";
import { useKeyboard } from "@opentui/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

const TEXTAREA_KEY_BINDINGS: KeyBinding[] = [
  { name: "return", action: "submit" },
  { name: "return", shift: true, action: "newline" },
  { name: "return", ctrl: true, action: "newline" },
  { name: "return", meta: true, action: "newline" },
  { name: "return", alt: true, action: "newline" },
  { name: "linefeed", action: "newline" }
];

const OPENERS = [
  "Camus shrugs at the sky,",
  "Nietzsche laughs in the dark,",
  "The void hums quietly while",
  "A hedonist clinks a glass because",
  "Sisyphus pauses mid-push as",
  "Dionysus sings over static and"
];

const DRIVERS = [
  "meaning is negotiated then forgotten,",
  "willpower tastes like rusted metal,",
  "pleasure is an act of rebellion,",
  "every rule is a rumor,",
  "the abyss wants a conversation,",
  "time is a joke with a long punchline,"
];

const SPINS = [
  "so I dance anyway.",
  "yet we still buy coffee at dawn.",
  "and the night market keeps buzzing.",
  "because absurd joy is cheaper than despair.",
  "while the sea keeps no memory.",
  "so breath becomes a quiet manifesto."
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
  startStreamingResponder: () => Promise<void>
) {
  const [inputLineCount, setInputLineCount] = useState(MIN_INPUT_LINES);

  const enforceInputLineBounds = useCallback(() => {
    const editor = textareaRef.current;
    if (!editor) {
      return;
    }
    const clamped = clampInputLines(editor.lineCount);
    setInputLineCount(clamped);

    if (editor.lineCount > MAX_INPUT_LINES) {
      const limited = editor.plainText.split(/\r?\n/).slice(0, MAX_INPUT_LINES).join("\n");
      editor.setText(limited);
      editor.gotoBufferEnd();
    }
  }, [textareaRef]);

  const handleSubmit = useCallback(() => {
    const editor = textareaRef.current;
    if (!editor) {
      return;
    }
    const raw = editor.plainText.trimEnd();
    if (raw.trim().length === 0) {
      return;
    }
    if (raw.trim() === "/quit") {
      process.exit(0);
    }
    const userLines = raw.split(/\r?\n/).slice(0, MAX_INPUT_LINES);
    appendLines("user", userLines);
    setPromptCount((count) => count + 1);
    editor.clear();
    setInputLineCount(MIN_INPUT_LINES);
    setAutoFollow(true);
    editor.submit();
    void startStreamingResponder();
  }, [appendLines, setAutoFollow, setPromptCount, startStreamingResponder, textareaRef]);

  return { inputLineCount, enforceInputLineBounds, handleSubmit };
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
}

function ChatLayout(props: ChatLayoutProps): JSX.Element {
  const visibleInputLines = Math.min(MAX_INPUT_LINES, clampInputLines(props.inputLineCount));
  const inputContainerHeight = Math.min(MAX_INPUT_LINES + 2, Math.max(MIN_INPUT_LINES + 2, visibleInputLines + 2));

  return (
    <box flexDirection="column" style={{ width: "100%", height: "100%", padding: 1, gap: 1 }}>
      <box style={{ minHeight: 1, maxHeight: 5, border: true, padding: 1 }}>
        <text>{props.headerText}</text>
      </box>
      <scrollbox
        ref={props.scrollRef}
        style={{
          flexGrow: 1,
          border: true,
          paddingTop: 0,
          paddingBottom: 0,
          paddingLeft: 0,
          paddingRight: 0
        }}
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
      <box
        style={{
          height: inputContainerHeight,
          minHeight: MIN_INPUT_LINES + 2,
          maxHeight: MAX_INPUT_LINES + 2,
          border: true,
          padding: 1,
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
          wrapMode="word"
          style={{
            height: "100%",
            width: "100%",
            minHeight: "100%",
            paddingLeft: 1,
            paddingRight: 1
          }}
        />
      </box>
      <box
        style={{
          minHeight: 1,
          maxHeight: 3,
          paddingLeft: 1,
          paddingRight: 1,
          flexDirection: "row",
          justifyContent: "space-between"
        }}
      >
        <text>{props.statusLabel}</text>
        <text fg="#a3e635">
          {`prompts: ${props.promptCount} | words: ${props.responderWordCount} | ${props.streamState}`}
        </text>
      </box>
    </box>
  );
}

function useEnterSubmit(onSubmit: () => void): void {
  useKeyboard((key) => {
    if (key.name === "return" || key.name === "enter") {
      const hasModifier = key.shift || key.ctrl || key.meta || key.option || key.super;
      if (!hasModifier) {
        key.preventDefault?.();
        onSubmit();
      }
    }
  });
}

export function App(): JSX.Element {
  const scrollRef = useRef<ScrollBoxRenderable>(null);
  const textareaRef = useRef<TextareaRenderable>(null);
  const streamRunId = useRef(0);
  const nextLineId = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    textareaRef.current?.focus();
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const makeLineId = useCallback((): string => {
    nextLineId.current += 1;
    return `line-${nextLineId.current}`;
  }, []);

  const {
    lines,
    appendLines,
    promptCount,
    setPromptCount,
    responderWordCount,
    setResponderWordCount,
    streamState,
    setStreamState
  } = useChatStore(makeLineId);

  const { autoFollow, setAutoFollow, handleContentChange, handleMouseScroll } = useScrollManagement(scrollRef);

  useEffect(() => {
    handleContentChange();
  }, [handleContentChange, lines.length]);

  const startStreamingResponder = useStreamingResponder(
    appendLines,
    setResponderWordCount,
    setStreamState,
    streamRunId,
    mountedRef
  );

  const { inputLineCount, enforceInputLineBounds, handleSubmit } = useInputManager(
    textareaRef,
    appendLines,
    setPromptCount,
    setAutoFollow,
    startStreamingResponder
  );

  const statusLabel = useMemo(() => {
    const streamingPart = streamState === "streaming" ? "streaming" : "waiting";
    const scrollPart = autoFollow ? "follow" : "scroll lock";
    return `${streamingPart} | ${scrollPart}`;
  }, [autoFollow, streamState]);

  useEnterSubmit(handleSubmit);

  return (
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
    />
  );
}

function clampInputLines(value: number): number {
  return Math.min(MAX_INPUT_LINES, Math.max(MIN_INPUT_LINES, value));
}

function secureRandomBetween(min: number, max: number): number {
  return randomInt(min, max + 1);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function buildResponderLine(): string {
  return `${pick(OPENERS)} ${pick(DRIVERS)} ${pick(SPINS)}`;
}

function pick<T>(items: readonly T[]): T {
  return items[secureRandomBetween(0, items.length - 1)];
}

function countWords(text: string): number {
  const matches = text.trim().match(/\S+/g);
  return matches ? matches.length : 0;
}
