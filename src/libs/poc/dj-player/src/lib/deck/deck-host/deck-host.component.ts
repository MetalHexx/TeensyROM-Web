import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  type OnDestroy,
  type OnInit,
} from '@angular/core';
import {
  DjPlayerEngine,
  FRAME_CLOCK,
  NOMINAL_INTERVAL_OPTIONS_US,
  SPEED_INPUT_SPAN,
} from '../../engine/dj-player-engine';
import type { EngineState } from '../../engine/dj-player-engine';
import { positionBasisFor, timelineBasisFor } from '../../engine/engine-utils';
import type { DetectedLoopFrames } from '../../engine/engine-utils';
import { ScriptProcessorFrameClock } from '../../clock/frame-clock';
import { REPLAY_RUNNER } from '../../replay/replay-runner';
import { WorkerReplayRunner } from '../../replay/worker-replay-runner';
import { ANALYSIS_SCANNER } from '../../analysis/scan-runner';
import { WorkerAnalysisScanner } from '../../analysis/worker-analysis-scanner';
import { TuneIndexService } from '../../analysis/tune-index.service';
import type { TuneIndexRecord } from '../../analysis/tune-index.model';
import { TrackAnalysisPanelComponent } from '../../analysis/track-analysis-panel/track-analysis-panel.component';
import { TuneIndexPanelComponent } from '../../analysis/tune-index-panel/tune-index-panel.component';
import { DeckMidiBinding } from '../../midi/deck-midi-binding';
import { MixerService } from '../../mixer/mixer.service';
import { DeckContext } from '../deck-context';
import { DeckRegistry } from '../deck-registry';
import { DeckTuneLoader } from '../deck-tune-loader';
import type { TuneSource } from '../deck-tune-loader';
import type { DeckDescriptor } from '../deck.config';

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

const MICROSECONDS_PER_SECOND = 1_000_000;

/**
 * Off, two sub-frame probes, then a ceiling that reaches well past a single PAL frame (~19.95 ms).
 * `R5` needs a stall shorter than the window to be demonstrably inaudible, which a ceiling of one
 * frame cannot show — `setScheduleAhead()` still clamps the selectable depth to
 * `UNCANCELLABLE_SCHEDULE_AHEAD_CEILING_MS` whenever the selected port cannot cancel a pending send;
 * this list is the shipping-depth question the clamp does not answer on its own.
 */
const SCHEDULE_AHEAD_OPTIONS_MS: readonly number[] = [0, 5, 20, 40, 80, 160];

/**
 * One deck: the whole of what "a deck owns" — its own engine, clock, replay worker, analysis
 * scanner, tune index and MIDI binding — behind a `providers` array that *is* the deck's injector.
 * `DeckRegistry` is how a page-level surface reaches any of it; nothing here is looked up by any
 * sibling deck.
 *
 * Provisional arrangement: this carries the transport, cues, voice, speed and sidebar markup lifted
 * unchanged out of `DjPocViewComponent` — P03 re-homes it into dedicated panel components. The MIDI
 * subsection and the stall control stay page-level, in `DjPocViewComponent` itself.
 */
@Component({
  selector: 'lib-deck-host',
  templateUrl: './deck-host.component.html',
  styleUrl: './deck-host.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TrackAnalysisPanelComponent, TuneIndexPanelComponent],
  // Provided here, one level down from where the POC's audio graph and permission-holding services
  // used to stay out of the app injector: two frame clocks, two replay workers and two scan workers
  // is the design, not something to hoist "for efficiency". Do not move an engine into a worker —
  // Web MIDI is not exposed to workers, so every packet would hop back to the main thread anyway.
  providers: [
    DeckContext,
    DeckMidiBinding,
    DjPlayerEngine,
    DeckTuneLoader,
    TuneIndexService,
    { provide: FRAME_CLOCK, useFactory: () => new ScriptProcessorFrameClock() },
    { provide: REPLAY_RUNNER, useFactory: () => new WorkerReplayRunner() },
    { provide: ANALYSIS_SCANNER, useFactory: () => new WorkerAnalysisScanner() },
  ],
})
export class DeckHostComponent implements OnInit, OnDestroy {
  readonly deck = input.required<DeckDescriptor>();

