import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ThemeService } from '@teensyrom-nx/ui/styles';
import { MidiAccessService } from '../midi/midi-access.service';
import { TUNE_INDEX_STORAGE, LocalStorageTuneIndexStorage } from '../analysis/tune-index-storage';
import { SharedTuneIndex } from '../analysis/shared-tune-index';
import { TrackAnalysisPanelComponent } from '../analysis/track-analysis-panel/track-analysis-panel.component';
import { DeckHostComponent } from '../deck/deck-host/deck-host.component';
import type { DeckPanelAreas } from '../deck/deck-host/deck-host.component';
import { DeckRegistry } from '../deck/deck-registry';
import type { DeckHandle } from '../deck/deck-registry';
import { DECKS } from '../deck/deck.config';
import type { DeckDescriptor } from '../deck/deck.config';
import { MixerService } from '../mixer/mixer.service';
import { MixerColumnComponent } from '../mixer/mixer-column/mixer-column.component';
import { DrawerComponent } from '../ui/drawer/drawer.component';
import { SetupDrawerComponent } from '../diagnostics/setup-drawer/setup-drawer.component';

/** The wireframe's own two-deck layout — five columns, three rows, transport/cues/binding stacked
 *  inside each deck's own outer column either side of the voice/speed and mixer columns, which run
 *  the full height of the page. Only this exact deck count draws it. */
const TWO_DECK_COLUMN_TEMPLATE = 'minmax(0, 1fr) 64px 208px 64px minmax(0, 1fr)';
const TWO_DECK_ROW_TEMPLATE = 'auto minmax(0, 1fr) auto';

/** Any other deck count's fallback — one deck block per row, its own voice/speed column beside it,
 *  the mixer as a band beneath every deck. No layout is designed for this case; it only has to
 *  compose and play. */
const FALLBACK_COLUMN_TEMPLATE = 'minmax(0, 1fr) 64px';

/** One deck, paired with the `grid-area` names its four panels claim — computed from `DECKS`' own
 *  order, never from anything a deck-owned file decides. */
interface DeckGridEntry {
  readonly deck: DeckDescriptor;
  readonly areas: DeckPanelAreas;
}

/** The `.grid`'s own template — the three CSS values `dj-poc-view.component.html` binds onto it —
 *  plus the deck entries that produced them. */
interface DeckGridLayout {
  readonly columns: string;
  readonly rows: string;
  readonly areas: string;
  readonly entries: readonly DeckGridEntry[];
}

/** This deck's own four area names, by its position in `DECKS` — the only thing that decides them.
 *  `mx`, the mixer's fixed area, never collides with one of these: no deck's index-derived prefix is
 *  ever bare. */
function panelAreasFor(index: number): DeckPanelAreas {
  return {
    transport: `t${index}`,
    voiceSpeed: `vs${index}`,
    loopsCues: `c${index}`,
    binding: `b${index}`,
  };
}

/**
 * The grid the wireframe draws, for exactly two decks, or a stacked fallback for any other count —
 * page code, not deck-owned: `DECKS.length` is the only thing that decides which shape renders, and
 * no deck reaches in to name a column of either one.
 */
export function computeGridLayout(decks: readonly DeckDescriptor[]): DeckGridLayout {
  const entries = decks.map((deck, index) => ({ deck, areas: panelAreasFor(index) }));

  if (entries.length === 2) {
    const [first, second] = entries.map((entry) => entry.areas);
    return {
      columns: TWO_DECK_COLUMN_TEMPLATE,
      rows: TWO_DECK_ROW_TEMPLATE,
      areas: [
        `"${first.transport} ${first.voiceSpeed} mx ${second.voiceSpeed} ${second.transport}"`,
        `"${first.loopsCues} ${first.voiceSpeed} mx ${second.voiceSpeed} ${second.loopsCues}"`,
        `"${first.binding} ${first.voiceSpeed} mx ${second.voiceSpeed} ${second.binding}"`,
      ].join(' '),
      entries,
    };
  }

  const rows: string[] = [];
  for (const entry of entries) {
    rows.push(`"${entry.areas.transport} ${entry.areas.voiceSpeed}"`);
    rows.push(`"${entry.areas.loopsCues} ${entry.areas.voiceSpeed}"`);
    rows.push(`"${entry.areas.binding} ${entry.areas.voiceSpeed}"`);
  }
  rows.push('"mx mx"');

  return {
    columns: FALLBACK_COLUMN_TEMPLATE,
    rows: `repeat(${entries.length * 3}, auto) auto`,
    areas: rows.join(' '),
    entries,
  };
}

