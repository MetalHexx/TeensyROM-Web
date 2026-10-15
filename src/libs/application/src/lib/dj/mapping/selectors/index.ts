import { withMethods } from '@ngrx/signals';
import type { WritableStore } from '../../dj-store';
import type { MidiMappingState } from '../midi-mapping-store';
import { mappingBySource } from './mapping-by-source';
import { mappingsForControl } from './mappings-for-control';
import { controller } from './controller';
import { hasMappings } from './has-mappings';
import { mappingsByOwner } from './mappings-by-owner';

export function withMidiMappingSelectors() {
  return withMethods((store) => {
    const writableStore = store as WritableStore<MidiMappingState>;
    return {
      ...mappingBySource(writableStore),
      ...mappingsForControl(writableStore),
      ...controller(writableStore),
      ...hasMappings(writableStore),
      ...mappingsByOwner(writableStore),
    };
  });
}
