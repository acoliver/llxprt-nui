export { UserMessage } from "./UserMessage";
export { SystemMessage } from "./SystemMessage";
export { ModelMessage } from "./ModelMessage";
export { ThinkingMessage } from "./ThinkingMessage";
export { renderMessage, getMessageRenderer, roleColor } from "./renderMessage";
export { migrateRole, EmptyBorder } from "./types";
export type {
  MessageRole,
  MessageProps,
  UserMessageProps,
  SystemMessageProps,
  ModelMessageProps,
  ThinkingMessageProps,
  MessageComponent,
} from "./types";
