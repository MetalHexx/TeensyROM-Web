import { Injectable, inject } from '@angular/core';
import { Observable, catchError, from, map, switchMap, tap, throwError } from 'rxjs';
import { ResponseError, ThemesApiService } from '@teensyrom-nx/data-access/api-client';
import {
  ALERT_SERVICE,
  ColorTheme,
  ColorThemeApplyError,
  DeviceColorRecord,
  DeviceColors,
  IColorThemeService,
} from '@teensyrom-nx/domain';
import { logError } from '@teensyrom-nx/utils';
import { extractErrorMessage, readDeviceBusyProblem } from '../error/api-error.utils';
import { ColorThemeMapper } from './color-theme.mapper';

/**
 * Infrastructure implementation of IColorThemeService over the generated themes client.
 *
 * Every failure except apply raises an alert and is rethrown. Apply raises none: it fails with a
 * ColorThemeApplyError and the caller reports each device's outcome.
 */
@Injectable()
export class ColorThemeService implements IColorThemeService {
  private readonly api = inject(ThemesApiService);
  private readonly alertService = inject(ALERT_SERVICE);

  listThemes(): Observable<ColorTheme[]> {
    return from(this.api.listThemes()).pipe(
      map((response) => response.themes.map(ColorThemeMapper.toColorTheme)),
      this.alertAndRethrow('listThemes', 'Failed to load themes')
    );
  }

  createTheme(name: string, colors: DeviceColors): Observable<ColorTheme> {
    return from(
      this.api.createTheme({
        saveThemeBody: { name, device: ColorThemeMapper.toDeviceThemePartDto(colors) },
      })
    ).pipe(
      map((response) => ColorThemeMapper.toColorTheme(response.theme)),
      this.alertAndRethrow('createTheme', 'Failed to save the theme')
    );
  }

  updateTheme(themeId: string, name: string, colors: DeviceColors): Observable<ColorTheme> {
    return from(
      this.api.updateTheme({
        themeId,
        saveThemeBody: { name, device: ColorThemeMapper.toDeviceThemePartDto(colors) },
      })
    ).pipe(
      map((response) => ColorThemeMapper.toColorTheme(response.theme)),
      this.alertAndRethrow('updateTheme', 'Failed to save the theme')
    );
  }

  deleteTheme(themeId: string): Observable<void> {
    return from(this.api.deleteTheme({ themeId })).pipe(
      map(() => undefined),
      this.alertAndRethrow('deleteTheme', 'Failed to delete the theme')
    );
  }

  getDeviceColors(deviceId: string): Observable<DeviceColorRecord> {
    return from(this.api.getDeviceTheme({ deviceId })).pipe(
      map((response) => ColorThemeMapper.toDeviceColorRecord(response.record)),
      this.alertAndRethrow('getDeviceColors', 'Failed to load the colors on record')
    );
  }

  applyDeviceColors(
    deviceId: string,
    colors: DeviceColors,
    themeId: string | null
  ): Observable<DeviceColorRecord> {
    return from(
      this.api.applyDeviceTheme({
        deviceId,
        applyDeviceThemeBody: { colors: ColorThemeMapper.toDeviceThemePartDto(colors), themeId },
      })
    ).pipe(
      map((response) => ColorThemeMapper.toDeviceColorRecord(response.record)),
      catchError((error) =>
        from(this.toApplyError(deviceId, error)).pipe(
          switchMap((applyError) => throwError(() => applyError))
        )
      )
    );
  }

  private async toApplyError(deviceId: string, error: unknown): Promise<ColorThemeApplyError> {
    const busy = await readDeviceBusyProblem(error);
    if (busy) {
      return new ColorThemeApplyError(deviceId, 'busy', busy.title);
    }
    if (error instanceof ResponseError && error.response?.status === 404) {
      return new ColorThemeApplyError(deviceId, 'notFound', 'The device is not connected.');
    }
    const message = await extractErrorMessage(error, 'The device did not accept the colors.');
    return new ColorThemeApplyError(deviceId, 'failed', message);
  }

  private alertAndRethrow<T>(methodName: string, fallbackMessage: string) {
    return catchError<T, Observable<never>>((error) => {
      logError(`ColorThemeService.${methodName} failed:`, error);
      return from(extractErrorMessage(error, fallbackMessage)).pipe(
        tap((message) => this.alertService.error(message)),
        switchMap(() => throwError(() => error))
      );
    });
  }
}
