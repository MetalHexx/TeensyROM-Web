import { Injectable, Injector, effect, inject, runInInjectionContext, untracked } from '@angular/core';
import { logError, logWarn } from '@teensyrom-nx/utils';
import { clamp } from '@sidablist/core';
import { DjStore } from './dj-store';
import { DeckRuntime } from './deck-runtime';
import { DECK_SLOTS, type Slot } from './slot';
import { linearCrossfaderGain } from './mixer/crossfader-curve';
import { scaleCoefficientFor, keyCoefficientFor } from './mixer/scale-taper';

/** Matches `DeckRuntime`'s refusal to hand out a slot whose engine bundle was never built. */
const UNBUILT_SLOT = /has not been built/;

/**
 * Turns each deck's stored mixer values into engine values: the crossfader-weighted output gain,
 * the three register scales, the key coefficient and the filter mode.
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

  /** Synchronously pushes this slot's stored values to its engine. Never throws: a failure is
   *  logged and confined to this slot. */
  applyDeck(slot: Slot): void {
    const { mix, crossfader } = untracked(() => ({
      mix: this.store.deckMix(slot)(),
      crossfader: this.store.crossfader(),
    }));
    const side = slot === 'A' ? 'a' : 'b';

    try {
      this.runtime.setOutputGain(slot, clamp(mix.level * linearCrossfaderGain(crossfader, side), 0, 1));
      this.runtime.setRegisterScale(slot, 'cutoff', scaleCoefficientFor(mix.cutoff));
      this.runtime.setRegisterScale(slot, 'resonance', scaleCoefficientFor(mix.resonance));
      this.runtime.setRegisterScale(slot, 'pulseWidth', scaleCoefficientFor(mix.pulseWidth));
      this.runtime.setKeyCoefficient(slot, keyCoefficientFor(mix.keySemitones));
      this.runtime.setFilterMode(slot, mix.filterMode);
    } catch (error) {
      this.report(slot, error);
    }
  }

  /** Returns the deck's tune-shaping to home and pushes it to the engine before returning, so the
   *  next tune plays at home settings from its first packet rather than waiting on the effect. Level
   *  and the crossfader are re-applied with it. */
  resetTuneShaping(slot: Slot): void {
    this.store.resetDeckTuneShaping({ slot });
    this.applyDeck(slot);
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
