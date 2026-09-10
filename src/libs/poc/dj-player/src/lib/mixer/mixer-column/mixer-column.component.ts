import { ChangeDetectionStrategy, Component, computed, inject, type Signal } from '@angular/core';
import { CrossfaderComponent, DeckStripComponent } from '@teensyrom-nx/ui/components';
import type { DeckStripModel, FilterModeValue } from '@teensyrom-nx/ui/components';
import { DECKS, type DeckDescriptor } from '../../deck/deck.config';
import { DeckRegistry } from '../../deck/deck-registry';
import { keyDisplayFor } from '../key-display';
import { MixerService } from '../mixer.service';
import type { ScaleControl } from '../mixer.service';
import { KEY_SEMITONE_RANGE } from '../scale-taper';

/**
 * The mixer column: one deck strip per `DECKS` entry — filter mode, the four scale knobs and the
 * channel fader — and the crossfader beneath them both. The POC-side adapter for the shared
 * `DeckStripComponent` and `CrossfaderComponent`: it injects `MixerService` and `DeckRegistry`,
 * builds each deck's `DeckStripModel`, and turns their outputs back into `MixerService` writes — the
 * library components hold no state and know nothing of the POC's own collaborators.
 *
 * `:host` claims the fixed `mx` grid area directly, in both the page's two-deck layout and its
 * N-deck fallback: there is exactly one mixer column regardless of how many decks compose, so naming
 * it here is not a deck naming a column — see `dj-poc-view.component.ts`'s own grid layout, which
 * never touches this area name.
 */
@Component({
  selector: 'lib-mixer-column',
  templateUrl: './mixer-column.component.html',
  styleUrl: './mixer-column.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DeckStripComponent, CrossfaderComponent],
})
export class MixerColumnComponent {
  /** Every deck's own reads and writes — cutoff/resonance/pulse-width, Key, filter mode, the
   *  channel faders and the crossfader. */
  private readonly mixer = inject(MixerService);
  /** The page-level registry a strip's key readout reaches through for its own deck's detected
   *  tune — see `buildKeyReadout`. */
  private readonly deckRegistry = inject(DeckRegistry);

  /** `DECKS` order — one strip rendered per entry, the same order the crossfader's own pair is
   *  drawn from. */
  protected readonly decks = DECKS;

  /** `mixer.crossfaderPosition` read straight through — the same memoized signal every reader
   *  shares, never re-wrapped in a fresh `computed()`. */
  protected readonly crossfaderPosition = this.mixer.crossfaderPosition;
  /** The crossfader's low end — `DECKS[0]`'s own label, matching `MixerService.crossfaderPair`. */
  protected readonly crossfaderStartLabel = DECKS[0]?.label ?? '';
  /** The crossfader's high end — `DECKS[1]`'s own label, matching `MixerService.crossfaderPair`. */
  protected readonly crossfaderEndLabel = DECKS[1]?.label ?? '';
  /** The crossfader's accessible name, composed from both its end labels. */
  protected readonly crossfaderAccessibleName =
    `Crossfader, deck ${this.crossfaderStartLabel} to deck ${this.crossfaderEndLabel}`;

  /** One `DeckStripModel` per `DECKS` entry, keyed by deck id and built once here — `DECKS` never
   *  changes at runtime, so there is no case that needs rebuilding this map. */
  private readonly deckStripModels: ReadonlyMap<string, Signal<DeckStripModel>> = new Map(
    DECKS.map((deck) => [deck.id, this.buildDeckStripModel(deck)])
  );

  /** This deck's own `DeckStripModel`. Every caller in this component's own template reaches it
   *  only for a `deck` drawn from `decks` itself, so the entry always exists. */
  protected deckStripModel(deckId: string): Signal<DeckStripModel> {
    const model = this.deckStripModels.get(deckId);
    if (!model) throw new Error(`no deck strip model for deck id "${deckId}"`);
    return model;
  }

  /** Routes a knob's emitted `{ id, value }` to the write `MixerService` exposes for it — the three
   *  tapered scale controls share one setter; Key gets its own semitone setter. */
  protected onKnobChange(deckId: string, change: { id: string; value: number }): void {
    if (change.id === 'key') {
      this.mixer.setKeySemitones(deckId, change.value);
      return;
    }
    this.mixer.setScalePosition(deckId, change.id as ScaleControl, change.value);
  }

