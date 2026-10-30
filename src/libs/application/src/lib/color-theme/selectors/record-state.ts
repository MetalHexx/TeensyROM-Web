import { computed, Signal } from '@angular/core';
import { StateSignals } from '@ngrx/signals';
import { Device } from '@teensyrom-nx/domain';
import { ColorThemeState } from '../color-theme-state.interface';
import { sameColors } from './themes';

export type ColorRecordState =
  | { kind: 'none' }
  | { kind: 'recorded' }
  | { kind: 'differ'; shownDeviceName: string; deviceNames: string[] };

/**
 * What the connected devices have on record: nothing, one agreed set of colors, or colors that differ
 * between devices. The first device with a loaded record is the one whose colors the draft shows.
 */
export function recordStateSelector(
  store: StateSignals<ColorThemeState>,
  connectedDevices: Signal<Device[]>
) {
  const recordState = computed<ColorRecordState>(() => {
    const records = store.records();
    const known = connectedDevices()
      .filter((d) => records[d.deviceId])
      .map((d) => ({ device: d, record: records[d.deviceId] }));

    if (!known.some((k) => k.record.isRecorded)) {
      return { kind: 'none' };
    }
    const first = known[0];
    if (known.every((k) => sameColors(k.record.colors, first.record.colors))) {
      return { kind: 'recorded' };
    }
    return {
      kind: 'differ',
      shownDeviceName: first.device.name || first.device.deviceId,
      deviceNames: known.map((k) => k.device.name || k.device.deviceId),
    };
  });

  return { recordState };
}
