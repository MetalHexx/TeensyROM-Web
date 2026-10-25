import { computed } from '@angular/core';
import { DjState, WritableStore } from '../dj-store';
import type { Slot } from '../slot';
import { clamp, resolvedFrame } from '../loops/loop-marker-math';

/** How far the playhead is through the running marker loop's lap, 0–100; 0 when no marker loop is
 *  running. Reads the playhead, so it recomputes with every frame tick — keep it apart from the
 *  summary. */
export function loopLapPercent(store: WritableStore<DjState>) {
  return {
    loopLapPercent: (slot: Slot) =>
      computed<number>(() => {
        const { markers, runningId } = store.loops()[slot];
        const running = runningId === null ? undefined : markers.find((m) => m.id === runningId);
        if (running === undefined || running.end === null) {
          return 0;
        }
        const start = resolvedFrame(running.start);
        const end = resolvedFrame(running.end);
        if (end <= start) {
          return 0;
        }
        return clamp(((store.decks()[slot].positionFrames - start) / (end - start)) * 100, 0, 100);
      }),
  };
}
