import {
  computed,
  inject,
  Injectable,
  InjectionToken,
  OnDestroy,
  Signal,
  signal,
} from '@angular/core';
import { logError, logInfo, LogType, logWarn } from '@teensyrom-nx/utils';
import {
  NTSC_FRAME_INTERVAL_US,
  PAL_FRAME_INTERVAL_US,
  VOICE_CONTROL_REGISTERS,
} from '../asid/asid-constants';
import {
  buildSidDataPacket,
  buildSidTypePacket,
  buildStartPacket,
  buildStopPacket,
} from '../asid/asid-encoder';
import { RegisterFrame } from '../asid/register-frame';
import type { FrameSnapshot } from '../asid/register-frame';
import type { FrameResult } from '../cpu/c64-machine';
import type { SidFile } from '../sid/sid-file.model';
import { MidiOutputService } from '../midi/midi-output.service';
import type { FrameClock } from '../clock/frame-clock';
import { REPLAY_RUNNER } from '../replay/replay-runner';
import { DeliveryTransport } from './delivery';
import { MarkerState } from './marker-state';
import { TuneSession } from './tune-session';
import { clamp, describeError } from './engine-utils';

export type EngineState = 'stopped' | 'playing' | 'paused' | 'error';

// The cue/loop/nudge types are Marker State's, but they are part of this module's public shape —
// the view and its spec import them from here, so they flow through unchanged rather than moving
// their import path.
export type {
  CapturedPoint,
  CueSlot,
  LoopOutPoint,
  LoopSlot,
  PositionAnchor,
} from './marker-state';
export { LOOP_AUDITION_PREROLL_MS, NUDGE_RANGE_MS } from './marker-state';
export { JUMP_CEILING_SECONDS } from './tune-session';
export { UNCANCELLABLE_SCHEDULE_AHEAD_CEILING_MS } from './delivery';

/**
 * The clock the engine rides.
 *
 * A token rather than a `new` in the field initialiser so a test can tick the engine by hand, and so
 * the POC's audio graph stays out of the app injector — the view provides it alongside the engine.
 */
export const FRAME_CLOCK = new InjectionToken<FrameClock>('FRAME_CLOCK');

/**
 * The three nominal PAL intervals worth comparing: 50.125 Hz (real hardware), the firmware's own
 * split-the-difference default, and 50.0 Hz (what DeepSID uses).
 */
export const NOMINAL_INTERVAL_OPTIONS_US: readonly number[] = [PAL_FRAME_INTERVAL_US, 19975, 20000];

/** What the fader and any typed value may reach: 0.5x–1.5x. */
export const SPEED_INPUT_SPAN = 0.5;
/** What the jump buttons may reach: 0.3x–1.7x, subject to the per-tune floor below. */
export const SPEED_HARD_SPAN = 0.7;
/** One press of a jump button moves the multiplier by this much, additively. */
export const SPEED_JUMP_STEP = 0.5;

/**
 * Frames between `stats` publishes. A signal write per frame would run Angular change detection at
 * the frame rate, which is jitter this experiment cannot afford.
 */
const STATS_PUBLISH_FRAME_INTERVAL = 25;

/** Counters and measurements the diagnostics panel reads. */
export interface EngineStats {
  readonly framesRendered: number;
  readonly packetsSent: number;
  readonly bytesSent: number;
  readonly suppressedWrites: number;
  readonly illegalOpcodeCount: number;
  /** The tune's multispeed: how many ticks the engine runs per video frame. */
  readonly callsPerFrame: number;
  /** The interval the frame clock is actually pacing at, rather than whatever the fader has asked
   *  for — the two only differ while nothing is playing and no clock is running. */
  readonly effectiveIntervalUs: number;
  readonly measuredMeanIntervalUs: number;
  readonly driftMs: number;
  /** Standard deviation of the audio-callback gap — how far the clock's own cadence scatters around
   *  the interval it was asked for. */
  readonly jitterMs: number;
  /** The longest single audio-callback gap since play started. */
  readonly worstGapMs: number;
  /** Callbacks that arrived more than 2x the nominal buffer duration late. */
  readonly lateCallbacks: number;
  /** Frame packets handed to the transport with a delivery time — the population every other
   *  delivery figure below is measured over. */
  readonly scheduledFrames: number;
  /** Of `scheduledFrames`, how many were already more than one frame interval past due at the
   *  moment they were handed to the transport. */
  readonly lateFrames: number;
  /** Mean of (hand-off time − due time) across `scheduledFrames`, in ms. */
  readonly meanLagMs: number;
  /** The single worst (hand-off time − due time) across `scheduledFrames`, in ms. */
  readonly worstLagMs: number;
  /** Frames handed to the transport at a delivery time earlier than the previous frame's — an
   *  inversion in the stream a well-behaved schedule should never produce. */
  readonly reorderedFrames: number;
  /** Of `scheduledFrames`, how many rode a clock advance clamped by its catch-up ceiling — their
   *  due time is later than the truth, so the lag figures above under-report for them. */
  readonly clampedFrames: number;
  /** Whether the selected MIDI port can cancel a pending send, per `MidiOutputService`'s own
   *  feature detection. */
  readonly cancelSupported: boolean;
  /** How long the furthest-out stale send reached past a cancel request before it was preempted,
   *  in ms. −1 when cancellation is unsupported, or none has happened yet this session. */
  readonly lastCancelLatencyMs: number;
}

