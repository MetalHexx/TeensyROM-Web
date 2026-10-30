import { updateState } from '../../../with-devtools';
import { createAction, logInfo, LogType } from '@teensyrom-nx/utils';
import type { WritableStore } from '../../dj-store';
import type { ControlMapping, KnownController } from '../mapping.models';
import type { MidiMappingState } from '../midi-mapping-store';

/** Replaces the controllers and mappings with the loaded set and marks the store loaded. */
export function setMidiMappingData(store: WritableStore<MidiMappingState>) {
  return {
    setMidiMappingData: ({
      controllers,
      mappings,
    }: {
      controllers: readonly KnownController[];
      mappings: readonly ControlMapping[];
    }): void => {
      const actionMessage = createAction('set-midi-mapping-data');

      logInfo(
        LogType.Info,
        `MIDI mappings loaded: ${controllers.length} controllers, ${mappings.length} mappings`
      );

      updateState(store, actionMessage, () => ({ loaded: true, controllers, mappings }));
    },
  };
}
