import { createAction, logInfo, LogType } from '@teensyrom-nx/utils';
import { updateState } from '../../with-devtools';
import { TransferState } from '../transfer-store';
import { WritableStore } from '../transfer-helpers';

export interface ShowTransferDetailsParams {
  deviceId: string;
}

/** Points the details dialog at a device's transfer. */
export function showTransferDetails(store: WritableStore<TransferState>) {
  return {
    showTransferDetails: ({ deviceId }: ShowTransferDetailsParams): void => {
      const actionMessage = createAction('show-transfer-details');
      logInfo(LogType.Info, `TransferAction: Showing transfer details for device ${deviceId}`);

      updateState(store, actionMessage, () => ({ detailsDeviceId: deviceId }));
    },
  };
}
