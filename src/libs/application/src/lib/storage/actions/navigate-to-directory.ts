import { StorageType, IStorageService } from '@teensyrom-nx/domain';
import { StorageState } from '../storage-store';
import { WritableStore, performDirectoryNavigation } from '../storage-helpers';
import { createAction } from '@teensyrom-nx/utils';

export function navigateToDirectory(
  store: WritableStore<StorageState>,
  storageService: IStorageService
) {
  return {
    navigateToDirectory: async ({
      deviceId,
      storageType,
      path,
    }: {
      deviceId: string;
      storageType: StorageType;
      path: string;
    }): Promise<void> => {
      const actionMessage = createAction(`navigate-to-directory`);

      await performDirectoryNavigation(
        store,
        storageService,
        { deviceId, storageType, path },
        actionMessage
      );
    },
  };
}
