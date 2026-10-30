import { updateState } from '../../with-devtools';
import { IWatchFolderService } from '@teensyrom-nx/domain';
import { createAction, logInfo, logError, LogType } from '@teensyrom-nx/utils';
import { WatchFolderStoreState } from '../watch-folder-store';
import { WritableStore, setPending } from '../watch-folder-helpers';

export interface RemoveFolderParams {
  watchFolderId: string;
}

export function removeFolder(
  store: WritableStore<WatchFolderStoreState>,
  service: IWatchFolderService
) {
  return {
    removeFolder: async ({ watchFolderId }: RemoveFolderParams): Promise<void> => {
      const actionMessage = createAction('remove-folder');
      logInfo(LogType.Start, 'RemoveFolder: Removing watch folder', { actionMessage, watchFolderId });

      updateState(store, actionMessage, (state) => ({ ...state, error: null }));
      setPending(store, actionMessage, watchFolderId, true);

      try {
        await service.remove(watchFolderId);
        logInfo(LogType.Success, 'RemoveFolder: Watch folder removed', { watchFolderId });
        updateState(store, actionMessage, (state) => ({
          ...state,
          folders: state.folders.filter((f) => f.id !== watchFolderId),
          lastUpdated: Date.now(),
        }));
      } catch (error) {
        logError('RemoveFolder: Failed to remove watch folder', error);
        updateState(store, actionMessage, (state) => ({
          ...state,
          error: (error as Error)?.message || 'Failed to remove the watch folder',
        }));
      } finally {
        setPending(store, actionMessage, watchFolderId, false);
        logInfo(LogType.Finish, 'RemoveFolder: Removal finished', { watchFolderId });
      }
    },
  };
}
