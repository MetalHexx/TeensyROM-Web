import { computed } from '@angular/core';
import { StorageState } from '../storage-store';
import { WritableStore } from '../storage-helpers';

export function isDeviceLevelView(store: WritableStore<StorageState>) {
  return {
    isDeviceLevelView: (deviceId: string) =>
      computed<boolean>(() => {
        const selected = store.selectedDirectories()[deviceId];
        return selected?.storageType === null;
      }),
  };
}
