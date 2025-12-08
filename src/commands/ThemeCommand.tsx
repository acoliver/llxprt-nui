import { useCallback, useEffect, useMemo, useRef, type JSX } from "react";
import { useCommand } from "../providers/CommandProvider";
import { ThemeModal } from "../ui/modals";
import type { ThemeDefinition } from "../features/theme";

interface ThemeCommandProps {
  readonly themes: ThemeDefinition[];
  readonly currentTheme: ThemeDefinition;
  readonly onThemeSelect: (theme: ThemeDefinition) => void;
  readonly appendLines: (role: "user" | "responder", lines: string[]) => void;
  readonly focusInput: () => void;
}

export function ThemeCommand({
  themes,
  currentTheme,
  onThemeSelect,
  appendLines,
  focusInput
}: ThemeCommandProps): JSX.Element | null {
  const { register } = useCommand();
  const dialogClearRef = useRef<(() => void) | null>(null);

  const handleClose = useCallback((): void => {
    if (dialogClearRef.current !== null) {
      dialogClearRef.current();
    }
    focusInput();
  }, [focusInput]);

  const handleSelect = useCallback((theme: ThemeDefinition): void => {
    onThemeSelect(theme);
    appendLines("responder", [`Theme set to ${theme.name}`]);
  }, [onThemeSelect, appendLines]);

  const modal = useMemo(() => (
    <ThemeModal
      themes={themes}
      current={currentTheme}
      onClose={handleClose}
      onSelect={handleSelect}
    />
  ), [themes, currentTheme, handleClose, handleSelect]);

  useEffect(() => {
    const cleanup = register([
      {
        name: "/theme",
        title: "Select Theme",
        category: "appearance",
        onExecute: (dialog) => {
          dialogClearRef.current = dialog.clear;
          dialog.replace(modal);
        }
      }
    ]);

    return cleanup;
  }, [register, modal]);

  return null;
}
