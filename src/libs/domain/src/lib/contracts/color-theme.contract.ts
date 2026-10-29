import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { ColorTheme, DeviceColorRecord, DeviceColors } from '../models/color-theme.model';

/**
 * Service contract for color themes and the colors on record for each device.
 */
export interface IColorThemeService {
  /** Lists shipped and custom themes. */
  listThemes(): Observable<ColorTheme[]>;

  /** Saves a new custom theme. */
  createTheme(name: string, colors: DeviceColors): Observable<ColorTheme>;

  /** Replaces the name and device colors of a custom theme. */
  updateTheme(themeId: string, name: string, colors: DeviceColors): Observable<ColorTheme>;

  /** Deletes a custom theme. */
  deleteTheme(themeId: string): Observable<void>;

  /** Reads the colors on record for a device. */
  getDeviceColors(deviceId: string): Observable<DeviceColorRecord>;

  /**
   * Sends colors to a device and returns the record afterwards. Fails with a
   * ColorThemeApplyError and raises no alert; the caller reports the outcome.
   */
  applyDeviceColors(
    deviceId: string,
    colors: DeviceColors,
    themeId: string | null
  ): Observable<DeviceColorRecord>;
}

/** Injection token for IColorThemeService. */
export const COLOR_THEME_SERVICE = new InjectionToken<IColorThemeService>('IColorThemeService');
