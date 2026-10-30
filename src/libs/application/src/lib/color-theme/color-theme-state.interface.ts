import { ColorTheme, DeviceColorRecord, DeviceColors } from '@teensyrom-nx/domain';

/** Color-theme store state: the theme list, the seven-color draft and the per-device records. */
export interface ColorThemeState {
  themes: ColorTheme[];
  selectedThemeId: string | null;
  /** The seven device colors being edited. */
  draft: DeviceColors;
  /** Colors on record, by deviceId. */
  records: Record<string, DeviceColorRecord>;
  /** APPLY_TO_ALL_DEVICES or a deviceId. */
  applyTarget: string;
  hasInitialised: boolean;
  isLoading: boolean;
  isSaving: boolean;
  isApplying: boolean;
  error: string | null;
}
