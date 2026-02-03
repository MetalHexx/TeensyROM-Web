import { inject } from '@angular/core';
import { patchState, WritableStateSource } from '@ngrx/signals';
import { IStorageService, DEVICE_STORAGE_SERVICE, StorageType } from '@teensyrom-nx/domain';
import { firstValueFrom } from 'rxjs';
import { DeviceState } from '../device-store';

type SignalStore<T> = {
  [K in keyof T]: () => T[K];
};

export function indexStorage(
  store: SignalStore<DeviceState> & WritableStateSource<DeviceState>,
  storageService: IStorageService = inject(DEVICE_STORAGE_SERVICE)
) {
  return {
    indexStorage: async (deviceId: string, storageType: StorageType, startingPath?: string) => {
      patchState(store, { isIndexing: true, error: null });
      try {
        await firstValueFrom(storageService.index(deviceId, storageType, startingPath));
        
        const devices = store.devices();
        const updatedDevices = devices.map(device => {
          if (device.deviceId !== deviceId) {
            return device;
          }
          
          if (storageType === StorageType.Sd) {
            return {
              ...device,
              sdStorage: device.sdStorage ? { ...device.sdStorage, indexExists: true } as typeof device.sdStorage : device.sdStorage
            };
          } else {
            return {
              ...device,
              usbStorage: device.usbStorage ? { ...device.usbStorage, indexExists: true } as typeof device.usbStorage : device.usbStorage
            };
          }
        });
        
        patchState(store, { devices: updatedDevices, isIndexing: false });
      } catch (error) {
        patchState(store, { isIndexing: false, error: String(error) });
      }
    },
  };
}
