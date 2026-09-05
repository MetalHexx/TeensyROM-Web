import { inject, computed } from '@angular/core';
import { signalStore, withMethods, withState, withComputed } from '@ngrx/signals';
import { withDevtools } from '@angular-architects/ngrx-toolkit';
import {
  Device,
  DEVICE_SERVICE,
  IDeviceService,
  DEVICE_STORAGE_SERVICE,
  IStorageService,
} from '@teensyrom-nx/domain';
import { findDevices, connectTcpDevice, enableDevice, disableDevice } from './methods/index';
import { indexStorage } from './methods/index-storage';
import { indexAllStorage } from './methods/index-all-storage';
import { resetAllDevices } from './methods/reset-all-devices';
import { pingAllDevices } from './methods/ping-devices';

export type DeviceState = {
  devices: Device[];
  hasInitialised: boolean;
  isLoading: boolean;
  isIndexing: boolean;
  error: string | null;
};

const initialState: DeviceState = {
  devices: [],
  hasInitialised: false,
  isLoading: true,
  isIndexing: false,
  error: null,
};

export const DeviceStore = signalStore(
  { providedIn: 'root' },
  withDevtools('devices'),
  withState(initialState),
  withComputed((store) => ({
    hasEnabledDevices: computed(() => store.devices().some((device) => device.isEnabled)),
  })),
  withMethods(
    (
      store,
      deviceService: IDeviceService = inject(DEVICE_SERVICE),
      storageService: IStorageService = inject(DEVICE_STORAGE_SERVICE)
    ) => ({
      ...findDevices(store, deviceService),
      ...connectTcpDevice(store, deviceService),
      ...enableDevice(store),
      ...disableDevice(store),
      ...indexStorage(store, storageService),
      ...indexAllStorage(store, storageService),
      ...resetAllDevices(store, deviceService),
      ...pingAllDevices(store, deviceService),
    })
  )
);
