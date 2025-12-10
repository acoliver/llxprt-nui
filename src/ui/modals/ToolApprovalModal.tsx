import type { JSX } from "react";
import { useMemo } from "react";
import type { ThemeDefinition } from "../../features/theme";
import type { ToolConfirmationType } from "../../types/events";
import { ModalShell } from "./ModalShell";
import { RadioSelect, type RadioSelectOption } from "../components/RadioSelect";

export type ToolApprovalOutcome = "allow_once" | "allow_always" | "cancel";

export interface ToolApprovalDetails {
  readonly callId: string;
  readonly toolName: string;
  readonly confirmationType: ToolConfirmationType;
  readonly question: string;
  readonly preview: string;
  readonly params: Record<string, unknown>;
  readonly canAllowAlways: boolean;
}

export interface ToolApprovalModalProps {
  readonly details: ToolApprovalDetails;
  readonly onDecision: (callId: string, outcome: ToolApprovalOutcome) => void;
  readonly onClose: () => void;
  readonly theme?: ThemeDefinition;
}

function formatPreview(preview: string, maxLength = 200): string {
  if (preview.length <= maxLength) {
    return preview;
  }
  return preview.slice(0, maxLength - 3) + "...";
}

function getTypeIcon(type: ToolConfirmationType): string {
  switch (type) {
    case "edit":
      return "✎";
    case "exec":
      return "⚡";
    case "mcp":
      return "⚙";
    case "info":
      return "ℹ";
    default:
      return "?";
  }
}

function getTypeLabel(type: ToolConfirmationType): string {
  switch (type) {
    case "edit":
      return "File Edit";
    case "exec":
      return "Shell Command";
    case "mcp":
      return "MCP Tool";
    case "info":
      return "Information Request";
    default:
      return "Tool";
  }
}

export function ToolApprovalModal(props: ToolApprovalModalProps): JSX.Element {
  const { details, onDecision, onClose, theme } = props;

  const options = useMemo((): RadioSelectOption<ToolApprovalOutcome>[] => {
    const result: RadioSelectOption<ToolApprovalOutcome>[] = [
      { label: "Yes, allow once", value: "allow_once", key: "allow_once" }
    ];

    if (details.canAllowAlways) {
      result.push({
        label: "Yes, allow always",
        value: "allow_always",
        key: "allow_always"
      });
    }

    result.push({
      label: "No, cancel (esc)",
      value: "cancel",
      key: "cancel"
    });

    return result;
  }, [details.canAllowAlways]);

  const handleSelect = (outcome: ToolApprovalOutcome): void => {
    onDecision(details.callId, outcome);
    onClose();
  };

  const typeIcon = getTypeIcon(details.confirmationType);
  const typeLabel = getTypeLabel(details.confirmationType);
  const title = `${typeIcon} ${typeLabel}: ${details.toolName}`;

  const previewLines = formatPreview(details.preview).split("\n");

  const footer = (
    <text fg={theme?.colors.text.muted}>
      ↑/↓ to navigate, Enter to select, Esc to cancel
    </text>
  );

  return (
    <ModalShell
      title={title}
      subtitle={details.question}
      onClose={onClose}
      theme={theme}
      footer={footer}
      width="80%"
    >
      <box
        flexDirection="column"
        style={{
          gap: 1,
          paddingLeft: 1,
          paddingRight: 1
        }}
      >
        <box
          border
          style={{
            padding: 1,
            borderColor: theme?.colors.panel.border,
            backgroundColor: theme?.colors.panel.bg,
            flexDirection: "column",
            gap: 0,
            maxHeight: 10,
            overflow: "hidden"
          }}
        >
          {previewLines.map((line, index) => (
            <text key={`preview-${index}`} fg={theme?.colors.text.tool}>
              {line}
            </text>
          ))}
        </box>

        <box style={{ marginTop: 1 }}>
          <RadioSelect
            options={options}
            onSelect={handleSelect}
            theme={theme}
            isFocused={true}
          />
        </box>
      </box>
    </ModalShell>
  );
}
