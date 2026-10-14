import { Injectable, Injector, effect, inject, runInInjectionContext, untracked } from '@angular/core';
import { logError, logWarn } from '@teensyrom-nx/utils';
import { clamp } from '@sidablist/core';
import type { SidFilterMode } from '@sidablist/core';
import { DjStore } from './dj-store';
import { DeckRuntime } from './deck-runtime';
import { DECK_SLOTS, type Slot } from './slot';
import { linearCrossfaderGain } from './mixer/crossfader-curve';
import { scaleCoefficientFor, keyCoefficientFor } from './mixer/scale-taper';
import {
  cutoffSweepDrives,
  dipSteps,
  resonanceDrive,
  tuneFilterStateFrom,
  type FieldDrive,
} from './mixer/filter-sweep';

/** Matches `DeckRuntime`'s refusal to hand out a slot whose engine bundle was never built. */
const UNBUILT_SLOT = /has not been built/;

/** How often a dip checks whether the engine has built another frame. The frame clock ticks every
 *  ~5 ms on this same thread, so each frame is seen within a tick of being built. */
const DIP_POLL_MS = 4;

/** A dip that sees no new frame for this long steps on anyway — a deck stopped mid-dip, or a
 *  stalled thread — so the volume is never left down. */
const DIP_GIVE_UP_MS = 100;

/** A volume dip in progress on one slot: which of `dipSteps()`'s factors is current, the frame
 *  count when it was set, and the sweep drives waiting to go out on the flip. */
interface Dip {
  readonly factors: readonly number[];
  readonly flipAt: number;
  step: number;
  position: number;
  since: number;
  drives: readonly FieldDrive[];
  timer: ReturnType<typeof setTimeout> | null;
}

/**
 * Turns each deck's stored mixer values into engine values: the crossfader-weighted output gain,
 * the pulse-width scale, the key coefficient, the filter mode, and the held cutoff, filter-routing
 * and resonance fields the cutoff and resonance knobs sweep. The cutoff and resonance register
 * scales are never set; they stay at home.
 *
 * The filter type has one owner: the sweep holds it while the cutoff knob is off centre, and at
 * centre the stored filter mode is applied instead of releasing the hold.
 *
 * Moving a voice into or out of the filter clicks on the chip, so on a playing deck a change to
 * the filter switches goes out behind a short dip of the deck's gain. The gain fades out to
 * silence, a silent frame goes out, the switches are sent, and the gain fades back in; the
 * lengths are `FILTER_SWEEP.dip`. The firmware writes `$D417` before `$D418` within a frame, so the
 * routing in `$D417` lands on a silent chip, while the filter type shares `$D418` with the volume
 * and changes at the first step of the fade back. The fades soften the click rather than remove
 * it. A switch change that arrives during the fade back starts a new dip from the gain it has
 * reached, so the gain never rises before it falls. The dip only shapes the gain the deck already
 * has; it holds nothing, and every way it ends leaves the gain at level times crossfader with the
 * latest switches applied.
 *
 * One effect per slot re-applies the deck whenever its mix state or the crossfader changes, so a
 * crossfader move re-applies both decks and a deck change re-applies only that deck. Values are
 * composed unrounded — the engine quantises once.
 *
 * `applyDeck` reaches `DeckRuntime.requireSlot`, which throws until `DeckService`'s constructor has
 * built both slots. In the app that holds because `DjBootstrapService` injects `DeckService`
 * before it installs this; an unbuilt slot is still caught and warned about rather than thrown, so
 * construction order can never crash startup.
 */
@Injectable({ providedIn: 'root' })
export class MixerApplier {
  private readonly store = inject(DjStore);
  private readonly runtime = inject(DeckRuntime);
  private readonly injector = inject(Injector);

  private installed = false;
  private readonly warnedUnbuilt = new Set<Slot>();
  /** The filter switches each slot's engine last received, as `switchKey` spells them. */
  private readonly appliedSwitches = new Map<Slot, string>();
  private readonly dips = new Map<Slot, Dip>();

  /** Installs the per-slot effects, once. Further calls are no-ops. */
  install(): void {
    if (this.installed) {
      return;
    }
    this.installed = true;

    runInInjectionContext(this.injector, () => {
      for (const slot of DECK_SLOTS) {
        const mix = this.store.deckMix(slot);
        effect(() => {
          mix();
          this.store.crossfader();
          untracked(() => this.applyDeck(slot));
        });
      }
    });
  }

  /** Synchronously pushes this slot's stored values to its engine — except a change to the filter
   *  switches on a playing deck, which goes out only after the deck's gain has faded to a silent
   *  frame, and brings the gain back behind it. Never throws: a failure is logged and confined to
   *  this slot. */
  applyDeck(slot: Slot): void {
    this.apply(slot, false);
  }

  /** Returns the deck's tune-shaping to home and pushes it to the engine before returning, so the
   *  next tune plays at home settings from its first packet rather than waiting on the effect. Level
   *  and the crossfader are re-applied with it. A dip in progress is dropped, never finished. */
  resetTuneShaping(slot: Slot): void {
    this.store.resetDeckTuneShaping({ slot });
    this.cancelDip(slot);
    this.apply(slot, true);
  }

