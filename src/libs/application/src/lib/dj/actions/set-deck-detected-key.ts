import { updateState } from '../../with-devtools';
import { createAction, logInfo, LogType } from '@teensyrom-nx/utils';
import { DeckDetectedKey, DjState, WritableStore } from '../dj-store';
import type { Slot } from '../slot';

/** Sets a deck's detected key, or clears it with `null`. */
export function setDeckDetectedKey(store: WritableStore<DjState>) {
  return {
    setDeckDetectedKey: ({
      slot,
      detectedKey,
    }: {
      slot: Slot;
      detectedKey: DeckDetectedKey | null;
    }): void => {
      const actionMessage = createAction('set-deck-detected-key');

      logInfo(LogType.Info, `Deck ${slot} detected key -> ${detectedKey?.camelot ?? 'none'}`);

      updateState(store, actionMessage, (state) => ({
        decks: {
          ...state.decks,
          [slot]: { ...state.decks[slot], detectedKey },
        },
      }));
    },
  };
}
