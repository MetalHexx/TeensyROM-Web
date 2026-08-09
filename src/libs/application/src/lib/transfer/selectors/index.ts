import { withMethods } from '@ngrx/signals';
import { TransferState } from '../transfer-store';
import { WritableStore } from '../transfer-helpers';
import { getTargetDeviceId } from './get-target-device-id';
import { getDeviceTransfer } from './get-device-transfer';
import { getTransferModalState } from './get-transfer-modal-state';
import { isTransferModalOpen } from './is-transfer-modal-open';
import { getTransferMetrics } from './get-transfer-metrics';
import { getTransferSummary } from './get-transfer-summary';
import { isDeviceBusy } from './is-device-busy';

export function withTransferSelectors() {
  return withMethods((store) => {
    const writableStore = store as WritableStore<TransferState>;
    return {
      ...getTargetDeviceId(writableStore),
      ...getDeviceTransfer(writableStore),
      ...getTransferModalState(writableStore),
      ...isTransferModalOpen(writableStore),
      ...getTransferMetrics(writableStore),
      ...getTransferSummary(writableStore),
      ...isDeviceBusy(writableStore),
    };
  });
}
