import { inject } from '@angular/core';
import { withMethods } from '@ngrx/signals';
import { IWatchFolderService, WATCH_FOLDER_SERVICE } from '@teensyrom-nx/domain';
import { WatchFolderStoreState } from '../watch-folder-store';
import { WritableStore } from '../watch-folder-helpers';
import { loadWatchFolders } from './load-watch-folders';
import { setFolderEnabled } from './set-folder-enabled';
import { removeFolder } from './remove-folder';
import { removeDestination } from './remove-destination';
import { addWatchFolder } from './add-watch-folder';
import { setDestination } from './set-destination';

export function withWatchFolderActions() {
  return withMethods((store, service: IWatchFolderService = inject(WATCH_FOLDER_SERVICE)) => {
    const writableStore = store as WritableStore<WatchFolderStoreState>;
    return {
      ...loadWatchFolders(writableStore, service),
      ...setFolderEnabled(writableStore, service),
      ...removeFolder(writableStore, service),
      ...removeDestination(writableStore, service),
      ...addWatchFolder(writableStore, service),
      ...setDestination(writableStore, service),
    };
  });
}
