import { patchState, WritableStateSource } from '@ngrx/signals';
import { DeviceState } from '../device-store';

type SignalStore<T> = {
  [K in keyof T]: () => T[K];
};

export function enableDevice(
  store: SignalStore<DeviceState> & WritableStateSource<DeviceState>
) {
  return {
    enableDevice: async (deviceId: string) => {
      patchState(store, {
        devices: store
          .devices()
          .map((d) => (d.deviceId === deviceId ? { ...d, isEnabled: true } : d)),
      });
    },
  };
}

export function disableDevice(
  store: SignalStore<DeviceState> & WritableStateSource<DeviceState>
) {
  return {
    disableDevice: async (deviceId: string) => {
      patchState(store, {
        devices: store
          .devices()
          .map((d) => (d.deviceId === deviceId ? { ...d, isEnabled: false } : d)),
      });
    },
  };
}
