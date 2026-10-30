import { updateState } from '../../../with-devtools';
import { createAction } from '@teensyrom-nx/utils';
import type { WritableStore } from '../../dj-store';
import type { LearnState, MidiMappingState } from '../midi-mapping-store';

/** Starts, advances or ends the mapping capture. Logs nothing: it advances on incoming MIDI. */
export function setLearn(store: WritableStore<MidiMappingState>) {
  return {
    setLearn: ({ learn }: { learn: LearnState | null }): void => {
      const actionMessage = createAction('set-learn');

      updateState(store, actionMessage, () => ({ learn }));
    },
  };
}
