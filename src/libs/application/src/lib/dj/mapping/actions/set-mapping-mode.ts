import { updateState } from '@angular-architects/ngrx-toolkit';
import { createAction, logInfo, LogType } from '@teensyrom-nx/utils';
import type { WritableStore } from '../../dj-store';
import type { MidiMappingState } from '../midi-mapping-store';

/** Turns mapping mode on or off. Turning it off also ends any mapping capture in progress. */
export function setMappingMode(store: WritableStore<MidiMappingState>) {
  return {
    setMappingMode: ({ on }: { on: boolean }): void => {
      const actionMessage = createAction('set-mapping-mode');

      logInfo(LogType.Info, `MIDI mapping mode -> ${on}`);

      updateState(store, actionMessage, () =>
        on ? { mappingMode: true } : { mappingMode: false, learn: null }
      );
    },
  };
}
