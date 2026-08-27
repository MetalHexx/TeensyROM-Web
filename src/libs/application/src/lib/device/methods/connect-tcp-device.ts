import { inject } from '@angular/core';
import { patchState, WritableStateSource } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { DEVICE_SERVICE, IDeviceService } from '@teensyrom-nx/domain';
import { DeviceState } from '../device-store';

type SignalStore<T> = {
  [K in keyof T]: () => T[K];
};

/** Connects directly to a device without waiting for network discovery. */
export function connectTcpDevice(
  store: SignalStore<DeviceState> & WritableStateSource<DeviceState>,
  deviceService: IDeviceService = inject(DEVICE_SERVICE)
) {
  return {
    connectTcpDevice: async (ipAddress: string) => {
      patchState(store, { isLoading: true, error: null });

      try {
        const device = await firstValueFrom(deviceService.connectTcpDevice(ipAddress));
        patchState(store, {
          devices: [...store.devices().filter((existing) => existing.deviceId !== device.deviceId), device],
          isLoading: false,
          hasInitialised: true,
        });
      } catch (error) {
        patchState(store, {
          error: String(error),
          isLoading: false,
          hasInitialised: true,
        });
      }
    },
  };
}
