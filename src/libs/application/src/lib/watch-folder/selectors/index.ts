import { withMethods } from '@ngrx/signals';
import { WatchFolderStoreState } from '../watch-folder-store';
import { WritableStore } from '../watch-folder-helpers';
import { getFolders } from './get-folders';
import { isPending } from './is-pending';

export function withWatchFolderSelectors() {
  return withMethods((store) => {
    const writableStore = store as WritableStore<WatchFolderStoreState>;
    return {
      ...getFolders(writableStore),
      ...isPending(writableStore),
    };
  });
}
