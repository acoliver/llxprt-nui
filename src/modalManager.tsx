import type { JSX } from "react";
import { useCallback, useMemo, useState } from "react";
import { AuthModal, AUTH_DEFAULTS, SearchSelectModal, ThemeModal, type AuthOption } from "./modals";
import type { ThemeDefinition } from "./theme";
import type { SearchItem } from "./modalTypes";
import type { SessionConfig, ProviderKey } from "./llxprtAdapter";

type ModalState =
  | { type: "none" }
  | { type: "model"; items: SearchItem[] }
  | { type: "provider"; items: SearchItem[] }
  | { type: "auth" }
  | { type: "theme" };

const MODAL_COMMANDS: Record<string, ModalState["type"]> = {
  "/model": "model",
  "/provider": "provider",
  "/auth": "auth",
  "/theme": "theme"
};

export function useModalManager(
  appendLines: (role: "user" | "responder", textLines: string[]) => void,
  focusInput: () => void,
  themes: ThemeDefinition[],
  currentTheme: ThemeDefinition,
  onThemeSelect: (theme: ThemeDefinition) => void,
  sessionConfig: SessionConfig,
  setSessionConfig: (next: SessionConfig) => void,
  fetchModelItems: () => Promise<{ items: SearchItem[]; messages?: string[] }>,
  fetchProviderItems: () => Promise<{ items: SearchItem[]; messages?: string[] }>
): { modalOpen: boolean; modalElement: JSX.Element | null; handleCommand: (command: string) => Promise<boolean> } {
  const [modal, setModal] = useState<ModalState>({ type: "none" });
  const [authOptions, setAuthOptions] = useState<AuthOption[]>(AUTH_DEFAULTS);

  const closeModal = useCallback(() => {
    setModal({ type: "none" });
    focusInput();
  }, [focusInput]);

  const handleModelSelect = useCallback(
    (item: SearchItem) => {
      setSessionConfig({ ...sessionConfig, model: item.id });
      appendLines("responder", [`Selected model: ${item.label}`]);
      closeModal();
    },
    [appendLines, closeModal, sessionConfig, setSessionConfig]
  );

  const handleProviderSelect = useCallback(
    (item: SearchItem) => {
      const id = item.id.toLowerCase() as ProviderKey;
      if (id === "openai" || id === "gemini" || id === "anthropic") {
        setSessionConfig({ ...sessionConfig, provider: id });
        appendLines("responder", [`Selected provider: ${item.label}`]);
      } else {
        appendLines("responder", [`Unsupported provider: ${item.id}`]);
      }
      closeModal();
    },
    [appendLines, closeModal, sessionConfig, setSessionConfig]
  );

  const handleAuthSave = useCallback(
    (next: AuthOption[]) => {
      setAuthOptions(next);
      const enabled = next.filter((opt) => opt.id !== "close" && opt.enabled).map((opt) => opt.label.replace(/^\d+\.\s*/, ""));
      appendLines("responder", [`Auth providers: ${enabled.join(", ") || "none"}`]);
    },
    [appendLines]
  );

  const modalElement: JSX.Element | null = useMemo(
    () =>
      renderModal(
        modal,
        closeModal,
        handleModelSelect,
        handleProviderSelect,
        handleAuthSave,
        authOptions,
        themes,
        currentTheme,
        onThemeSelect,
        appendLines
      ),
    [appendLines, authOptions, closeModal, currentTheme, handleAuthSave, handleModelSelect, handleProviderSelect, modal, onThemeSelect, themes]
  );

  const handleCommand = useCallback(
    async (command: string) => {
      const modalType = MODAL_COMMANDS[command.trim()];
      if (!modalType || modalType === "none") {
        return false;
      }
      if (modalType === "model") {
        const result = await fetchModelItems();
        if (result.messages?.length) {
          appendLines("responder", result.messages);
        }
        if (result.items.length === 0) {
          return true;
        }
        setModal({ type: "model", items: result.items });
        return true;
      }
      if (modalType === "provider") {
        const result = await fetchProviderItems();
        if (result.messages?.length) {
          appendLines("responder", result.messages);
        }
        if (result.items.length === 0) {
          return true;
        }
        setModal({ type: "provider", items: result.items });
        return true;
      }
      setModal({ type: modalType });
      return true;
    },
    [appendLines, fetchModelItems, fetchProviderItems]
  );

  return { modalOpen: modal.type !== "none", modalElement, handleCommand };
}

function renderModal(
  modal: ModalState,
  closeModal: () => void,
  handleModelSelect: (item: SearchItem) => void,
  handleProviderSelect: (item: SearchItem) => void,
  handleAuthSave: (next: AuthOption[]) => void,
  authOptions: AuthOption[],
  themes: ThemeDefinition[],
  currentTheme: ThemeDefinition,
  onThemeSelect: (theme: ThemeDefinition) => void,
  appendLines: (role: "user" | "responder", textLines: string[]) => void
): JSX.Element | null {
  switch (modal.type) {
    case "model":
      return (
        <SearchSelectModal
          title="Search Models"
          noun="models"
          items={modal.items}
          alphabetical
          footerHint="Tab to switch modes"
          onClose={closeModal}
          onSelect={handleModelSelect}
          theme={currentTheme}
        />
      );
    case "provider":
      return (
        <SearchSelectModal
          title="Select Provider"
          noun="providers"
          items={modal.items}
          alphabetical
          footerHint="Tab to switch modes"
          onClose={closeModal}
          onSelect={handleProviderSelect}
          theme={currentTheme}
        />
      );
    case "auth":
      return <AuthModal options={authOptions} onClose={closeModal} onSave={handleAuthSave} theme={currentTheme} />;
    case "theme":
      return (
        <ThemeModal
          themes={themes}
          current={currentTheme}
          onClose={closeModal}
          onSelect={(theme) => {
            onThemeSelect(theme);
            appendLines("responder", [`Theme set to ${theme.name}`]);
          }}
        />
      );
    default:
      return null;
  }
}
