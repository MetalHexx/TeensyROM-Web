import { inject } from '@angular/core';
import { IDeviceService, DEVICE_SERVICE } from '@teensyrom-nx/domain';
import { DeviceState } from '../device-store';
import { firstValueFrom } from 'rxjs';

type SignalStore<T> = {
  [K in keyof T]: () => T[K];
};

export function pingAllDevices(
  store: SignalStore<DeviceState>,
  deviceService: IDeviceService = inject(DEVICE_SERVICE)
) {
  return {
    pingAllDevices: async () => {
      const devices = store.devices();
      // allSettled: a failing ping (device service alerts and rethrows) must not leave the
      // other devices' pings unhandled or the call rejected.
      await Promise.allSettled(
        devices.map((device) => firstValueFrom(deviceService.pingDevice(device.deviceId)))
      );
    },
  };
}
