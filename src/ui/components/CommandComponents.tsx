import type { JSX } from "react";
import type { SessionConfig } from "../../features/config";
import type { ThemeDefinition } from "../../features/theme";
import type { SearchItem } from "../modals/types";
import { ModelCommand } from "../../commands/ModelCommand";
import { ProviderCommand } from "../../commands/ProviderCommand";
import { ThemeCommand } from "../../commands/ThemeCommand";
import { AuthCommand } from "../../commands/AuthCommand";

interface CommandComponentsProps {
  readonly fetchModelItems: () => Promise<{ items: SearchItem[]; messages?: string[] }>;
  readonly fetchProviderItems: () => Promise<{ items: SearchItem[]; messages?: string[] }>;
  readonly sessionConfig: SessionConfig;
  readonly setSessionConfig: (config: SessionConfig) => void;
  readonly appendLines: (role: "user" | "responder", lines: string[]) => void;
  readonly themes: ThemeDefinition[];
  readonly currentTheme: ThemeDefinition;
  readonly onThemeSelect: (theme: ThemeDefinition) => void;
  readonly focusInput: () => void;
}

export function CommandComponents({
  fetchModelItems,
  fetchProviderItems,
  sessionConfig,
  setSessionConfig,
  appendLines,
  themes,
  currentTheme,
  onThemeSelect,
  focusInput
}: CommandComponentsProps): JSX.Element {
  return (
    <>
      <ModelCommand
        fetchModelItems={fetchModelItems}
        sessionConfig={sessionConfig}
        setSessionConfig={setSessionConfig}
        appendLines={appendLines}
        theme={currentTheme}
        focusInput={focusInput}
      />
      <ProviderCommand
        fetchProviderItems={fetchProviderItems}
        sessionConfig={sessionConfig}
        setSessionConfig={setSessionConfig}
        appendLines={appendLines}
        theme={currentTheme}
        focusInput={focusInput}
      />
      <ThemeCommand
        themes={themes}
        currentTheme={currentTheme}
        onThemeSelect={onThemeSelect}
        appendLines={appendLines}
        focusInput={focusInput}
      />
      <AuthCommand
        appendLines={appendLines}
        theme={currentTheme}
        focusInput={focusInput}
      />
    </>
  );
}
