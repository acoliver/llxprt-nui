import type { TextareaRenderable } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import type { JSX } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { filterItems, type SearchItem } from "./modalTypes";

export interface ModalShellProps {
  readonly title: string;
  readonly subtitle?: string;
  readonly width?: number;
  readonly onClose: () => void;
  readonly children: JSX.Element | JSX.Element[];
  readonly footer?: JSX.Element;
}

export interface SearchSelectProps {
  readonly title: string;
  readonly noun: string;
  readonly items: SearchItem[];
  readonly alphabetical?: boolean;
  readonly footerHint?: string;
  readonly onClose: () => void;
  readonly onSelect: (item: SearchItem) => void;
}

export interface AuthOption {
  readonly id: string;
  readonly label: string;
  readonly enabled: boolean;
}

const GRID_COLUMNS = 3;
const SEARCH_PAGE_SIZE = GRID_COLUMNS * 6;

export function ModalShell(props: ModalShellProps): JSX.Element {
  useKeyboard((key) => {
    if (key.name === "escape") {
      key.preventDefault?.();
      props.onClose();
    }
  });

  return (
    <box
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        bg: "#0f172a",
        padding: 1,
        alignItems: "center",
        justifyContent: "center"
      }}
    >
      <box
        border
        style={{
          width: props.width ?? "95%",
          maxWidth: props.width ?? "95%",
          padding: 1,
          flexDirection: "column",
          gap: 1
        }}
      >
        <text>{props.title}</text>
        {props.subtitle ? <text>{props.subtitle}</text> : null}
        <box flexDirection="column" style={{ gap: 1, flexGrow: 1 }}>
          {props.children}
        </box>
        {props.footer ?? null}
      </box>
    </box>
  );
}

export function SearchSelectModal(props: SearchSelectProps): JSX.Element {
  const searchRef = useRef<TextareaRenderable>(null);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filtered = useMemo(() => filterItems(props.items, query, props.alphabetical), [props.alphabetical, props.items, query]);

  const pageStart = Math.floor(selectedIndex / SEARCH_PAGE_SIZE) * SEARCH_PAGE_SIZE;
  const visible = filtered.slice(pageStart, pageStart + SEARCH_PAGE_SIZE);
  const startDisplay = filtered.length === 0 ? 0 : pageStart + 1;
  const endDisplay = Math.min(pageStart + visible.length, filtered.length);

  const current = filtered[selectedIndex];

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useSearchSelectKeys(filtered, selectedIndex, setSelectedIndex, current, props.onSelect, props.onClose);

  return (
    <ModalShell
      title={props.title}
      onClose={props.onClose}
      footer={props.footerHint ? <text>{props.footerHint}</text> : undefined}
    >
      <text>{`Found ${filtered.length} of ${props.items.length} ${props.noun}`}</text>
      <box flexDirection="row" style={{ gap: 1, alignItems: "center" }}>
        <text>{`${props.alphabetical ? "Search" : "Filter"}:`}</text>
        <textarea
          ref={searchRef}
          placeholder="type to filter"
          keyBindings={[{ name: "return", action: "submit" }]}
          onSubmit={() => undefined}
          onContentChange={() => setQuery(searchRef.current?.plainText ?? "")}
          onCursorChange={() => setQuery(searchRef.current?.plainText ?? "")}
          style={{ height: 1, width: "90%", minHeight: 1, maxHeight: 1, paddingLeft: 0, paddingRight: 0, paddingTop: 0, paddingBottom: 0 }}
        />
      </box>
      <text>{`Showing ${startDisplay}-${endDisplay} of ${filtered.length} rows`}</text>
      <box flexDirection="column" style={{ gap: 0 }}>{renderSearchGrid(visible, pageStart, selectedIndex)}</box>
    </ModalShell>
  );
}

