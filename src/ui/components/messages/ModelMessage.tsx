import type { JSX } from "react";
import type { ModelMessageProps } from "./types";

export function ModelMessage(props: Readonly<ModelMessageProps>): JSX.Element {
  return (
    <box key={props.id} style={{ marginBottom: 1 }}>
      <text fg={props.theme.colors.text.responder}>{props.text}</text>
    </box>
  );
}

ModelMessage.displayName = "ModelMessage";
