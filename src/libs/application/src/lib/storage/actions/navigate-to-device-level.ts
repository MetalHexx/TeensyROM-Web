import { StorageState, NavigationHistory, NavigationHistoryItem } from '../storage-store';
import { WritableStore, clearSearchState } from '../storage-helpers';
import { createAction } from '@teensyrom-nx/utils';
import { LogType, logInfo } from '@teensyrom-nx/utils';
import { updateState } from '@angular-architects/ngrx-toolkit';

export function navigateToDeviceLevel(store: WritableStore<StorageState>) {
  return {
    navigateToDeviceLevel: ({ deviceId }: { deviceId: string }): void => {
      const actionMessage = createAction(`navigate-to-device-level`);

      logInfo(LogType.Navigate, `Navigating to device level for device: ${deviceId}`);

      // Clear any active search when navigating to device level
      clearSearchState(store, deviceId, actionMessage);

      // Set selected directory with null storageType to indicate device-level view
      updateState(store, actionMessage, (state) => ({
        selectedDirectories: {
          ...state.selectedDirectories,
          [deviceId]: {
            deviceId,
            storageType: null,
            path: '/',
          },
        },
      }));

      // Add device-level entry to navigation history
      const currentHistory = store.navigationHistory()[deviceId] || new NavigationHistory();
      const updatedHistory = new NavigationHistory(currentHistory.maxHistorySize);

      const historyEntry: NavigationHistoryItem = {
        path: '/',
        storageType: null, // Device level indicator
      };

      updatedHistory.history = [
        ...currentHistory.history.slice(0, currentHistory.currentIndex + 1),
        historyEntry,
      ];
      updatedHistory.currentIndex = updatedHistory.history.length - 1;
      updatedHistory.maxHistorySize = currentHistory.maxHistorySize;

      // Trim history if it exceeds max size
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
        `Added device-level view to navigation history for device: ${deviceId}`
      );
      logInfo(LogType.Finish, `Navigation to device level completed for device: ${deviceId}`);
    },
  };
}
