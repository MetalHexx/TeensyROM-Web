/** Whether a color theme ships with the app or was saved by the user. */
export enum ColorThemeKind {
  Shipped = 'Shipped',
  Custom = 'Custom',
}

/** The seven device colors, each a palette index. */
export interface DeviceColors {
  background: number;
  border: number;
  banner: number;
  time: number;
  option: number;
  sources: number;
  name: number;
}

/** The device color slots, in display order. */
export const DEVICE_COLOR_SLOTS: readonly (keyof DeviceColors)[] = [
  'background',
  'border',
  'banner',
  'time',
  'option',
  'sources',
  'name',
];

/** The parts a color theme is made of. The web and CLI parts join later. */
export interface ColorThemeParts {
  device: DeviceColors;
}

export interface ColorTheme {
  id: string;
  name: string;
  kind: ColorThemeKind;
  parts: ColorThemeParts;
}

/** The colors on record for one device. */
export interface DeviceColorRecord {
  deviceId: string;
  colors: DeviceColors;
  themeId: string | null;
  appliedAt: string | null;
  isRecorded: boolean;
}

/** Id of the factory color theme. */
export const FACTORY_COLOR_THEME_ID = 'tr-default';

/** Apply target meaning every connected device. */
export const APPLY_TO_ALL_DEVICES = 'all';

export type ColorThemeApplyFailure = 'busy' | 'notFound' | 'failed';

/** Why applying colors to one device failed. */
export class ColorThemeApplyError extends Error {
  constructor(
    readonly deviceId: string,
    readonly reason: ColorThemeApplyFailure,
    message: string
  ) {
    super(message);
    this.name = 'ColorThemeApplyError';
  }
}