  private readonly context = inject(DeckContext);
  private readonly registry = inject(DeckRegistry);
  private readonly binding = inject(DeckMidiBinding);
  private readonly engine = inject(DjPlayerEngine);
  private readonly tuneIndex = inject(TuneIndexService);
  private readonly tuneLoader = inject(DeckTuneLoader);
  // Page-level, one level up (`DjPocViewComponent`) — every deck reads the same composed model
  // rather than holding its own, so the crossfader moves both decks' gain from one instance.
  private readonly mixer = inject(MixerService);

  constructor() {
    // Pushed at the packet boundary, never at the write — see `RegisterFrame.setOutputGain`. Fires
    // once at construction against `context.id()`'s pre-adoption `''` (a no-op gain of 1, since the
    // mixer knows no such deck) and again once `ngOnInit` adopts the real id.
    effect(() => {
      this.engine.setOutputGain(this.mixer.gainFor(this.context.id())());
    });
  }

  ngOnInit(): void {
    const descriptor = this.deck();
    this.context.adopt(descriptor);
    // DeckMidiBinding's own identity field, not something DeckContext writes for it — see its own
    // doc for why it stays a constructor-free field.
    this.binding.deckId = this.context.id();
    this.binding.restore();
    this.engine.restoreRepeatTrackPreference();
    this.registry.register({
      descriptor,
      engine: this.engine,
      binding: this.binding,
      tuneIndex: this.tuneIndex,
      tuneLoader: this.tuneLoader,
    });
  }

  ngOnDestroy(): void {
    this.registry.unregister(this.deck().id);
  }

  protected readonly engineState = this.engine.state;
  protected readonly engineError = this.engine.lastError;
  protected readonly engineStats = this.engine.stats;
  protected readonly repeatTrack = this.engine.repeatTrack;
  protected readonly trackEndFrame = this.engine.trackEndFrame;

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
  protected readonly speedMultiplier = this.engine.speedMultiplier;
  protected readonly nominalIntervalUs = this.engine.nominalIntervalUs;
  protected readonly scheduleAheadMs = this.engine.scheduleAheadMs;
  protected readonly mutedVoices = this.engine.mutedVoices;
  protected readonly heldVoices = this.engine.heldVoices;
  protected readonly effectiveMutes = this.engine.effectiveMutes;
  protected readonly markers = this.engine.markers;
  protected readonly loopingMarker = this.engine.loopingMarker;
  protected readonly queuedMarker = this.engine.queuedMarker;
  /** True while a `triggerMarker` launch is awaiting `play()` — trigger and delete are disabled on
   *  every row for that span, since a delete racing the await would reindex out from under it. */
  protected readonly markerLaunchPending = this.engine.markerLaunchPending;

  /** 0–100, non-zero only for the marker currently looping — the engine does the arithmetic. */
  protected progressPercentFor(index: number): number {
    return this.engine.progressPercentFor(index);
  }

  /** Which of the three states a marker's row is in — drives the visual distinction between active,
   * queued and idle without relying on a text label. Every marker can be queued now that a cue and
   * a loop are the same kind of row. */
  protected markerState(index: number): 'active' | 'queued' | 'idle' {
    if (this.loopingMarker() === index) return 'active';
    if (this.queuedMarker() === index) return 'queued';
    return 'idle';
  }

  protected readonly minSpeed = 1 - SPEED_INPUT_SPAN;
  protected readonly maxSpeed = 1 + SPEED_INPUT_SPAN;
  /** The fader's displayed value, pinned to its own span when a jump has carried the multiplier
   * beyond it — display only, never written back to the engine. */
  protected readonly speedFaderValue = computed<number>(() =>
    Math.min(Math.max(this.speedMultiplier(), this.minSpeed), this.maxSpeed)
  );
  protected readonly scheduleAheadOptionsMs = SCHEDULE_AHEAD_OPTIONS_MS;
  protected readonly voiceIndices: readonly number[] = [0, 1, 2];
  protected readonly nudgeRange = this.engine.nudgeRangeFrames;

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
    const record: TuneIndexRecord | null = this.engine.tuneIndex();
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