export function AuthModal(props: {
  readonly options: AuthOption[];
  readonly onClose: () => void;
  readonly onSave: (next: AuthOption[]) => void;
}): JSX.Element {
  const [options, setOptions] = useState<AuthOption[]>(props.options);
  const [index, setIndex] = useState(0);

  const closeWithSave = (): void => {
    props.onSave(options);
    props.onClose();
  };

  useKeyboard((key) => {
    if (key.eventType !== "press") {
      return;
    }
    if (key.name === "escape") {
      closeWithSave();
      return;
    }
    if (key.name === "up") {
      key.preventDefault?.();
      moveSelection(index - 1, options.length, setIndex);
    } else if (key.name === "down") {
      key.preventDefault?.();
      moveSelection(index + 1, options.length, setIndex);
    } else if (key.name === "return" || key.name === "enter") {
      key.preventDefault?.();
      const current = options[index];
      if (!current) {
        return;
      }
      if (current.id === "close") {
        closeWithSave();
        return;
      }
      setOptions((prev) =>
        prev.map((opt, optIndex) => (optIndex === index ? { ...opt, enabled: !opt.enabled } : opt))
      );
    }
  });

  return (
    <ModalShell title="OAuth Authentication" onClose={closeWithSave}>
      <text>Select an OAuth provider to authenticate:</text>
      <text>Note: You can also use API keys via /key, /keyfile, --key, --keyfile, or environment variables</text>
      <box flexDirection="column" style={{ gap: 0 }}>{renderAuthOptions(options, index)}</box>
      <text>(Use Enter to select, ESC to close)</text>
      <text>Terms of Services and Privacy Notice for Gemini CLI</text>
      <text>https://github.com/acoliver/llxprt-code/blob/main/docs/tos-privacy.md</text>
    </ModalShell>
  );
}

function chunkItems(list: SearchItem[], columns: number): SearchItem[][] {
  const rows: SearchItem[][] = [];
  for (let index = 0; index < list.length; index += columns) {
    rows.push(list.slice(index, index + columns));
  }
  return rows;
}

function moveSelection(next: number, length: number, setSelectedIndex: (value: number) => void): void {
  if (length === 0) {
    setSelectedIndex(0);
    return;
  }
  const clamped = Math.max(0, Math.min(next, length - 1));
  setSelectedIndex(clamped);
}

function useSearchSelectKeys(
  filtered: SearchItem[],
  selectedIndex: number,
  setSelectedIndex: (value: number) => void,
  current: SearchItem | undefined,
  onSelect: (item: SearchItem) => void,
  onClose: () => void
): void {
  useKeyboard((key) => {
    if (key.eventType !== "press") {
      return;
    }
    if (key.name === "escape") {
      onClose();
      return;
    }
    if (filtered.length === 0) {
      return;
    }
    const handlers: Record<string, () => void> = {
      tab: () => moveSelection(selectedIndex + (key.shift ? -1 : 1), filtered.length, setSelectedIndex),
      return: () => {
        if (current) {
          onSelect(current);
        }
      },
      enter: () => {
        if (current) {
          onSelect(current);
        }
      },
      up: () => moveSelection(selectedIndex - GRID_COLUMNS, filtered.length, setSelectedIndex),
      down: () => moveSelection(selectedIndex + GRID_COLUMNS, filtered.length, setSelectedIndex),
      left: () => moveSelection(selectedIndex - 1, filtered.length, setSelectedIndex),
      right: () => moveSelection(selectedIndex + 1, filtered.length, setSelectedIndex)
    };
    const handler = handlers[key.name ?? ""];
    if (handler) {
      key.preventDefault?.();
      handler();
    }
  });
}

function renderSearchGrid(items: SearchItem[], pageStart: number, selectedIndex: number): JSX.Element[] {
  const rows = chunkItems(items, GRID_COLUMNS);
  const columnWidths = Array.from({ length: GRID_COLUMNS }, (_, col) =>
    Math.max(
      0,
      ...rows.map((row) => (row[col] ? row[col].label.length + 2 : 0)) // bullet + space
    )
  );

  return rows.map((row, rowIndex) => (
    <box key={`row-${rowIndex}`} flexDirection="row" style={{ gap: 2 }}>
      {row.map((item, index) =>
        renderSearchItem(item, pageStart + rowIndex * GRID_COLUMNS + index, selectedIndex, columnWidths[index] ?? item.label.length + 2)
      )}
    </box>
  ));
}

function renderSearchItem(item: SearchItem, absoluteIndex: number, selectedIndex: number, width: number): JSX.Element {
  const bullet = absoluteIndex === selectedIndex ? "●" : "○";
  const label = `${bullet} ${item.label}`.padEnd(width + 2, " ");
  return <text key={item.id}>{label}</text>;
}

function renderAuthOptions(options: AuthOption[], selectedIndex: number): JSX.Element[] {
  return options.map((opt, optIndex) => renderAuthRow(opt, optIndex, selectedIndex));
}

