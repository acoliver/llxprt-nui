import type { JSX } from "react";
import type { ThemeDefinition } from "../../../features/theme";

export type MessageRole = "user" | "model" | "system" | "thinking";

export interface MessageProps {
  readonly id: string;
  readonly text: string;
  readonly theme: ThemeDefinition;
}

export type UserMessageProps = MessageProps;

export type SystemMessageProps = MessageProps;

export type ModelMessageProps = MessageProps;

export type ThinkingMessageProps = MessageProps;

export type MessageComponent = (props: MessageProps) => JSX.Element;

export function migrateRole(role: string): MessageRole {
  if (role === "responder") {
    return "model";
  }
  return role as MessageRole;
}

export const EmptyBorder = {
  top: " ",
  bottom: " ",
  left: " ",
  right: " ",
  topLeft: " ",
  topRight: " ",
  bottomLeft: " ",
  bottomRight: " ",
  horizontal: " ",
  vertical: " ",
};
