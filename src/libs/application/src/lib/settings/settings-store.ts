import { signalStore, withState } from '@ngrx/signals';
import { withDevtools } from '@angular-architects/ngrx-toolkit';
import { logInfo, LogType } from '@teensyrom-nx/utils';
import { SettingsState } from './settings-state.interface';
import { withSettingsSelectors } from './selectors';
import { withSettingsActions } from './actions';

const initialState: SettingsState = {
  settings: null,
  history: [],
  historyPosition: -1,
  storedCurrent: null,
  isLoading: false,
  isSaving: false,
  error: null,
  lastUpdated: null,
};

logInfo(LogType.Start, 'SettingsStore: Initializing settings state management store');

export const SettingsStore = signalStore(
  { providedIn: 'root' },
  withDevtools('settings'),
  withState(initialState),
  withSettingsSelectors(),
  withSettingsActions()
);

logInfo(LogType.Success, 'SettingsStore: Settings store configured successfully');
