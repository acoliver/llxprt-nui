import type { ScrollBoxRenderable, TextareaRenderable } from "@opentui/core";
import { parseColor, stringToStyledText } from "@opentui/core";
import type { JSX, RefObject } from "react";
import { useMemo } from "react";
import type { CompletionSuggestion } from "../../features/completion";
import type { ThemeDefinition } from "../../features/theme";
import { HeaderBar } from "./HeaderBar";
import { StatusBar } from "./StatusBar";
import { SuggestionPanel } from "./SuggestionPanel";
import { renderMessage, type MessageRole } from "./messages";

type Role = MessageRole;
type StreamState = "idle" | "streaming";

interface ChatMessage {
  id: string;
  kind: "message";
  role: Role;
  text: string;
}

interface ToolBlock {
  id: string;
  kind: "tool";
  lines: string[];
  isBatch: boolean;
  scrollable?: boolean;
  maxHeight?: number;
  streaming?: boolean;
}

type ChatEntry = ChatMessage | ToolBlock;

const MIN_INPUT_LINES = 1;
const MAX_INPUT_LINES = 10;
const TEXTAREA_KEY_BINDINGS = [
  // Override default: plain return submits instead of newline
  { name: "return", action: "submit" },
  // Modifier+return inserts newline
  { name: "return", shift: true, action: "newline" },
  { name: "return", ctrl: true, action: "newline" },
  { name: "return", alt: true, action: "newline" },
  // Additional submit triggers
  { name: "kpenter", action: "submit" },
];

export interface ChatLayoutProps {
  readonly headerText: string;
  readonly entries: ChatEntry[];
  readonly scrollRef: RefObject<ScrollBoxRenderable | null>;
  readonly autoFollow: boolean;
  readonly textareaRef: RefObject<TextareaRenderable | null>;
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
  readonly theme: ThemeDefinition;
}

interface ScrollbackProps {
  readonly entries: ChatEntry[];
  readonly scrollRef: RefObject<ScrollBoxRenderable | null>;
  readonly autoFollow: boolean;
  readonly onScroll: (event: { type: string }) => void;
  readonly theme: ThemeDefinition;
}

interface InputAreaProps {
  readonly textareaRef: RefObject<TextareaRenderable | null>;
  readonly containerHeight: number;
  readonly textareaHeight: number;
  readonly handleSubmit: () => void;
  readonly enforceInputLineBounds: () => void;
  readonly theme: ThemeDefinition;
}

export function renderChatMessage(message: ChatMessage, theme: ThemeDefinition): JSX.Element {
  return renderMessage(message.role, message.id, message.text, theme);
}

export function renderToolBlock(block: ToolBlock, theme: ThemeDefinition): JSX.Element {
  const content = block.scrollable === true ? (
    <scrollbox
      style={{
        paddingLeft: 0,
        paddingRight: 0,
        paddingTop: 0,
        paddingBottom: 0,
        height: Math.min(block.lines.length + 1, block.maxHeight ?? block.lines.length + 1),
        maxHeight: block.maxHeight,
        overflow: "hidden"
      }}
      contentOptions={{ paddingLeft: 0, paddingRight: 0 }}
      scrollY
      scrollX={false}
    >
      <box flexDirection="column" style={{ gap: 0, width: "100%", paddingLeft: 0, paddingRight: 0 }}>
        {block.lines.map((line, index) => (
          <text key={`${block.id}-line-${index}`} fg={theme.colors.text.tool}>
            {line}
          </text>
        ))}
      </box>
    </scrollbox>
  ) : (
    block.lines.map((line, index) => (
      <text key={`${block.id}-line-${index}`} fg={theme.colors.text.tool}>
        {line}
      </text>
    ))
  );

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
        borderStyle: block.isBatch ? "rounded" : "single",
        borderColor: theme.colors.panel.border,
        backgroundColor: theme.colors.panel.bg,
        overflow: "hidden"
      }}
    >
      {content}
      {block.streaming === true ? (
        <text fg={theme.colors.text.muted} key={`${block.id}-streaming`}>
          ...streaming...
        </text>
      ) : null}
    </box>
  );
}

function ScrollbackView(props: ScrollbackProps): JSX.Element {
  return (
    <scrollbox
      ref={props.scrollRef}
      style={{
        flexGrow: 1,
        border: true,
        paddingTop: 0,
        paddingBottom: 0,
        paddingLeft: 0,
        paddingRight: 0,
        overflow: "hidden",
        borderColor: props.theme.colors.panel.border,
        backgroundColor: props.theme.colors.panel.bg
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
          {props.entries.map((entry) =>
            entry.kind === "message"
              ? renderChatMessage(entry, props.theme)
              : renderToolBlock(entry, props.theme)
          )}
        </box>
      </scrollbox>
  );
}

function InputArea(props: InputAreaProps): JSX.Element {
  const placeholderText = useMemo(() => {
    const base = stringToStyledText("Type a thought, then submit with Enter");
    const fg = parseColor(props.theme.colors.input.placeholder);
    return { ...base, chunks: base.chunks.map((chunk) => ({ ...chunk, fg })) };
  }, [props.theme.colors.input.placeholder]);

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
        gap: 0,
        borderColor: props.theme.colors.panel.border,
        backgroundColor: props.theme.colors.panel.bg
      }}
    >
      <textarea
        ref={props.textareaRef}
        focused
        placeholder={placeholderText}
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
          paddingBottom: 0,
          fg: props.theme.colors.input.fg,
          bg: props.theme.colors.input.bg,
          borderColor: props.theme.colors.input.border
        }}
        textColor={props.theme.colors.input.fg}
        focusedTextColor={props.theme.colors.input.fg}
        backgroundColor={props.theme.colors.input.bg}
        focusedBackgroundColor={props.theme.colors.input.bg}
      />
    </box>
  );
}

function clampInputLines(value: number): number {
  return Math.min(MAX_INPUT_LINES, Math.max(MIN_INPUT_LINES, value));
}

export function ChatLayout(props: ChatLayoutProps): JSX.Element {
  const visibleInputLines = Math.min(MAX_INPUT_LINES, clampInputLines(props.inputLineCount));
  const containerHeight = Math.min(MAX_INPUT_LINES + 2, Math.max(MIN_INPUT_LINES + 2, visibleInputLines + 2));
  const textareaHeight = Math.max(3, containerHeight - 2);

  return (
    <box
      flexDirection="column"
      style={{ width: "100%", height: "100%", padding: 1, gap: 1, backgroundColor: props.theme.colors.background }}
      onMouseUp={props.onMouseUp}
    >
      <HeaderBar text={props.headerText} theme={props.theme} />
      <ScrollbackView
        entries={props.entries}
        scrollRef={props.scrollRef}
        autoFollow={props.autoFollow}
        onScroll={props.onScroll}
        theme={props.theme}
      />
      <InputArea
        textareaRef={props.textareaRef}
        containerHeight={containerHeight}
        textareaHeight={textareaHeight}
        handleSubmit={props.handleSubmit}
        enforceInputLineBounds={props.enforceInputLineBounds}
        theme={props.theme}
      />
      <SuggestionPanel suggestions={props.suggestions} selectedIndex={props.selectedSuggestion} theme={props.theme} />
      <StatusBar
        statusLabel={props.statusLabel}
        promptCount={props.promptCount}
        responderWordCount={props.responderWordCount}
        streamState={props.streamState}
        theme={props.theme}
      />
    </box>
  );
}
