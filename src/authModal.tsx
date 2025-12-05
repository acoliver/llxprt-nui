import { useKeyboard } from "@opentui/react";
import { useState, type JSX } from "react";
import { ModalShell } from "./modalShell";

export interface AuthOption {
  readonly id: string;
  readonly label: string;
  readonly enabled: boolean;
}

export function AuthModal(props: {
  readonly options: AuthOption[];
  readonly onClose: () => void;
  readonly onSave: (next: AuthOption[]) => void;
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
    <ModalShell title="OAuth Authentication" onClose={closeWithSave}>
      <text>Select an OAuth provider to authenticate:</text>
      <text>Note: You can also use API keys via /key, /keyfile, --key, --keyfile, or environment variables</text>
      <box flexDirection="column" style={{ gap: 0 }}>{renderAuthOptions(options, index)}</box>
      <text>(Use Enter to select, ESC to close)</text>
      <text>Terms of Services and Privacy Notice for Gemini CLI</text>
      <text>https://github.com/acoliver/llxprt-code/blob/main/docs/tos-privacy.md</text>
    </ModalShell>
  );
}

function renderAuthOptions(options: AuthOption[], selectedIndex: number): JSX.Element[] {
  return options.map((opt, optIndex): JSX.Element => {
    const bullet = optIndex === selectedIndex ? "●" : "  ";
    const label = `${bullet} ${optIndex + 1}. ${opt.label} [${opt.enabled ? "ON" : "OFF"}]`;
    return <text key={opt.id}>{label}</text>;
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