const EMPTY_STATS: EngineStats = {
  framesRendered: 0,
  packetsSent: 0,
  bytesSent: 0,
  suppressedWrites: 0,
  illegalOpcodeCount: 0,
  callsPerFrame: 1,
  effectiveIntervalUs: 0,
  measuredMeanIntervalUs: 0,
  driftMs: 0,
  jitterMs: 0,
  worstGapMs: 0,
  lateCallbacks: 0,
  scheduledFrames: 0,
  lateFrames: 0,
  meanLagMs: 0,
  worstLagMs: 0,
  reorderedFrames: 0,
  clampedFrames: 0,
  cancelSupported: false,
  lastCancelLatencyMs: -1,
};

/**
 * Drives a tune out to the cartridge: one emulated frame and one ASID SID-data packet per clock
 * tick, plus the transport, speed and timing controls the listening session needs.
 *
 * Injectable rather than `providedIn: 'root'` so the view can provide it beside `MidiOutputService`
 * and keep both out of the app injector.
 *
 * The coordinator: it owns the tick loop, the pending queue, the play/pause/stop state machine,
 * speed, voices and stats publication, and sequences three collaborators for everything else —
 * `DeliveryTransport` (packet delivery), `TuneSession` (the loaded tune, its machine/frame pair and
 * the off-thread jump), and `MarkerState` (cues, loops and the nudge machinery). Each collaborator
 * is a plain class built with `new`, not an Angular service, for the same reason `C64Machine` and
 * `RegisterFrame` are: it is scoped to this engine instance, not the app injector.
 */
@Injectable()
export class DjPlayerEngine implements OnDestroy {
  private readonly midi = inject(MidiOutputService);
  private readonly clock = inject(FRAME_CLOCK);
  private readonly replayRunner = inject(REPLAY_RUNNER);

  private readonly delivery = new DeliveryTransport(this.midi);

  private readonly tuneSession: TuneSession = new TuneSession(this.replayRunner, {
    nominalIntervalUs: () => this.nominalIntervalUs(),
    effectiveMutes: () => this.effectiveMutes(),
    clearError: () => this.lastError.set(null),
    fail: (reason) => this.fail(reason),
    queueResync: () => this.queueResync(),
    resetAnchors: () => this.markerState.resetAnchorRing(),
    recordAnchor: (machine, frame, framesRendered) =>
      this.markerState.recordAnchor(machine, frame, framesRendered),
    applyIntervalChange: () => this.applyIntervalChange(),
  });

  private readonly markerState: MarkerState = new MarkerState({
    machine: () => this.tuneSession.machine,
    frame: () => this.tuneSession.frame,
    file: () => this.tuneSession.file,
    framesRendered: () => this.tuneSession.framesRendered,
    setFramesRendered: (value) => {
      this.tuneSession.framesRendered = value;
    },
    nominalIntervalUs: () => this.nominalIntervalUs(),
    restoreState: (machine, registers, frameNumber) =>
      this.tuneSession.restoreState(machine, registers, frameNumber),
    queueResync: () => this.queueResync(),
    effectiveMutes: () => this.effectiveMutes(),
    fail: (reason) => this.fail(reason),
  });

