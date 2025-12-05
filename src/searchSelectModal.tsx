import type { TextareaRenderable } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import { useEffect, useMemo, useRef, useState, type JSX } from "react";
import { filterItems, type SearchItem } from "./modalTypes";
import { ModalShell } from "./modalShell";

const GRID_COLUMNS = 3;
const SEARCH_PAGE_SIZE = GRID_COLUMNS * 6;

export interface SearchSelectProps {
  readonly title: string;
  readonly noun: string;
  readonly items: SearchItem[];
  readonly alphabetical?: boolean;
  readonly footerHint?: string;
  readonly onClose: () => void;
  readonly onSelect: (item: SearchItem) => void;
}

interface SearchState {
  readonly query: string;
  readonly setQuery: (value: string) => void;
  readonly selectedIndex: number;
  readonly setSelectedIndex: (value: number) => void;
}

export function SearchSelectModal(props: SearchSelectProps): JSX.Element {
  const searchRef = useRef<TextareaRenderable>(null);
  const { query, setQuery, selectedIndex, setSelectedIndex } = useSearchState();
  const filtered = useMemo(() => filterItems(props.items, query, props.alphabetical), [props.alphabetical, props.items, query]);
  const { pageStart, visible, startDisplay, endDisplay } = getPagination(filtered, selectedIndex);
  const current = filtered[selectedIndex];

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, setSelectedIndex]);

  useSearchSelectKeys(filtered, selectedIndex, setSelectedIndex, current, props.onSelect, props.onClose);

  return (
    <ModalShell title={props.title} onClose={props.onClose} footer={props.footerHint ? <text>{props.footerHint}</text> : undefined}>
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
      <SearchGrid items={visible} pageStart={pageStart} selectedIndex={selectedIndex} />
    </ModalShell>
  );
}

function useSearchState(): SearchState {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  return { query, setQuery, selectedIndex, setSelectedIndex };
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

function SearchGrid(props: { readonly items: SearchItem[]; readonly pageStart: number; readonly selectedIndex: number }): JSX.Element {
  return <box flexDirection="column" style={{ gap: 0 }}>{renderSearchGrid(props.items, props.pageStart, props.selectedIndex)}</box>;
}

function renderSearchGrid(items: SearchItem[], pageStart: number, selectedIndex: number): JSX.Element[] {
  const rows = chunkItems(items, GRID_COLUMNS);
  const columnWidths = Array.from({ length: GRID_COLUMNS }, (_, col) =>
    Math.max(
      0,
      ...rows.map((row) => (row[col] ? row[col].label.length + 2 : 0))
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

function getPagination(filtered: SearchItem[], selectedIndex: number): {
  pageStart: number;
  visible: SearchItem[];
  startDisplay: number;
  endDisplay: number;
} {
  const pageStart = Math.floor(selectedIndex / SEARCH_PAGE_SIZE) * SEARCH_PAGE_SIZE;
  const visible = filtered.slice(pageStart, pageStart + SEARCH_PAGE_SIZE);
  const startDisplay = filtered.length === 0 ? 0 : pageStart + 1;
  const endDisplay = Math.min(pageStart + visible.length, filtered.length);
  return { pageStart, visible, startDisplay, endDisplay };
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
