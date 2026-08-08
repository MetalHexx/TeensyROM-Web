import { StateSignals, WritableStateSource } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { StorageState, StorageDirectoryState, NavigationHistory } from './storage-store';
import { StorageKey, StorageKeyUtil } from './storage-key.util';
import { StorageType, IStorageService } from '@teensyrom-nx/domain';
import { LogType, logInfo, logError } from '@teensyrom-nx/utils';
import { updateState } from '@angular-architects/ngrx-toolkit';

export type WritableStore<T extends object> = StateSignals<T> & WritableStateSource<T>;

/**
 * Helper to set loading state for a storage entry
 */
export function setLoadingStorage(
  store: WritableStore<StorageState>,
  key: StorageKey,
  actionMessage: string
): void {
  updateState(store, actionMessage, (state) => ({
    storageEntries: {
      ...state.storageEntries,
      [key]: {
        ...state.storageEntries[key],
        isLoading: true,
        error: null,
      },
    },
  }));
}

/**
 * Helper to update a storage entry with arbitrary changes
 */
export function updateStorage(
  store: WritableStore<StorageState>,
  key: StorageKey,
  updates: Partial<StorageDirectoryState>,
  actionMessage: string
): void {
  updateState(store, actionMessage, (state) => ({
    storageEntries: {
      ...state.storageEntries,
      [key]: {
        ...state.storageEntries[key],
        ...updates,
      },
    },
  }));
}

/**
 * Helper to set loaded state with common success fields
 */
export function setStorageLoaded(
  store: WritableStore<StorageState>,
  key: StorageKey,
  additionalUpdates: Partial<StorageDirectoryState> = {},
  actionMessage: string
): void {
  updateStorage(
    store,
    key,
    {
      isLoaded: true,
      isLoading: false,
      error: null,
      lastLoadTime: Date.now(),
      ...additionalUpdates,
    },
    actionMessage
  );
}

/**
 * Helper to get existing storage entry by key
 */
export function getStorage(
  store: WritableStore<StorageState>,
  key: StorageKey
): StorageDirectoryState | undefined {
  const currentState = store.storageEntries();
  return currentState[key];
}

/**
 * Helper to check if a directory is already loaded at a specific path
 */
export function isDirectoryLoadedAtPath(
  entry: StorageDirectoryState | undefined,
  path: string
): boolean {
  return !!(
    entry &&
    entry.currentPath === path &&
    entry.isLoaded &&
    entry.directory &&
    !entry.error
  );
}

/**
 * Helper to check if the given values match the currently selected directory
 */
export function isSelectedDirectory(
  store: WritableStore<StorageState>,
  deviceId: string,
  storageType: StorageType,
  path: string
): boolean {
  const currentSelection = store.selectedDirectories()[deviceId];
  return !!(
    currentSelection &&
    currentSelection.storageType === storageType &&
    currentSelection.path === path
  );
}

/**
 * Helper to set error state for a storage entry
 */
export function setStorageError(
  store: WritableStore<StorageState>,
  key: StorageKey,
  errorMessage: string,
  actionMessage: string
): void {
  updateState(store, actionMessage, (state) => {
    const currentEntry = state.storageEntries[key];
    if (!currentEntry) {
      logError(`No entry found for ${key} during error update`);
      return state;
    }

    return {
      storageEntries: {
        ...state.storageEntries,
        [key]: {
          ...currentEntry,
          isLoading: false,
          error: errorMessage,
        },
      },
    };
  });
}

/**
 * Helper to insert a storage entry
 */
export function insertStorage(
  store: WritableStore<StorageState>,
  key: StorageKey,
  entry: StorageDirectoryState,
  actionMessage: string
): void {
  updateState(store, actionMessage, (state) => ({
    storageEntries: {
      ...state.storageEntries,
      [key]: entry,
    },
  }));
}

/**
 * Helper to create initial storage directory state
 */
export function createStorage(
  store: WritableStore<StorageState>,
  deviceId: string,
  storageType: StorageType,
  path = '/',
  actionMessage: string
): StorageDirectoryState {
  const newEntry: StorageDirectoryState = {
    deviceId,
    storageType,
    currentPath: path,
    directory: null,
    isLoaded: false,
    isLoading: true,
    error: null,
    lastLoadTime: null,
  };
  insertStorage(store, StorageKeyUtil.create(deviceId, storageType), newEntry, actionMessage);
  return newEntry;
}

/**
 * Helper to remove storage entry by key
 */
export function removeStorage(
  store: WritableStore<StorageState>,
  key: StorageKey,
  actionMessage: string
): void {
  updateState(store, actionMessage, (state) => {
    const updatedEntries = { ...state.storageEntries };
    delete updatedEntries[key];
    return { storageEntries: updatedEntries };
  });
}

/**
 * Helper to filter entries by device ID
 */
