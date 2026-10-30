import { computed, Signal } from '@angular/core';
import { StateSignals } from '@ngrx/signals';
import { APPLY_TO_ALL_DEVICES, Device } from '@teensyrom-nx/domain';
import { ColorThemeState } from '../color-theme-state.interface';

/** The connected devices and the apply target among them. */
export function deviceSelectors(
  store: StateSignals<ColorThemeState>,
  usableDevices: Signal<Device[]>
) {
  const connectedDevices = computed(() => usableDevices().filter((d) => d.isConnected));
  const showApplyTarget = computed(() => connectedDevices().length >= 2);
  const effectiveApplyTarget = computed(() => {
    const target = store.applyTarget();
    return connectedDevices().some((d) => d.deviceId === target) ? target : APPLY_TO_ALL_DEVICES;
  });
  const targetDevices = computed(() => {
    const target = effectiveApplyTarget();
    return target === APPLY_TO_ALL_DEVICES
      ? connectedDevices()
      : connectedDevices().filter((d) => d.deviceId === target);
  });

  return { connectedDevices, showApplyTarget, effectiveApplyTarget, targetDevices };
}
