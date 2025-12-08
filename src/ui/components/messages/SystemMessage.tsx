import type { JSX } from "react";
import type { SystemMessageProps } from "./types";
import { EmptyBorder } from "./types";

export function SystemMessage(props: Readonly<SystemMessageProps>): JSX.Element {
  return (
    <box
      key={props.id}
      border={["left"]}
      borderColor={props.theme.colors.message.systemBorder}
      customBorderChars={{
        ...EmptyBorder,
        vertical: "│",
        bottomLeft: "╵",
        topLeft: "╷",
      }}
      style={{ paddingLeft: 1 }}
    >
      <text fg={props.theme.colors.message.systemText}>{props.text}</text>
    </box>
  );
}

SystemMessage.displayName = "SystemMessage";