  readonly state = signal<EngineState>('stopped');
  readonly currentSubtune = this.tuneSession.currentSubtune;
  readonly subtuneCount = this.tuneSession.subtuneCount;
  readonly speedMultiplier = signal<number>(1);
  /**
   * The slowest multiplier any tune can be told about. The clock is the only thing a speed change
   * touches now, and it has no ceiling of its own, so the hard span is the whole constraint —
   * multispeed and nominal interval no longer narrow it.
   */
  readonly slowestSpeed = computed<number>(() => 1 - SPEED_HARD_SPAN);
  readonly fastestSpeed = computed<number>(() => 1 + SPEED_HARD_SPAN);
  private readonly _rememberedSpeed = signal<number | null>(null);
  /** The speed being ridden before the current jump excursion; null when not on an excursion. */
  readonly rememberedSpeed: Signal<number | null> = this._rememberedSpeed.asReadonly();
  /** Which jump button opened the current excursion — null when `rememberedSpeed` is null. Tracked
   * separately because "same button again" vs. "opposite button" cannot be told apart from the
   * multiplier's value alone once a jump has clamped. */
  private excursionDirection: 'up' | 'down' | null = null;
  readonly nominalIntervalUs = signal<number>(PAL_FRAME_INTERVAL_US);
  readonly scheduleAheadMs = this.delivery.scheduleAheadMs;
  readonly lastError = signal<string | null>(null);
  readonly stats = signal<EngineStats>(EMPTY_STATS);
  readonly mutedVoices = signal<readonly boolean[]>([false, false, false]);
  /** Momentary hold state — the button beside each checkbox, held down. */
  readonly heldVoices = signal<readonly boolean[]>([false, false, false]);
  /** What the chip actually does: latched XOR held. */
  readonly effectiveMutes = computed<readonly boolean[]>(() =>
    this.mutedVoices().map((latched, i) => latched !== this.heldVoices()[i])
  );
  readonly cues = this.markerState.cues;
  readonly loopSlots = this.markerState.loopSlots;
  readonly activeLoopSlot = this.markerState.activeLoopSlot;
  readonly queuedLoopSlot = this.markerState.queuedLoopSlot;
  readonly nudgeRangeFrames = this.markerState.nudgeRangeFrames;
  readonly ceilingFrames = this.tuneSession.ceilingFrames;

  /** Current playback position as a percentage of the ceiling, for the playhead. Clamped to 0–100
   * because JUMP_CEILING_SECONDS is a fixed fiction, not the tune's real length — past ~5 PAL minutes
   * of continuous play framesRendered/ceilingFrames exceeds 100% and the thumb should pin, not
   * overflow. */
  readonly positionPercent = computed<number>(() => {
    const ceiling = this.ceilingFrames();
    return ceiling === 0 ? 0 : clamp((this.stats().framesRendered / ceiling) * 100, 0, 100);
  });

  private framesSincePublish = 0;
  /** Snapshots a jump still owes the stream, drained one per tick by `onTick`. */
  private pending: FrameSnapshot[] = [];
  /** What the frame clock was last handed, or null before it has ever been started — the rate
   *  diagnostics report, rather than one derived from a fader that may have moved while stopped. */
  private runningIntervalUs: number | null = null;

  /** Rebuilds the machine and register frame for `file` and initialises its start subtune. */
  loadTune(file: SidFile): void {
    if (this.state() === 'playing' || this.state() === 'paused') {
      this.clock.stop();
      this.delivery.sendControl(buildStopPacket());
    }
    // Whatever a jump is replaying describes the outgoing tune, not this one.
    this.tuneSession.discardOutstandingJump();

    this.tuneSession.load(file);
    this.mutedVoices.set([false, false, false]);
    // A fresh RegisterFrame starts fully unmuted, so a held button must not survive into a tune it
    // never pressed against — otherwise effectiveMutes would disagree with the chip it just replaced.
    this.heldVoices.set([false, false, false]);
    this.nominalIntervalUs.set(
      file.clock === 'ntsc' ? NTSC_FRAME_INTERVAL_US : PAL_FRAME_INTERVAL_US
    );
    this.resetCounters();
    // Cues and loop entries hold machine state, not frame numbers, so a new tune invalidates every
    // captured snapshot — this is the only path that clears them. Stop, play-from-stopped and
    // subtune changes reuse the same machine and must leave captured points alone. Whatever was
    // looping goes with the points: there is nothing left to loop against.
    this.markerState.clear();

    if (this.tuneSession.initSubtune(file.startSong)) {
      this.state.set('stopped');
    }
    this.publishStats();
  }

