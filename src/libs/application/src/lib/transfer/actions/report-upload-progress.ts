import { createAction, logInfo, LogType } from '@teensyrom-nx/utils';
import { TransferState } from '../transfer-store';
import { WritableStore, updateDeviceTransferState } from '../transfer-helpers';

export interface ReportUploadProgressParams {
  deviceId: string;
  uploadedBytes: number;
  uploadBytesPerSecond: number;
}

/** Records the upload pool's aggregated byte progress for the browser-to-API hop. */
export function reportUploadProgress(store: WritableStore<TransferState>) {
  return {
    reportUploadProgress: ({
      deviceId,
      uploadedBytes,
      uploadBytesPerSecond,
    }: ReportUploadProgressParams): void => {
      const actionMessage = createAction('report-upload-progress');
      logInfo(
        LogType.Info,
        `TransferAction: Upload progress for device ${deviceId}: ${uploadedBytes} bytes at ${uploadBytesPerSecond} B/s`
      );

      updateDeviceTransferState(store, deviceId, actionMessage, (state) => ({
        ...state,
        uploadedBytes,
        uploadBytesPerSecond,
        lastUpdated: Date.now(),
      }));
    },
  };
}