  /** Writes the deck's own channel fader gain. */
  protected onFaderChange(deckId: string, value: number): void {
    this.mixer.setDeckFader(deckId, value);
  }

  /** Writes the deck's own forced filter mode — the emitted `null` (a deselect) maps straight
   *  through, matching `FilterModeSelectorComponent`'s own "re-click deselects" behaviour. */
  protected onFilterModeSelect(deckId: string, mode: FilterModeValue | null): void {
    this.mixer.setFilterMode(deckId, mode);
  }

  /** Writes the crossfader's position. */
  protected onCrossfaderChange(position: number): void {
    this.mixer.setCrossfaderPosition(position);
  }

  /** Builds `deck`'s whole `DeckStripModel` as one `computed()` over every `MixerService` signal it
   *  depends on, each fetched once and reused across the whole model rather than re-read per field —
   *  the per-id accessors are memoized, so this never re-subscribes on a template read. */
  private buildDeckStripModel(deck: DeckDescriptor): Signal<DeckStripModel> {
    const deckId = deck.id;
    const label = deck.label;

    const engaged = this.mixer.filterMode(deckId);
    const cutoff = this.mixer.scalePosition(deckId, 'cutoff');
    const resonance = this.mixer.scalePosition(deckId, 'resonance');
    const pulseWidth = this.mixer.scalePosition(deckId, 'pulseWidth');
    const keySemitones = this.mixer.keySemitones(deckId);
    const fader = this.mixer.deckFader(deckId);
    const keyReadout = this.buildKeyReadout(deckId, keySemitones);

    return computed<DeckStripModel>(() => ({
      filter: {
        engaged: engaged(),
        groupAccessibleName: `Filter mode deck ${label}`,
        optionAccessibleNames: {
          lowPass: `Filter mode low-pass deck ${label}`,
          bandPass: `Filter mode band-pass deck ${label}`,
          highPass: `Filter mode high-pass deck ${label}`,
          off: `Filter mode off deck ${label}`,
        },
      },
      knobs: [
        { id: 'cutoff', label: 'Cutoff', accessibleName: `Cutoff deck ${label}`, value: cutoff() },
        {
          id: 'resonance',
          label: 'Resonance',
          accessibleName: `Resonance deck ${label}`,
          value: resonance(),
        },
        {
          id: 'pulseWidth',
          label: 'Pulse Width',
          accessibleName: `Pulse Width deck ${label}`,
          value: pulseWidth(),
        },
        {
          id: 'key',
          label: 'Key',
          accessibleName: `Key deck ${label}`,
          value: keySemitones(),
          min: -KEY_SEMITONE_RANGE,
          max: KEY_SEMITONE_RANGE,
          step: 1,
          readout: keyReadout(),
        },
      ],
      fader: { value: fader(), accessibleName: `Channel fader deck ${label}`, label },
    }));
  }

  /**
   * The tune's detected key transposed by the Key knob's own offset, formatted per the operator's
   * `MixerService.keyDisplayFormat` preference — so turning the knob shows the key it's actually
   * tuning *to*, letting two decks be dialed to the same key for harmonic mixing. Falls back to the
   * signed semitone offset (`'0'`, `'+3'`, `'-5'`) when no confident detection exists.
   *
   * Moved up intact from the POC's old per-deck `DeckStripComponent` — reaching `DeckRegistry` for
   * this deck's own `tuneIndex.record()` was the only reason a deck strip ever touched it, and a
   * `DeckStripComponent` sits outside the deck host's own injector so it could not inject
   * `TuneIndexService` directly.
   */
  private buildKeyReadout(deckId: string, keySemitones: Signal<number>): Signal<string> {
    const deckHandle = computed(
      () => this.deckRegistry.decks().find((handle) => handle.descriptor.id === deckId) ?? null
    );
    const detectedKeyDisplay = computed(() =>
      keyDisplayFor(
        deckHandle()?.tuneIndex.record() ?? null,
        this.mixer.keyDisplayFormat(),
        keySemitones()
      )
    );
    return computed(() => {
      const display = detectedKeyDisplay();
      if (display) return display;
      const semitones = keySemitones();
      return semitones === 0 ? '0' : semitones > 0 ? `+${semitones}` : `${semitones}`;
    });
  }
}