  /**
   * Starts (or resumes) playback. Must be called from a user gesture — the clock resumes an
   * `AudioContext`.
   */
  async play(): Promise<void> {
    const file = this.tuneSession.file;
    const machine = this.tuneSession.machine;
    const frame = this.tuneSession.frame;
    if (file === null || machine === null || frame === null) {
      this.fail('no tune is loaded');
      return;
    }
    if (this.state() === 'playing') {
      return;
    }
    if (this.midi.selectedPortId() === null) {
      this.fail('no MIDI output port is selected');
      return;
    }

    if (this.state() === 'paused') {
      // Restore the chip to the emulated state rather than to whatever the pause gate-off left it
      // holding.
      frame.markAllDirty();
    } else {
      if (!this.tuneSession.initSubtune(this.currentSubtune())) {
        return;
      }
      this.resetCounters();
    }

    this.lastError.set(null);
    // The header already told us the model and the cartridge displays it.
    this.delivery.sendControl(buildSidTypePacket(0, file.model === 'mos8580'));
    this.delivery.sendControl(buildStartPacket());

    const intervalUs = this.effectiveIntervalUs();
    try {
      await this.clock.start(intervalUs, (dueAtMs, catchUpClamped) =>
        this.onTick(dueAtMs, catchUpClamped)
      );
    } catch (error) {
      // The cartridge is already in ASID mode waiting on a frame stream that will never start, so
      // close the session rather than leaving it open for the tester to notice and stop by hand.
      this.delivery.sendControl(buildStopPacket());
      this.fail(`the frame clock could not start — ${describeError(error)}`);
      return;
    }
    this.runningIntervalUs = intervalUs;

    this.state.set('playing');
    this.publishStats();
    logInfo(
      LogType.Play,
      `DJ engine: subtune ${this.currentSubtune()} at ${Math.round(intervalUs)} µs per packet.`
    );
  }

  /** Stops the clock and gates every voice off, so a pause leaves silence rather than a held note. */
  pause(): void {
    if (this.state() !== 'playing') {
      return;
    }

    this.clock.stop();
    // No tick will come to drain them, and the gate-off below supersedes them anyway.
    this.pending = [];
    this.delivery.clearCommitted();
    this.delivery.sendControl(buildSidDataPacket(buildVoiceGateOffSnapshot()));
    this.state.set('paused');
    this.publishStats();
    logInfo(LogType.Paused, 'DJ engine: paused, voices gated off.');
  }

  /** Stops the clock, tells the cartridge to leave ASID mode, and resets the machine. */
  stop(): void {
    this.clock.stop();
    // A sequence must never survive a transport change: no tick is coming to drain it, and the
    // subtune re-init below invalidates whatever it was holding anyway. A jump still replaying is
    // owed the same treatment — landing it would restart playback at a position nobody asked for.
    this.pending = [];
    this.delivery.clearCommitted();
    this.tuneSession.discardOutstandingJump();
    if (this.tuneSession.file !== null) {
      this.delivery.sendControl(buildStopPacket());
    }
    this.state.set('stopped');
    if (this.tuneSession.machine !== null) {
      this.tuneSession.initSubtune(this.currentSubtune());
    }
    this.publishStats();
  }

  /**
   * Tears playback down with the injector that provides the engine — the view leaving the screen
   * destroys neither the clock's audio graph nor the cartridge's ASID session on its own, and a
   * clock left ticking keeps streaming frames with no UI left to reach `stop()`.
   *
   * Deliberately lighter than `stop()`: re-initialising the subtune during a route change costs a
   * synchronous machine run nothing will ever play.
   */
  ngOnDestroy(): void {
    this.clock.stop();
    this.tuneSession.discardOutstandingJump();
    // The replay thread outlives this injector otherwise — nothing else holds the runner.
    this.tuneSession.dispose();
    if (this.state() === 'playing' || this.state() === 'paused') {
      this.delivery.sendControl(buildStopPacket());
    }
  }

  nextSubtune(): void {
    this.tuneSession.nextSubtune();
  }

  previousSubtune(): void {
    this.tuneSession.previousSubtune();
  }

  /**
   * Voice 0/1/2 — the latched checkbox state. Replicates the firmware's own hardware-mute
   * technique: forces that voice's control register to 0 once, then drops every further write the
   * tune's code makes to it until unmuted.
   */
  setVoiceMuted(voice: number, muted: boolean): void {
    if (voice < 0 || voice > 2) return;
    this.mutedVoices.update((voices) => voices.map((v, i) => (i === voice ? muted : v)));
    this.applyEffectiveMute(voice);
  }

