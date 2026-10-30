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

export function reconnectDevice(
  store: SignalStore<DeviceState> & WritableStateSource<DeviceState>,
  deviceService: IDeviceService = inject(DEVICE_SERVICE)
) {
  return {
    reconnectDevice: async (deviceId: string): Promise<void> => {
      const actionMessage = createAction('reconnect-device');

      logInfo(LogType.Start, `DeviceStore: Reconnecting device ${deviceId}`);

      updateState(store, actionMessage, (state) => ({
        reconnectingDeviceIds: [...state.reconnectingDeviceIds, deviceId],
      }));

      try {
        const reconnected = await firstValueFrom(deviceService.reconnectDevice(deviceId));

        updateState(store, actionMessage, (state) => ({
          devices: state.devices.map((device) =>
            device.deviceId === deviceId ? { ...reconnected, isEnabled: device.isEnabled } : device
          ),
        }));

        logInfo(LogType.Success, `DeviceStore: Reconnected device ${deviceId}`);
      } catch (error) {
        // The service already alerted the user; leave the device as it was.
        logError(`DeviceStore: Failed to reconnect device ${deviceId}`, error);
      }

      // A search for the reconnected device may have found or updated other units too. This
      // reads the records-only list (no device contact) rather than calling `findDevices`,
      // which would reset every device's `isEnabled` back to true.
      try {
        const latest = await firstValueFrom(deviceService.findDevices(false));

        updateState(store, actionMessage, (state) => {
          const enabledById = new Map(state.devices.map((device) => [device.deviceId, device.isEnabled]));
          return {
            devices: latest.map((device) => ({
              ...device,
              isEnabled: enabledById.get(device.deviceId) ?? device.isEnabled,
            })),
          };
        });
      } catch (error) {
        logError('DeviceStore: Failed to refresh device list after reconnect', error);
      }

      updateState(store, actionMessage, (state) => ({
        reconnectingDeviceIds: state.reconnectingDeviceIds.filter((id) => id !== deviceId),
      }));

      logInfo(LogType.Finish, `DeviceStore: Reconnect flow complete for device ${deviceId}`);
    },
  };
}
