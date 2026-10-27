import { computed } from '@angular/core';
import { WatchFolder } from '@teensyrom-nx/domain';
import { WatchFolderStoreState } from '../watch-folder-store';
import { WritableStore } from '../watch-folder-helpers';

export function getFolders(store: WritableStore<WatchFolderStoreState>) {
  return {
    getFolders: () => computed<WatchFolder[]>(() => store.folders()),
  };
}
