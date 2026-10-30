import { updateState } from '../../../with-devtools';
import { createAction, logInfo, LogType } from '@teensyrom-nx/utils';
import type { WritableStore } from '../../dj-store';
import type { MidiMappingState } from '../midi-mapping-store';

export function removeMapping(store: WritableStore<MidiMappingState>) {
  return {
    removeMapping: ({ id }: { id: string }): void => {
      const actionMessage = createAction('remove-mapping');

      logInfo(LogType.Info, `MIDI mapping ${id} removed`);

      updateState(store, actionMessage, (state) => ({
        mappings: state.mappings.filter((mapping) => mapping.id !== id),
      }));
    },
  };
}