export function getAllDeviceStorage(
  entries: Record<string, StorageDirectoryState>,
  deviceId: string
): Record<string, StorageDirectoryState> {
  const result: Record<string, StorageDirectoryState> = {};
  for (const [key, value] of Object.entries(entries)) {
    if (key.startsWith(`${deviceId}-`)) {
      result[key] = value as StorageDirectoryState;
    }
  }
  return result;
}

// Re-export logging utilities for backward compatibility
export { LogType, logInfo, logError, logWarn } from '@teensyrom-nx/utils';

/**
 * Helper to update selected directory for a device
 */
export function setDeviceSelectedDirectory(
  store: WritableStore<StorageState>,
  deviceId: string,
  storageType: StorageType | null,
  path: string,
  actionMessage: string
): void {
  updateState(store, actionMessage, (state) => ({
    selectedDirectories: {
      ...state.selectedDirectories,
      [deviceId]: {
        deviceId,
        storageType,
        path,
      },
    },
  }));
}

/**
 * Helper to clear search state for a device
 */
export function clearSearchState(
  store: WritableStore<StorageState>,
  deviceId: string,
  actionMessage: string
): void {
  updateState(store, actionMessage, (state) => {
    const updatedSearchState = { ...state.searchState };
    delete updatedSearchState[deviceId];

    return {
      searchState: updatedSearchState,
    };
  });
}

/**
 * Shared body for a directory navigation: clears search, selects the path, short-circuits when
 * already loaded there, loads via the service, marks loaded, and appends navigation history.
 * Used by both user-intent navigation and playback-driven alignment.
 */
export async function performDirectoryNavigation(
  store: WritableStore<StorageState>,
  storageService: IStorageService,
  args: { deviceId: string; storageType: StorageType; path: string },
  actionMessage: string
): Promise<void> {
  const { deviceId, storageType, path } = args;
  const key = StorageKeyUtil.create(deviceId, storageType);

  logInfo(LogType.Navigate, `Navigating to ${key} at path: ${path}`);

  // Clear any active search when navigating (search is device-level, not storage-specific)
  clearSearchState(store, deviceId, actionMessage);

  if (!isSelectedDirectory(store, deviceId, storageType, path)) {
    setDeviceSelectedDirectory(store, deviceId, storageType, path, actionMessage);
  }

  const existingEntry = getStorage(store, key);

  if (isDirectoryLoadedAtPath(existingEntry, path)) {
    logInfo(LogType.Info, `Directory already loaded for ${key} at path: ${path}`);
    return;
  }

  setLoadingStorage(store, key, actionMessage);

  try {
    logInfo(LogType.NetworkRequest, `Loading directory for ${key} at path: ${path}`);

    const directory = await firstValueFrom(
      storageService.getDirectory(deviceId, storageType, path)
    );

    logInfo(LogType.Success, `Directory navigation successful for ${key}:`, directory);

    setStorageLoaded(
      store,
      key,
      {
        currentPath: path,
        directory,
      },
      actionMessage
    );

    const currentHistory = store.navigationHistory()[deviceId] || new NavigationHistory();
    const updatedHistory = new NavigationHistory(currentHistory.maxHistorySize);

    updatedHistory.history = [
      ...currentHistory.history.slice(0, currentHistory.currentIndex + 1),
      { path, storageType },
    ];
    updatedHistory.currentIndex = updatedHistory.history.length - 1;
    updatedHistory.maxHistorySize = currentHistory.maxHistorySize;

    if (updatedHistory.history.length > updatedHistory.maxHistorySize) {
      const excess = updatedHistory.history.length - updatedHistory.maxHistorySize;
      updatedHistory.history = updatedHistory.history.slice(excess);
      updatedHistory.currentIndex -= excess;
    }

    updateState(store, actionMessage, (state) => ({
      navigationHistory: {
        ...state.navigationHistory,
        [deviceId]: updatedHistory,
      },
    }));

    logInfo(
      LogType.Info,
      `Added directory to navigation history for device: ${deviceId}, path: ${path}`
    );
    logInfo(LogType.Finish, `Navigation completed for ${key} at path: ${path}`);
  } catch (error) {
    logError(`Directory navigation failed for ${key} at path ${path}:`, error);

    updateStorage(
      store,
      key,
      {
        currentPath: path,
        directory: null,
        isLoaded: false,
        isLoading: false,
        error: 'Failed to navigate to directory',
      },
      actionMessage
    );
  }
}

/**
 * Query helper to get search state for a specific device (read-only, no actionMessage)
 */
export function getSearchState(store: WritableStore<StorageState>, deviceId: string) {
  return store.searchState()[deviceId] ?? null;
}

/**
 * Query helper to check if there's an active search for a device (read-only, no actionMessage)
 */
export function hasActiveSearch(store: WritableStore<StorageState>, deviceId: string): boolean {
  const searchState = getSearchState(store, deviceId);
  return !!(searchState && searchState.hasSearched);
}
