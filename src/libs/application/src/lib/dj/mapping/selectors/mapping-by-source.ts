import { computed } from '@angular/core';
import type { WritableStore } from '../../dj-store';
import { sourceKey, type ControlMapping } from '../mapping.models';
import type { MidiMappingState } from '../midi-mapping-store';

/** The mapping on a source (by `sourceKey`), or `null`. */
export function mappingBySource(store: WritableStore<MidiMappingState>) {
  return {
    mappingBySource: (key: string) =>
      computed<ControlMapping | null>(
        () => store.mappings().find((mapping) => sourceKey(mapping.source) === key) ?? null
      ),
  };
}
