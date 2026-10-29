import { updateState } from '@angular-architects/ngrx-toolkit';
import { firstValueFrom } from 'rxjs';
import {
  ColorThemeApplyError,
  Device,
  DeviceColorRecord,
  IAlertService,
  IColorThemeService,
} from '@teensyrom-nx/domain';
import { createAction, logError, logInfo, LogType } from '@teensyrom-nx/utils';
import { ColorThemeActionStore, deviceLabel } from './action-store';

function failureMessage(subject: string, device: Device, error: unknown): string {
  const target = deviceLabel(device);
  const applyError = error instanceof ColorThemeApplyError ? error : null;
  switch (applyError?.reason) {
    case 'busy':
      return `Applying ${subject} to ${target} failed because the device is busy with a transfer.`;
    case 'notFound':
      return `Applying ${subject} to ${target} failed because the device is not connected.`;
    default:
      return `Applying ${subject} to ${target} failed: ${(error as Error)?.message ?? 'unknown error'}`;
  }
}

export function apply(
  store: ColorThemeActionStore,
  service: IColorThemeService,
  alertService: IAlertService
) {
  return {
    /**
     * Sends the draft to every target device at once and reports each device's outcome with its own
     * alert. Records are stored only for the devices that accepted the colors.
     */
    apply: async (): Promise<void> => {
      const devices = store.targetDevices();
      if (devices.length === 0) {
        return;
      }

      const draft = store.draft();
      const themeId = store.unchangedThemeId();
      const themeName = themeId ? store.themes().find((t) => t.id === themeId)?.name : undefined;
      const subject = themeName ? `“${themeName}”` : 'the colors';

      const actionMessage = createAction('apply-color-theme');
      logInfo(LogType.Start, `ColorTheme: Applying colors to ${devices.length} device(s)`, {
        actionMessage,
      });
      updateState(store, actionMessage, (state) => ({ ...state, isApplying: true }));

      const results = await Promise.allSettled(
        devices.map((d) => firstValueFrom(service.applyDeviceColors(d.deviceId, draft, themeId)))
      );

      const applied: DeviceColorRecord[] = [];
      results.forEach((result, i) => {
        const device = devices[i];
        if (result.status === 'fulfilled') {
          applied.push(result.value);
          alertService.success(
            themeName
              ? `${subject} was applied to ${deviceLabel(device)}.`
              : `The colors were applied to ${deviceLabel(device)}.`
          );
        } else {
          logError(`ColorTheme: Apply failed for ${device.deviceId}:`, result.reason);
          alertService.error(failureMessage(subject, device, result.reason));
        }
      });

      updateState(store, actionMessage, (state) => ({
        ...state,
        records: {
          ...state.records,
          ...Object.fromEntries(applied.map((r) => [r.deviceId, r])),
        },
        isApplying: false,
      }));

      logInfo(LogType.Finish, 'ColorTheme: Apply finished');
    },
  };
}
