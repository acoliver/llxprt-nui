import type { JSX } from "react";
import type { ThemeDefinition } from "../theme";

export interface SelectableListItemProps {
  readonly label: string;
  readonly isSelected: boolean;
  readonly isActive?: boolean;
  readonly activeTag?: string;
  readonly theme?: ThemeDefinition;
  readonly width?: number;
}

export function SelectableListItem(props: SelectableListItemProps): JSX.Element {
  const bullet = props.isSelected ? "●" : "○";
  const activeTag = props.isActive === true && props.activeTag ? props.activeTag : "";
  const labelText = `${bullet} ${props.label}${activeTag}`;
  const finalText = props.width != null ? labelText.padEnd(props.width, " ") : labelText;

  return (
    <text fg={props.isSelected ? props.theme?.colors.accent.primary : props.theme?.colors.text.primary}>
      {finalText}
    </text>
  );
}
