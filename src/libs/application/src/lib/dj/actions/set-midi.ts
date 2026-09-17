import { updateState } from '@angular-architects/ngrx-toolkit';
import { createAction, logInfo, LogType } from '@teensyrom-nx/utils';
import { DjState, MidiState, WritableStore } from '../dj-store';

/** Replaces the page-level Web MIDI slice: the grant state, the enumerated ports, and the last error. */
export function setMidi(store: WritableStore<DjState>) {
  return {
    setMidi: (midi: MidiState): void => {
      const actionMessage = createAction('set-midi');

      logInfo(LogType.Info, `MIDI access -> ${midi.accessState}`);

      updateState(store, actionMessage, () => ({ midi }));
    },
  };
}
