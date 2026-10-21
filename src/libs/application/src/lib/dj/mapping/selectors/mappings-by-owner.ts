import { computed } from '@angular/core';
import type { WritableStore } from '../../dj-store';
import type { ControlMapping, ControlOwner } from '../mapping.models';
import type { MidiMappingState } from '../midi-mapping-store';

/** The mappings grouped by the owner of the control they drive. */
export function mappingsByOwner(store: WritableStore<MidiMappingState>) {
  return {
    mappingsByOwner: () =>
      computed<Record<ControlOwner, readonly ControlMapping[]>>(() => {
        const mappings = store.mappings();
        return {
          A: mappings.filter((mapping) => mapping.control.owner === 'A'),
          B: mappings.filter((mapping) => mapping.control.owner === 'B'),
          mixer: mappings.filter((mapping) => mapping.control.owner === 'mixer'),
        };
      }),
  };
}
