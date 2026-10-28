import { computed } from '@angular/core';
import { WatchFolderStoreState } from '../watch-folder-store';
import { WritableStore } from '../watch-folder-helpers';

export function isPending(store: WritableStore<WatchFolderStoreState>) {
  return {
    isPending: (watchFolderId: string) =>
      computed<boolean>(() => store.pendingFolderIds().includes(watchFolderId)),
  };
}
