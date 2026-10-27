import { updateState } from '@angular-architects/ngrx-toolkit';
import { AddWatchFolderInput, IWatchFolderService, WatchFolderRejection } from '@teensyrom-nx/domain';
import { createAction, logInfo, logError, LogType } from '@teensyrom-nx/utils';
import { WatchFolderStoreState } from '../watch-folder-store';
import { WritableStore, toRejection, upsertFolder } from '../watch-folder-helpers';

/**
 * Adds a folder, or a device to a folder already watched. Resolves to null when saved, or to the
 * rejection so the calling form can stay open and show it; a rejection is not written to `error`.
 */
export function addWatchFolder(
  store: WritableStore<WatchFolderStoreState>,
  service: IWatchFolderService
) {
  return {
    addWatchFolder: async (input: AddWatchFolderInput): Promise<WatchFolderRejection | null> => {
      const actionMessage = createAction('add-watch-folder');
      logInfo(LogType.Start, 'AddWatchFolder: Adding watch folder', {
        actionMessage,
        deviceId: input.deviceId,
      });

      try {
        const folder = await service.add(input);
        logInfo(LogType.Success, 'AddWatchFolder: Watch folder saved', { watchFolderId: folder.id });
        updateState(store, actionMessage, (state) => ({
          ...state,
          folders: upsertFolder(state.folders, folder),
          lastUpdated: Date.now(),
        }));
        return null;
      } catch (error) {
        logError('AddWatchFolder: Watch folder was not saved', error);
        return toRejection(error, 'Failed to add the watch folder');
      } finally {
        logInfo(LogType.Finish, 'AddWatchFolder: Add finished');
      }
    },
  };
}
