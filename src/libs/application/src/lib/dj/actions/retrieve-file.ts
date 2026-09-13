import { firstValueFrom } from 'rxjs';
import { StorageType, IFileContentService } from '@teensyrom-nx/domain';
import { createAction, LogType, logInfo, logError } from '@teensyrom-nx/utils';
import { updateState } from '@angular-architects/ngrx-toolkit';
import { DjState, WritableStore } from '../dj-store';
import { DjFileKeyUtil } from '../dj-file-key.util';

export function retrieveFile(
  store: WritableStore<DjState>,
  fileContentService: IFileContentService
) {
  return {
    retrieveFile: async ({
      deviceId,
      storageType,
      path,
    }: {
      deviceId: string;
      storageType: StorageType;
      path: string;
    }): Promise<void> => {
      const actionMessage = createAction('retrieve-file');
      const key = DjFileKeyUtil.create(deviceId, storageType, path);
      const existingEntry = store.files()[key];

      if (existingEntry?.status === 'retrieved' || existingEntry?.status === 'retrieving') {
        logInfo(LogType.Info, `File already retrieved for ${key}`);
        return;
      }

      logInfo(LogType.Start, `Retrieving file for ${key}`);

      updateState(store, actionMessage, (state) => ({
        files: {
          ...state.files,
          [key]: {
            deviceId,
            storageType,
            path,
            fileName: path.substring(path.lastIndexOf('/') + 1),
            status: 'retrieving' as const,
            bytes: null,
            byteLength: null,
            error: null,
          },
        },
      }));

      try {
        logInfo(LogType.NetworkRequest, `Requesting file content for ${key}`);

        const fileContent = await firstValueFrom(
          fileContentService.getFileContent(deviceId, storageType, path)
        );

        logInfo(LogType.Success, `File retrieved for ${key}`);

        updateState(store, actionMessage, (state) => ({
          files: {
            ...state.files,
            [key]: {
              ...state.files[key],
              status: 'retrieved' as const,
              bytes: fileContent.bytes,
              byteLength: fileContent.byteLength,
            },
          },
        }));

        logInfo(LogType.Finish, `Retrieve file completed for ${key}`);
      } catch (error) {
        logError(`Failed to retrieve file for ${key}:`, error);

        updateState(store, actionMessage, (state) => ({
          files: {
            ...state.files,
            [key]: {
              ...state.files[key],
              status: 'failed' as const,
              bytes: null,
              error: (error as { message?: string })?.message || 'Failed to retrieve file',
            },
          },
        }));
      }
    },
  };
}
