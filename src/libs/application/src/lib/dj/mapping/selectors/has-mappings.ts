import { computed } from '@angular/core';
import type { WritableStore } from '../../dj-store';
import type { MidiMappingState } from '../midi-mapping-store';

/** Whether any mapping uses a source from this controller. */
export function hasMappings(store: WritableStore<MidiMappingState>) {
  return {
    hasMappings: (controllerId: string) =>
      computed<boolean>(() =>
        store.mappings().some((mapping) => mapping.source.controllerId === controllerId)
      ),
  };
}
