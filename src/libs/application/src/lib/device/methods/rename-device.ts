import { inject } from '@angular/core';
import { updateState } from '../../with-devtools';
import { WritableStateSource } from '@ngrx/signals';
import { IDeviceService, DEVICE_SERVICE } from '@teensyrom-nx/domain';
import { createAction, logInfo, logError, LogType } from '@teensyrom-nx/utils';
import { firstValueFrom } from 'rxjs';
import { DeviceState } from '../device-store';

type SignalStore<T> = {
  [K in keyof T]: () => T[K];
};

export function renameDevice(
  store: SignalStore<DeviceState> & WritableStateSource<DeviceState>,
  deviceService: IDeviceService = inject(DEVICE_SERVICE)
) {
  return {
    /** Resolves `true` once the renamed device is stored, `false` if the API call failed. */
    renameDevice: async (deviceId: string, name: string): Promise<boolean> => {
      const actionMessage = createAction('rename-device');

      logInfo(LogType.Start, `DeviceStore: Renaming device ${deviceId}`);

      try {
        const renamed = await firstValueFrom(deviceService.renameDevice(deviceId, name));

        updateState(store, actionMessage, (state) => ({
          devices: state.devices.map((device) =>
            device.deviceId === deviceId ? { ...renamed, isEnabled: device.isEnabled } : device
          ),
        }));

        logInfo(LogType.Success, `DeviceStore: Renamed device ${deviceId}`);
        return true;
      } catch (error) {
        // The service already alerted the user; leave the device as it was.
        logError(`DeviceStore: Failed to rename device ${deviceId}`, error);
        return false;
      }
    },
  };
}
