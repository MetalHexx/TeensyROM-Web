import { computed } from '@angular/core';
import { WritableStore } from '../actions';
import { SettingsState } from '../settings-state.interface';

/**
 * Selector factory for getting whether video is enabled for a specific device
 * Returns false if device is not found (safe default)
 */
export function selectEnableVideoForDevice(store: WritableStore<SettingsState>) {
  return {
    enableVideoForDevice: (deviceId: string) =>
      computed(() => {
        const settings = store.settings();
        if (!settings?.knownDevices) return false;
        const device = settings.knownDevices.find((d) => d.deviceId === deviceId);
        return device?.videoSettings?.enableVideo ?? false;
      }),
  };
}
