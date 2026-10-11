import { inject } from '@angular/core';
import { updateState } from '@angular-architects/ngrx-toolkit';
import { WritableStateSource } from '@ngrx/signals';
import { IDeviceService, DEVICE_SERVICE } from '@teensyrom-nx/domain';
import { createAction, logInfo, logError, LogType } from '@teensyrom-nx/utils';
import { firstValueFrom } from 'rxjs';
import { DeviceState } from '../device-store';

type SignalStore<T> = {
  [K in keyof T]: () => T[K];
};

export function forgetDevice(
  store: SignalStore<DeviceState> & WritableStateSource<DeviceState>,
  deviceService: IDeviceService = inject(DEVICE_SERVICE)
) {
  return {
    forgetDevice: async (deviceId: string): Promise<void> => {
      const actionMessage = createAction('forget-device');

      logInfo(LogType.Start, `DeviceStore: Forgetting device ${deviceId}`);

      try {
        await firstValueFrom(deviceService.forgetDevice(deviceId));

        updateState(store, actionMessage, (state) => ({
          devices: state.devices.filter((device) => device.deviceId !== deviceId),
        }));

        logInfo(LogType.Success, `DeviceStore: Forgot device ${deviceId}`);
      } catch (error) {
        // The service already alerted the user; leave the device as it was.
        logError(`DeviceStore: Failed to forget device ${deviceId}`, error);
      }
    },
  };
}