  /** Voice 0/1/2 — the momentary hold state a press-and-hold button drives. Release always restores
   * whatever the latched checkbox says, even if it changed while held. */
  setVoiceHeld(voice: number, held: boolean): void {
    if (voice < 0 || voice > 2) return;
    this.heldVoices.update((voices) => voices.map((v, i) => (i === voice ? held : v)));
    this.applyEffectiveMute(voice);
  }

  /** Unchecks every latched mute without disturbing whichever voice is currently held. */
  clearVoiceMutes(): void {
    this.mutedVoices.set([false, false, false]);
    for (let voice = 0; voice < 3; voice++) {
      this.applyEffectiveMute(voice);
    }
  }

  private applyEffectiveMute(voice: number): void {
    this.tuneSession.frame?.setVoiceMuted(voice, this.effectiveMutes()[voice]);
  }

  /** Clamped to the input span intersected with the per-tune floor. A divisor on the clock and
   * nothing else, which is why it is nearly free. */
  setSpeed(multiplier: number): void {
    if (!Number.isFinite(multiplier)) {
      return;
    }
    this.applySpeedBounded(
      multiplier,
      Math.max(1 - SPEED_INPUT_SPAN, this.slowestSpeed()),
      1 + SPEED_INPUT_SPAN
    );
  }

  /**
   * Moves the multiplier up by `SPEED_JUMP_STEP` from wherever it currently sits, clamped to the
   * hard range. See `jump` for the excursion state machine this and `jumpSpeedDown` share.
   */
  jumpSpeedUp(): void {
    this.jump('up');
  }

  /** Moves the multiplier down by `SPEED_JUMP_STEP`. See `jump`. */
  jumpSpeedDown(): void {
    this.jump('down');
  }

  /**
   * Dual-purpose: with no excursion open, sets 1.0. With one open, restores `rememberedSpeed`
   * exactly and closes the excursion — the same return path a jump on the opposite button takes.
   */
  homeSpeed(): void {
    const remembered = this._rememberedSpeed();
    if (remembered === null) {
      this.applySpeedBounded(1, this.slowestSpeed(), this.fastestSpeed());
      return;
    }
    this.returnFromExcursion(remembered);
  }

  /**
   * The jump excursion state machine. The first press of either button opens an excursion by
   * recording the pre-jump multiplier into `rememberedSpeed`, then moves additively; a same-side
   * press while open is a no-op, and an opposite-side press returns to `rememberedSpeed` exactly
   * (never by re-deriving it with arithmetic — see `returnFromExcursion`) and closes the excursion.
   */
  private jump(direction: 'up' | 'down'): void {
    const remembered = this._rememberedSpeed();
    if (remembered === null) {
      this._rememberedSpeed.set(this.speedMultiplier());
      this.excursionDirection = direction;
      const delta = direction === 'up' ? SPEED_JUMP_STEP : -SPEED_JUMP_STEP;
      this.applySpeedBounded(this.speedMultiplier() + delta, this.slowestSpeed(), this.fastestSpeed());
      return;
    }
    if (this.excursionDirection === direction) {
      return; // same button again while on an excursion — no-op
    }
    this.returnFromExcursion(remembered);
  }

  /**
   * Restores `remembered` exactly and closes the excursion. Reads the stored value rather than
   * subtracting the jump step back out — a jump that clamped on the way out must not corrupt the
   * way back, and this is what makes that fall out for free.
   */
  private returnFromExcursion(remembered: number): void {
    this.applySpeedBounded(remembered, this.slowestSpeed(), this.fastestSpeed());
    this._rememberedSpeed.set(null);
    this.excursionDirection = null;
  }

  /** Shared by `setSpeed` (input bounds) and the jump surface (hard bounds), so both funnel through
   * one `applyIntervalChange()` call rather than duplicating it. */
  private applySpeedBounded(multiplier: number, lo: number, hi: number): void {
    this.speedMultiplier.set(clamp(multiplier, lo, hi));
    this.applyIntervalChange();
  }

  /** One of `NOMINAL_INTERVAL_OPTIONS_US` for a PAL tune; NTSC tunes load their own default. */
  setNominalIntervalUs(us: number): void {
    if (!Number.isFinite(us) || us <= 0) {
      logWarn(`DJ engine: ignoring a nominal interval of ${us} µs.`);
      return;
    }
    this.nominalIntervalUs.set(us);
    this.applyIntervalChange();
  }

  /** Delegates to `DeliveryTransport` — see its own doc for the clamp/enforcement split. */
  setScheduleAhead(ms: number): void {
    this.delivery.setScheduleAhead(ms);
  }

