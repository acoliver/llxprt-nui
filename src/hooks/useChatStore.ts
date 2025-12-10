import type { Dispatch, SetStateAction } from "react";
import { useCallback, useState } from "react";
import type { MessageRole } from "../ui/components/messages";
import type { ToolStatus, ToolConfirmationType } from "../types/events";

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
  /** The tool call ID from the backend */
  callId: string;
  name: string;
  params: Record<string, unknown>;
  status: ToolStatus;
  /** Tool output after execution */
  output?: string;
  /** Error message if failed */
  errorMessage?: string;
  /** Confirmation details if awaiting approval */
  confirmation?: {
    confirmationType: ToolConfirmationType;
    question: string;
    preview: string;
    canAllowAlways: boolean;
  };
}

type ToolBlock = ToolBlockLegacy | ToolCall;

type ChatEntry = ChatMessage | ToolBlock;

type StateSetter<T> = Dispatch<SetStateAction<T>>;

export type { Role, StreamState, ChatMessage, ToolBlock, ToolBlockLegacy, ToolCall, ChatEntry, StateSetter };

export interface UseChatStoreReturn {
  entries: ChatEntry[];
  appendMessage: (role: Role, text: string) => string;
  appendToMessage: (id: string, text: string) => void;
  appendToolBlock: (tool: { lines: string[]; isBatch: boolean; scrollable?: boolean; maxHeight?: number; streaming?: boolean }) => string;
  appendToolCall: (callId: string, name: string, params: Record<string, unknown>) => string;
  updateToolCall: (callId: string, update: Partial<Omit<ToolCall, "id" | "kind" | "callId">>) => void;
  findToolCallByCallId: (callId: string) => ToolCall | undefined;
  promptCount: number;
  setPromptCount: StateSetter<number>;
  responderWordCount: number;
  setResponderWordCount: StateSetter<number>;
  streamState: StreamState;
  setStreamState: StateSetter<StreamState>;
  updateToolBlock: (id: string, mutate: (block: ToolBlock) => ToolBlock) => void;
}

export function useChatStore(makeId: () => string): UseChatStoreReturn {
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [promptCount, setPromptCount] = useState(0);
  const [responderWordCount, setResponderWordCount] = useState(0);
  const [streamState, setStreamState] = useState<StreamState>("idle");

  const appendMessage = useCallback(
    (role: Role, text: string): string => {
      const id = makeId();
      setEntries((prev) => [
        ...prev,
        {
          id,
          kind: "message",
          role,
          text
        }
      ]);
      return id;
    },
    [makeId]
  );

  const appendToMessage = useCallback(
    (id: string, text: string): void => {
      setEntries((prev) =>
        prev.map((entry) => {
          if (entry.kind !== "message" || entry.id !== id) {
            return entry;
          }
          return { ...entry, text: entry.text + text };
        })
      );
    },
    []
  );

  const appendToolBlock = useCallback(
    (tool: { lines: string[]; isBatch: boolean; scrollable?: boolean; maxHeight?: number; streaming?: boolean }) => {
      const id = makeId();
      setEntries((prev) => [
        ...prev,
        {
          id,
          kind: "tool",
          lines: tool.lines,
          isBatch: tool.isBatch,
          scrollable: tool.scrollable,
          maxHeight: tool.maxHeight,
          streaming: tool.streaming
        }
      ]);
      return id;
    },
    [makeId]
  );

  const appendToolCall = useCallback(
    (callId: string, name: string, params: Record<string, unknown>): string => {
      const id = makeId();
      setEntries((prev) => [
        ...prev,
        {
          id,
          kind: "toolcall",
          callId,
          name,
          params,
          status: "pending" as const
        }
      ]);
      return id;
    },
    [makeId]
  );

  const updateToolCall = useCallback(
    (callId: string, update: Partial<Omit<ToolCall, "id" | "kind" | "callId">>) => {
      setEntries((prev) =>
        prev.map((item) => {
          if (item.kind !== "toolcall" || item.callId !== callId) {
            return item;
          }
          return { ...item, ...update };
        })
      );
    },
    []
  );

  const findToolCallByCallId = useCallback(
    (callId: string): ToolCall | undefined => {
      return entries.find(
        (entry): entry is ToolCall => entry.kind === "toolcall" && entry.callId === callId
      );
    },
    [entries]
  );

  const updateToolBlock = useCallback(
    (id: string, mutate: (block: ToolBlock) => ToolBlock) => {
      setEntries((prev) =>
        prev.map((item) => {
          if ((item.kind !== "tool" && item.kind !== "toolcall") || item.id !== id) {
            return item;
          }
          return mutate(item);
        })
      );
    },
    []
  );

  return {
    entries,
    appendMessage,
    appendToMessage,
    appendToolBlock,
    appendToolCall,
    updateToolCall,
    findToolCallByCallId,
    promptCount,
    setPromptCount,
    responderWordCount,
    setResponderWordCount,
    streamState,
    setStreamState,
    updateToolBlock
  };
}
