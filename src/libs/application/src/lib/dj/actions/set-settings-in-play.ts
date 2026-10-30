import { updateState } from '../../with-devtools';
import { createAction, logInfo, LogType } from '@teensyrom-nx/utils';
import { DeckMixerSettings, DeckPanelState, DjState, WritableStore } from '../dj-store';
import type { Slot } from '../slot';

/** Swaps which settings are in play on a deck: writes its whole panel, the marker whose own
 *  settings are in play and the main track's held settings together, so the swap is one step in
 *  DevTools. `setDeckPanel` cannot do this, since its patch leaves the voice strips out. */
export function setSettingsInPlay(store: WritableStore<DjState>) {
  return {
    setSettingsInPlay: ({
      slot,
      panel,
      settingsInPlayId,
      mainSettings,
    }: {
      slot: Slot;
      panel: DeckPanelState;
      settingsInPlayId: string | null;
      mainSettings: DeckMixerSettings | null;
    }): void => {
      const actionMessage = createAction('set-settings-in-play');

      logInfo(LogType.Info, `Deck ${slot} settings in play -> ${settingsInPlayId ?? 'main'}`);

      updateState(store, actionMessage, (state) => ({
        panel: { ...state.panel, [slot]: panel },
        loops: {
          ...state.loops,
          [slot]: { ...state.loops[slot], settingsInPlayId, mainSettings },
        },
      }));
    },
  };
}
