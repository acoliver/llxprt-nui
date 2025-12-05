import { useKeyboard } from "@opentui/react";
import { useState, type JSX } from "react";
import { ModalShell } from "./modalShell";
import type { ThemeDefinition } from "./theme";

export interface AuthOption {
  readonly id: string;
  readonly label: string;
  readonly enabled: boolean;
}

export function AuthModal(props: {
  readonly options: AuthOption[];
  readonly onClose: () => void;
  readonly onSave: (next: AuthOption[]) => void;
  readonly theme?: ThemeDefinition;
}): JSX.Element {
  const [options, setOptions] = useState<AuthOption[]>(props.options);
  const [index, setIndex] = useState(0);

  const closeWithSave = (): void => {
    props.onSave(options);
    props.onClose();
  };

  useKeyboard((key) => {
    if (key.eventType !== "press") {
      return;
    }
    if (key.name === "escape") {
      closeWithSave();
      return;
    }
    if (key.name === "up") {
      key.preventDefault?.();
      moveSelection(index - 1, options.length, setIndex);
    } else if (key.name === "down") {
      key.preventDefault?.();
      moveSelection(index + 1, options.length, setIndex);
    } else if (key.name === "return" || key.name === "enter") {
      key.preventDefault?.();
      const current = options[index];
      if (!current) {
        return;
      }
      if (current.id === "close") {
        closeWithSave();
        return;
      }
      setOptions((prev) =>
        prev.map((opt, optIndex) => (optIndex === index ? { ...opt, enabled: !opt.enabled } : opt))
      );
    }
  });

  return (
    <ModalShell title="OAuth Authentication" onClose={closeWithSave} theme={props.theme}>
      <text fg={props.theme?.colors.text.primary}>Select an OAuth provider to authenticate:</text>
      <text fg={props.theme?.colors.text.muted}>
        Note: You can also use API keys via /key, /keyfile, --key, --keyfile, or environment variables
      </text>
      <box flexDirection="column" style={{ gap: 0 }}>{renderAuthOptions(options, index, props.theme)}</box>
      <text fg={props.theme?.colors.text.muted}>(Use Enter to select, ESC to close)</text>
      <text fg={props.theme?.colors.text.primary}>Terms of Services and Privacy Notice for Gemini CLI</text>
      <text fg={props.theme?.colors.text.muted}>https://github.com/acoliver/llxprt-code/blob/main/docs/tos-privacy.md</text>
    </ModalShell>
  );
}

function renderAuthOptions(options: AuthOption[], selectedIndex: number, theme?: ThemeDefinition): JSX.Element[] {
  return options.map((opt, optIndex): JSX.Element => {
    const bullet = optIndex === selectedIndex ? "●" : "  ";
    const label = `${bullet} ${optIndex + 1}. ${opt.label} [${opt.enabled ? "ON" : "OFF"}]`;
    const isSelected = optIndex === selectedIndex;
    return (
      <text key={opt.id} fg={isSelected ? theme?.colors.accent.primary : theme?.colors.text.primary}>
        {label}
      </text>
    );
  });
}

function moveSelection(next: number, length: number, setSelectedIndex: (value: number) => void): void {
  if (length === 0) {
    setSelectedIndex(0);
    return;
  }
  const clamped = Math.max(0, Math.min(next, length - 1));
  setSelectedIndex(clamped);
}
