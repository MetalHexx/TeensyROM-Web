import { updateState } from '../../with-devtools';
import { IWatchFolderService } from '@teensyrom-nx/domain';
import { createAction, logInfo, logError, LogType } from '@teensyrom-nx/utils';
import { WatchFolderStoreState } from '../watch-folder-store';
import { WritableStore, setPending, upsertFolder } from '../watch-folder-helpers';

export interface SetFolderEnabledParams {
  watchFolderId: string;
  enabled: boolean;
}

export function setFolderEnabled(
  store: WritableStore<WatchFolderStoreState>,
  service: IWatchFolderService
) {
  return {
    setFolderEnabled: async ({ watchFolderId, enabled }: SetFolderEnabledParams): Promise<void> => {
      const actionMessage = createAction('set-folder-enabled');
      logInfo(LogType.Start, 'SetFolderEnabled: Switching watch folder', {
        actionMessage,
        watchFolderId,
        enabled,
      });

      updateState(store, actionMessage, (state) => ({ ...state, error: null }));
      setPending(store, actionMessage, watchFolderId, true);

      try {
        const folder = await service.setEnabled(watchFolderId, enabled);
        logInfo(LogType.Success, 'SetFolderEnabled: Watch folder switched', { watchFolderId });
        updateState(store, actionMessage, (state) => ({
          ...state,
          folders: upsertFolder(state.folders, folder),
          lastUpdated: Date.now(),
        }));
      } catch (error) {
        logError('SetFolderEnabled: Failed to switch watch folder', error);
        updateState(store, actionMessage, (state) => ({
          ...state,
          error: (error as Error)?.message || 'Failed to switch the watch folder',
        }));
      } finally {
        setPending(store, actionMessage, watchFolderId, false);
        logInfo(LogType.Finish, 'SetFolderEnabled: Switch finished', { watchFolderId });
      }
    },
  };
}
