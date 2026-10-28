import { updateState } from '@angular-architects/ngrx-toolkit';
import { IWatchFolderService } from '@teensyrom-nx/domain';
import { createAction, logInfo, logError, LogType } from '@teensyrom-nx/utils';
import { WatchFolderStoreState } from '../watch-folder-store';
import { WritableStore, setPending, upsertFolder } from '../watch-folder-helpers';

export interface RemoveDestinationParams {
  watchFolderId: string;
  deviceId: string;
}

export function removeDestination(
  store: WritableStore<WatchFolderStoreState>,
  service: IWatchFolderService
) {
  return {
    removeDestination: async ({ watchFolderId, deviceId }: RemoveDestinationParams): Promise<void> => {
      const actionMessage = createAction('remove-destination');
      logInfo(LogType.Start, 'RemoveDestination: Removing device from watch folder', {
        actionMessage,
        watchFolderId,
        deviceId,
      });

      updateState(store, actionMessage, (state) => ({ ...state, error: null }));
      setPending(store, actionMessage, watchFolderId, true);

      try {
        const { folderRemoved, watchFolder } = await service.removeDestination(watchFolderId, deviceId);
        logInfo(LogType.Success, 'RemoveDestination: Device removed', { watchFolderId, folderRemoved });
        updateState(store, actionMessage, (state) => ({
          ...state,
          folders:
            folderRemoved || !watchFolder
              ? state.folders.filter((f) => f.id !== watchFolderId)
              : upsertFolder(state.folders, watchFolder),
          lastUpdated: Date.now(),
        }));
      } catch (error) {
        logError('RemoveDestination: Failed to remove device', error);
        updateState(store, actionMessage, (state) => ({
          ...state,
          error: (error as Error)?.message || 'Failed to remove the device',
        }));
      } finally {
        setPending(store, actionMessage, watchFolderId, false);
        logInfo(LogType.Finish, 'RemoveDestination: Removal finished', { watchFolderId });
      }
    },
  };
}
