import { computed } from '@angular/core';
import { AudioDevice } from '@teensyrom-nx/domain';
import { AudioState } from '../audio-store.state';
import { WritableStore } from '../actions';

/**
 * Selector for getting the currently selected audio device
 * Returns null if no device is selected
 */
export function selectedDevice(store: WritableStore<AudioState>) {
  return {
    selectedDevice: computed<AudioDevice | null>(() => {
      const devices = store.devices();
      const selectedIndex = store.selectedDeviceIndex();
      if (selectedIndex === null || selectedIndex < 0 || selectedIndex >= devices.length) {
        return null;
      }
      return devices[selectedIndex];
    }),
  };
}
