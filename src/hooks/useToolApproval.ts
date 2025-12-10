import { useCallback, useState, useRef, useEffect } from "react";
import type { ConfigSession } from "../features/config/configSession";
import type { ToolApprovalDetails, ToolApprovalOutcome } from "../ui/modals/ToolApprovalModal";
import { ToolConfirmationOutcome } from "@vybestack/llxprt-code-core";

// MessageBusType enum values matching llxprt-code-core
const MessageBusType = {
  TOOL_CONFIRMATION_RESPONSE: "tool-confirmation-response",
} as const;

// Type for the MessageBus publish interface
interface MessageBusPublishPayload {
  type: string;
  correlationId: string;
  outcome: ToolConfirmationOutcome;
  confirmed: boolean;
  requiresUserConfirmation: boolean;
}

export interface PendingApproval extends ToolApprovalDetails {
  readonly correlationId: string;
}

export interface UseToolApprovalResult {
  readonly pendingApproval: PendingApproval | null;
  readonly queueApproval: (approval: PendingApproval) => void;
  readonly handleDecision: (callId: string, outcome: ToolApprovalOutcome) => void;
  readonly clearApproval: () => void;
}

function mapOutcome(outcome: ToolApprovalOutcome): ToolConfirmationOutcome {
  switch (outcome) {
    case "allow_once":
      return ToolConfirmationOutcome.ProceedOnce;
    case "allow_always":
      return ToolConfirmationOutcome.ProceedAlways;
    case "cancel":
      return ToolConfirmationOutcome.Cancel;
    default:
      return ToolConfirmationOutcome.Cancel;
  }
}

export function useToolApproval(session: ConfigSession | null): UseToolApprovalResult {
  const [pendingApproval, setPendingApproval] = useState<PendingApproval | null>(null);
  const approvalQueueRef = useRef<PendingApproval[]>([]);

  const processNextApproval = useCallback(() => {
    if (approvalQueueRef.current.length > 0) {
      const next = approvalQueueRef.current.shift();
      if (next) {
        setPendingApproval(next);
      }
    } else {
      setPendingApproval(null);
    }
  }, []);

  const queueApproval = useCallback((approval: PendingApproval) => {
    approvalQueueRef.current.push(approval);
    // If no current pending approval, show this one
    if (pendingApproval === null) {
      processNextApproval();
    }
  }, [pendingApproval, processNextApproval]);

  const handleDecision = useCallback((callId: string, outcome: ToolApprovalOutcome) => {
    if (!session || !pendingApproval) return;
    if (pendingApproval.callId !== callId) return;

    // Use type assertion since getMessageBus exists on Config but types may not be exported
    const config = session.config as unknown as { getMessageBus(): { publish(payload: MessageBusPublishPayload): void } };
    const messageBus = config.getMessageBus();
    const coreOutcome = mapOutcome(outcome);

    messageBus.publish({
      type: MessageBusType.TOOL_CONFIRMATION_RESPONSE,
      correlationId: pendingApproval.correlationId,
      outcome: coreOutcome,
      confirmed: outcome !== "cancel",
      requiresUserConfirmation: false,
    });

    // Move to next approval in queue
    processNextApproval();
  }, [session, pendingApproval, processNextApproval]);

  const clearApproval = useCallback(() => {
    // Cancel all pending approvals
    if (session && pendingApproval) {
      const config = session.config as unknown as { getMessageBus(): { publish(payload: MessageBusPublishPayload): void } };
      const messageBus = config.getMessageBus();
      messageBus.publish({
        type: MessageBusType.TOOL_CONFIRMATION_RESPONSE,
        correlationId: pendingApproval.correlationId,
        outcome: ToolConfirmationOutcome.Cancel,
        confirmed: false,
        requiresUserConfirmation: false,
      });
    }
    approvalQueueRef.current = [];
    setPendingApproval(null);
  }, [session, pendingApproval]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      approvalQueueRef.current = [];
    };
  }, []);

  return {
    pendingApproval,
    queueApproval,
    handleDecision,
    clearApproval,
  };
}
