import { inject, computed } from '@angular/core';
import { signalStore, withMethods, withState, withComputed } from '@ngrx/signals';
import { withDevtools } from '@angular-architects/ngrx-toolkit';
import {
  Device,
  DEVICE_SERVICE,
  IDeviceService,
  CRT_STORAGE,
  ICrtStorage,
  DEVICE_STORAGE_SERVICE,
  IStorageService,
  DeviceState as DeviceConnectionState,
} from '@teensyrom-nx/domain';
import {
  findDevices,
  enableDevice,
  disableDevice,
  reconnectDevice,
  forgetDevice,
  renameDevice,
} from './methods/index';
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
  reconnectingDeviceIds: string[];
};

const initialState: DeviceState = {
  devices: [],
  hasInitialised: false,
  isLoading: true,
  isIndexing: false,
  error: null,
  reconnectingDeviceIds: [],
};

export const DeviceStore = signalStore(
  { providedIn: 'root' },
  withDevtools('devices'),
  withState(initialState),
  withComputed((store) => {
    const usableDevices = computed(() =>
      store
        .devices()
        .filter(
          (device) => device.isEnabled && device.deviceState !== DeviceConnectionState.ConnectionLost
        )
    );

    return {
      usableDevices,
      hasEnabledDevices: computed(() => usableDevices().length > 0),
    };
  }),
  withMethods(
    (
      store,
      deviceService: IDeviceService = inject(DEVICE_SERVICE),
      storageService: IStorageService = inject(DEVICE_STORAGE_SERVICE),
      crtStorage: ICrtStorage = inject(CRT_STORAGE)
    ) => ({
      ...findDevices(store, deviceService),
      ...enableDevice(store),
      ...disableDevice(store),
      ...reconnectDevice(store, deviceService),
      ...forgetDevice(store, deviceService, crtStorage),
      ...renameDevice(store, deviceService),
      ...indexStorage(store, storageService),
      ...indexAllStorage(store, storageService),
      ...resetAllDevices(store, deviceService),
      ...pingAllDevices(store, deviceService),
    })
  )
);
