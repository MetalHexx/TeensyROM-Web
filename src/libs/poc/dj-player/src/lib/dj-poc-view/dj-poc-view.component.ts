import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { logInfo, LogType } from '@teensyrom-nx/utils';
import { ThemeService } from '@teensyrom-nx/ui/styles';
import { SidFile, SidParseError } from '../sid/sid-file.model';
import { parseSidFile } from '../sid/sid-file.parser';
import { BUNDLED_TUNES, decodeBundledTune } from '../sid/bundled';
import { MidiOutputService } from '../midi/midi-output.service';
import { ScriptProcessorFrameClock } from '../clock/frame-clock';
import { REPLAY_RUNNER } from '../replay/replay-runner';
import { WorkerReplayRunner } from '../replay/worker-replay-runner';
import {
  DjPlayerEngine,
  FRAME_CLOCK,
  NOMINAL_INTERVAL_OPTIONS_US,
  SPEED_INPUT_SPAN,
} from '../engine/dj-player-engine';
import { TrackAnalysisPanelComponent } from '../analysis/track-analysis-panel/track-analysis-panel.component';
import { TuneIndexPanelComponent } from '../analysis/tune-index-panel/tune-index-panel.component';
import { ANALYSIS_SCANNER } from '../analysis/scan-runner';
import { WorkerAnalysisScanner } from '../analysis/worker-analysis-scanner';
import { TUNE_INDEX_STORAGE, LocalStorageTuneIndexStorage } from '../analysis/tune-index-storage';
import { TuneIndexService } from '../analysis/tune-index.service';

/** A tune the Tune section can offer as a button — bundled, or opened from disk this session. */
interface TuneSource {
  readonly id: string;
  readonly label: string;
  readonly getBytes: () => Uint8Array;
}

const MICROSECONDS_PER_SECOND = 1_000_000;

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
 * Off, two sub-frame probes, then a ceiling that reaches well past a single PAL frame (~19.95 ms).
 * `R5` needs a stall shorter than the window to be demonstrably inaudible, which a ceiling of one
 * frame cannot show — `setScheduleAhead()` still clamps the selectable depth to
 * `UNCANCELLABLE_SCHEDULE_AHEAD_CEILING_MS` whenever the selected port cannot cancel a pending send;
 * this list is the shipping-depth question the clamp does not answer on its own.
 */
const SCHEDULE_AHEAD_OPTIONS_MS: readonly number[] = [0, 5, 20, 40, 80, 160];

/**
 * The DJ player control panel — reachable only by typing `/dev/dj-poc` in the browser. A
 * performance stage (Transport/Scrub, Cues, Loop, Voice, Speed) beside a persistent sidebar
 * (Setup: MIDI/Timing/Tune, and Diagnostics).
 */
@Component({
  selector: 'lib-dj-poc-view',
  templateUrl: './dj-poc-view.component.html',
  styleUrl: './dj-poc-view.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TrackAnalysisPanelComponent, TuneIndexPanelComponent],
  // Provided here rather than root: this is a quarantined POC surface and neither its
  // permission-holding service nor its audio graph should register in the app injector.
  providers: [
    MidiOutputService,
    DjPlayerEngine,
    { provide: FRAME_CLOCK, useFactory: () => new ScriptProcessorFrameClock() },
    { provide: REPLAY_RUNNER, useFactory: () => new WorkerReplayRunner() },
    TuneIndexService,
    { provide: TUNE_INDEX_STORAGE, useFactory: () => new LocalStorageTuneIndexStorage() },
    // Its own worker thread, deliberately separate from TrackAnalysisPanelComponent's own
    // ANALYSIS_SCANNER provider (which wins for that subtree): the panel's on-demand scan and this
    // service's automatic one must never contend for the same thread.
    { provide: ANALYSIS_SCANNER, useFactory: () => new WorkerAnalysisScanner() },
  ],
})
export class DjPocViewComponent {
  // This route bypasses LayoutComponent, the only place ThemeService is normally injected —
  // without this, ThemeService never constructs and the app's dark-mode class never applies.
  private readonly themeService = inject(ThemeService);

  private readonly midiService = inject(MidiOutputService);
  protected readonly midiAccessState = this.midiService.accessState;
  protected readonly midiPorts = this.midiService.ports;
  protected readonly selectedMidiPortId = this.midiService.selectedPortId;
  protected readonly midiError = this.midiService.lastError;

  // Web MIDI enumerates zero ports for a granted-but-empty session (no cartridge attached, or the
  // OS hasn't surfaced it yet) without the service itself treating that as an error.
  protected readonly noPortsFoundError = computed<string | null>(() =>
    this.midiAccessState() === 'granted' && this.midiPorts().length === 0
      ? 'MIDI access was granted, but no output ports were found. Connect the cartridge and re-enable MIDI.'
      : null
  );

