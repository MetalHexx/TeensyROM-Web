import { computed } from '@angular/core';
import { WritableStore } from '../actions';
import { SettingsState } from '../settings-state.interface';

/**
 * Selector factory for getting whether audio streaming is enabled for a specific device
 * Returns false if device is not found (safe default)
 */
export function selectEnableAudioStreamForDevice(store: WritableStore<SettingsState>) {
  return {
    enableAudioStreamForDevice: (deviceId: string) =>
      computed(() => {
        const settings = store.settings();
        if (!settings?.knownDevices) return false;
        const device = settings.knownDevices.find((d) => d.deviceId === deviceId);
        return device?.audioSettings?.enableAudioStream ?? false;
      }),
  };
}
