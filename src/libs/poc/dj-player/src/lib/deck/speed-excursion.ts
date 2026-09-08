import { signal, type Signal } from '@angular/core';
import { clamp } from '@sidablist/core';

/** One press of a jump button moves the multiplier by this much, additively. */
const JUMP_STEP = 0.5;

/** What the fader and any typed value may reach: 0.5x–1.5x. Core divides by whatever multiplier it
 *  is handed, so every span a control honours is stated on this side of the seam. */
export const SPEED_INPUT_SPAN = 0.5;

/** What the jump buttons may reach: 0.3x–1.7x. */
export const SPEED_HARD_SPAN = 0.7;

/** A remembered-speed excursion the jump buttons drive. DJ apparatus, not timeline: the first press
 *  of either button opens an excursion by remembering the pre-jump multiplier, then moves the
 *  multiplier additively, clamped to [`slowest`, `fastest`]; a same-side press while open is a
 *  no-op, and an opposite-side press restores the remembered value exactly — never by re-deriving it
 *  with arithmetic, so a jump that clamped on the way out cannot corrupt the way back — and closes
 *  the excursion. `home()` is dual-purpose: 1.0 with no excursion open, or the same exact-restore-
 *  and-close an opposite jump takes.
 *
 *  Opening a fresh excursion seeds `remembered` from `getMultiplier()` — the live tempo — rather
 *  than trusting an internally tracked value, since a tempo change made outside `jumpUp`/`jumpDown`/
 *  `home` (the fader, or a tune load) never calls back into this module. Direction is tracked
 *  separately from the multiplier because "same button again" versus "opposite button" cannot be
 *  told apart from the multiplier's value alone once a jump has clamped.
 */
export function createSpeedExcursion(opts: {
  setTempo: (multiplier: number) => void;
  getMultiplier: () => number;
  slowest: number;
  fastest: number;
}): {
  readonly remembered: Signal<number | null>;
  jumpUp(): void;
  jumpDown(): void;
  home(): void;
} {
  const { setTempo, getMultiplier, slowest, fastest } = opts;
  const _remembered = signal<number | null>(null);
  let direction: 'up' | 'down' | null = null;

  function returnFromExcursion(rememberedValue: number): void {
    setTempo(rememberedValue);
    _remembered.set(null);
    direction = null;
  }

  function jump(dir: 'up' | 'down'): void {
    const rememberedValue = _remembered();
    if (rememberedValue === null) {
      const liveMultiplier = getMultiplier();
      _remembered.set(liveMultiplier);
      direction = dir;
      const delta = dir === 'up' ? JUMP_STEP : -JUMP_STEP;
      setTempo(clamp(liveMultiplier + delta, slowest, fastest));
      return;
    }
    if (direction === dir) {
      return; // same button again while on an excursion — no-op
    }
    returnFromExcursion(rememberedValue);
  }

  return {
    remembered: _remembered.asReadonly(),
    jumpUp: () => jump('up'),
    jumpDown: () => jump('down'),
    home: () => {
      const rememberedValue = _remembered();
      if (rememberedValue === null) {
        setTempo(1);
        return;
      }
      returnFromExcursion(rememberedValue);
    },
  };
}
