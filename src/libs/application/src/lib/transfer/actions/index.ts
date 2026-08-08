import { withMethods } from '@ngrx/signals';
import { TransferState } from '../transfer-store';
import { WritableStore } from '../transfer-helpers';
import { setTargetDevice } from './set-target-device';
import { clearTargetDevice } from './clear-target-device';
import { beginScan } from './begin-scan';
import { reportScanProgress } from './report-scan-progress';
import { completeScan } from './complete-scan';
import { beginJob } from './begin-job';
import { applyJobSnapshot } from './apply-job-snapshot';
import { recordFileCompletion } from './record-file-completion';
import { recordUploadFailure } from './record-upload-failure';
import { setDeviceBusy } from './set-device-busy';
import { setTransferError } from './set-transfer-error';
import { setActiveForeignJob } from './set-active-foreign-job';
import { clearTransfer } from './clear-transfer';

export function withTransferActions() {
  return withMethods((store) => {
    const writableStore = store as WritableStore<TransferState>;
    return {
      ...setTargetDevice(writableStore),
      ...clearTargetDevice(writableStore),
      ...beginScan(writableStore),
      ...reportScanProgress(writableStore),
      ...completeScan(writableStore),
      ...beginJob(writableStore),
      ...applyJobSnapshot(writableStore),
      ...recordFileCompletion(writableStore),
      ...recordUploadFailure(writableStore),
      ...setDeviceBusy(writableStore),
      ...setTransferError(writableStore),
      ...setActiveForeignJob(writableStore),
      ...clearTransfer(writableStore),
    };
  });
}
