import { computed } from '@angular/core';
import type { WritableStore } from '../../dj-store';
import { controlKey, type ControlIdentity, type ControlMapping } from '../mapping.models';
import type { MidiMappingState } from '../midi-mapping-store';

/** Every mapping that drives a control; a control keeps several sources. */
export function mappingsForControl(store: WritableStore<MidiMappingState>) {
  return {
    mappingsForControl: (identity: ControlIdentity) =>
      computed<readonly ControlMapping[]>(() => {
        const key = controlKey(identity);
        return store.mappings().filter((mapping) => controlKey(mapping.control) === key);
      }),
  };
}