  /** Marker index → the start offset being dragged right now. Absent means "not dragging that
   * marker's start". Re-deriving a captured point replays frames, so the commit has to wait for the
   * release rather than following every drag tick. */
  private readonly startDragOffsets = signal<ReadonlyMap<number, number>>(new Map());

  /** Marker index → the end offset being dragged right now. Kept purely so the readout tracks the
   * thumb; the commit itself waits for release, because it also auditions the seam. */
  private readonly endDragOffsets = signal<ReadonlyMap<number, number>>(new Map());

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

  /** An NTSC tune loads an interval of its own, so the selector has to be able to show it. */
  protected readonly intervalOptions = computed<readonly number[]>(() => {
    const current = this.nominalIntervalUs();
    return NOMINAL_INTERVAL_OPTIONS_US.includes(current)
      ? NOMINAL_INTERVAL_OPTIONS_US
      : [current, ...NOMINAL_INTERVAL_OPTIONS_US];
  });

  // One SID-data packet goes out per clock tick, so the clock's own measured tick rate is the
  // frame-packet rate; the occasional Start/Stop/Identify control packet is noise against it.
  protected readonly packetsPerSecond = computed(() => {
    const intervalUs = this.engineStats().measuredMeanIntervalUs;
    return intervalUs > 0 ? MICROSECONDS_PER_SECOND / intervalUs : 0;
  });
  protected readonly bytesPerSecond = computed(() => {
    const stats = this.engineStats();
    return stats.packetsSent > 0
      ? this.packetsPerSecond() * (stats.bytesSent / stats.packetsSent)
      : 0;
  });

  protected readonly availableTunes = this.tuneLoader.availableTunes;
  protected readonly currentTune = this.tuneLoader.currentTune;
  protected readonly tuneError = this.tuneLoader.tuneError;

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

  protected onSpeedInput(event: Event): void {
    this.engine.setSpeed(Number((event.target as HTMLInputElement).value));
  }

  protected onSpeedJumpUp(): void {
    this.engine.jumpSpeedUp();
  }

  protected onSpeedJumpDown(): void {
    this.engine.jumpSpeedDown();
  }

  protected onSpeedHome(): void {
    this.engine.homeSpeed();
  }

  protected onNominalIntervalChange(event: Event): void {
    this.engine.setNominalIntervalUs(Number((event.target as HTMLSelectElement).value));
  }

  protected onScheduleAheadChange(event: Event): void {
    this.engine.setScheduleAhead(Number((event.target as HTMLSelectElement).value));
  }

  protected onVoiceMuteToggle(voice: number, event: Event): void {
    this.engine.setVoiceMuted(voice, (event.target as HTMLInputElement).checked);
  }

  /** Pointer capture keeps the release on this element even if the press drags off it — without it
   * the browser fires no `pointerup` here and the voice stays inverted. */
  protected onVoiceHoldStart(voice: number, event: PointerEvent): void {
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    this.engine.setVoiceHeld(voice, true);
  }

  /** Handles both `pointerup` and `pointercancel` — either way the hold ends. */
  protected onVoiceHoldEnd(voice: number): void {
    this.engine.setVoiceHeld(voice, false);
  }

  /** Keyboard equivalent of `onVoiceHoldStart` for Enter/Space; `event.repeat` guards against the
   * browser's auto-repeat re-triggering the press while the key stays down. Bound to the plain
   * `keydown` event (rather than Angular's `keydown.enter`/`keydown.space` filter syntax) because
   * strict template type checking can't resolve those filtered event names to `KeyboardEvent`. */
  protected onVoiceHoldKeyDown(voice: number, event: KeyboardEvent): void {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    event.preventDefault();
    if (event.repeat) {
      return;
    }
    this.engine.setVoiceHeld(voice, true);
  }

  /** Keyboard equivalent of `onVoiceHoldEnd` for Enter/Space. */
  protected onVoiceHoldKeyUp(voice: number, event: KeyboardEvent): void {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    event.preventDefault();
    this.engine.setVoiceHeld(voice, false);
  }

