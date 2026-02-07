import { withMethods } from '@ngrx/signals';
import { getSelectedDirectoryForDevice } from './get-selected-directory-for-device';
import { getSelectedDirectoryState } from './get-selected-directory-state';
import { getDeviceStorageEntries } from './get-device-storage-entries';
import { getDeviceDirectories } from './get-device-directories';
import { getSearchState } from './get-search-state';
import { isSlowFavoriteOperation } from './is-slow-favorite-operation';
import { isDeviceLevelView } from './is-device-level-view';
import { StorageState } from '../storage-store';
import { WritableStore } from '../storage-helpers';

export function withStorageSelectors() {
  return withMethods((store) => {
    const writableStore = store as WritableStore<StorageState>;
    return {
      ...getSelectedDirectoryForDevice(writableStore),
      ...getSelectedDirectoryState(writableStore),
      ...getDeviceStorageEntries(writableStore),
      ...getDeviceDirectories(writableStore),
      ...getSearchState(writableStore),
      ...isSlowFavoriteOperation(writableStore),
      ...isDeviceLevelView(writableStore),
    };
  });
}
