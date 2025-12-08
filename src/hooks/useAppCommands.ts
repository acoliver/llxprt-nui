import { useCallback } from "react";
import type { SessionConfig } from "../features/config";
import { listModels, listProviders } from "../features/config";
import { applyConfigCommand, validateSessionConfig } from "../features/config";
import { findTheme, type ThemeDefinition } from "../features/theme";

interface ItemFetchResult {
  items: { id: string; label: string }[];
  messages?: string[];
}

interface ConfigCommandResult {
  handled: boolean;
  nextConfig: SessionConfig;
  messages: string[];
}

interface UseAppCommandsProps {
  sessionConfig: SessionConfig;
  setSessionConfig: (config: SessionConfig) => void;
  themes: ThemeDefinition[];
  setThemeBySlug: (slug: string) => void;
  appendLines: (role: "user" | "model" | "system", lines: string[]) => void;
}

interface UseAppCommandsResult {
  fetchModelItems: () => Promise<ItemFetchResult>;
  fetchProviderItems: () => Promise<ItemFetchResult>;
  applyTheme: (key: string) => void;
  handleConfigCommand: (command: string) => Promise<ConfigCommandResult>;
}

export function useAppCommands({
  sessionConfig,
  setSessionConfig,
  themes,
  setThemeBySlug,
  appendLines,
}: UseAppCommandsProps): UseAppCommandsResult {
  const fetchModelItems = useCallback(async (): Promise<ItemFetchResult> => {
    const missing = validateSessionConfig(sessionConfig, { requireModel: false });
    if (missing.length > 0) {
      return { items: [], messages: missing };
    }
    try {
      const models = await listModels(sessionConfig);
      const items = models.map((model) => ({ id: model.id, label: model.name || model.id }));
      return { items };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { items: [], messages: [`Failed to load models: ${message}`] };
    }
  }, [sessionConfig]);

  const fetchProviderItems = useCallback(async (): Promise<ItemFetchResult> => {
    try {
      const providers = await Promise.resolve(listProviders());
      const items = providers.map((p) => ({ id: p.id, label: p.label }));
      return { items };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { items: [], messages: [`Failed to load providers: ${message}`] };
    }
  }, []);

  const applyTheme = useCallback(
    (key: string) => {
      const match = findTheme(themes, key);
      if (!match) {
        appendLines("system", [`Theme not found: ${key}`]);
        return;
      }
      setThemeBySlug(match.slug);
      appendLines("system", [`Theme set to ${match.name}`]);
    },
    [appendLines, setThemeBySlug, themes]
  );

  const handleConfigCommand = useCallback(
    async (command: string): Promise<ConfigCommandResult> => {
      const configResult = await applyConfigCommand(command, sessionConfig);
      if (configResult.handled) {
        setSessionConfig(configResult.nextConfig);
        if (configResult.messages.length > 0) {
          appendLines("system", configResult.messages);
        }
      }
      return configResult;
    },
    [appendLines, sessionConfig, setSessionConfig]
  );

  return { fetchModelItems, fetchProviderItems, applyTheme, handleConfigCommand };
}
