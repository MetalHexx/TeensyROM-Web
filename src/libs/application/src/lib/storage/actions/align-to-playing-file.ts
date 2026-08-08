import { StorageType, IStorageService } from '@teensyrom-nx/domain';
import { StorageState } from '../storage-store';
import { WritableStore, performDirectoryNavigation } from '../storage-helpers';
import { createAction, logInfo, LogType } from '@teensyrom-nx/utils';

/**
 * Playback-driven directory alignment. Behaves exactly like `navigateToDirectory` for an
 * unpinned device; a no-op when the device's pin is held by a mounted view other than playback.
 */
export function alignToPlayingFile(
  store: WritableStore<StorageState>,
  storageService: IStorageService
) {
  return {
    alignToPlayingFile: async ({
      deviceId,
      storageType,
      path,
    }: {
      deviceId: string;
      storageType: StorageType;
      path: string;
    }): Promise<void> => {
      if (store.navigationPin() === deviceId) {
        logInfo(LogType.Info, `Skipping playback alignment for ${deviceId}: navigation pin held`);
        return;
      }

      const actionMessage = createAction(`align-to-playing-file`);

      await performDirectoryNavigation(
        store,
        storageService,
        { deviceId, storageType, path },
        actionMessage
      );
    },
  };
}
