import { firstValueFrom } from 'rxjs';
import { IStorageService, PlayerFilterType } from '@teensyrom-nx/domain';
import { StorageState } from '../storage-store';
import { WritableStore } from '../storage-helpers';
import { createAction, LogType, logInfo, logError } from '@teensyrom-nx/utils';
import { updateState } from '@angular-architects/ngrx-toolkit';

export function searchFiles(store: WritableStore<StorageState>, storageService: IStorageService) {
  return {
    searchFiles: async ({
      deviceId,
      searchText,
      filterType,
    }: {
      deviceId: string;
      searchText: string;
      filterType?: PlayerFilterType;
    }): Promise<void> => {
      const actionMessage = createAction('search-files');

      logInfo(
        LogType.Start,
        `Starting unified search for device ${deviceId} with text: "${searchText}"`,
        filterType ? { filterType } : undefined
      );

      // Get current search state to preserve hasSearched flag
      const currentSearchState = store.searchState()[deviceId];
      const wasAlreadySearching = currentSearchState?.hasSearched ?? false;

      // Set searching state
      updateState(store, actionMessage, (state) => ({
        searchState: {
          ...state.searchState,
          [deviceId]: {
            searchText,
            filterType: filterType ?? null,
            results: [],
            isSearching: true,
            hasSearched: wasAlreadySearching, // Preserve existing state - don't reset to false
            error: null,
          },
        },
      }));

      try {
        logInfo(LogType.NetworkRequest, `Making search API call for device ${deviceId} (all storages)`);

        const results = await firstValueFrom(
          storageService.search(deviceId, searchText, filterType)
        );

        logInfo(LogType.Success, `Search successful for device ${deviceId}:`, {
          resultCount: results.length,
          note: 'Results include files from all available storages (SD + USB)',
        });

        // Update with search results
        updateState(store, actionMessage, (state) => ({
          searchState: {
            ...state.searchState,
            [deviceId]: {
              ...state.searchState[deviceId],
              results,
              isSearching: false,
              hasSearched: true,
              error: null,
            },
          },
        }));

        logInfo(LogType.Finish, `Search completed for device ${deviceId}`);
      } catch (error) {
        logError(`Search failed for device ${deviceId}:`, error);

        updateState(store, actionMessage, (state) => ({
          searchState: {
            ...state.searchState,
            [deviceId]: {
              ...state.searchState[deviceId],
              results: [],
              isSearching: false,
              hasSearched: true,
              error: error instanceof Error ? error.message : 'Search failed',
            },
          },
        }));
      }
    },
  };
}