  protected onClearVoiceMutes(): void {
    this.engine.clearVoiceMutes();
  }

  protected onAddMarker(): void {
    this.engine.addMarker();
  }

  protected onCaptureMarkerStart(index: number): void {
    this.engine.captureMarkerStart(index);
  }

  protected onTriggerMarker(index: number): void {
    void this.engine.triggerMarker(index);
  }

  protected onSetMarkerEnd(index: number): void {
    this.engine.setMarkerEnd(index);
  }

  protected onClearMarkerEnd(index: number): void {
    this.engine.clearMarkerEnd(index);
  }

  protected onClearMarker(index: number): void {
    this.engine.clearMarker(index);
  }

  protected onDeleteMarker(index: number): void {
    this.engine.deleteMarker(index);
  }

  protected onStopLoop(): void {
    this.engine.stopLoop();
  }

  /** The start offset a marker's row shows: the live drag while one is in flight, the committed
   * value otherwise. */
  protected displayedMarkerStartOffset(index: number): number {
    return this.startDragOffsets().get(index) ?? this.markers()[index]?.start?.offset ?? 0;
  }

  /** The end offset a marker's row shows — mirrors `displayedMarkerStartOffset`. */
  protected displayedMarkerEndOffset(index: number): number {
    return this.endDragOffsets().get(index) ?? this.markers()[index]?.end?.offset ?? 0;
  }

  /** The start's frame readout: the captured frame plus whichever offset is currently displayed —
   * the nudged frame, since that is where the marker actually lands. */
  protected markerStartFrame(index: number): number | null {
    const point = this.markers()[index]?.start ?? null;
    return point === null ? null : point.frame + this.displayedMarkerStartOffset(index);
  }

  /** The end's frame readout — mirrors `markerStartFrame`. */
  protected markerEndFrame(index: number): number | null {
    const end = this.markers()[index]?.end ?? null;
    return end === null ? null : end.frame + this.displayedMarkerEndOffset(index);
  }

  protected markerStartOffsetLabel(index: number): string {
    return offsetLabel(this.displayedMarkerStartOffset(index));
  }

  protected markerEndOffsetLabel(index: number): string {
    return offsetLabel(this.displayedMarkerEndOffset(index));
  }

  // Moves the readout only. Every re-derivation replays up to ~50 frames of emulation on the thread
  // the frame clock rides, so running one per drag tick would put steady replay load beside the
  // audio callback.
  protected onMarkerStartNudgeInput(index: number, event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.startDragOffsets.update((offsets) => new Map(offsets).set(index, value));
  }

  // (change) fires on release: commit the offset, then audition so the operator hears where the
  // point now lands. Auditions bypass the queue by design — a setup gesture, not a performance
  // trigger — and must stay immediate even while a loop is already running.
  protected onMarkerStartNudgeChange(index: number, event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.engine.setMarkerStartOffset(index, value);
    this.engine.auditionMarkerStart(index);
    this.startDragOffsets.update((offsets) => {
      const next = new Map(offsets);
      next.delete(index);
      return next;
    });
  }

  // Moves the readout only, same as the start drag.
  protected onMarkerEndNudgeInput(index: number, event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.endDragOffsets.update((offsets) => new Map(offsets).set(index, value));
  }

  // (change) fires on release: commit the offset, then audition so the operator hears where the
  // seam now lands — see `onMarkerStartNudgeChange`.
  protected onMarkerEndNudgeChange(index: number, event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.engine.setMarkerEndOffset(index, value);
    this.engine.auditionMarkerEnd(index);
    this.endDragOffsets.update((offsets) => {
      const next = new Map(offsets);
      next.delete(index);
      return next;
    });
  }

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

  protected frameRateHz(intervalUs: number): string {
    return (MICROSECONDS_PER_SECOND / intervalUs).toFixed(3);
  }
}

/** Signed and unit-suffixed, as a nudge row reads it: `+0 fr`, `−7 fr`. */
function offsetLabel(offset: number): string {
  return `${offset < 0 ? '−' : '+'}${Math.abs(offset)} fr`;
}
