import type { ScrollBoxRenderable, TextareaRenderable } from "@opentui/core";
import { parseColor, stringToStyledText } from "@opentui/core";
import type { JSX, RefObject } from "react";
import { useMemo } from "react";
import type { CompletionSuggestion } from "../../features/completion";
import type { ThemeDefinition } from "../../features/theme";
import type { ToolStatus } from "../../types/events";
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

interface ToolBlockLegacy {
  id: string;
  kind: "tool";
  lines: string[];
  isBatch: boolean;
  scrollable?: boolean;
  maxHeight?: number;
  streaming?: boolean;
}

interface ToolCall {
  id: string;
  kind: "toolcall";
  callId: string;
  name: string;
  params: Record<string, unknown>;
  status: ToolStatus;
  output?: string;
  errorMessage?: string;
  confirmation?: {
    confirmationType: string;
    question: string;
    preview: string;
    canAllowAlways: boolean;
  };
}

type ToolBlock = ToolBlockLegacy | ToolCall;
type ChatEntry = ChatMessage | ToolBlock;

const MIN_INPUT_LINES = 1;
const MAX_INPUT_LINES = 10;
// Key bindings:
// - Return submits
// - Shift+Return sends linefeed (\n) which inserts newline
// - Option+Return (meta) inserts newline
// - Keypad enter (kpenter/kpplus) submits
const TEXTAREA_KEY_BINDINGS = [
  { name: "return", action: "submit" },
  { name: "return", meta: true, action: "newline" },
  { name: "return", shift: true, action: "newline" },
  { name: "linefeed", action: "newline" },
  { name: "kpenter", action: "submit" },
  { name: "kpplus", action: "submit" },
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

/**
 * Get status indicator symbol and color for tool status
 */
function getStatusIndicator(status: ToolStatus, theme: ThemeDefinition): { symbol: string; color: string } {
  const successColor = theme.colors.accent.success ?? theme.colors.status.fg;
  const errorColor = theme.colors.accent.error ?? theme.colors.text.primary;
  const warningColor = theme.colors.accent.warning ?? theme.colors.status.fg;
  const pendingColor = theme.colors.status.muted ?? theme.colors.text.muted;

  switch (status) {
    case "pending":
      return { symbol: "○", color: pendingColor };
    case "executing":
      return { symbol: "◎", color: pendingColor };
    case "complete":
      return { symbol: "✓", color: successColor };
    case "error":
      return { symbol: "✗", color: errorColor };
    case "confirming":
      return { symbol: "?", color: warningColor };
    case "cancelled":
      return { symbol: "-", color: warningColor };
  }
}

/**
 * Format tool parameters for display
 */
function formatParams(params: Record<string, unknown>): string[] {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    const valueStr = typeof value === "string" ? value : JSON.stringify(value);
    // Truncate long values
    const displayValue = valueStr.length > 80 ? valueStr.slice(0, 77) + "..." : valueStr;
    lines.push(`  ${key}: ${displayValue}`);
  }
  return lines;
}

// Maximum height for tool output scrollbox before requiring scroll
const TOOL_OUTPUT_MAX_HEIGHT = 10;

/**
 * Render a ToolCall entry with status, params, and output in a scrollable container
 */
