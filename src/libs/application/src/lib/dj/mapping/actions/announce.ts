import { updateState } from '../../../with-devtools';
import { createAction } from '@teensyrom-nx/utils';
import type { WritableStore } from '../../dj-store';
import type { MidiMappingState } from '../midi-mapping-store';

/** Sets the live-region message. */
export function announce(store: WritableStore<MidiMappingState>) {
  return {
    announce: ({ text }: { text: string | null }): void => {
      const actionMessage = createAction('announce');

      updateState(store, actionMessage, () => ({ announcement: text }));
    },
  };
}
