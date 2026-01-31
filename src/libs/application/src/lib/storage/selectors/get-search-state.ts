import { computed } from '@angular/core';
import { StorageState, SearchState } from '../storage-store';
import { WritableStore } from '../storage-helpers';

export function getSearchState(store: WritableStore<StorageState>) {
  return {
    getSearchState: (deviceId: string) =>
      computed<SearchState | null>(() => {
        return store.searchState()[deviceId] ?? null;
      }),
  };
}
