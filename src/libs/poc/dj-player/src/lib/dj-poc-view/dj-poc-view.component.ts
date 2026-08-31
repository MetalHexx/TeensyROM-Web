import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { logInfo, LogType } from '@teensyrom-nx/utils';
import { ThemeService } from '@teensyrom-nx/ui/styles';
import { MidiAccessService } from '../midi/midi-access.service';
import { TUNE_INDEX_STORAGE, LocalStorageTuneIndexStorage } from '../analysis/tune-index-storage';
import { SharedTuneIndex } from '../analysis/shared-tune-index';
import { DeckHostComponent } from '../deck/deck-host/deck-host.component';
import { DeckRegistry } from '../deck/deck-registry';
import type { DeckHandle } from '../deck/deck-registry';
import { DECKS } from '../deck/deck.config';

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
 * per entry in `DECKS`, side by side, and holds only what is genuinely shared across every deck:
 * the Web MIDI permission grant, the tune-index cache, and the registry a page-level surface reaches
 * a deck's own collaborators through.
 *
 * `SharedTuneIndex` lives here, not in `DeckHostComponent`: a loop point, a key, a length are facts
 * about the tune, not about the deck that found them, so every deck's own `TuneIndexService` reaches
 * up to this one page-level instance for storage and single-flight scan production. `TUNE_INDEX_STORAGE`
 * still stays the injectable seam beneath it, unchanged, so a test still substitutes its own in-memory
 * double for `SharedTuneIndex` to sit on.
 *
 * Provisional arrangement: the MIDI subsection and the main-thread stall control are the two pieces
 * of markup that stay here rather than moving into `DeckHostComponent` — see its own doc for the
 * rest of what moved. P03 replaces every line of this.
 */
@Component({
  selector: 'lib-dj-poc-view',
  templateUrl: './dj-poc-view.component.html',
  styleUrl: './dj-poc-view.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DeckHostComponent],
  // Provided here rather than root: this is a quarantined POC surface, and neither the permission-
  // holding MIDI service nor any deck's own audio graph should register in the app injector. Each
  // deck's own engine, clock, replay worker and scanner are provided one level down, in
  // `DeckHostComponent` — see its own `providers` array for why those are never hoisted here.
  providers: [
    MidiAccessService,
    { provide: TUNE_INDEX_STORAGE, useFactory: () => new LocalStorageTuneIndexStorage() },
    SharedTuneIndex,
    DeckRegistry,
  ],
})
export class DjPocViewComponent {
  // This route bypasses LayoutComponent, the only place ThemeService is normally injected —
  // without this, ThemeService never constructs and the app's dark-mode class never applies.
  private readonly themeService = inject(ThemeService);

  protected readonly decksConfig = DECKS;

  private readonly midiAccess = inject(MidiAccessService);
  protected readonly midiAccessState = this.midiAccess.accessState;
  protected readonly midiPorts = this.midiAccess.ports;
  protected readonly midiAccessError = this.midiAccess.lastError;

  private readonly registry = inject(DeckRegistry);
  protected readonly decks = this.registry.decks;

  // Web MIDI enumerates zero ports for a granted-but-empty session (no cartridge attached, or the
  // OS hasn't surfaced it yet) without the service itself treating that as an error.
  protected readonly noPortsFoundError = computed<string | null>(() =>
    this.midiAccessState() === 'granted' && this.midiPorts().length === 0
      ? 'MIDI access was granted, but no output ports were found. Connect the cartridge and re-enable MIDI.'
      : null
  );

  /** The main-thread stall control's configured span, ms — see `onStallMainThread`. Page-level and
   *  singular: it is the isolation test's negative control, so it disturbs every deck together
   *  rather than one at a time. */
  protected readonly stallDurationMs = signal<number>(DEFAULT_STALL_DURATION_MS);
  protected readonly maxStallDurationMs = MAX_STALL_DURATION_MS;

  /** Requests the page-level grant, then attempts every registered deck's own restore — mirrors the
   *  old single-deck sequence, just fanned out to however many decks are composed. `restore()`
   *  no-ops once a deck already holds a selection, so a second press is harmless. */
  onEnableMidi(): void {
    void this.midiAccess
      .requestAccess()
      .then(() => this.decks().forEach((deck) => deck.binding.restore()));
  }

  onSelectMidiPort(deck: DeckHandle, event: Event): void {
    const select = event.target as HTMLSelectElement;
    deck.binding.selectPort(select.value);
  }

  /** Whether `deck`'s Identify control is reachable: access must be granted, the deck must hold a
   *  port, and identifying interrupts the stream on the cartridge, so it stays out of reach while
   *  that deck plays. */
  protected canIdentify(deck: DeckHandle): boolean {
    return (
      this.midiAccessState() === 'granted' &&
      deck.binding.selectedPortId() !== null &&
      deck.engine.state() !== 'playing'
    );
  }

  onIdentify(deck: DeckHandle): void {
    const ports = this.midiPorts();
    const index = ports.findIndex((port) => port.id === deck.binding.selectedPortId());
    const label = index === -1 ? 'ASID-DJ-0 PORT ?' : `ASID-DJ-0 PORT ${index + 1}`;
    deck.binding.identify(label);
  }

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
