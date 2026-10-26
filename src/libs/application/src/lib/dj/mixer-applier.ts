import {
  Injectable,
  Injector,
  effect,
  inject,
  runInInjectionContext,
  untracked,
} from '@angular/core';
import { logError, logWarn } from '@teensyrom-nx/utils';
import { readSidField, SID_REGISTER_COUNT } from '@sidablist/core';
import type { SidField } from '@sidablist/core';
import { DjStore, type DeckPanelState, type VoiceSwitch } from './dj-store';
import { DeckRuntime } from './deck-runtime';
import { DECK_SLOTS, type Slot } from './slot';
import { engineSettingsOf, SWITCH_FIELDS } from './mixer/engine-settings';

/** Matches `DeckRuntime`'s refusal to hand out a slot whose engine bundle was never built. */
const UNBUILT_SLOT = /has not been built/;

/**
 * Turns each deck's stored SID panel into engine calls: each voice's pitch multiplier (Key, Coarse
 * and Fine as one), its pulse-width and envelope offsets, and its waveform and switch locks; the
 * deck's cutoff and resonance offsets and filter-mode lock. The library does the arithmetic,
 * clamps each field and composes the result with the tune; this class only hands over the panel.
 *
 * One effect per slot re-applies the whole deck whenever its panel changes, unless the engine
 * already holds that very panel: a jump that landed a marker's settings records the panel it put
 * there (`markInEngine`), so the effect does not re-apply the landing's work. Every library call is
 * idempotent, so a full re-apply per change costs no extra writes.
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
  /** The panel object each slot's engine holds now: the one `applyDeck` last pushed or a landing
   *  recorded. A last-pushed record rather than a one-shot mark, so it cannot go stale. */
  private readonly inEngine: Record<Slot, DeckPanelState | null> = { A: null, B: null };
  /** Scratch buffers for `tuneSwitchOn`, reused so a read allocates nothing. */
  private readonly written = new Uint8Array(SID_REGISTER_COUNT);
  private readonly sent = new Uint8Array(SID_REGISTER_COUNT);

  /** Installs the per-slot effects, once. Further calls are no-ops. */
  install(): void {
    if (this.installed) {
      return;
    }
    this.installed = true;

    runInInjectionContext(this.injector, () => {
      for (const slot of DECK_SLOTS) {
        const panel = this.store.deckPanel(slot);
        effect(() => {
          const current = panel();
          untracked(() => {
            if (this.inEngine[slot] !== current) {
              this.applyDeck(slot);
            }
          });
        });
      }
    });
  }

  /** Synchronously pushes this slot's stored panel to its engine, always, and records it as what
   *  the engine holds. Never throws: a failure is logged and confined to this slot. */
  applyDeck(slot: Slot): void {
    const panel = untracked(() => this.store.deckPanel(slot)());
    this.inEngine[slot] = panel;

    try {
      const { voicePitch = [], fieldOffsets = [], fieldHolds = [] } = engineSettingsOf(panel);
      voicePitch.forEach((multiplier, voice) =>
        this.runtime.setVoicePitch(slot, voice, multiplier)
      );
      for (const { field, amount } of fieldOffsets) {
        this.runtime.setFieldOffset(slot, field, amount);
      }
      for (const { field, value } of fieldHolds) {
        this.lock(slot, field, value);
      }
    } catch (error) {
      this.report(slot, error);
    }
  }

  /** Records that `panel` is what the engine now holds for this slot — a jump landed it — so the
   *  panel effect does not re-apply the landing's work. Any other panel applies as usual. */
  markInEngine(slot: Slot, panel: DeckPanelState): void {
    this.inEngine[slot] = panel;
  }

  /** Returns the deck's panel to home, clears its detected key, and pushes the result to the
   *  engine before returning, so the next tune plays at home settings from its first packet rather
   *  than waiting on the effect. */
  resetPanel(slot: Slot): void {
    this.store.resetDeckPanel({ slot, reason: 'tune-change' });
    this.applyDeck(slot);
  }

  /** Whether the tune itself has this switch on right now — what a press flips from. One read, on
   *  demand, never per frame. An unbuilt slot or a failed read reports like an apply failure and
   *  answers `false`. */
  tuneSwitchOn(slot: Slot, voice: number, sw: VoiceSwitch): boolean {
    try {
      this.runtime.readRegisters(slot, this.written, this.sent);
      return readSidField(this.written, { name: SWITCH_FIELDS[sw], voice }) !== 0;
    } catch (error) {
      this.report(slot, error);
      return false;
    }
  }

  /** Holds `field` at `value`, or hands it back to the tune when `value` is `null`. */
  private lock(slot: Slot, field: SidField, value: number | null): void {
    if (value === null) {
      this.runtime.releaseField(slot, field);
    } else {
      this.runtime.holdField(slot, field, value);
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
