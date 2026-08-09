import { createAction, logError } from '@teensyrom-nx/utils';
import { TransferState, TransferFeedEntry } from '../transfer-store';
import { WritableStore, updateDeviceTransferState, toFeedFileName, pushFeedEntry } from '../transfer-helpers';

export interface RecordUploadFailureParams {
  deviceId: string;
  relativePath: string;
  reason: string;
}

/** Records a file that exhausted its local upload attempts without ever reaching the server. */
export function recordUploadFailure(store: WritableStore<TransferState>) {
  return {
    recordUploadFailure: ({ deviceId, relativePath, reason }: RecordUploadFailureParams): void => {
      const actionMessage = createAction('record-upload-failure');
      logError(
        `TransferAction: Recording local upload failure for device ${deviceId}: ${relativePath} - ${reason}`
      );

      updateDeviceTransferState(store, deviceId, actionMessage, (state) => {
        const entry: TransferFeedEntry = {
          relativePath,
          fileName: toFeedFileName(relativePath),
          success: false,
          reason,
        };

        return {
          ...state,
          ...pushFeedEntry(state, entry),
          uploadFailedCount: state.uploadFailedCount + 1,
          lastUpdated: Date.now(),
        };
      });
    },
  };
}
