import { computed } from '@angular/core';
import { WritableStore } from '../actions';
import { SettingsState } from '../settings-state.interface';

/**
 * Selector factory for getting whether auto-connect is enabled for a specific device
 * Returns true if device is not found (new devices should auto-connect by default)
 */
export function selectAutoConnectForDevice(store: WritableStore<SettingsState>) {
  return {
    autoConnectForDevice: (deviceId: string) =>
      computed(() => {
        const settings = store.settings();
        if (!settings?.knownDevices) return true; // Default: auto-connect new devices
        const device = settings.knownDevices.find((d) => d.deviceId === deviceId);
        return device?.connectionSettings?.autoConnectEnabled ?? true;
      }),
  };
}
