import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { logInfo, LogType } from '@teensyrom-nx/utils';
import { ThemeService } from '@teensyrom-nx/ui/styles';
import { MidiAccessService } from '../midi/midi-access.service';
import { TUNE_INDEX_STORAGE, LocalStorageTuneIndexStorage } from '../analysis/tune-index-storage';
import { SharedTuneIndex } from '../analysis/shared-tune-index';
import { DeckHostComponent } from '../deck/deck-host/deck-host.component';
import { DeckRegistry } from '../deck/deck-registry';
import { DECKS } from '../deck/deck.config';
import { MixerService } from '../mixer/mixer.service';
import { CrossfaderComponent } from '../mixer/crossfader/crossfader.component';

/** The stall control's starting span — long enough to be heard, short enough not to trip
 *  `MAX_CATCH_UP_US`'s catch-up ceiling in the frame clock on a single press. */
const DEFAULT_STALL_DURATION_MS = 150;

/**
 * The longest stall the control will actually run. The busy-wait is synchronous and uncancellable,
 * so a mistyped `150000` would freeze the tab for two and a half minutes with no way back. This
 * still reaches well past the widest schedule-ahead option (160 ms), which is the span the stall
 * has to out-last to prove anything.
 */
const MAX_STALL_DURATION_MS = 2000;

/**
 * The DJ player page — reachable only by typing `/dev/dj-poc` in the browser. Composes one deck host
 * per entry in `DECKS`, side by side, and holds only what is genuinely shared across every deck: the
 * Web MIDI permission grant (each deck's own `BindingCardComponent` reaches up to it), the tune-index
 * cache, the registry a page-level surface reaches a deck's own collaborators through, and the
 * mixer's per-deck gain model.
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
 * Provisional arrangement: the main-thread stall control is the one piece of markup that stays here
 * rather than moving into a deck-owned component — every MIDI-facing control moved into each deck's
 * own `BindingCardComponent` in P03-T01. `CrossfaderComponent` renders provisionally at the top of
 * the page; P03-T02 moves it into a dedicated mixer column.
 */
@Component({
  selector: 'lib-dj-poc-view',
  templateUrl: './dj-poc-view.component.html',
  styleUrl: './dj-poc-view.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DeckHostComponent, CrossfaderComponent],
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

  protected readonly decksConfig = DECKS;

  /** The main-thread stall control's configured span, ms — see `onStallMainThread`. Page-level and
   *  singular: it is the isolation test's negative control, so it disturbs every deck together
   *  rather than one at a time. */
  protected readonly stallDurationMs = signal<number>(DEFAULT_STALL_DURATION_MS);
  protected readonly maxStallDurationMs = MAX_STALL_DURATION_MS;

  onStallDurationInput(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (Number.isFinite(value) && value >= 0) {
      this.stallDurationMs.set(value);
    }
  }

  /**
   * Blocks the main thread synchronously for `stallDurationMs()`, capped at
   * `MAX_STALL_DURATION_MS` — the deliberate stall the resilience claim needs on demand rather than
   * waiting for a real one to land during a session. Every deck's frame clock rides this same
   * thread, so nothing any of them paces can run until the loop below returns — this is the
   * isolation test's negative control: it disturbs every deck together, where a fault confined to
   * one deck must not touch the others.
   *
   * The log line carries the duration actually run, so a clamped value reads as the override it is
   * rather than as the control silently ignoring what was typed.
   */
  onStallMainThread(): void {
    const ms = Math.min(this.stallDurationMs(), MAX_STALL_DURATION_MS);
    logInfo(LogType.Debug, `DJ POC: stalling the main thread for ${ms} ms.`);
    const until = performance.now() + ms;
    while (performance.now() < until) {
      // Deliberately empty — a busy-wait is the point, not a bug.
    }
  }
}
