import { signalStore, withState, StateSignals, WritableStateSource } from '@ngrx/signals';
import { withDevtools } from '@angular-architects/ngrx-toolkit';
import { StorageType } from '@teensyrom-nx/domain';
import { withDjActions } from './actions';
import { withDjSelectors } from './selectors';

export type WritableStore<T extends object> = StateSignals<T> & WritableStateSource<T>;

export type DjFileStatus = 'retrieving' | 'retrieved' | 'failed';

export interface DjFileEntry {
  deviceId: string;
  storageType: StorageType;
  path: string;
  fileName: string;
  status: DjFileStatus;
  bytes: ArrayBuffer | null;
  byteLength: number | null;
  error: string | null;
}

export interface DjState {
  files: Record<string, DjFileEntry>; // key: DjFileKey
}

const initialState: DjState = {
  files: {},
};

export const DjStore = signalStore(
  { providedIn: 'root' },
  withDevtools('dj'),
  withState(initialState),
  withDjSelectors(),
  withDjActions()
);
