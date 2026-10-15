import { computed } from '@angular/core';
import type { WritableStore } from '../../dj-store';
import type { KnownController } from '../mapping.models';
import type { MidiMappingState } from '../midi-mapping-store';

/** A known controller by id, or `null`. */
export function controller(store: WritableStore<MidiMappingState>) {
  return {
    controller: (id: string) =>
      computed<KnownController | null>(
        () => store.controllers().find((known) => known.id === id) ?? null
      ),
  };
}
