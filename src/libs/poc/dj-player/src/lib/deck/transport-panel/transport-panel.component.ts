import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DjPlayerEngine } from '../../engine/dj-player-engine';
import type { EngineState } from '../../engine/dj-player-engine';
import { positionBasisFor, timelineBasisFor } from '../../engine/engine-utils';
import type { DetectedLoopFrames } from '../../engine/engine-utils';
import { TuneIndexService } from '../../analysis/tune-index.service';
import { DeckContext } from '../deck-context';
import { DeckTuneLoader } from '../deck-tune-loader';
import type { TuneSource } from '../deck-tune-loader';
import { DeckMidiBinding } from '../../midi/deck-midi-binding';

/** What the position bar draws. `unknown` is a verdict, not a waiting room — a record that answered
 *  nothing renders hatched and never falls back to another state. `analyzing` is a transient that
 *  looks different on purpose: hatched means "we looked and verified nothing", dimmed means "nothing
 *  has been looked for yet". Neither `analyzing` nor `unknown` carries a tick or a playhead. */
type BarState =
  | { kind: 'analyzing' }
  | { kind: 'unknown' }
  | { kind: 'loop'; introPercent: number } // 0 for loop-from-top; the tick sits at introPercent
  | { kind: 'ended'; musicPercent: number }; // no tick — there is no loop point

/** The transport's own six-state readout. `analyzing` is spliced in here, in the deck, over the
 *  engine's own four-plus-one — the engine never learns about scanning. */
type TransportState = EngineState | 'analyzing';

/** Text for the LED's adjacent label — the colour reinforces this, it never replaces it. */
const TRANSPORT_STATE_LABELS: Record<TransportState, string> = {
  stopped: 'Stopped',
  playing: 'Playing',
  paused: 'Paused',
  ended: 'Ended',
  error: 'Error',
  analyzing: 'Analyzing…',
};

/**
 * Line 1: the position bar and its frame readout. Line 2: transport buttons, the repeat toggle, and
 * the state indicator. Line 3: this deck's tune load controls and the subtune stepper. Nothing more —
 * the wireframe draws exactly three lines and this component is the whole of what "the transport"
 * means for a deck.
 *
 * Reads every collaborator from the deck injector it renders inside (`DeckHostComponent`'s
 * `providers`) — no inputs, because the injector already resolves per deck.
 */
