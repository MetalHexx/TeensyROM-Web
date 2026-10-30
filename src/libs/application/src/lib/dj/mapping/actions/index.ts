import { withMethods } from '@ngrx/signals';
import type { WritableStore } from '../../dj-store';
import type { MidiMappingState } from '../midi-mapping-store';
import { setMidiMappingData } from './set-midi-mapping-data';
import { upsertMapping } from './upsert-mapping';
import { removeMapping } from './remove-mapping';
import { upsertController } from './upsert-controller';
import { removeController } from './remove-controller';
import { setMappingMode } from './set-mapping-mode';
import { setLearn } from './set-learn';
import { setControllerRuntime } from './set-controller-runtime';
import { announce } from './announce';
import { repairControllers } from './repair-controllers';

export function withMidiMappingActions() {
  return withMethods((store) => {
    const writableStore = store as WritableStore<MidiMappingState>;
    return {
      ...setMidiMappingData(writableStore),
      ...upsertMapping(writableStore),
      ...removeMapping(writableStore),
      ...upsertController(writableStore),
      ...removeController(writableStore),
      ...setMappingMode(writableStore),
      ...setLearn(writableStore),
      ...setControllerRuntime(writableStore),
      ...announce(writableStore),
      ...repairControllers(writableStore),
    };
  });
}
