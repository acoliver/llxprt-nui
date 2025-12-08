import type { Dispatch, SetStateAction } from "react";
import { useCallback, useState } from "react";

type Role = "user" | "responder" | "thinking" | "model" | "system";
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
  scrollable?: boolean;
  maxHeight?: number;
  streaming?: boolean;
}

type StateSetter<T> = Dispatch<SetStateAction<T>>;

export type { Role, StreamState, ChatLine, ToolBlock, StateSetter };

export interface UseChatStoreReturn {
  lines: (ChatLine | ToolBlock)[];
  appendLines: (role: Role, textLines: string[]) => void;
  appendToolBlock: (tool: { lines: string[]; isBatch: boolean; scrollable?: boolean; maxHeight?: number; streaming?: boolean }) => string;
  promptCount: number;
  setPromptCount: StateSetter<number>;
  responderWordCount: number;
  setResponderWordCount: StateSetter<number>;
  streamState: StreamState;
  setStreamState: StateSetter<StreamState>;
  updateToolBlock: (id: string, mutate: (block: ToolBlock) => ToolBlock) => void;
}

export function useChatStore(makeLineId: () => string): UseChatStoreReturn {
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
    (tool: { lines: string[]; isBatch: boolean; scrollable?: boolean; maxHeight?: number; streaming?: boolean }) => {
      const id = makeLineId();
      setLines((prev) => [
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
    [makeLineId]
  );

  const updateToolBlock = useCallback(
    (id: string, mutate: (block: ToolBlock) => ToolBlock) => {
      setLines((prev) =>
        prev.map((item) => {
          if (item.kind !== "tool" || item.id !== id) {
            return item;
          }
          return mutate(item);
        })
      );
    },
    []
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
    setStreamState,
    updateToolBlock
  };
}
