import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from "react";
import { useCommand } from "../uicontext";
import { SearchSelectModal } from "../ui/modals";
import type { SearchItem } from "../ui/modals/types";
import type { SessionConfig, ProviderKey } from "../features/config";
import type { ThemeDefinition } from "../features/theme";

interface ProviderCommandProps {
  readonly fetchProviderItems: () => Promise<{ items: SearchItem[]; messages?: string[] }>;
  readonly sessionConfig: SessionConfig;
  readonly setSessionConfig: (config: SessionConfig) => void;
  readonly appendLines: (role: "user" | "model", lines: string[]) => void;
  readonly theme: ThemeDefinition;
  readonly focusInput: () => void;
}

export function ProviderCommand({
  fetchProviderItems,
  sessionConfig,
  setSessionConfig,
  appendLines,
  theme,
  focusInput
}: ProviderCommandProps): JSX.Element | null {
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
    const id = item.id.toLowerCase() as ProviderKey;
    setSessionConfig({ ...sessionConfig, provider: id });
    appendLines("model", [`Selected provider: ${item.label}`]);
    if (dialogClearRef.current !== null) {
      dialogClearRef.current();
    }
    focusInput();
  }, [sessionConfig, setSessionConfig, appendLines, focusInput]);

  const modal = useMemo(() => (
    <SearchSelectModal
      title="Select Provider"
      noun="providers"
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
        name: "/provider",
        title: "Select Provider",
        category: "configuration",
        onExecute: async (dialog) => {
          const result = await fetchProviderItems();
          if (result.messages !== undefined && result.messages.length > 0) {
            appendLines("model", result.messages);
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
  }, [register, fetchProviderItems, appendLines, modal]);

  return null;
}
