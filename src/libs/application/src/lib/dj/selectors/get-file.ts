import { computed } from '@angular/core';
import { StorageType } from '@teensyrom-nx/domain';
import { DjState, DjFileEntry, WritableStore } from '../dj-store';
import { DjFileKeyUtil } from '../dj-file-key.util';

export function getFile(store: WritableStore<DjState>) {
  return {
    getFile: (deviceId: string, storageType: StorageType, path: string) =>
      computed<DjFileEntry | undefined>(() => {
        const key = DjFileKeyUtil.create(deviceId, storageType, path);
        return store.files()[key];
      }),
  };
}
