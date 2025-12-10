import type { Dispatch, SetStateAction } from "react";
import { useCallback } from "react";
import type { Role, StreamState, ToolCall } from "./useChatStore";
import type { ConfigSession } from "../features/config/configSession";
import type { AdapterEvent, ToolPendingEvent, ToolConfirmationEvent } from "../features/config";
import { sendMessageWithSession } from "../features/config";
import {
  executeToolCall,
  type ToolCallRequestInfo,
} from "@vybestack/llxprt-code-core";

type StateSetter<T> = Dispatch<SetStateAction<T>>;

interface RefHandle<T> {
  current: T;
}

interface StreamContext {
  modelMessageId: string | null;
  thinkingMessageId: string | null;
  /** Track tool calls by their backend callId */
  toolCalls: Map<string, string>;
  /** Collect pending tool requests to execute after streaming */
  pendingToolRequests: ToolPendingEvent[];
}

function countWords(text: string): number {
  const matches = text.trim().match(/\S+/g);
  return matches ? matches.length : 0;
}

type ToolCallUpdate = Partial<Omit<ToolCall, "id" | "kind" | "callId">>;

function handleAdapterEvent(
  event: AdapterEvent,
  context: StreamContext,
  appendMessage: (role: Role, text: string) => string,
  appendToMessage: (id: string, text: string) => void,
  appendToolCall: (callId: string, name: string, params: Record<string, unknown>) => string,
  updateToolCall: (callId: string, update: ToolCallUpdate) => void,
  setResponderWordCount: StateSetter<number>,
  onConfirmationNeeded?: (event: ToolConfirmationEvent) => void
): StreamContext {
  if (event.type === "text_delta") {
    const text = event.text;
    // Skip empty or whitespace-only text when starting a new message
    if (context.modelMessageId === null) {
      if (text.trim() === "") {
        return context;
      }
      const id = appendMessage("model", text);
      setResponderWordCount((count) => count + countWords(text));
      return { ...context, modelMessageId: id };
    }
    appendToMessage(context.modelMessageId, text);
    setResponderWordCount((count) => count + countWords(text));
    return context;
  }
  if (event.type === "thinking_delta") {
    const text = event.text;
    // Skip empty or whitespace-only text when starting a new message
    if (context.thinkingMessageId === null) {
      if (text.trim() === "") {
        return context;
      }
      const id = appendMessage("thinking", text);
      setResponderWordCount((count) => count + countWords(text));
      return { ...context, thinkingMessageId: id };
    }
    appendToMessage(context.thinkingMessageId, text);
    setResponderWordCount((count) => count + countWords(text));
    return context;
  }
  if (event.type === "tool_pending") {
    // Create a new ToolCall entry
    const entryId = appendToolCall(event.id, event.name, event.params);
    const newToolCalls = new Map(context.toolCalls);
    newToolCalls.set(event.id, entryId);
    // Collect the tool request for later execution
    const newPendingToolRequests = [...context.pendingToolRequests, event];
    // Reset message IDs since model output may continue after tool
    return { modelMessageId: null, thinkingMessageId: null, toolCalls: newToolCalls, pendingToolRequests: newPendingToolRequests };
  }
  if (event.type === "tool_result") {
    // Update existing tool call with result
    updateToolCall(event.id, {
      status: event.success ? "complete" : "error",
      output: event.output,
      errorMessage: event.errorMessage
    });
    return context;
  }
  if (event.type === "tool_confirmation") {
    // Update tool call with confirmation details
    updateToolCall(event.id, {
      status: "confirming",
      confirmation: {
        confirmationType: event.confirmationType,
        question: event.question,
        preview: event.preview,
        canAllowAlways: event.canAllowAlways
      }
    });
    // Notify UI that confirmation is needed
    if (onConfirmationNeeded) {
      onConfirmationNeeded(event);
    }
    return context;
  }
  if (event.type === "tool_cancelled") {
    updateToolCall(event.id, { status: "cancelled" });
    return context;
  }
  if (event.type === "error") {
    appendMessage("system", `Error: ${event.message}`);
    return context;
  }
  // Handle complete and unknown events - no action needed
  return context;
}

export type UseStreamingResponderFunction = (prompt: string, session: ConfigSession | null) => Promise<void>;

/**
 * Execute pending tool calls and return their response parts.
 * Updates tool status as each tool executes.
 */
