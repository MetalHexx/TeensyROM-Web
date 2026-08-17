import { createAction, logError, logInfo, LogType } from '@teensyrom-nx/utils';
import { TransferState } from '../transfer-store';
import { WritableStore, isTerminalJobState, updateDeviceTransferState } from '../transfer-helpers';

export interface SetCancelErrorParams {
  deviceId: string;
  error: string;
}

/**
 * Records a cancel request that failed on its way to (or back from) the server.
 *
 * Ignored once the job has already settled: the hub can land the terminal snapshot while the
 * cancel reply is still in flight, and a reply that then fails for a transport reason says
 * nothing about a job the server has already finished with. The settled job wins, so the modal
 * keeps its terminal screen instead of regressing to an error.
 */
export function setCancelError(store: WritableStore<TransferState>) {
  return {
    setCancelError: ({ deviceId, error }: SetCancelErrorParams): void => {
      const jobState = store.transfers()[deviceId]?.job?.state;
      if (jobState !== undefined && isTerminalJobState(jobState)) {
        logInfo(
          LogType.Info,
          `TransferAction: Ignoring cancel failure for device ${deviceId}; job already ${jobState}`
        );
        return;
      }

      const actionMessage = createAction('set-cancel-error');
      logError(`TransferAction: Cancel failed for device ${deviceId}: ${error}`);

      updateDeviceTransferState(store, deviceId, actionMessage, (state) => ({
        ...state,
        phase: 'cancel-failed',
        error,
        isLoading: false,
        lastUpdated: Date.now(),
      }));
    },
  };
}
