import { ColorTheme, ColorThemeKind } from '@teensyrom-nx/domain';

export const READ_ONLY_TEXT = "Shipped themes can't be changed. Use Save as to keep an edited copy.";

export const MAX_THEME_NAME_LENGTH = 24;

export const INVALID_NAME_TEXT = 'Name must be 1–24 characters with no control characters.';
export const NAME_TAKEN_TEXT = 'A theme with that name already exists.';

/** What the connected devices have on record, as the colors card needs it. */
export type RecordStateText =
  | { kind: 'none' }
  | { kind: 'recorded' }
  | { kind: 'differ'; shownDeviceName: string; deviceNames: string[] };

/** The colors card subtitle: which theme the colors belong to and whether they were changed. */
export function themeSubtitle(theme: ColorTheme | null, isEdited: boolean): string {
  if (!theme) {
    return 'Unsaved colors';
  }
  if (isEdited) {
    return `${theme.name} · Edited`;
  }
  return theme.kind === ColorThemeKind.Custom
    ? `${theme.name} · Custom`
    : `${theme.name} · Shipped, read-only`;
}

/** The colors card info tooltip: where the shown colors come from. */
export function recordInfoText(state: RecordStateText): string {
  switch (state.kind) {
    case 'none':
      return 'No colors on record yet. Showing the TR Default factory colors.';
    case 'recorded':
      return "Shows the colors last applied from TeensyROM Web. Colors changed on the C64's own menu are not seen.";
    case 'differ': {
      const shown = state.shownDeviceName;
      return state.deviceNames.length === 2
        ? `${shown} and ${state.deviceNames[1]} have different colors on record. Showing ${shown}'s colors.`
        : `The connected devices have different colors on record. Showing ${shown}'s colors.`;
    }
  }
}

/** C0 and C1 control characters. */
function hasControlCharacter(text: string): boolean {
  return Array.from(text).some((ch) => {
    const code = ch.charCodeAt(0);
    return code <= 0x1f || (code >= 0x7f && code <= 0x9f);
  });
}

/** Validates a theme name for the Save as dialog; returns an error message, or `''` when valid. */
export function validateThemeName(name: string, existingNames: string[]): string {
  const trimmed = name.trim();
  if (
    trimmed === '' ||
    trimmed.length > MAX_THEME_NAME_LENGTH ||
    hasControlCharacter(name)
  ) {
    return INVALID_NAME_TEXT;
  }
  const lowered = trimmed.toLowerCase();
  if (existingNames.some((n) => n.toLowerCase() === lowered)) {
    return NAME_TAKEN_TEXT;
  }
  return '';
}
