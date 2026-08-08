import { withMethods } from '@ngrx/signals';
import { TransferState } from '../transfer-store';
import { WritableStore } from '../transfer-helpers';
import { setTargetDevice } from './set-target-device';
import { clearTargetDevice } from './clear-target-device';

export function withTransferActions() {
  return withMethods((store) => {
    const writableStore = store as WritableStore<TransferState>;
    return {
      ...setTargetDevice(writableStore),
      ...clearTargetDevice(writableStore),
    };
  });
}
