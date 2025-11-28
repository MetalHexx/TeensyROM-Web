import { computed } from '@angular/core';
import { WritableStore } from '../actions';
import { SettingsState } from '../settings-state.interface';
import { DeviceSettings } from '@teensyrom-nx/domain';

/**
 * Selector for getting all known devices
 * Returns empty array if settings not loaded
 */
export function selectKnownDevices(store: WritableStore<SettingsState>) {
  return {
    allKnownDevices: computed<DeviceSettings[]>(() => {
      const settings = store.settings();
      return settings?.knownDevices ?? [];
    }),
  };
}
