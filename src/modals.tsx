export { ModalShell, type ModalShellProps } from "./modalShell";
export { SearchSelectModal, type SearchSelectProps } from "./searchSelectModal";
export { AuthModal, type AuthOption } from "./authModal";
export { ThemeModal } from "./themeModal";
export { filterItems, type SearchItem } from "./modalTypes";

// Default auth options used by the auth dialog
import type { AuthOption } from "./authModal";
export const AUTH_DEFAULTS: AuthOption[] = [
  { id: "gemini", label: "1. Gemini (Google OAuth)", enabled: true },
  { id: "qwen", label: "2. Qwen (OAuth)", enabled: true },
  { id: "anthropic", label: "3. Anthropic Claude (OAuth)", enabled: true },
  { id: "close", label: "4. Close", enabled: false }
];
