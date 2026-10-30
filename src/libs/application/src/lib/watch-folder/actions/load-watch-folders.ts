import { updateState } from '../../with-devtools';
import { IWatchFolderService } from '@teensyrom-nx/domain';
import { createAction, logInfo, logError, LogType } from '@teensyrom-nx/utils';
import { WatchFolderStoreState } from '../watch-folder-store';
import { WritableStore } from '../watch-folder-helpers';

export function loadWatchFolders(
  store: WritableStore<WatchFolderStoreState>,
  service: IWatchFolderService
) {
  return {
    loadWatchFolders: async (): Promise<void> => {
      const actionMessage = createAction('load-watch-folders');
      logInfo(LogType.Start, 'LoadWatchFolders: Loading watch folders', { actionMessage });

      updateState(store, actionMessage, (state) => ({ ...state, isLoading: true, error: null }));

      try {
        const folders = await service.list();
        logInfo(LogType.Success, 'LoadWatchFolders: Watch folders loaded', { count: folders.length });
        updateState(store, actionMessage, (state) => ({
          ...state,
          folders,
          isLoading: false,
          error: null,
          lastUpdated: Date.now(),
        }));
      } catch (error) {
        logError('LoadWatchFolders: Failed to load watch folders', error);
        updateState(store, actionMessage, (state) => ({
          ...state,
          isLoading: false,
          error: (error as Error)?.message || 'Failed to load watch folders',
        }));
      }

      logInfo(LogType.Finish, 'LoadWatchFolders: Load finished');
    },
  };
}
