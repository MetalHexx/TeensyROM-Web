import { inject } from '@angular/core';
import { withMethods } from '@ngrx/signals';
import { SETTINGS_SERVICE, ISettingsService } from '@teensyrom-nx/domain';
import { SettingsState } from '../settings-state.interface';
import { StateSignals, WritableStateSource } from '@ngrx/signals';
import { loadSettings } from './load-settings';
import { saveSettings } from './save-settings';
import { updateSettings } from './update-settings';
import { undo } from './undo';
import { redo } from './redo';
import { clearHistory } from './clear-history';
import { updateDeviceVideoDeviceId } from './update-device-video-device-id';

export type WritableStore<T extends object> = StateSignals<T> & WritableStateSource<T>;

export function withSettingsActions() {
  return withMethods((store, settingsService: ISettingsService = inject(SETTINGS_SERVICE)) => {
    const writableStore = store as WritableStore<SettingsState>;
    return {
      ...loadSettings(writableStore, settingsService),
      ...saveSettings(writableStore, settingsService),
      ...updateSettings(writableStore),
      ...undo(writableStore),
      ...redo(writableStore),
      ...clearHistory(writableStore),
      ...updateDeviceVideoDeviceId(writableStore, settingsService),
    };
  });
}
