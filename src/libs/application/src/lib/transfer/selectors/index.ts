import { withMethods } from '@ngrx/signals';
import { TransferState } from '../transfer-store';
import { WritableStore } from '../transfer-helpers';
import { getTargetDeviceId } from './get-target-device-id';

export function withTransferSelectors() {
  return withMethods((store) => {
    const writableStore = store as WritableStore<TransferState>;
    return {
      ...getTargetDeviceId(writableStore),
    };
  });
}