@Component({
  selector: 'lib-transport-panel',
  templateUrl: './transport-panel.component.html',
  styleUrl: './transport-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransportPanelComponent {
  private readonly engine = inject(DjPlayerEngine);
  private readonly context = inject(DeckContext);
  private readonly tuneLoader = inject(DeckTuneLoader);
  private readonly binding = inject(DeckMidiBinding);
  // Not part of the handoff's inlined external surface — `analyzing`/`canPlay`/`canStop` and the
  // position bar's `analyzing` state all depend on whether a scan is in flight, which only this
  // service exposes (`DjPlayerEngine.tuneIndex()` is the settled record, not the in-flight flag).
  // Carried over unchanged from `DeckHostComponent`, which already depended on it for the same reason.
  private readonly tuneIndex = inject(TuneIndexService);

  protected readonly label = this.context.label;

  protected readonly engineState = this.engine.state;
  protected readonly engineError = this.engine.lastError;
  protected readonly engineStats = this.engine.stats;
  protected readonly repeatTrack = this.engine.repeatTrack;

  private readonly selectedMidiPortId = this.binding.selectedPortId;

  /** True while the tune-index service is scanning a genuinely new tune — never true for a cache
   *  hit, which publishes its record without ever setting this. */
  protected readonly analyzing = this.tuneIndex.pending;

  /** The composed transport readout the LED and its label draw from. Keeps the dependency running
   *  one way — the tune-index service already depends on the engine, and the engine never on it. */
  protected readonly transportState = computed<TransportState>(() =>
    this.analyzing() ? 'analyzing' : this.engineState()
  );

  protected readonly transportStateLabel = computed<string>(
    () => TRANSPORT_STATE_LABELS[this.transportState()]
  );

  protected readonly currentSubtune = this.engine.currentSubtune;
  protected readonly subtuneCount = this.engine.subtuneCount;

  protected readonly availableTunes = this.tuneLoader.availableTunes;
  protected readonly currentTune = this.tuneLoader.currentTune;
  protected readonly tuneError = this.tuneLoader.tuneError;

  /** Play stays out of reach for the whole of a scan, whichever load started it: a manual start would
   *  put the frame clock beside the analysis worker on the same tune, which is the contention the
   *  awaited load exists to avoid. */
  protected readonly canPlay = computed(
    () =>
      this.currentTune() !== null &&
      this.selectedMidiPortId() !== null &&
      this.engineState() !== 'playing' &&
      !this.analyzing()
  );

  /** Stop goes out of reach only while a freshly loaded tune scans — the deck is stopped at the
   *  position the load just established, and the load starts it itself once the scan settles, so
   *  there is nothing there to stop. A scan a subtune step raised mid-playback leaves Stop reachable:
   *  that deck is running, and taking Stop from it would strand it with no way to silence the
   *  cartridge. */
  protected readonly canStop = computed(
    () => this.currentTune() !== null && !(this.analyzing() && this.engineState() === 'stopped')
  );

  protected readonly canStepSubtune = computed(
    () => this.currentTune() !== null && this.subtuneCount() > 1
  );

  protected selectTune(source: TuneSource): void {
    this.tuneLoader.selectTune(source);
  }

  protected onFilePicked(event: Event): void {
    void this.tuneLoader.onFilePicked(event);
  }

  protected onPlay(): void {
    void this.engine.play();
  }

  protected onPause(): void {
    this.engine.pause();
  }

  protected onStop(): void {
    this.engine.stop();
  }

  protected onRepeatToggle(event: Event): void {
    this.engine.setRepeatTrack((event.target as HTMLInputElement).checked);
  }

  protected onPreviousSubtune(): void {
    this.engine.previousSubtune();
  }

  protected onNextSubtune(): void {
    this.engine.nextSubtune();
  }

  // Non-null only mid-drag: while dragging, the pointer's own value pins the thumb so the engine's
  // own position updates (which fire from stats publishes, not from the drag) can't fight it and
  // snap the thumb out from under the operator. Cleared back to null on release, at which point the
  // engine's live position takes back over.
  private readonly scrubDragValue = signal<number | null>(null);
  protected readonly scrubDisplayPercent = computed<number>(
    () => this.scrubDragValue() ?? this.engine.positionPercent()
  );

  /** What the position bar draws, over the index record and the pending signal — the one place that
   *  decides loop vs. ended vs. unknown vs. analyzing, so the regions, the tick and the disabled state
   *  can never disagree about it. `timelineBasisFor` gates whether the record answered anything at
   *  all; `positionBasisFor` supplies the ended case's music length, exactly as it does for both
   *  analysis panels' Length rows. */
  protected readonly barState = computed<BarState>(() => {
    if (this.tuneIndex.pending()) {
      return { kind: 'analyzing' };
    }
    const record = this.engine.tuneIndex();
    if (record === null) {
      return { kind: 'unknown' };
    }
    const detected: DetectedLoopFrames = record;
    const timeline = timelineBasisFor(detected);
    if (timeline === null) {
      return { kind: 'unknown' };
    }
    if (detected.loopStartFrame !== null && detected.loopPeriodFrames !== null) {
      return { kind: 'loop', introPercent: (detected.loopStartFrame / timeline) * 100 };
    }
    return { kind: 'ended', musicPercent: ((positionBasisFor(detected) ?? 0) / timeline) * 100 };
  });

  /** The intro region's share of the bar, and the tick's left offset — 0 for a loop that repeats from
   *  the top. Zero outside the 'loop' state, where the template never reads it. */
  protected readonly introRegionPercent = computed<number>(() => {
    const state = this.barState();
    return state.kind === 'loop' ? state.introPercent : 0;
  });

  /** The music region's share of the bar: the loop case's remainder after the intro, or the ended
   *  case's own share. Zero outside those two states. */
  protected readonly musicRegionPercent = computed<number>(() => {
    const state = this.barState();
    if (state.kind === 'loop') return 100 - state.introPercent;
    if (state.kind === 'ended') return state.musicPercent;
    return 0;
  });

  /** The dead-tail region's share for an ended tune — the remainder after the music. Zero outside
   *  'ended', where the template never reads it. */
  protected readonly deadRegionPercent = computed<number>(() => {
    const state = this.barState();
    return state.kind === 'ended' ? 100 - state.musicPercent : 0;
  });

  protected onScrubInput(event: Event): void {
    this.scrubDragValue.set(Number((event.target as HTMLInputElement).value));
  }

  // (change) fires on release, not on every drag tick — the seam that makes this "drag anywhere,
  // release, and it jumps" rather than a continuous scrub. The pin stays set — holding the thumb at
  // the clicked spot — until the engine's async scrub actually lands; releasing it early snapped the
  // thumb back to the stale position and then forward again once the worker's replay landed. Guarded
  // on the pin still being this call's own value so a superseded scrub settling late cannot clear a
  // newer one's pin out from under it.
  protected async onScrubChange(event: Event): Promise<void> {
    const value = Number((event.target as HTMLInputElement).value);
    this.scrubDragValue.set(value);
    await this.engine.scrubTo(value);
    if (this.scrubDragValue() === value) {
      this.scrubDragValue.set(null);
    }
  }
}
