import { signal, type Signal } from '@angular/core';
import { clamp } from '@sidablist/core';

/** One press of a jump button moves the multiplier by this much, additively — mirrors
 *  `dj-player-engine.ts`'s own `SPEED_JUMP_STEP` until the old engine's copy of this state machine
 *  is deleted. */
const JUMP_STEP = 0.5;

/** A remembered-speed excursion the jump buttons drive. DJ apparatus, not timeline: the first press
 *  of either button opens an excursion by remembering the pre-jump multiplier, then moves the
 *  multiplier additively, clamped to [`slowest`, `fastest`]; a same-side press while open is a
 *  no-op, and an opposite-side press restores the remembered value exactly — never by re-deriving it
 *  with arithmetic, so a jump that clamped on the way out cannot corrupt the way back — and closes
 *  the excursion. `home()` is dual-purpose: 1.0 with no excursion open, or the same exact-restore-
 *  and-close an opposite jump takes.
 *
 *  Tracks the multiplier itself, seeded at home (1) — `setTempo` is a pure sink here, not also a
 *  source, so nothing in this module observes a tempo change made outside `jumpUp`/`jumpDown`/
 *  `home` (the fader, while the old engine still stands as the wiring for `P09-T05` to replace).
 *  Direction is tracked separately from the multiplier because "same button again" versus "opposite
 *  button" cannot be told apart from the multiplier's value alone once a jump has clamped.
 */
export function createSpeedExcursion(opts: {
  setTempo: (multiplier: number) => void;
  slowest: number;
  fastest: number;
}): {
  readonly remembered: Signal<number | null>;
  jumpUp(): void;
  jumpDown(): void;
  home(): void;
} {
  const { setTempo, slowest, fastest } = opts;
  const _remembered = signal<number | null>(null);
  let current = 1;
  let direction: 'up' | 'down' | null = null;

  function returnFromExcursion(rememberedValue: number): void {
    current = rememberedValue;
    setTempo(current);
    _remembered.set(null);
    direction = null;
  }

  function jump(dir: 'up' | 'down'): void {
    const rememberedValue = _remembered();
    if (rememberedValue === null) {
      _remembered.set(current);
      direction = dir;
      const delta = dir === 'up' ? JUMP_STEP : -JUMP_STEP;
      current = clamp(current + delta, slowest, fastest);
      setTempo(current);
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
        current = 1;
        setTempo(current);
        return;
      }
      returnFromExcursion(rememberedValue);
    },
  };
}
