import { computed } from '@angular/core';
import { WritableStore } from '../actions';
import { SettingsState } from '../settings-state.interface';
import { DeviceSettings } from '@teensyrom-nx/domain';

/**
 * Selector factory for getting a specific device's settings by ID
 * Returns null if device is not found in knownDevices
 */
export function selectDeviceSettings(store: WritableStore<SettingsState>) {
  return {
    getDeviceSettings: (deviceId: string) =>
      computed<DeviceSettings | null>(() => {
        const settings = store.settings();
        if (!settings?.knownDevices) return null;
        return settings.knownDevices.find((d) => d.deviceId === deviceId) ?? null;
      }),
  };
}
