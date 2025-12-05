import type { JSX } from "react";
import { useCallback, useMemo, useState } from "react";
import { AuthModal, AUTH_DEFAULTS, MODEL_OPTIONS, PROVIDER_OPTIONS, SearchSelectModal, type AuthOption } from "./modals";
import type { SearchItem } from "./modalTypes";

type ModalState = { type: "none" } | { type: "model" } | { type: "provider" } | { type: "auth" };
const MODAL_COMMANDS: Record<string, ModalState["type"]> = {
  "/model": "model",
  "/provider": "provider",
  "/auth": "auth"
};

export function useModalManager(
  appendLines: (role: "user" | "responder", textLines: string[]) => void
): { modalOpen: boolean; modalElement: JSX.Element | null; handleCommand: (command: string) => boolean } {
  const [modal, setModal] = useState<ModalState>({ type: "none" });
  const [authOptions, setAuthOptions] = useState<AuthOption[]>(AUTH_DEFAULTS);
  const closeModal = useCallback(() => setModal({ type: "none" }), []);
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
    () => renderModal(modal, closeModal, handleModelSelect, handleProviderSelect, handleAuthSave, authOptions),
    [authOptions, closeModal, handleAuthSave, handleModelSelect, handleProviderSelect, modal]
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
  authOptions: AuthOption[]
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
        />
      );
    case "auth":
      return <AuthModal options={authOptions} onClose={closeModal} onSave={handleAuthSave} />;
    default:
      return null;
  }
}
