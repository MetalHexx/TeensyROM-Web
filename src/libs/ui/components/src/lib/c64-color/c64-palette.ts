/** One of the C64's sixteen display colors. */
export interface C64Color {
  /** Firmware color index, 0..15. */
  readonly index: number;
  /** Human-readable name, e.g. "Light Blue". */
  readonly name: string;
  /** Display color as `#RRGGBB`. */
  readonly hex: string;
}

/** Number of colors in the C64 palette. */
export const C64_COLOR_COUNT = 16;

/**
 * The C64's sixteen display colors in firmware index order, using the Colodore palette at its
 * default settings. For display only: the device owns what each index means.
 */
export const C64_PALETTE: readonly C64Color[] = [
  { index: 0, name: 'Black', hex: '#000000' },
  { index: 1, name: 'White', hex: '#FFFFFF' },
  { index: 2, name: 'Red', hex: '#813338' },
  { index: 3, name: 'Cyan', hex: '#75CEC8' },
  { index: 4, name: 'Purple', hex: '#8E3C97' },
  { index: 5, name: 'Green', hex: '#56AC4D' },
  { index: 6, name: 'Blue', hex: '#2E2C9B' },
  { index: 7, name: 'Yellow', hex: '#EDF171' },
  { index: 8, name: 'Orange', hex: '#8E5029' },
  { index: 9, name: 'Brown', hex: '#553800' },
  { index: 10, name: 'Light Red', hex: '#C46C71' },
  { index: 11, name: 'Dark Grey', hex: '#4A4A4A' },
  { index: 12, name: 'Medium Grey', hex: '#7B7B7B' },
  { index: 13, name: 'Light Green', hex: '#A9FF9F' },
  { index: 14, name: 'Light Blue', hex: '#706DEB' },
  { index: 15, name: 'Light Grey', hex: '#B2B2B2' },
];

/** The palette entry for `index`, or `undefined` when it is not an integer in 0..15. */
export function c64Color(index: number): C64Color | undefined {
  return Number.isInteger(index) ? C64_PALETTE[index] : undefined;
}
