import type { RefObject } from "react";
import { useCallback, useRef } from "react";
import type { SessionConfig } from "../features/config";
import { useStreamingResponder } from "./useStreamingResponder";

interface UseStreamingLifecycleResult {
  streamRunId: RefObject<number>;
  mountedRef: RefObject<boolean>;
  abortRef: RefObject<AbortController | null>;
  cancelStreaming: () => void;
  startStreamingResponder: (prompt: string, config: SessionConfig) => Promise<void>;
}

export function useStreamingLifecycle(
  appendMessage: (role: "user" | "model" | "thinking" | "system", text: string) => string,
  appendToMessage: (id: string, text: string) => void,
  appendToolBlock: (tool: { lines: string[]; isBatch: boolean; scrollable?: boolean; maxHeight?: number; streaming?: boolean }) => string,
  setResponderWordCount: (count: number) => void,
  setStreamState: (state: "idle" | "streaming") => void
): UseStreamingLifecycleResult {
  const streamRunId = useRef(0);
  const mountedRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);

  const startStreamingResponder = useStreamingResponder(
    appendMessage,
    appendToMessage,
    appendToolBlock,
    setResponderWordCount,
    setStreamState,
    streamRunId,
    mountedRef,
    abortRef
  );

  const cancelStreaming = useCallback(() => {
    streamRunId.current += 1;
    abortRef.current?.abort();
    setStreamState("idle");
  }, [setStreamState]);

  return {
    streamRunId,
    mountedRef,
    abortRef,
    cancelStreaming,
    startStreamingResponder,
  };
}