  addCue(): number {
    return this.markerState.addCue();
  }

  captureCue(index: number): void {
    this.markerState.captureCue(index);
  }

  setCueOffset(index: number, offset: number): void {
    this.markerState.setCueOffset(index, offset);
  }

  /**
   * Launches (or resumes) playback first if it is not already running, then hops — see
   * `MarkerState.restoreCapturedPoint` for the restore itself.
   *
   * The playing check is inlined rather than routed through a shared `async` helper: when already
   * playing, skipping straight to the hop must stay perfectly synchronous with the call — awaiting
   * even an already-resolved promise yields a microtask, which would land the hop's restore a tick
   * later than a caller that never awaits this method (as the existing tests do not) expects.
   *
   * The cue is captured *before* the `play()` await, not re-read by index afterward: `play()` awaits
   * a real async gap (`context.resume()`), and the view fires this call without disabling cue/loop
   * controls while it is in flight, so the row can be cleared or re-captured before it lands. The
   * pre-await capture restores whatever was there at click time regardless — the same stale-but-
   * deterministic behaviour as a direct hop while already playing.
   */
  async hopToCue(index: number): Promise<void> {
    if (!this.markerState.hasCue(index)) return;
    const cue = this.cues()[index];
    if (cue === null) return;
    if (this.state() !== 'playing') {
      await this.play();
      if (this.state() !== 'playing') return;
    }
    this.markerState.restoreCapturedPoint(cue);
  }

  clearCue(index: number): void {
    this.markerState.clearCue(index);
  }

  deleteCue(index: number): void {
    this.markerState.deleteCue(index);
  }

  addLoop(): number {
    return this.markerState.addLoop();
  }

  tapLoopIn(index: number): void {
    this.markerState.tapLoopIn(index);
  }

  tapLoopOut(index: number): void {
    this.markerState.tapLoopOut(index);
  }

  setLoopInOffset(index: number, frames: number): void {
    this.markerState.setLoopInOffset(index, frames);
  }

  setLoopOutOffset(index: number, frames: number): void {
    this.markerState.setLoopOutOffset(index, frames);
  }

  /**
   * Launches (or resumes) playback first if it is not already running, then punches — see
   * `MarkerState.punchLoop` for the engage-now-or-queue decision. The playability check runs before
   * the launch, so a launch is never spent on a row with nothing to play. See `hopToCue` for why the
   * playing check is inlined rather than shared.
   */
  async punchLoop(index: number): Promise<void> {
    if (!this.markerState.isLoopPlayable(index)) return;
    if (this.state() !== 'playing') {
      await this.play();
      if (this.state() !== 'playing') return;
    }
    this.markerState.punchLoop(index);
  }

  auditionLoopIn(index: number): void {
    this.markerState.auditionLoopIn(index);
  }

  auditionLoopOut(index: number): void {
    this.markerState.auditionLoopOut(index);
  }

  stopLoop(): void {
    this.markerState.stopLoop();
  }

  clearLoopSlot(index: number): void {
    this.markerState.clearLoopSlot(index);
  }

  deleteLoop(index: number): void {
    this.markerState.deleteLoop(index);
  }

  progressPercentFor(slot: number): number {
    return this.markerState.progressPercentFor(slot, this.stats().framesRendered);
  }

  /**
   * Asks for `percent` of the jump ceiling — see `TuneSession.scrubTo`. The returned promise
   * resolves once the request has settled — landed, failed, or been superseded/discarded — so a
   * caller that needs to know when the jump is done (rather than merely requested) can await it.
   */
  scrubTo(percent: number): Promise<void> {
    return this.tuneSession.scrubTo(percent);
  }

