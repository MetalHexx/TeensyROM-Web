import { Injectable, inject } from '@angular/core';
import { clamp } from '@sidablist/core';
import { DeckRuntime } from './deck-runtime';
import type { Slot } from './slot';
import { createSpeedExcursion, SPEED_HARD_SPAN, SPEED_INPUT_SPAN } from './mixer/speed-excursion';

type SpeedExcursion = ReturnType<typeof createSpeedExcursion>;

export type NudgeDirection = 'up' | 'down';

/** One deck's speed controls: the fader's own value, and the amount each nudge pad is holding
 *  (`null` when released). */
interface DeckTempo {
  fader: number;
  layers: Record<NudgeDirection, number | null>;
}

function homeTempo(): DeckTempo {
  return { fader: 1, layers: { up: null, down: null } };
}

/**
 * Each deck's tempo controls: the speed fader, the remembered-speed jump buttons and the two
 * momentary nudge pads.
 *
 * The deck keeps the fader's value apart from the tempo the engine plays. The tempo is always
 * recomputed from the fader plus whichever nudge layers are held — never added to on a press and
 * subtracted on a release — so releasing a nudge lands on the fader's value exactly, wherever the
 * fader or a jump has moved it meanwhile.
 *
 * The fader reaches 0.5x–1.5x; the jumps may reach 0.3x–1.7x and move the fader's value, as does
 * the fader itself. A jump excursion remembers the fader's value, never the nudged tempo. A fader
 * move while an excursion is open does not close it — the next opposite press still restores the
 * value remembered when the excursion opened. Writes go straight to the engine; the store learns
 * the tempo from the engine's own snapshot, which `DeckService` reflects.
 */
@Injectable({ providedIn: 'root' })
export class DeckSpeed {
  private readonly runtime = inject(DeckRuntime);

  private readonly tempos: Record<Slot, DeckTempo> = { A: homeTempo(), B: homeTempo() };

  private readonly excursions: Record<Slot, SpeedExcursion> = {
    A: this.createExcursion('A'),
    B: this.createExcursion('B'),
  };

  /** Sets the speed fader's value, clamped to 1 ± `SPEED_INPUT_SPAN`. Non-finite values are
   *  ignored. */
  setFader(slot: Slot, multiplier: number): void {
    if (!Number.isFinite(multiplier)) {
      return;
    }
    this.tempos[slot].fader = clamp(multiplier, 1 - SPEED_INPUT_SPAN, 1 + SPEED_INPUT_SPAN);
    this.apply(slot);
  }

  /** Presses or releases a nudge pad. A press while the same pad is held replaces its amount —
   *  nudges do not stack — and a release of a pad that is not held does nothing. */
  setNudge(slot: Slot, direction: NudgeDirection, held: boolean, amount: number): void {
    const { layers } = this.tempos[slot];
    if (!held && layers[direction] === null) {
      return;
    }
    layers[direction] = held ? amount : null;
    this.apply(slot);
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

  /** Returns the deck to 1.0x: the fader home, both nudges released and any open excursion
   *  closed. */
  reset(slot: Slot): void {
    this.tempos[slot] = homeTempo();
    this.excursions[slot] = this.createExcursion(slot);
    this.apply(slot);
  }

  /** The speed fader's own value, before any nudge. */
  faderValue(slot: Slot): number {
    return this.tempos[slot].fader;
  }

  /** True while either nudge pad is held. */
  isNudging(slot: Slot): boolean {
    const { up, down } = this.tempos[slot].layers;
    return up !== null || down !== null;
  }

  /** The one tempo function: the fader's value plus the held up amount minus the held down
   *  amount, within the hard span. Called after every change. */
  private apply(slot: Slot): void {
    const { fader, layers } = this.tempos[slot];
    this.runtime.setTempo(
      slot,
      clamp(fader + (layers.up ?? 0) - (layers.down ?? 0), 1 - SPEED_HARD_SPAN, 1 + SPEED_HARD_SPAN)
    );
  }

  private createExcursion(slot: Slot): SpeedExcursion {
    return createSpeedExcursion({
      setTempo: (multiplier) => {
        this.tempos[slot].fader = multiplier;
        this.apply(slot);
      },
      getMultiplier: () => this.tempos[slot].fader,
      slowest: 1 - SPEED_HARD_SPAN,
      fastest: 1 + SPEED_HARD_SPAN,
    });
  }
}
