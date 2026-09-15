import { inject } from '@angular/core';
import { withMethods } from '@ngrx/signals';
import { DjState, WritableStore } from '../dj-store';
import { DeviceStore } from '../../device/device-store';
import { deck } from './deck';
import { binding } from './binding';
import { transportSummary } from './transport-summary';
import { bindingSummary } from './binding-summary';

export function withDjSelectors() {
  return withMethods((store, deviceStore: InstanceType<typeof DeviceStore> = inject(DeviceStore)) => {
    const writableStore = store as WritableStore<DjState>;
    return {
      ...deck(writableStore),
      ...binding(writableStore),
      ...transportSummary(writableStore),
      ...bindingSummary(writableStore, deviceStore),
    };
  });
}
