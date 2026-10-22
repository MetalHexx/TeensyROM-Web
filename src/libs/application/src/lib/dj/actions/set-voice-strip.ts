import { updateState } from '@angular-architects/ngrx-toolkit';
import { createAction } from '@teensyrom-nx/utils';
import { DjState, VoiceStripState, WritableStore } from '../dj-store';
import type { Slot } from '../slot';

/** Merges a patch into one voice's strip (voice 0…2); any other voice changes nothing. Logs
 *  nothing — it fires on every drag tick. */
export function setVoiceStrip(store: WritableStore<DjState>) {
  return {
    setVoiceStrip: ({
      slot,
      voice,
      patch,
    }: {
      slot: Slot;
      voice: number;
      patch: Partial<VoiceStripState>;
    }): void => {
      const actionMessage = createAction('set-voice-strip');

      updateState(store, actionMessage, (state) => {
        const panel = state.panel[slot];
        const pick = (index: number, strip: VoiceStripState): VoiceStripState =>
          index === voice ? { ...strip, ...patch } : strip;
        const [first, second, third] = panel.voices;
        const voices = [pick(0, first), pick(1, second), pick(2, third)] as const;
        return { panel: { ...state.panel, [slot]: { ...panel, voices } } };
      });
    },
  };
}
