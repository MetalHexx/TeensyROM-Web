import { updateState } from '@angular-architects/ngrx-toolkit';
import { createAction, logInfo, LogType } from '@teensyrom-nx/utils';
import { DeckLoopMarker, DjState, WritableStore } from '../dj-store';
import type { Slot } from '../slot';

/** True when `next` holds the same markers as `current`, in the same order, with the same
 *  boundaries and voices — whatever their readiness or settings. */
function samePlaces(current: readonly DeckLoopMarker[], next: readonly DeckLoopMarker[]): boolean {
  return (
    current.length === next.length &&
    current.every((marker, i) => {
      const other = next[i];
      return (
        marker.id === other.id &&
        marker.start === other.start &&
        marker.end === other.end &&
        marker.voices === other.voices
      );
    })
  );
}

/** Replaces a deck's marker list. A readiness change is frequent while the engine builds, and a
 *  settings change on every knob tick, so neither logs. */
export function setLoopMarkers(store: WritableStore<DjState>) {
  return {
    setLoopMarkers: ({
      slot,
      markers,
    }: {
      slot: Slot;
      markers: readonly DeckLoopMarker[];
    }): void => {
      const actionMessage = createAction('set-loop-markers');

      if (!samePlaces(store.loops()[slot].markers, markers)) {
        logInfo(LogType.Info, `Deck ${slot} markers -> ${markers.length}`);
      }

      updateState(store, actionMessage, (state) => ({
        loops: { ...state.loops, [slot]: { ...state.loops[slot], markers } },
      }));
    },
  };
}