  private readonly engine = inject(DjPlayerEngine);
  private readonly tuneIndex = inject(TuneIndexService);
  protected readonly engineState = this.engine.state;
  protected readonly engineError = this.engine.lastError;
  protected readonly engineStats = this.engine.stats;
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

  /** The main-thread stall control's configured span, ms — see `onStallMainThread`. */
  protected readonly stallDurationMs = signal<number>(DEFAULT_STALL_DURATION_MS);
  protected readonly maxStallDurationMs = MAX_STALL_DURATION_MS;

  // Non-null only mid-drag: while dragging, the pointer's own value pins the thumb so the engine's
  // own position updates (which fire from stats publishes, not from the drag) can't fight it and
  // snap the thumb out from under the operator. Cleared back to null on release, at which point the
  // engine's live position takes back over.
  private readonly scrubDragValue = signal<number | null>(null);
  protected readonly scrubDisplayPercent = computed<number>(
    () => this.scrubDragValue() ?? this.engine.positionPercent()
  );

  /** Marker index → the start offset being dragged right now. Absent means "not dragging that
   * marker's start". Re-deriving a captured point replays frames, so the commit has to wait for the
   * release rather than following every drag tick. */
  private readonly startDragOffsets = signal<ReadonlyMap<number, number>>(new Map());

  /** Marker index → the end offset being dragged right now. Kept purely so the readout tracks the
   * thumb; the commit itself waits for release, because it also auditions the seam. */
  private readonly endDragOffsets = signal<ReadonlyMap<number, number>>(new Map());

