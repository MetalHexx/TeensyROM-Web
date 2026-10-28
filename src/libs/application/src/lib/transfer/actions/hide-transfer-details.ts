import { createAction, logInfo, LogType } from '@teensyrom-nx/utils';
import { updateState } from '@angular-architects/ngrx-toolkit';
import { TransferState } from '../transfer-store';
import { WritableStore, findWaitingRefusalDeviceId } from '../transfer-helpers';

/**
 * Hides the details dialog. It moves instead to another own refusal still waiting, so one in an
 * unshown tab is never stranded behind a closed dialog.
 */
export function hideTransferDetails(store: WritableStore<TransferState>) {
  return {
    hideTransferDetails: (): void => {
      const actionMessage = createAction('hide-transfer-details');
      logInfo(LogType.Info, 'TransferAction: Hiding transfer details');

      updateState(store, actionMessage, (state) => ({
        detailsDeviceId: findWaitingRefusalDeviceId(state.transfers, state.detailsDeviceId),
      }));
    },
  };
}
