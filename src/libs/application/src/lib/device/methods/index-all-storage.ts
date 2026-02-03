import { inject } from '@angular/core';
import { patchState, WritableStateSource } from '@ngrx/signals';
import { IStorageService, DEVICE_STORAGE_SERVICE } from '@teensyrom-nx/domain';
import { firstValueFrom } from 'rxjs';
import { DeviceState } from '../device-store';

type SignalStore<T> = {
  [K in keyof T]: () => T[K];
};

export function indexAllStorage(
  store: SignalStore<DeviceState> & WritableStateSource<DeviceState>,
  storageService: IStorageService = inject(DEVICE_STORAGE_SERVICE)
) {
  return {
    indexStorageAllStorage: async () => {
      patchState(store, { isIndexing: true, error: null });
      try {
        await firstValueFrom(storageService.indexAll());
        
        // Update indexExists for all available storage on all devices
        const devices = store.devices();
        const updatedDevices = devices.map(device => {
          const updatedSdStorage = device.sdStorage?.available
            ? { ...device.sdStorage, indexExists: true } as typeof device.sdStorage
            : device.sdStorage;
          
          const updatedUsbStorage = device.usbStorage?.available
            ? { ...device.usbStorage, indexExists: true } as typeof device.usbStorage
            : device.usbStorage;
          
          return {
            ...device,
            sdStorage: updatedSdStorage,
            usbStorage: updatedUsbStorage
          };
        });
        
        patchState(store, { devices: updatedDevices, isIndexing: false });
      } catch (error) {
        patchState(store, { isIndexing: false, error: String(error) });
      }
    },
  };
}
