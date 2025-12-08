import type { JSX } from "react";
import type { ThemeDefinition } from "../../features/theme";

type StreamState = "idle" | "streaming";

export interface StatusBarProps {
  readonly statusLabel: string;
  readonly promptCount: number;
  readonly responderWordCount: number;
  readonly streamState: StreamState;
  readonly theme: ThemeDefinition;
}

export function buildStatusLabel(streamState: StreamState, autoFollow: boolean): string {
  const streamingPart = streamState === "streaming" ? "streaming" : "waiting";
  const scrollPart = autoFollow ? "follow" : "scroll lock";
  return `${streamingPart} | ${scrollPart}`;
}

export function StatusBar(props: StatusBarProps): JSX.Element {
  return (
    <box
      style={{
        minHeight: 1,
        maxHeight: 3,
        paddingLeft: 1,
        paddingRight: 1,
        flexDirection: "row",
        justifyContent: "space-between",
        backgroundColor: props.theme.colors.panel.bg
      }}
    >
      <text fg={props.theme.colors.text.primary}>{props.statusLabel}</text>
      <text fg={props.theme.colors.text.primary}>
        {`prompts: ${props.promptCount} | words: ${props.responderWordCount} | ${props.streamState}`}
      </text>
    </box>
  );
}