async function executeToolsAndGetResponses(
  session: ConfigSession,
  pendingTools: ToolPendingEvent[],
  updateToolCall: (callId: string, update: Partial<Omit<ToolCall, "id" | "kind" | "callId">>) => void,
  signal: AbortSignal
): Promise<unknown[]> {
  const responseParts: unknown[] = [];
  const config = session.config;

  for (const tool of pendingTools) {
    if (signal.aborted) break;

    // Mark as executing
    updateToolCall(tool.id, { status: "executing" });

    const request: ToolCallRequestInfo = {
      callId: tool.id,
      name: tool.name,
      args: tool.params,
      isClientInitiated: false,
      prompt_id: `nui-${Date.now()}`,
    };

    try {
      const response = await executeToolCall(config, request, signal);

      // Update tool with result
      if (response.error) {
        updateToolCall(tool.id, {
          status: "error",
          errorMessage: response.error.message,
          output: response.resultDisplay as string | undefined
        });
      } else {
        let output: string | undefined;
        if (response.resultDisplay != null) {
          output = typeof response.resultDisplay === "string"
            ? response.resultDisplay
            : JSON.stringify(response.resultDisplay);
        }
        updateToolCall(tool.id, {
          status: "complete",
          output
        });
      }

      // Collect response parts
      responseParts.push(...response.responseParts);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      updateToolCall(tool.id, {
        status: "error",
        errorMessage: message
      });
    }
  }

  return responseParts;
}

export function useStreamingResponder(
  appendMessage: (role: Role, text: string) => string,
  appendToMessage: (id: string, text: string) => void,
  appendToolCall: (callId: string, name: string, params: Record<string, unknown>) => string,
  updateToolCall: (callId: string, update: Partial<Omit<ToolCall, "id" | "kind" | "callId">>) => void,
  setResponderWordCount: StateSetter<number>,
  setStreamState: StateSetter<StreamState>,
  streamRunId: RefHandle<number>,
  mountedRef: RefHandle<boolean>,
  abortRef: RefHandle<AbortController | null>,
  onConfirmationNeeded?: (event: ToolConfirmationEvent) => void
): UseStreamingResponderFunction {
  return useCallback(
    async (prompt: string, session: ConfigSession | null) => {
      // Validate session exists
      if (session === null) {
        appendMessage(
          "system",
          "No active session. Load a profile first with /profile load <name>"
        );
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

      let context: StreamContext = {
        modelMessageId: null,
        thinkingMessageId: null,
        toolCalls: new Map(),
        pendingToolRequests: []
      };

      try {
        // Initial streaming loop
        for await (const event of sendMessageWithSession(session, prompt, controller.signal)) {
          if (!mountedRef.current || streamRunId.current !== currentRun) {
            break;
          }
          context = handleAdapterEvent(event, context, appendMessage, appendToMessage, appendToolCall, updateToolCall, setResponderWordCount, onConfirmationNeeded);
        }

        // Agentic loop: execute tools and continue conversation
        while (
          context.pendingToolRequests.length > 0 &&
          mountedRef.current &&
          streamRunId.current === currentRun &&
          !controller.signal.aborted
        ) {
          // Execute pending tools
          const responseParts = await executeToolsAndGetResponses(
            session,
            context.pendingToolRequests,
            updateToolCall,
            controller.signal
          );

          // Reset context for next round
          context = {
            modelMessageId: null,
            thinkingMessageId: null,
            toolCalls: new Map(),
            pendingToolRequests: []
          };

          // Send tool responses back to model and continue streaming
          const client = session.getClient();
          const promptId = `nui-continuation-${Date.now()}`;
          const stream = client.sendMessageStream(responseParts, controller.signal, promptId);

          for await (const coreEvent of stream) {
            if (streamRunId.current !== currentRun) {
              break;
            }
            // Transform and handle the event
            const { transformEvent } = await import("../features/config/llxprtAdapter");
            const event = transformEvent(coreEvent);
            context = handleAdapterEvent(event, context, appendMessage, appendToMessage, appendToolCall, updateToolCall, setResponderWordCount, onConfirmationNeeded);
          }
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
    [appendMessage, appendToMessage, appendToolCall, updateToolCall, abortRef, mountedRef, setResponderWordCount, setStreamState, streamRunId, onConfirmationNeeded]
  );
}
