import { Injectable, inject } from '@angular/core';
import { clamp } from '@sidablist/core';
import { DeckRuntime } from './deck-runtime';
import type { Slot } from './slot';
import { createSpeedExcursion, SPEED_HARD_SPAN, SPEED_INPUT_SPAN } from './mixer/speed-excursion';

type SpeedExcursion = ReturnType<typeof createSpeedExcursion>;

/**
 * Each deck's tempo controls: the speed fader and the remembered-speed jump buttons.
 *
 * The fader reaches 0.5x–1.5x; the jumps may reach 0.3x–1.7x. A fader move while a jump excursion
 * is open does not close it — the next opposite press still restores the value remembered when the
 * excursion opened. Writes go straight to the engine; the store learns the tempo from the engine's
 * own snapshot, which `DeckService` reflects.
 */
@Injectable({ providedIn: 'root' })
export class DeckSpeed {
  private readonly runtime = inject(DeckRuntime);

  private readonly excursions: Record<Slot, SpeedExcursion> = {
    A: this.createExcursion('A'),
    B: this.createExcursion('B'),
  };

  /** Sets the tempo multiplier, clamped to 1 ± `SPEED_INPUT_SPAN`. Non-finite values are ignored. */
  setFader(slot: Slot, multiplier: number): void {
    if (!Number.isFinite(multiplier)) {
      return;
    }
    this.runtime.setTempo(slot, clamp(multiplier, 1 - SPEED_INPUT_SPAN, 1 + SPEED_INPUT_SPAN));
  }

  /** One press of a jump button: `up` and `down` open, hold or return from an excursion, `home`
   *  returns from one or, with none open, goes to 1.0x. */
  jump(slot: Slot, id: 'up' | 'home' | 'down'): void {
    const excursion = this.excursions[slot];
    if (id === 'up') {
      excursion.jumpUp();
    } else if (id === 'down') {
      excursion.jumpDown();
    } else {
      excursion.home();
    }
  }

  /** Closes any open excursion and returns the deck to 1.0x. */
  reset(slot: Slot): void {
    this.excursions[slot] = this.createExcursion(slot);
    this.runtime.setTempo(slot, 1);
  }

  private createExcursion(slot: Slot): SpeedExcursion {
    return createSpeedExcursion({
      setTempo: (multiplier) => this.runtime.setTempo(slot, multiplier),
      getMultiplier: () => this.runtime.snapshot(slot).tempo.multiplier,
      slowest: 1 - SPEED_HARD_SPAN,
      fastest: 1 + SPEED_HARD_SPAN,
    });
  }
}