  private apply(slot: Slot, immediate: boolean): void {
    const { mix, playing } = untracked(() => ({
      mix: this.store.deckMix(slot)(),
      playing: this.store.deck(slot)().status === 'playing',
    }));

    try {
      this.runtime.setRegisterScale(slot, 'pulseWidth', scaleCoefficientFor(mix.pulseWidth));
      this.runtime.setKeyCoefficient(slot, keyCoefficientFor(mix.keySemitones));

      const tune = () => tuneFilterStateFrom(this.runtime.tuneRegisters(slot));
      const drives = cutoffSweepDrives(mix.cutoff, tune);
      const key = switchKey(drives, mix.filterMode);
      const dip = this.dips.get(slot);

      if (dip !== undefined && dip.step < dip.flipAt) {
        dip.drives = drives;
      } else if (immediate || !playing || (this.appliedSwitches.get(slot) ?? key) === key) {
        this.applySweep(slot, drives, mix.filterMode);
      } else {
        this.startDip(slot, drives);
      }

      this.drive(slot, resonanceDrive(mix.resonance));
      this.runtime.setOutputGain(slot, this.gainFor(slot));
    } catch (error) {
      this.report(slot, error);
    }
  }

  private applySweep(slot: Slot, drives: readonly FieldDrive[], filterMode: SidFilterMode | null): void {
    for (const drive of drives) {
      if (drive.field.name === 'filterType' && drive.hold === null) {
        this.runtime.setFilterMode(slot, filterMode);
      } else {
        this.drive(slot, drive);
      }
    }
    this.appliedSwitches.set(slot, switchKey(drives, filterMode));
  }

  /** The level and crossfader gain, times the dip's current factor while one is running. */
  private gainFor(slot: Slot): number {
    const { mix, crossfader } = untracked(() => ({
      mix: this.store.deckMix(slot)(),
      crossfader: this.store.crossfader(),
    }));
    const dip = this.dips.get(slot);
    const factor = dip === undefined ? 1 : (dip.factors[dip.step] ?? 1);
    return clamp(mix.level * linearCrossfaderGain(crossfader, slot === 'A' ? 'a' : 'b') * factor, 0, 1);
  }

  /** Starts a dip carrying `drives`. Past a running dip's flip the gain is still coming back, so
   *  the new fade-out begins at its first step not above the gain reached, never lifting it first. */
  private startDip(slot: Slot, drives: readonly FieldDrive[]): void {
    const running = this.dips.get(slot);
    const reached = running === undefined ? 1 : (running.factors[running.step] ?? 1);
    this.cancelDip(slot);
    const { factors, flipAt } = dipSteps();
    this.dips.set(slot, {
      factors,
      flipAt,
      step: factors.findIndex((factor) => factor <= reached),
      position: this.runtime.position(slot),
      since: Date.now(),
      drives,
      timer: setTimeout(() => this.advanceDip(slot), DIP_POLL_MS),
    });
  }

  /** Moves the dip on one step once the engine has built a frame at the current step's gain:
   *  the step reaching `flipAt` sends the waiting switches with that step's gain. */
  private advanceDip(slot: Slot): void {
    const dip = this.dips.get(slot);
    if (dip === undefined) {
      return;
    }

    try {
      const position = this.runtime.position(slot);
      const now = Date.now();
      if (position === dip.position && now - dip.since < DIP_GIVE_UP_MS) {
        dip.timer = setTimeout(() => this.advanceDip(slot), DIP_POLL_MS);
        return;
      }

      dip.step++;
      dip.position = position;
      dip.since = now;
      if (dip.step === dip.flipAt) {
        this.applySweep(slot, dip.drives, this.storedFilterMode(slot));
      }
      if (dip.step < dip.factors.length) {
        dip.timer = setTimeout(() => this.advanceDip(slot), DIP_POLL_MS);
      } else {
        this.dips.delete(slot);
      }
      this.runtime.setOutputGain(slot, this.gainFor(slot));
    } catch (error) {
      this.abandonDip(slot, dip, error);
    }
  }

  /** Ends a dip that failed: drops it, reports the failure, then tries once to send the waiting
   *  switches and put the gain back to level times crossfader, so the deck is not left down. A
   *  failure of either is reported and never thrown; the gain is attempted even if the switches fail. */
  private abandonDip(slot: Slot, dip: Dip, error: unknown): void {
    this.cancelDip(slot);
    this.report(slot, error);
    try {
      this.applySweep(slot, dip.drives, this.storedFilterMode(slot));
    } catch (retryError) {
      this.report(slot, retryError);
    }
    try {
      this.runtime.setOutputGain(slot, this.gainFor(slot));
    } catch (retryError) {
      this.report(slot, retryError);
    }
  }

  private storedFilterMode(slot: Slot): SidFilterMode | null {
    return untracked(() => this.store.deckMix(slot)()).filterMode;
  }

  private cancelDip(slot: Slot): void {
    const dip = this.dips.get(slot);
    if (dip?.timer != null) {
      clearTimeout(dip.timer);
    }
    this.dips.delete(slot);
  }

  private drive(slot: Slot, { field, hold }: FieldDrive): void {
    if (hold === null) {
      this.runtime.releaseField(slot, field);
    } else {
      this.runtime.holdField(slot, field, hold.value, hold.amount);
    }
  }

  private report(slot: Slot, error: unknown): void {
    if (error instanceof Error && UNBUILT_SLOT.test(error.message)) {
      if (!this.warnedUnbuilt.has(slot)) {
        this.warnedUnbuilt.add(slot);
        logWarn(`MixerApplier: deck ${slot} has no engine built yet — mixer values not applied.`);
      }
      return;
    }
    logError(`MixerApplier: applying deck ${slot} failed`, error);
  }
}

/** The filter switches a set of sweep drives leaves on the chip — the filter type (held, or the
 *  stored mode at centre) and each voice's routing — spelled so two sets compare equal exactly
 *  when sending one after the other would flip nothing. */
function switchKey(drives: readonly FieldDrive[], filterMode: SidFilterMode | null): string {
  return drives
    .filter((drive) => drive.field.name !== 'cutoff')
    .map(({ field, hold }) => {
      if (hold !== null) {
        return String(hold.value);
      }
      return field.name === 'filterType' ? `mode:${filterMode}` : '-';
    })
    .join('|');
}
