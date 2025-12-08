import type { ScrollBoxRenderable, TextareaRenderable } from "@opentui/core";
import type { JSX } from "react";
import { useRenderer } from "@opentui/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCompletionManager } from "./completions";
import { usePromptHistory } from "./history";
import { useThemeManager } from "./themeManager";
import type { ThemeDefinition } from "./theme";
import type { SessionConfig } from "./llxprtAdapter";
import { useChatStore } from "./hooks/useChatStore";
import { useInputManager } from "./hooks/useInputManager";
import { useScrollManagement } from "./hooks/useScrollManagement";
import { useStreamingLifecycle } from "./hooks/useStreamingLifecycle";
import { useSelectionClipboard } from "./hooks/useSelectionClipboard";
import { useAppCommands } from "./hooks/useAppCommands";
import { useSuggestionSetup } from "./hooks/useSuggestionSetup";
import {
  useEnterSubmit,
  useFocusAndMount,
  useSuggestionKeybindings,
  useLineIdGenerator,
  useHistoryNavigation
} from "./hooks/useKeyboardHandlers";
import { ChatLayout } from "./components/ChatLayout";
import { buildStatusLabel } from "./components/StatusBar";
import { CommandComponents } from "./components/CommandComponents";
import { DialogProvider, useDialog } from "./providers/DialogProvider";
import { CommandProvider, useCommand } from "./providers/CommandProvider";

const HEADER_TEXT = "LLxprt Code - I'm here to help";

function AppInner(): JSX.Element {
  const scrollRef = useRef<ScrollBoxRenderable | null>(null);
  const textareaRef = useRef<TextareaRenderable | null>(null);
  const [sessionConfig, setSessionConfig] = useState<SessionConfig>({ provider: "openai" });
  const { themes, theme, setThemeBySlug } = useThemeManager();
  const renderer = useRenderer();
  const dialog = useDialog();
  const { trigger: triggerCommand } = useCommand();
  const { suggestions, selectedIndex, refresh: refreshCompletion, clear: clearCompletion, moveSelection, applySelection } = useCompletionManager(textareaRef);
  const { record: recordHistory, handleHistoryKey } = usePromptHistory(textareaRef);
  const makeLineId = useLineIdGenerator();
  const { lines, appendLines, appendToolBlock, promptCount, setPromptCount, responderWordCount, setResponderWordCount, streamState, setStreamState } = useChatStore(makeLineId);
  const { mountedRef, cancelStreaming, startStreamingResponder } = useStreamingLifecycle(appendLines, appendToolBlock, setResponderWordCount, setStreamState);

  useFocusAndMount(textareaRef, mountedRef);

  const focusInput = useCallback(() => { textareaRef.current?.focus(); }, []);
  const handleThemeSelect = useCallback((theme: ThemeDefinition) => { setThemeBySlug(theme.slug); }, [setThemeBySlug]);

  const { fetchModelItems, fetchProviderItems, applyTheme, handleConfigCommand } = useAppCommands({ sessionConfig, setSessionConfig, themes, setThemeBySlug, appendLines });

  useSuggestionSetup(themes);

  const { autoFollow, setAutoFollow, handleContentChange, handleMouseScroll } = useScrollManagement(scrollRef);

  useEffect(() => { handleContentChange(); }, [handleContentChange, lines.length]);

  const handleCommand = useCallback(async (command: string) => {
    const configResult = await handleConfigCommand(command);
    if (configResult.handled) return true;
    if (command.startsWith("/theme")) {
      const parts = command.trim().split(/\s+/);
      if (parts.length === 1) return triggerCommand("/theme");
      applyTheme(parts.slice(1).join(" "));
      return true;
    }
    return triggerCommand(command);
  }, [applyTheme, handleConfigCommand, triggerCommand]);

  const { inputLineCount, enforceInputLineBounds, handleSubmit, handleTabComplete } = useInputManager(textareaRef, appendLines, setPromptCount, setAutoFollow, (prompt) => startStreamingResponder(prompt, sessionConfig), refreshCompletion, clearCompletion, applySelection, handleCommand, recordHistory);

  const statusLabel = useMemo(() => buildStatusLabel(streamState, autoFollow), [autoFollow, streamState]);
  const handleMouseUp = useSelectionClipboard(renderer);
  const handleSubmitWrapped = useCallback(() => { void handleSubmit(); }, [handleSubmit]);

  useEnterSubmit(() => void handleSubmit(), dialog.isOpen);
  useSuggestionKeybindings(dialog.isOpen ? 0 : suggestions.length, moveSelection, handleTabComplete, cancelStreaming, () => { textareaRef.current?.clear(); enforceInputLineBounds(); return Promise.resolve(); }, () => streamState === "streaming");
  useHistoryNavigation(dialog.isOpen, suggestions.length, handleHistoryKey);

  return (
    <>
      <CommandComponents
        fetchModelItems={fetchModelItems}
        fetchProviderItems={fetchProviderItems}
        sessionConfig={sessionConfig}
        setSessionConfig={setSessionConfig}
        appendLines={appendLines}
        themes={themes}
        currentTheme={theme}
        onThemeSelect={handleThemeSelect}
        focusInput={focusInput}
      />
      <ChatLayout headerText={HEADER_TEXT} lines={lines} scrollRef={scrollRef} autoFollow={autoFollow}
        textareaRef={textareaRef} inputLineCount={inputLineCount} enforceInputLineBounds={enforceInputLineBounds}
        handleSubmit={handleSubmitWrapped} statusLabel={statusLabel} promptCount={promptCount}
        responderWordCount={responderWordCount} streamState={streamState} onScroll={handleMouseScroll}
        onMouseUp={handleMouseUp} suggestions={suggestions} selectedSuggestion={selectedIndex} theme={theme} />
    </>
  );
}

function AppWithProviders(): JSX.Element {
  const dialog = useDialog();
  return (
    <CommandProvider dialogContext={dialog}>
      <AppInner />
    </CommandProvider>
  );
}

export function App(): JSX.Element {
  return (
    <DialogProvider>
      <AppWithProviders />
    </DialogProvider>
  );
}
