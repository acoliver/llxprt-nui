import { useKeyboard } from "@opentui/react";
import { useEffect, useMemo, useRef, useState, type JSX } from "react";
import type { TextareaRenderable } from "@opentui/core";
import { ModalShell } from "./modalShell";
import type { ThemeDefinition } from "./theme";

export interface ThemeModalProps {
  readonly themes: ThemeDefinition[];
  readonly current: ThemeDefinition;
  readonly onClose: () => void;
  readonly onSelect: (theme: ThemeDefinition) => void;
}

export function ThemeModal(props: ThemeModalProps): JSX.Element {
  const searchRef = useRef<TextareaRenderable>(null);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filtered = useMemo(() => filterThemes(props.themes, query), [props.themes, query]);
  const selected = filtered[selectedIndex] ?? filtered[0] ?? props.current;

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useKeyboard((key) => {
    if (key.eventType !== "press") {
      return;
    }
    if (key.name === "escape") {
      props.onClose();
      return;
    }
    if (filtered.length === 0) {
      return;
    }
    if (key.name === "down") {
      key.preventDefault?.();
      setSelectedIndex((index) => clampIndex(index + 1, filtered.length));
    } else if (key.name === "up") {
      key.preventDefault?.();
      setSelectedIndex((index) => clampIndex(index - 1, filtered.length));
    } else if (key.name === "return" || key.name === "enter") {
      key.preventDefault?.();
      const currentSelection = filtered[selectedIndex] ?? filtered[0];
      if (currentSelection) {
        props.onSelect(currentSelection);
      }
      props.onClose();
    }
  });

  const countLabel = `Found ${filtered.length} of ${props.themes.length} themes`;

  return (
    <ModalShell title="Select Theme" onClose={props.onClose} theme={props.current}>
      <text fg={props.current.colors.text.primary}>{countLabel}</text>
      <box flexDirection="row" style={{ gap: 1, alignItems: "center" }}>
        <text fg={props.current.colors.text.primary}>Filter:</text>
        <textarea
          ref={searchRef}
          placeholder="type to filter"
          keyBindings={[{ name: "return", action: "submit" }]}
          onSubmit={() => undefined}
          onContentChange={() => setQuery(searchRef.current?.plainText ?? "")}
          onCursorChange={() => setQuery(searchRef.current?.plainText ?? "")}
          style={{
            height: 1,
            width: "90%",
            minHeight: 1,
            maxHeight: 1,
            paddingLeft: 0,
            paddingRight: 0,
            paddingTop: 0,
            paddingBottom: 0,
            fg: props.current.colors.input.fg,
            bg: props.current.colors.input.bg,
            borderColor: props.current.colors.input.border
          }}
        />
      </box>
      <box flexDirection="row" style={{ gap: 1, height: 14 }}>
        <ThemeList
          themes={filtered}
          selectedIndex={selectedIndex}
          activeSlug={props.current.slug}
          displayTheme={props.current}
        />
        <ThemePreview theme={selected} />
      </box>
    </ModalShell>
  );
}

function ThemeList(props: { readonly themes: ThemeDefinition[]; readonly selectedIndex: number; readonly activeSlug: string; readonly displayTheme: ThemeDefinition }): JSX.Element {
  return (
    <scrollbox
      style={{
        width: "45%",
        border: true,
        borderColor: props.displayTheme.colors.panel.border,
        paddingLeft: 1,
        paddingRight: 1
      }}
      scrollY
    >
      <box flexDirection="column" style={{ gap: 0 }}>
        {props.themes.map((theme, index) => renderThemeRow(theme, index, props.selectedIndex, props.activeSlug, props.displayTheme))}
      </box>
    </scrollbox>
  );
}

function renderThemeRow(
  theme: ThemeDefinition,
  index: number,
  selectedIndex: number,
  activeSlug: string,
  displayTheme: ThemeDefinition
): JSX.Element {
  const isSelected = index === selectedIndex;
  const isActive = theme.slug === activeSlug;
  const bullet = isSelected ? "●" : "○";
  const activeTag = isActive ? " (active)" : "";
  const label = `${bullet} ${theme.name}${activeTag}`;
  return (
    <text key={theme.slug} fg={isSelected ? displayTheme.colors.accent.primary : displayTheme.colors.text.primary}>
      {label}
    </text>
  );
}

function ThemePreview({ theme }: { readonly theme: ThemeDefinition }): JSX.Element {
  return (
    <box
      border
      style={{
        flexGrow: 1,
        padding: 1,
        borderColor: theme.colors.panel.border,
        backgroundColor: theme.colors.panel.bg,
        gap: 0,
        flexDirection: "column"
      }}
    >
      <text fg={theme.colors.panel.headerFg ?? theme.colors.text.primary} bg={theme.colors.panel.headerBg ?? theme.colors.panel.bg}>
        {`${theme.name} (${theme.kind})`}
      </text>
      <text fg={theme.colors.text.user}>[user] Hello world</text>
      <text fg={theme.colors.text.responder}>[responder] A thoughtful reply</text>
      <text fg={theme.colors.text.thinking}>[thinking] Considering options...</text>
      <text fg={theme.colors.text.tool}>[tool] SearchInFile src/app.tsx</text>
      <text fg={theme.colors.diff.addedFg} bg={theme.colors.diff.addedBg}>
        + diff added line
      </text>
      <text fg={theme.colors.diff.removedFg} bg={theme.colors.diff.removedBg}>
        - diff removed line
      </text>
    </box>
  );
}

function filterThemes(themes: ThemeDefinition[], query: string): ThemeDefinition[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return themes;
  }
  return themes.filter(
    (theme) => theme.name.toLowerCase().includes(normalized) || theme.slug.toLowerCase().includes(normalized) || theme.kind.toLowerCase().includes(normalized)
  );
}

function clampIndex(next: number, length: number): number {
  if (length === 0) {
    return 0;
  }
  return Math.max(0, Math.min(next, length - 1));
}