/**
 * The DJ player page — reachable only by typing `/dev/dj-poc` in the browser. Composes one deck host
 * per entry in `DECKS`, laid out on the five-column grid the wireframe draws, and holds only what is
 * genuinely shared across every deck: the Web MIDI permission grant (each deck's own
 * `BindingCardComponent` reaches up to it), the tune-index cache, the registry a page-level surface
 * reaches a deck's own collaborators through, and the mixer's per-deck gain model.
 *
 * `SharedTuneIndex` lives here, not in `DeckHostComponent`: a loop point, a key, a length are facts
 * about the tune, not about the deck that found them, so every deck's own `TuneIndexService` reaches
 * up to this one page-level instance for storage and single-flight scan production. `TUNE_INDEX_STORAGE`
 * still stays the injectable seam beneath it, unchanged, so a test still substitutes its own in-memory
 * double for `SharedTuneIndex` to sit on.
 *
 * `MixerService` lives here for the same reason `SharedTuneIndex` does: a deck's composed gain is
 * a fact the crossfader and a future per-deck fader both write into, so every deck reads the one
 * page-level instance rather than each holding its own.
 *
 * `MidiAccessService` lives here for the same reason again: the SysEx permission grant and the
 * enumerated port list are facts about the page's one Web MIDI session, not about either deck, so
 * both decks' own `BindingCardComponent`s read and drive the same instance rather than each holding
 * its own.
 *
 * The grid's own template — `.grid`'s `grid-template-columns/-rows/-areas` — is computed once here,
 * from `DECKS`, and bound onto the element rather than declared in the stylesheet: a stylesheet
 * cannot itself branch on how many decks composed. Each deck host receives its own four `grid-area`
 * names as an input; nothing about which column is whose lives in `DeckHostComponent` or any panel
 * beneath it.
 *
 * This component fills both drawers rather than owning either one's content: `SetupDrawerComponent`
 * carries the whole of Setup & Diagnostics — including the main-thread stall control, moved in from
 * here — over `DeckRegistry.decks()` on its own, needing nothing threaded down to it. The Track
 * Analysis drawer is different only because which deck it inspects is a page-level choice: this
 * component owns the deck selector and hands the selected deck's own handle to
 * `TrackAnalysisPanelComponent`, which reads everything else it needs straight off that handle.
 */
@Component({
  selector: 'lib-dj-poc-view',
  templateUrl: './dj-poc-view.component.html',
  styleUrl: './dj-poc-view.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DeckHostComponent,
    MixerColumnComponent,
    DrawerComponent,
    SetupDrawerComponent,
    TrackAnalysisPanelComponent,
  ],
  // Provided here rather than root: this is a quarantined POC surface, and neither the permission-
  // holding MIDI service nor any deck's own audio graph should register in the app injector. Each
  // deck's own engine, clock, replay worker and scanner are provided one level down, in
  // `DeckHostComponent` — see its own `providers` array for why those are never hoisted here.
  providers: [
    MidiAccessService,
    { provide: TUNE_INDEX_STORAGE, useFactory: () => new LocalStorageTuneIndexStorage() },
    SharedTuneIndex,
    DeckRegistry,
    MixerService,
  ],
})
export class DjPocViewComponent {
  // This route bypasses LayoutComponent, the only place ThemeService is normally injected —
  // without this, ThemeService never constructs and the app's dark-mode class never applies.
  private readonly themeService = inject(ThemeService);
  private readonly deckRegistry = inject(DeckRegistry);

  protected readonly decksConfig = DECKS;
  protected readonly gridLayout: DeckGridLayout = computeGridLayout(DECKS);

  protected readonly decks = this.deckRegistry.decks;

  /** An explicit pick from the Track Analysis deck selector — null until the operator chooses one,
   *  which is when `selectedTrackAnalysisDeck` falls back to the first registered deck. */
  private readonly pickedTrackAnalysisDeckId = signal<string | null>(null);

  /** Which deck `TrackAnalysisPanelComponent` inspects. Computed rather than defaulted once at
   *  construction, so a deck that registers after this page's first render (or unregisters) is
   *  still reflected rather than leaving the selector pointed at nothing. */
  protected readonly selectedTrackAnalysisDeck = computed<DeckHandle | null>(() => {
    const decks = this.decks();
    if (decks.length === 0) return null;
    const pickedId = this.pickedTrackAnalysisDeckId();
    return decks.find((deck) => deck.descriptor.id === pickedId) ?? decks[0];
  });

  /** The selected deck's own id, split out from `selectedTrackAnalysisDeck` so the template's
   *  `[selected]` comparison never chains a property access off an optional call — the deepest
   *  Angular's strictTemplates type-checker can follow through `?.` before it loses the narrowing
   *  and reports the object as possibly `undefined`. */
  protected readonly selectedTrackAnalysisDeckId = computed<string | null>(
    () => this.selectedTrackAnalysisDeck()?.descriptor.id ?? null
  );

  protected onTrackAnalysisDeckChange(event: Event): void {
    this.pickedTrackAnalysisDeckId.set((event.target as HTMLSelectElement).value);
  }
}
