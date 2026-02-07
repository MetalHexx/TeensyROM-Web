import { StorageType } from '@teensyrom-nx/domain';
import { StorageState } from '../storage-store';
import { StorageKeyUtil } from '../storage-key.util';
import { WritableStore, getStorage } from '../storage-helpers';
import { LogType, logInfo, createAction } from '@teensyrom-nx/utils';
import { updateState } from '@angular-architects/ngrx-toolkit';

export function updateFileCompatibility(store: WritableStore<StorageState>) {
  return {
    updateFileCompatibility: ({
      deviceId,
      storageType,
      filePath,
      isCompatible,
    }: {
      deviceId: string;
      storageType: StorageType;
      filePath: string;
      isCompatible: boolean;
    }): void => {
      const actionMessage = createAction('update-file-compatibility');
      const key = StorageKeyUtil.create(deviceId, storageType);

      // Check if storage entry exists
      const storageEntry = getStorage(store, key);
      if (!storageEntry) {
        logInfo(
          LogType.Warning,
          `Storage entry not found for ${key}, cannot update file compatibility`
        );
        return;
      }

      // Check if directory and files exist
      if (!storageEntry.directory?.files) {
        logInfo(
          LogType.Warning,
          `No directory or files found in storage entry ${key}, cannot update file compatibility`
        );
        return;
      }

      // Find the file in the directory
      const fileIndex = storageEntry.directory.files.findIndex((file) => file.path === filePath);

      if (fileIndex === -1) {
        logInfo(
          LogType.Warning,
          `File not found in directory: ${filePath}, cannot update compatibility`
        );
        return;
      }

      logInfo(
        LogType.Info,
        `Updating file compatibility for ${filePath} to ${isCompatible} in ${key}`
      );

      // Perform immutable update
      updateState(store, actionMessage, (state) => {
        const currentEntry = state.storageEntries[key];
        if (!currentEntry?.directory?.files) {
          return state;
        }

        const updatedFiles = [...currentEntry.directory.files];
        updatedFiles[fileIndex] = {
          ...updatedFiles[fileIndex],
          isCompatible: isCompatible,
        };

        return {
          storageEntries: {
            ...state.storageEntries,
            [key]: {
              ...currentEntry,
              directory: {
                ...currentEntry.directory,
                files: updatedFiles,
              },
            },
          },
        };
      });

      logInfo(LogType.Success, `Successfully updated compatibility for ${filePath}`);
    },
  };
}