  /**
   * One emulated frame, one packet — including frames where nothing changed, so the packet stream
   * and the frame grid stay one-to-one and a packet's place in it always names its due time.
   *
   * `dueAtMs` is when the clock says this frame fell due, which is before now and one interval apart
   * from its neighbour when a callback releases several at once. It rides the tick through to the
   * transport so delivery can be anchored to the frame grid rather than to whenever the main thread
   * reached it. `catchUpClamped` rides alongside it — see `FrameClock.start` — and is threaded to
   * `DeliveryTransport.sendFramePacket` so the delivery stats can flag a frame whose due time
   * under-reports its lag.
   */
  private onTick(dueAtMs: number, catchUpClamped: boolean): void {
    const machine = this.tuneSession.machine;
    const frame = this.tuneSession.frame;
    if (machine === null || frame === null) {
      return;
    }

    if (this.midi.selectedPortId() === null) {
      this.fail('the MIDI output port disappeared — playback stopped');
      return;
    }

    // A sequence's packets ride the tick rather than arriving beside it: the host paces the stream
    // frame by frame, so each of `queueResync`'s two packets needs a frame slot of its own and the
    // due time that comes with it. Sent between ticks they would share one slot, and the release
    // window the gate-off exists to open would collapse to the gap between two `midi.send` calls.
    const queued = this.pending.shift();
    if (queued !== undefined) {
      this.delivery.sendFramePacket(
        buildSidDataPacket(queued),
        dueAtMs,
        catchUpClamped,
        this.effectiveIntervalUs()
      );
      this.publishStats();
      return;
    }

    let result: FrameResult;
    try {
      result = machine.runFrame();
    } catch (error) {
      this.fail(`the play routine could not run — ${describeError(error)}`);
      return;
    }
    if (!result.completed) {
      this.fail(
        `the play routine did not return within its cycle budget (${result.cyclesUsed} cycles)`
      );
      return;
    }

    this.delivery.sendFramePacket(
      buildSidDataPacket(frame.takeSnapshot()),
      dueAtMs,
      catchUpClamped,
      this.effectiveIntervalUs()
    );
    this.tuneSession.framesRendered++;
    this.markerState.maybeRecordAnchor(machine, frame, this.tuneSession.framesRendered);
    if (this.markerState.advanceLoop(this.tuneSession.framesRendered)) {
      return; // the resync it queued goes out on the next tick; don't publish stats twice
    }
    if (++this.framesSincePublish >= STATS_PUBLISH_FRAME_INTERVAL) {
      this.publishStats();
    }
  }

  /**
   * Moves the clock the instant the fader does, so the pitch tracks the hand. The cartridge runs
   * pass-through and holds no rate of its own to agree with, which is what makes the direct route
   * safe here.
   */
  private applyIntervalChange(): void {
    if (this.state() !== 'playing') {
      // Nothing is pacing anything — `play()` reads the interval fresh when it starts the clock.
      this.publishStats();
      return;
    }
    // Frames may already be sitting in the transport's queue at the old rate;
    // `retimeCommittedHostSends()` is the cancel-and-reschedule half of the change.
    const intervalUs = this.effectiveIntervalUs();
    this.setClockIntervalUs(intervalUs);
    this.delivery.retimeCommittedHostSends(intervalUs);
    this.publishStats();
  }

  /** Moves the clock and records what it is now pacing, so diagnostics report the rate actually
   *  running rather than the one the fader has already asked for. */
  private setClockIntervalUs(intervalUs: number): void {
    this.clock.setIntervalUs(intervalUs);
    this.runningIntervalUs = intervalUs;
  }

  /**
   * The real inter-packet time. Multispeed is a tick rate, never a batch: `runFrame` plays the
   * routine once, so a 2x tune ticks twice per video frame at half the interval.
   */
  private effectiveIntervalUs(): number {
    const callsPerFrame = this.tuneSession.machine?.callsPerFrame ?? 1;
    return this.nominalIntervalUs() / this.speedMultiplier() / callsPerFrame;
  }

  /**
   * Hands the chip-resync packets to the frame clock instead of sending them here.
   *
   * The host paces the stream one frame per tick, so a packet injected between ticks lands inside a
   * frame slot another packet already owns — two frames' worth of register writes arriving as one,
   * however hard the cue buttons are hit. Riding the tick gives each packet a slot and a due time of
   * its own.
   *
   * The gate-off leads in a packet of its own so it lands a whole frame ahead of the resync, giving
   * every voice a real release window before it re-attacks. Folding both into one packet via the
   * ASID secondary gate slots would halve the frames but collapse that window to a few cycles.
   *
   * Costs the hop up to two frames of latency (~40 ms at 50 Hz), which is well under what a hand
   * hitting a cue button can hear.
   */
  private queueResync(): void {
    const frame = this.tuneSession.frame;
    if (frame === null) return;

    frame.markAllDirty();
    const snapshot = frame.takeSnapshot();

    // Nothing is ticking while paused or stopped, so there is no tick to ride and no stream to stay
    // in step with — send at once instead.
    if (this.state() !== 'playing') {
      this.pending = [];
      // A jump landing while *paused* must also stay silent: `pause()` already zeroed the three
      // voice control registers on the real chip, and this snapshot is a full re-emit, so sent
      // verbatim it could re-open a gate while the UI still reads "Paused". Force those three to 0
      // in the outgoing packet only — `frame` keeps its true values, so `play()`'s paused-resume
      // branch (`markAllDirty()`) restores the real state on the next Play. Stopped needs none of
      // that: nothing is sounding to silence, and the true state is what the chip should hold.
      const outgoing = this.state() === 'paused' ? withVoiceGatesOff(snapshot) : snapshot;
      // No tick released this one, so there is no frame grid to place it on: it is due now, and it
      // never rode a catch-up-clamped advance because it never rode the clock at all.
      this.delivery.sendFramePacket(
        buildSidDataPacket(outgoing),
        performance.now(),
        false,
        this.effectiveIntervalUs()
      );
      this.publishStats();
      return;
    }

    // Replaces any sequence still owed rather than appending to it. Spamming hops then costs one
    // packet per tick forever, instead of building a backlog that plays every hop the button ever
    // took — the newest hop is always the one that lands.
    this.pending = [buildVoiceGateOffSnapshot(), snapshot];
  }

