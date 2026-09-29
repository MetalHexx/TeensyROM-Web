import { IDeviceService, DEVICE_SERVICE } from '@teensyrom-nx/domain';
import { DeviceState } from '../device-store';
import { firstValueFrom } from 'rxjs';
import { inject } from '@angular/core';
import { IPlayerContext, PLAYER_CONTEXT } from '../../player/player-context.interface';

type SignalStore<T> = {
  [K in keyof T]: () => T[K];
};

export function resetAllDevices(
  store: SignalStore<DeviceState>,
  deviceService: IDeviceService = inject(DEVICE_SERVICE),
  playerContext: IPlayerContext = inject(PLAYER_CONTEXT)
) {
  return {
    resetAllDevices: async () => {
      const devices = store.devices();

      const results = await Promise.allSettled(
        devices.map((device) => firstValueFrom(deviceService.resetDevice(device.deviceId)))
      );

      // Only a device whose own reset actually succeeded gets reflected into the player - a
      // failed reset leaves that device's player as it was, while the others still are.
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          playerContext.reflectDeviceReset(devices[index].deviceId);
        }
      });
    },
  };
}