export function renderToolCall(tool: ToolCall, theme: ThemeDefinition): JSX.Element {
  const { symbol, color } = getStatusIndicator(tool.status, theme);
  const paramLines = formatParams(tool.params);

  // Build output lines
  const outputLines: string[] = [];
  if (tool.output) {
    outputLines.push(...tool.output.split("\n"));
  }
  if (tool.errorMessage) {
    outputLines.push(`Error: ${tool.errorMessage}`);
  }

  // Determine border color based on status
  let borderColor = theme.colors.panel.border;
  if (tool.status === "confirming") {
    borderColor = theme.colors.accent.warning ?? theme.colors.panel.border;
  } else if (tool.status === "error") {
    borderColor = theme.colors.accent.error ?? theme.colors.panel.border;
  } else if (tool.status === "complete") {
    borderColor = theme.colors.accent.success ?? theme.colors.panel.border;
  }

  // Output needs scrollbox if it exceeds max height
  const outputNeedsScroll = outputLines.length > TOOL_OUTPUT_MAX_HEIGHT;

  return (
    <box
      key={tool.id}
      border
      style={{
        paddingLeft: 1,
        paddingRight: 1,
        paddingTop: 0,
        paddingBottom: 0,
        marginTop: 0,
        marginBottom: 0,
        width: "100%",
        flexDirection: "column",
        gap: 0,
        borderStyle: "rounded",
        borderColor,
        backgroundColor: theme.colors.panel.bg,
        overflow: "hidden"
      }}
    >
      {/* Header: status symbol + tool name */}
      <box key={`${tool.id}-header`} flexDirection="row" style={{ gap: 0 }}>
        <text fg={color}>{symbol}</text>
        <text fg={theme.colors.text.tool}> {tool.name}</text>
      </box>

      {/* Parameters */}
      {paramLines.map((line, idx) => (
        <text key={`${tool.id}-param-${idx}`} fg={theme.colors.text.muted} style={{ paddingLeft: 1 }}>
          {line}
        </text>
      ))}

      {/* Confirmation prompt if awaiting approval */}
      {tool.confirmation && (
        <box key={`${tool.id}-confirm`} flexDirection="column" style={{ gap: 0 }}>
          <text fg={theme.colors.accent.warning ?? theme.colors.status.fg}>{tool.confirmation.question}</text>
          <text fg={theme.colors.text.muted}>Preview: {tool.confirmation.preview.slice(0, 100)}</text>
          <text fg={theme.colors.text.primary}>(Approval modal will appear)</text>
        </box>
      )}

      {/* Output (shown after execution) - in scrollbox if large */}
      {outputLines.length > 0 && (
        <box key={`${tool.id}-output`} flexDirection="column" style={{ gap: 0 }}>
          <text fg={theme.colors.text.muted} style={{ paddingLeft: 1 }}>Output:</text>
          {outputNeedsScroll ? (
            <scrollbox
              style={{
                height: TOOL_OUTPUT_MAX_HEIGHT,
                maxHeight: TOOL_OUTPUT_MAX_HEIGHT,
                paddingLeft: 0,
                paddingRight: 0,
                paddingTop: 0,
                paddingBottom: 0,
                overflow: "hidden"
              }}
              contentOptions={{ paddingLeft: 1, paddingRight: 0 }}
              scrollY
              scrollX={false}
            >
              <box flexDirection="column" style={{ gap: 0, width: "100%" }}>
                {outputLines.map((line, idx) => (
                  <text
                    key={`${tool.id}-output-${idx}`}
                    fg={tool.errorMessage ? (theme.colors.accent.error ?? theme.colors.text.primary) : theme.colors.text.tool}
                  >
                    {line}
                  </text>
                ))}
              </box>
            </scrollbox>
          ) : (
            outputLines.map((line, idx) => (
              <text
                key={`${tool.id}-output-${idx}`}
                fg={tool.errorMessage ? (theme.colors.accent.error ?? theme.colors.text.primary) : theme.colors.text.tool}
                style={{ paddingLeft: 1 }}
              >
                {line}
              </text>
            ))
          )}
        </box>
      )}

      {/* Executing indicator */}
      {tool.status === "executing" && (
        <text key={`${tool.id}-executing`} fg={theme.colors.text.muted} style={{ paddingLeft: 1 }}>
          ...executing...
        </text>
      )}
    </box>
  );
}

export function renderToolBlock(block: ToolBlockLegacy, theme: ThemeDefinition): JSX.Element {
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
        paddingLeft: 1,
        paddingRight: 1,
        paddingTop: 0,
        paddingBottom: 0,
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
          {props.entries.map((entry) => {
            if (entry.kind === "message") {
              return renderChatMessage(entry, props.theme);
            }
            if (entry.kind === "toolcall") {
              return renderToolCall(entry, props.theme);
            }
            // Legacy tool block
            return renderToolBlock(entry, props.theme);
          })}
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
          borderColor: props.theme.colors.input.border,
          cursorColor: props.theme.colors.input.fg
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
