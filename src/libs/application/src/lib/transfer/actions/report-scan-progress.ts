import { createAction, logInfo, LogType } from '@teensyrom-nx/utils';
import { TransferState } from '../transfer-store';
import { WritableStore, updateDeviceTransferState } from '../transfer-helpers';

export interface ReportScanProgressParams {
  deviceId: string;
  scanFound: number;
}

export function reportScanProgress(store: WritableStore<TransferState>) {
  return {
    reportScanProgress: ({ deviceId, scanFound }: ReportScanProgressParams): void => {
      const actionMessage = createAction('report-scan-progress');
      logInfo(
        LogType.Info,
        `TransferAction: Scan progress for device ${deviceId}: ${scanFound} found`
      );

      updateDeviceTransferState(store, deviceId, actionMessage, (state) => ({
        ...state,
        scanFound,
        lastUpdated: Date.now(),
      }));
    },
  };
}
