import { createAction, logInfo, LogType } from '@teensyrom-nx/utils';
import { TransferFileCompletion } from '@teensyrom-nx/domain';
import { TransferState, TransferFeedEntry } from '../transfer-store';
import { WritableStore, updateDeviceTransferState, toFeedFileName, pushFeedEntry } from '../transfer-helpers';

export interface RecordFileCompletionParams {
  deviceId: string;
  completion: TransferFileCompletion;
}

/** Folds a per-file hub completion event into the device's feed and, on failure, the failure list. */
export function recordFileCompletion(store: WritableStore<TransferState>) {
  return {
    recordFileCompletion: ({ deviceId, completion }: RecordFileCompletionParams): void => {
      const actionMessage = createAction('record-file-completion');
      logInfo(
        LogType.Info,
        `TransferAction: Recording file completion for device ${deviceId}: ${completion.relativePath} (${
          completion.success ? 'success' : 'failed'
        })`
      );

      updateDeviceTransferState(store, deviceId, actionMessage, (state) => {
        const entry: TransferFeedEntry = {
          relativePath: completion.relativePath,
          fileName: toFeedFileName(completion.relativePath),
          success: completion.success,
          reason: completion.success ? null : `device write failed — ${completion.error}`,
        };

        return {
          ...state,
          ...pushFeedEntry(state, entry),
          lastUpdated: Date.now(),
        };
      });
    },
  };
}
