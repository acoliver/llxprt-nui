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

function countWords(text: string): number {
  const matches = text.trim().match(/\S+/g);
  return matches ? matches.length : 0;
}

function handleAdapterEvent(
  event: AdapterEvent,
  appendLines: (role: Role, textLines: string[]) => void,
  appendToolBlock: (tool: { lines: string[]; isBatch: boolean; scrollable?: boolean; maxHeight?: number; streaming?: boolean }) => string,
  setResponderWordCount: StateSetter<number>
): void {
  if (event.type === "text") {
    appendLines("responder", event.lines);
    setResponderWordCount((count) => count + event.lines.reduce((sum, line) => sum + countWords(line), 0));
    return;
  }
  if (event.type === "thinking") {
    appendLines("thinking", event.lines);
    setResponderWordCount((count) => count + event.lines.reduce((sum, line) => sum + countWords(line), 0));
    return;
  }
  appendToolBlock({ lines: [event.header, ...event.lines], isBatch: false, scrollable: false });
}

export type UseStreamingResponderFunction = (prompt: string, session: SessionConfig) => Promise<void>;

export function useStreamingResponder(
  appendLines: (role: Role, textLines: string[]) => void,
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
        appendLines("responder", missing);
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

      try {
        for await (const event of sendMessage(session, prompt, controller.signal)) {
          if (!mountedRef.current || streamRunId.current !== currentRun) {
            break;
          }
          handleAdapterEvent(event, appendLines, appendToolBlock, setResponderWordCount);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          const message = error instanceof Error ? error.message : String(error);
          appendLines("responder", [`Error: ${message}`]);
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
    [appendLines, appendToolBlock, abortRef, mountedRef, setResponderWordCount, setStreamState, streamRunId]
  );
}
