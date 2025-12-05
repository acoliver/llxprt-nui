import type { JSX } from "react";
import { useCallback, useMemo, useState } from "react";
import { AuthModal, AUTH_DEFAULTS, MODEL_OPTIONS, PROVIDER_OPTIONS, SearchSelectModal, ThemeModal, type AuthOption } from "./modals";
import type { ThemeDefinition } from "./theme";
import type { SearchItem } from "./modalTypes";

type ModalState = { type: "none" } | { type: "model" } | { type: "provider" } | { type: "auth" } | { type: "theme" };
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
  onThemeSelect: (theme: ThemeDefinition) => void
): { modalOpen: boolean; modalElement: JSX.Element | null; handleCommand: (command: string) => boolean } {
  const [modal, setModal] = useState<ModalState>({ type: "none" });
  const [authOptions, setAuthOptions] = useState<AuthOption[]>(AUTH_DEFAULTS);
  const closeModal = useCallback(() => {
    setModal({ type: "none" });
    focusInput();
  }, [focusInput]);
  const handleModelSelect = useCallback(
    (item: SearchItem) => {
      appendLines("responder", [`Selected model: ${item.label}`]);
      closeModal();
    },
    [appendLines, closeModal]
  );

  const handleProviderSelect = useCallback(
    (item: SearchItem) => {
      appendLines("responder", [`Selected provider: ${item.label}`]);
      closeModal();
    },
    [appendLines, closeModal]
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
    (command: string) => {
      const modalType = MODAL_COMMANDS[command];
      if (modalType && modalType !== "none") {
        setModal({ type: modalType });
        return true;
      }
      return false;
    },
    []
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
          items={MODEL_OPTIONS}
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
          items={PROVIDER_OPTIONS}
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
