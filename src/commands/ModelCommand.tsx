import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from "react";
import { useCommand } from "../providers/CommandProvider";
import { SearchSelectModal } from "../searchSelectModal";
import type { SearchItem } from "../modalTypes";
import type { SessionConfig } from "../llxprtAdapter";
import type { ThemeDefinition } from "../theme";

interface ModelCommandProps {
  readonly fetchModelItems: () => Promise<{ items: SearchItem[]; messages?: string[] }>;
  readonly sessionConfig: SessionConfig;
  readonly setSessionConfig: (config: SessionConfig) => void;
  readonly appendLines: (role: "user" | "responder", lines: string[]) => void;
  readonly theme: ThemeDefinition;
  readonly focusInput: () => void;
}

export function ModelCommand({
  fetchModelItems,
  sessionConfig,
  setSessionConfig,
  appendLines,
  theme,
  focusInput
}: ModelCommandProps): JSX.Element | null {
  const { register } = useCommand();
  const dialogClearRef = useRef<(() => void) | null>(null);
  const [modalItems, setModalItems] = useState<SearchItem[]>([]);

  const handleClose = useCallback((): void => {
    if (dialogClearRef.current !== null) {
      dialogClearRef.current();
    }
    focusInput();
  }, [focusInput]);

  const handleSelect = useCallback((item: SearchItem): void => {
    setSessionConfig({ ...sessionConfig, model: item.id });
    appendLines("responder", [`Selected model: ${item.label}`]);
    if (dialogClearRef.current !== null) {
      dialogClearRef.current();
    }
    focusInput();
  }, [sessionConfig, setSessionConfig, appendLines, focusInput]);

  const modal = useMemo(() => (
    <SearchSelectModal
      title="Search Models"
      noun="models"
      items={modalItems}
      alphabetical
      footerHint="Tab to switch modes"
      onClose={handleClose}
      onSelect={handleSelect}
      theme={theme}
    />
  ), [modalItems, handleClose, handleSelect, theme]);

  useEffect(() => {
    const cleanup = register([
      {
        name: "/model",
        title: "Select Model",
        category: "configuration",
        onExecute: async (dialog) => {
          const result = await fetchModelItems();
          if (result.messages !== undefined && result.messages.length > 0) {
            appendLines("responder", result.messages);
          }
          if (result.items.length === 0) {
            return;
          }

          dialogClearRef.current = dialog.clear;
          setModalItems(result.items);
          dialog.replace(modal);
        }
      }
    ]);

    return cleanup;
  }, [register, fetchModelItems, appendLines, modal]);

  return null;
}
