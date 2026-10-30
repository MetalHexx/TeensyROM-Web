import { updateState } from '../../with-devtools';
import {
  IWatchFolderService,
  WatchFolderDestinationChange,
  WatchFolderRejection,
} from '@teensyrom-nx/domain';
import { createAction, logInfo, logError, LogType } from '@teensyrom-nx/utils';
import { WatchFolderStoreState } from '../watch-folder-store';
import { WritableStore, setPending, toRejection, upsertFolder } from '../watch-folder-helpers';

export interface SetDestinationParams {
  watchFolderId: string;
  deviceId: string;
  change: WatchFolderDestinationChange;
}

/**
 * Changes a device destination on a folder. Resolves to null when saved, or to the rejection
 * so the calling form can stay open and show it; a rejection is not written to `error`.
 */
export function setDestination(
  store: WritableStore<WatchFolderStoreState>,
  service: IWatchFolderService
) {
  return {
    setDestination: async ({
      watchFolderId,
      deviceId,
      change,
    }: SetDestinationParams): Promise<WatchFolderRejection | null> => {
      const actionMessage = createAction('set-destination');
      logInfo(LogType.Start, 'SetDestination: Changing destination', {
        actionMessage,
        watchFolderId,
        deviceId,
      });

      setPending(store, actionMessage, watchFolderId, true);

      try {
        const folder = await service.setDestination(watchFolderId, deviceId, change);
        logInfo(LogType.Success, 'SetDestination: Destination saved', { watchFolderId });
        updateState(store, actionMessage, (state) => ({
          ...state,
          folders: upsertFolder(state.folders, folder),
          lastUpdated: Date.now(),
        }));
        return null;
      } catch (error) {
        logError('SetDestination: Destination was not saved', error);
        return toRejection(error, 'Failed to change the destination');
      } finally {
        setPending(store, actionMessage, watchFolderId, false);
        logInfo(LogType.Finish, 'SetDestination: Change finished', { watchFolderId });
      }
    },
  };
}
