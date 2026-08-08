import { signalStore, withState } from '@ngrx/signals';
import { withDevtools } from '@angular-architects/ngrx-toolkit';
import { logInfo, LogType } from '@teensyrom-nx/utils';
import { withTransferSelectors } from './selectors';
import { withTransferActions } from './actions';

export interface DeviceTransferState {
  deviceId: string;
  isLoading: boolean;
  error: string | null;
  lastUpdated: number | null;
}

export interface TransferState {
  targetDeviceId: string | null;
  transfers: Record<string, DeviceTransferState>;
}

const initialState: TransferState = {
  targetDeviceId: null,
  transfers: {},
};

logInfo(LogType.Start, 'TransferStore: Initializing transfer state management store');

export const TransferStore = signalStore(
  { providedIn: 'root' },
  withDevtools('transfer'),
  withState(initialState),
  withTransferSelectors(),
  withTransferActions()
);

logInfo(LogType.Success, 'TransferStore: Transfer store configured successfully');
