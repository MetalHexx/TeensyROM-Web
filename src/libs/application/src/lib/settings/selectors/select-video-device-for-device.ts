import { computed } from '@angular/core';
import { WritableStore } from '../actions';
import { SettingsState } from '../settings-state.interface';

/**
 * Selector factory for getting the video device ID for a specific TeensyROM device
 * Returns empty string if device is not found or videoDeviceId is not set (safe default)
 */
export function selectVideoDeviceForDevice(store: WritableStore<SettingsState>) {
  return {
    videoDeviceIdForDevice: (deviceId: string) =>
      computed(() => {
        const settings = store.settings();
        if (!settings?.knownDevices) return '';
        const device = settings.knownDevices.find((d) => d.deviceId === deviceId);
        return device?.videoSettings?.videoDeviceId ?? '';
      }),
  };
}
