import { updateState } from '../../with-devtools';
import { createAction, logInfo, LogType } from '@teensyrom-nx/utils';
import { DeckLiveLoopState, DjState, WritableStore } from '../dj-store';
import type { Slot } from '../slot';

/** Sets the live loop a deck's engine is running, or clears it with null. */
export function setLiveLoop(store: WritableStore<DjState>) {
  return {
    setLiveLoop: ({ slot, live }: { slot: Slot; live: DeckLiveLoopState | null }): void => {
      const actionMessage = createAction('set-live-loop');

      logInfo(
        LogType.Info,
        live === null
          ? `Deck ${slot} live loop -> none`
          : `Deck ${slot} live loop -> ${live.startFrame}-${live.endFrame}${
              live.pendingEndFrame === null ? '' : ` (to ${live.pendingEndFrame})`
            }`
      );

      updateState(store, actionMessage, (state) => ({
        loops: {
          ...state.loops,
          [slot]: { ...state.loops[slot], live },
        },
      }));
    },
  };
}