function renderAuthRow(option: AuthOption, index: number, selectedIndex: number): JSX.Element {
  const bullet = index === selectedIndex ? "●" : "  ";
  return <text key={option.id}>{`${bullet} ${index + 1}. ${option.label} [${option.enabled ? "ON" : "OFF"}]`}</text>;
}

export const MODEL_OPTIONS: SearchItem[] = [
  { id: "qwen-72b", label: "Qwen/Qwen2.5-72B-Instruct" },
  { id: "qwen-coder-32b", label: "Qwen/Qwen2.5-Coder-32B-Instruct" },
  { id: "qwen-vl-32b", label: "Qwen/Qwen2.5-VL-32B-Instruct" },
  { id: "qwen-vl-72b", label: "Qwen/Qwen2.5-VL-72B-Instruct" },
  { id: "qwen3-14b", label: "Qwen/Qwen3-14B" },
  { id: "qwen3-235b-a22b", label: "Qwen/Qwen3-235B-A22B" },
  { id: "qwen3-235b-a22b-instruct", label: "Qwen/Qwen3-235B-A22B-Instruct-2507" },
  { id: "qwen3-235b-a22b-thinking", label: "Qwen/Qwen3-235B-A22B-Thinking-2507" },
  { id: "qwen3-30b-a3b", label: "Qwen/Qwen3-30B-A3B" },
  { id: "qwen3-30b-a3b-instruct", label: "Qwen/Qwen3-30B-A3B-Instruct-2507" },
  { id: "qwen3-32b", label: "Qwen/Qwen3-32B" },
  { id: "qwen3-coder-30b", label: "Qwen/Qwen3-Coder-30B-A3B-Instruct" },
  { id: "qwen3-coder-480b", label: "Qwen/Qwen3-Coder-480B-A35B-Instruct-FP8" },
  { id: "qwen3-next-80b", label: "Qwen/Qwen3-Next-80B-A3B-Instruct" },
  { id: "qwen3-vl-235b-instruct", label: "Qwen/Qwen3-VL-235B-A22B-Instruct" },
  { id: "qwen3-vl-235b-thinking", label: "Qwen/Qwen3-VL-235B-A22B-Thinking" },
  { id: "rednote-dots", label: "rednote-hilab/dots.ocr" },
  { id: "deepseek-r1t", label: "tngtech/DeepSeek-R1T-Chimera" },
  { id: "deepseek-r1t2", label: "tngtech/DeepSeek-TNG-R1T2-Chimera" },
  { id: "tng-chimera", label: "tngtech/TNG-R1T-Chimera" },
  { id: "unsloth-gemma-12b", label: "unsloth/gemma-3-12b-it" },
  { id: "unsloth-gemma-27b", label: "unsloth/gemma-3-27b-it" },
  { id: "unsloth-gemma-4b", label: "unsloth/gemma-3-4b-it" },
  { id: "unsloth-mistral-nemo", label: "unsloth/Mistral-Nemo-Instruct-2407" },
  { id: "unsloth-mistral-small", label: "unsloth/Mistral-Small-24B-Instruct-2501" },
  { id: "zai-glm-45", label: "zai-org/GLM-4.5" },
  { id: "zai-glm-45-air", label: "zai-org/GLM-4.5-Air" },
  { id: "zai-glm-46", label: "zai-org/GLM-4.6" }
];

export const PROVIDER_OPTIONS: SearchItem[] = [
  { id: "anthropic", label: "anthropic" },
  { id: "gemini", label: "gemini" },
  { id: "openai", label: "openai" },
  { id: "cerebras", label: "Cerebras Code" },
  { id: "chutes", label: "Chutes.ai" },
  { id: "fireworks", label: "Fireworks" },
  { id: "llama-cpp", label: "llama.cpp" },
  { id: "lm-studio", label: "LM Studio" },
  { id: "openrouter", label: "OpenRouter" },
  { id: "qwen", label: "qwen" },
  { id: "synthetic", label: "Synthetic" },
  { id: "xai", label: "xAI" }
];

export const AUTH_DEFAULTS: AuthOption[] = [
  { id: "gemini", label: "1. Gemini (Google OAuth)", enabled: true },
  { id: "qwen", label: "2. Qwen (OAuth)", enabled: true },
  { id: "anthropic", label: "3. Anthropic Claude (OAuth)", enabled: true },
  { id: "close", label: "4. Close", enabled: false }
];
