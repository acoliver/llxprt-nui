import type { Dispatch, SetStateAction } from "react";
import { useCallback } from "react";
import type { Role, StreamState } from "./useChatStore";
import type { SessionConfig, AdapterEvent } from "../features/config";
import { sendMessage } from "../features/config";
import { validateSessionConfig } from "../features/config";

type StateSetter<T> = Dispatch<SetStateAction<T>>;

interface RefHandle<T> {
  current: T;
}

interface StreamContext {
  modelMessageId: string | null;
  thinkingMessageId: string | null;
}

function countWords(text: string): number {
  const matches = text.trim().match(/\S+/g);
  return matches ? matches.length : 0;
}

function handleAdapterEvent(
  event: AdapterEvent,
  context: StreamContext,
  appendMessage: (role: Role, text: string) => string,
  appendToMessage: (id: string, text: string) => void,
  appendToolBlock: (tool: { lines: string[]; isBatch: boolean; scrollable?: boolean; maxHeight?: number; streaming?: boolean }) => string,
  setResponderWordCount: StateSetter<number>
): StreamContext {
  if (event.type === "text") {
    const text = event.lines.join("\n");
    if (context.modelMessageId === null) {
      const id = appendMessage("model", text);
      setResponderWordCount((count) => count + countWords(text));
      return { ...context, modelMessageId: id };
    } else {
      const appendText = "\n" + text;
      appendToMessage(context.modelMessageId, appendText);
      setResponderWordCount((count) => count + countWords(text));
      return context;
    }
  }
  if (event.type === "thinking") {
    const text = event.lines.join("\n");
    if (context.thinkingMessageId === null) {
      const id = appendMessage("thinking", text);
      setResponderWordCount((count) => count + countWords(text));
      return { ...context, thinkingMessageId: id };
    } else {
      const appendText = "\n" + text;
      appendToMessage(context.thinkingMessageId, appendText);
      setResponderWordCount((count) => count + countWords(text));
      return context;
    }
  }
  appendToolBlock({ lines: [event.header, ...event.lines], isBatch: false, scrollable: false });
  return { modelMessageId: null, thinkingMessageId: null };
}

export type UseStreamingResponderFunction = (prompt: string, session: SessionConfig) => Promise<void>;

export function useStreamingResponder(
  appendMessage: (role: Role, text: string) => string,
  appendToMessage: (id: string, text: string) => void,
  appendToolBlock: (tool: { lines: string[]; isBatch: boolean; scrollable?: boolean; maxHeight?: number; streaming?: boolean }) => string,
  setResponderWordCount: StateSetter<number>,
  setStreamState: StateSetter<StreamState>,
  streamRunId: RefHandle<number>,
  mountedRef: RefHandle<boolean>,
  abortRef: RefHandle<AbortController | null>
): UseStreamingResponderFunction {
  return useCallback(
    async (prompt: string, session: SessionConfig) => {
      const missing = validateSessionConfig(session);
      if (missing.length > 0) {
        appendMessage("system", missing.join("\n"));
        return;
      }

      streamRunId.current += 1;
      const currentRun = streamRunId.current;

      if (abortRef.current) {
        abortRef.current.abort();
      }
      const controller = new AbortController();
      abortRef.current = controller;
      setStreamState("streaming");

      let context: StreamContext = { modelMessageId: null, thinkingMessageId: null };

      try {
        for await (const event of sendMessage(session, prompt, controller.signal)) {
          if (!mountedRef.current || streamRunId.current !== currentRun) {
            break;
          }
          context = handleAdapterEvent(event, context, appendMessage, appendToMessage, appendToolBlock, setResponderWordCount);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          const message = error instanceof Error ? error.message : String(error);
          appendMessage("system", `Error: ${message}`);
        }
      } finally {
        if (mountedRef.current && streamRunId.current === currentRun) {
          setStreamState("idle");
        }
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
      }
    },
    [appendMessage, appendToMessage, appendToolBlock, abortRef, mountedRef, setResponderWordCount, setStreamState, streamRunId]
  );
}
