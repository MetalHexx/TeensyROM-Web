import { updateState } from '@angular-architects/ngrx-toolkit';
import { createAction, logInfo, LogType } from '@teensyrom-nx/utils';
import type { WritableStore } from '../../dj-store';
import { sourceKey, type ControlMapping } from '../mapping.models';
import type { MidiMappingState } from '../midi-mapping-store';

/** Adds a mapping, or replaces the one with the same id. One source drives one control, so any
 *  other mapping on the same source is dropped. */
export function upsertMapping(store: WritableStore<MidiMappingState>) {
  return {
    upsertMapping: ({ mapping }: { mapping: ControlMapping }): void => {
      const actionMessage = createAction('upsert-mapping');

      logInfo(LogType.Info, `MIDI mapping ${mapping.id} set`);

      updateState(store, actionMessage, (state) => {
        const key = sourceKey(mapping.source);
        const others = state.mappings.filter(
          (existing) => existing.id === mapping.id || sourceKey(existing.source) !== key
        );
        const replaced = others.some((existing) => existing.id === mapping.id);
        return {
          mappings: replaced
            ? others.map((existing) => (existing.id === mapping.id ? mapping : existing))
            : [...others, mapping],
        };
      });
    },
  };
}
