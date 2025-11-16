import { withMethods } from '@ngrx/signals';
import { SettingsState } from '../settings-state.interface';
import { StateSignals, WritableStateSource } from '@ngrx/signals';
import { getSettings } from './get-settings';
import { canUndo } from './can-undo';
import { canRedo } from './can-redo';
import { getHistoryPosition } from './get-history-position';
import { isNavigatingHistory } from './is-navigating-history';
import { historyPositionDisplay } from './history-position-display';

export type WritableStore<T extends object> = StateSignals<T> & WritableStateSource<T>;

export function withSettingsSelectors() {
  return withMethods((store) => {
    const writableStore = store as WritableStore<SettingsState>;
    return {
      ...getSettings(writableStore),
      ...canUndo(writableStore),
      ...canRedo(writableStore),
      ...getHistoryPosition(writableStore),
      ...isNavigatingHistory(writableStore),
      ...historyPositionDisplay(writableStore),
    };
  });
}