  private fail(reason: string): void {
    this.clock.stop();
    this.lastError.set(reason);
    this.state.set('error');
    this.publishStats();
    logError(`DJ engine: ${reason}`);
  }

  private resetCounters(): void {
    this.tuneSession.resetPosition();
    this.pending = [];
    this.delivery.reset();
  }

  /**
   * The interval the diagnostics readout reports: what the clock is running while playing, and the
   * rate the next `play()` would start at otherwise. Reading `runningIntervalUs` while stopped would
   * report a rate that stopped being true when the clock did.
   */
  private reportedIntervalUs(): number {
    if (this.tuneSession.file === null) return 0;
    return this.state() === 'playing' && this.runningIntervalUs !== null
      ? this.runningIntervalUs
      : this.effectiveIntervalUs();
  }

  private publishStats(): void {
    const clockStats = this.clock.stats;
    this.framesSincePublish = 0;
    const delivery = this.delivery.snapshot();
    this.stats.set({
      framesRendered: this.tuneSession.framesRendered,
      packetsSent: delivery.packetsSent,
      bytesSent: delivery.bytesSent,
      suppressedWrites: this.tuneSession.frame?.suppressedWriteCount ?? 0,
      illegalOpcodeCount: this.tuneSession.machine?.illegalOpcodeCount ?? 0,
      callsPerFrame: this.tuneSession.machine?.callsPerFrame ?? 1,
      effectiveIntervalUs: this.reportedIntervalUs(),
      measuredMeanIntervalUs: clockStats.measuredMeanIntervalUs,
      driftMs: clockStats.driftMs,
      jitterMs: clockStats.jitterMs,
      worstGapMs: clockStats.worstGapMs,
      lateCallbacks: clockStats.lateCallbacks,
      scheduledFrames: delivery.scheduledFrames,
      lateFrames: delivery.lateFrames,
      meanLagMs: delivery.meanLagMs,
      worstLagMs: delivery.worstLagMs,
      reorderedFrames: delivery.reorderedFrames,
      clampedFrames: delivery.clampedFrames,
      cancelSupported: delivery.cancelSupported,
      lastCancelLatencyMs: delivery.lastCancelLatencyMs,
    });
  }
}

/**
 * A snapshot that clears the voice control registers so nothing is left sustaining. Built on a
 * scratch frame: the live frame mirrors the emulated chip state and is what resume restores from.
 */
function buildVoiceGateOffSnapshot(): FrameSnapshot {
  const scratch = new RegisterFrame();
  for (const register of VOICE_CONTROL_REGISTERS) {
    scratch.onSidWrite(register, 0);
  }
  return scratch.takeSnapshot();
}

/**
 * After `markAllDirty()` + `takeSnapshot()`, slots 0-24 are present in ascending order with no gaps,
 * so `values` has exactly one entry per slot — indices 22/23/24 are the three voice control
 * registers. Returns a copy with those three forced to 0.
 *
 * Only ever valid on an all-dirty snapshot: `takeSnapshot()` compacts `values` to one entry per
 * *present* slot, so on an ordinary frame those indices name whatever the tune happened to write.
 * The one caller is a jump landing while paused.
 */
function withVoiceGatesOff(snapshot: FrameSnapshot): FrameSnapshot {
  const values = [...snapshot.values];
  values[22] = 0;
  values[23] = 0;
  values[24] = 0;
  return { ...snapshot, values };
}