  // Identify interrupts the stream on the cartridge, so it stays out of reach while a tune plays.
  protected readonly canIdentify = computed(
    () =>
      this.midiAccessState() === 'granted' &&
      this.selectedMidiPortId() !== null &&
      this.engineState() !== 'playing'
  );
  protected readonly canPlay = computed(
    () =>
      this.currentTune() !== null &&
      this.selectedMidiPortId() !== null &&
      this.engineState() !== 'playing'
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

  private readonly bundledSources: readonly TuneSource[] = BUNDLED_TUNES.map((tune) => ({
    id: tune.id,
    label: tune.label,
    getBytes: () => decodeBundledTune(tune.base64),
  }));

  // Tunes opened from disk join the bundled buttons for the rest of the session rather than
  // replacing the file picker's value — a listening session runs for hours.
  private readonly diskSources = signal<readonly TuneSource[]>([]);
  private diskTuneCount = 0;

  readonly availableTunes = computed<readonly TuneSource[]>(() => [
    ...this.bundledSources,
    ...this.diskSources(),
  ]);
  readonly currentTune = signal<SidFile | null>(null);
  readonly tuneError = signal<string | null>(null);

  selectTune(source: TuneSource): void {
    try {
      this.loadTune(parseSidFile(source.getBytes()), source.label);
    } catch (error) {
      this.currentTune.set(null);
      this.tuneError.set(describeParseError(error));
    }
  }

  async onFilePicked(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = ''; // allow re-picking the same file later in the session
    if (!file) {
      return;
    }

    const bytes = new Uint8Array(await file.arrayBuffer());

    try {
      const parsed = parseSidFile(bytes);
      const source: TuneSource = {
        id: `disk-${this.diskTuneCount++}-${file.name}`,
        label: file.name,
        getBytes: () => bytes,
      };
      this.diskSources.update((sources) => [...sources, source]);
      this.loadTune(parsed, file.name);
    } catch (error) {
      this.currentTune.set(null);
      this.tuneError.set(describeParseError(error));
    }
  }

  onEnableMidi(): void {
    void this.midiService.requestAccess();
  }

  onSelectMidiPort(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.midiService.selectPort(select.value);
  }

  onIdentify(): void {
    const ports = this.midiPorts();
    const index = ports.findIndex((port) => port.id === this.selectedMidiPortId());
    const label = index === -1 ? 'ASID-DJ-0 PORT ?' : `ASID-DJ-0 PORT ${index + 1}`;
    this.midiService.identify(label);
  }

  onPlay(): void {
    void this.engine.play();
  }

  onPause(): void {
    this.engine.pause();
  }

  onStop(): void {
    this.engine.stop();
  }

  onPreviousSubtune(): void {
    this.engine.previousSubtune();
  }

  onNextSubtune(): void {
    this.engine.nextSubtune();
  }

  onSpeedInput(event: Event): void {
    this.engine.setSpeed(Number((event.target as HTMLInputElement).value));
  }

  onSpeedJumpUp(): void {
    this.engine.jumpSpeedUp();
  }

  onSpeedJumpDown(): void {
    this.engine.jumpSpeedDown();
  }

  onSpeedHome(): void {
    this.engine.homeSpeed();
  }

  onNominalIntervalChange(event: Event): void {
    this.engine.setNominalIntervalUs(Number((event.target as HTMLSelectElement).value));
  }

  onScheduleAheadChange(event: Event): void {
    this.engine.setScheduleAhead(Number((event.target as HTMLSelectElement).value));
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
   * waiting for a real one to land during a session. The frame clock's audio callback rides this
   * same thread, so nothing it paces can run until the loop below returns; the delivery stats
   * afterward are what say whether that gap was heard.
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

  onVoiceMuteToggle(voice: number, event: Event): void {
    this.engine.setVoiceMuted(voice, (event.target as HTMLInputElement).checked);
  }

  /** Pointer capture keeps the release on this element even if the press drags off it — without it
   * the browser fires no `pointerup` here and the voice stays inverted. */
  onVoiceHoldStart(voice: number, event: PointerEvent): void {
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    this.engine.setVoiceHeld(voice, true);
  }

  /** Handles both `pointerup` and `pointercancel` — either way the hold ends. */
  onVoiceHoldEnd(voice: number): void {
    this.engine.setVoiceHeld(voice, false);
  }

  /** Keyboard equivalent of `onVoiceHoldStart` for Enter/Space; `event.repeat` guards against the
   * browser's auto-repeat re-triggering the press while the key stays down. Bound to the plain
   * `keydown` event (rather than Angular's `keydown.enter`/`keydown.space` filter syntax) because
   * strict template type checking can't resolve those filtered event names to `KeyboardEvent`. */
  onVoiceHoldKeyDown(voice: number, event: KeyboardEvent): void {
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
  onVoiceHoldKeyUp(voice: number, event: KeyboardEvent): void {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    event.preventDefault();
    this.engine.setVoiceHeld(voice, false);
  }

  onClearVoiceMutes(): void {
    this.engine.clearVoiceMutes();
  }

  onAddMarker(): void {
    this.engine.addMarker();
  }

  onCaptureMarkerStart(index: number): void {
    this.engine.captureMarkerStart(index);
  }

  onTriggerMarker(index: number): void {
    void this.engine.triggerMarker(index);
  }

  onSetMarkerEnd(index: number): void {
    this.engine.setMarkerEnd(index);
  }

  onClearMarkerEnd(index: number): void {
    this.engine.clearMarkerEnd(index);
  }

  onClearMarker(index: number): void {
    this.engine.clearMarker(index);
  }

  onDeleteMarker(index: number): void {
    this.engine.deleteMarker(index);
  }

  onStopLoop(): void {
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
  onMarkerStartNudgeInput(index: number, event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.startDragOffsets.update((offsets) => new Map(offsets).set(index, value));
  }

  // (change) fires on release: commit the offset, then audition so the operator hears where the
  // point now lands. Auditions bypass the queue by design — a setup gesture, not a performance
  // trigger — and must stay immediate even while a loop is already running.
  onMarkerStartNudgeChange(index: number, event: Event): void {
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
  onMarkerEndNudgeInput(index: number, event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.endDragOffsets.update((offsets) => new Map(offsets).set(index, value));
  }

  // (change) fires on release: commit the offset, then audition so the operator hears where the
  // seam now lands — see `onMarkerStartNudgeChange`.
  onMarkerEndNudgeChange(index: number, event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.engine.setMarkerEndOffset(index, value);
    this.engine.auditionMarkerEnd(index);
    this.endDragOffsets.update((offsets) => {
      const next = new Map(offsets);
      next.delete(index);
      return next;
    });
  }

  onScrubInput(event: Event): void {
    this.scrubDragValue.set(Number((event.target as HTMLInputElement).value));
  }

  // (change) fires on release, not on every drag tick — the seam that makes this "drag anywhere,
  // release, and it jumps" rather than a continuous scrub. The pin stays set — holding the thumb at
  // the clicked spot — until the engine's async scrub actually lands; releasing it early snapped the
  // thumb back to the stale position and then forward again once the worker's replay landed. Guarded
  // on the pin still being this call's own value so a superseded scrub settling late cannot clear a
  // newer one's pin out from under it.
  async onScrubChange(event: Event): Promise<void> {
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

  private loadTune(file: SidFile, filename: string): void {
    this.currentTune.set(file);
    this.tuneError.set(null);
    this.engine.loadTune(file);
    // Called after loadTune, so the tune-index effect reads the subtune the load has already
    // settled on.
    this.tuneIndex.setTune(file, filename);
    // play() already no-ops into the engine's "no MIDI output port selected" error path when no
    // port is chosen, so no separate guard is needed here.
    void this.engine.play();
  }
}

/** Signed and unit-suffixed, as a nudge row reads it: `+0 fr`, `−7 fr`. */
function offsetLabel(offset: number): string {
  return `${offset < 0 ? '−' : '+'}${Math.abs(offset)} fr`;
}

function describeParseError(error: unknown): string {
  return error instanceof SidParseError ? error.message : 'Failed to parse SID file.';
}
