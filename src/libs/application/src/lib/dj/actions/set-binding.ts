import { updateState } from '../../with-devtools';
import { createAction, logInfo, LogType } from '@teensyrom-nx/utils';
import { DeckBindingState, DjState, WritableStore } from '../dj-store';
import type { Slot } from '../slot';

/** Replaces a slot's cartridge binding wholesale. */
export function setBinding(store: WritableStore<DjState>) {
  return {
    setBinding: ({ slot, binding }: { slot: Slot; binding: DeckBindingState }): void => {
      const actionMessage = createAction('set-binding');

      logInfo(LogType.Info, `Deck ${slot} binding updated`);

      updateState(store, actionMessage, (state) => ({
        bindings: { ...state.bindings, [slot]: binding },
      }));
    },
  };
}
