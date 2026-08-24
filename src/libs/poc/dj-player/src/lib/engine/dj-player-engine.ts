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
  buildFramerateRecipePacket,
  buildSidDataPacket,
  buildSidTypePacket,
  buildStartPacket,
  buildStopPacket,
} from '../asid/asid-encoder';
import { RegisterFrame } from '../asid/register-frame';
import type { FrameSnapshot, RegisterValuesSnapshot } from '../asid/register-frame';
import { C64Machine } from '../cpu/c64-machine';
import type { MachineSnapshot } from '../cpu/c64-machine';
import type { FrameResult } from '../cpu/c64-machine';
import type { SidFile } from '../sid/sid-file.model';
import { MidiOutputService } from '../midi/midi-output.service';
import type { FrameClock } from '../clock/frame-clock';

export type EngineState = 'stopped' | 'playing' | 'paused' | 'error';
export type SpeedMode = 'clock-only' | 'clock-and-recipe';

/** The nudge window in real time. Frames are derived from the tune's rate so the felt range is
 *  the same on a 1x tune and a 2x-multispeed one. */
export const NUDGE_RANGE_MS = 1000;

/** How much music plays into the seam when a loop's out-point is auditioned. A feel default —
 *  confirm by ear on hardware. */
export const LOOP_AUDITION_PREROLL_MS = 2000;

/**
 * An earlier machine image a captured point can replay forward from.
 *
 * A snapshot can only be run forward, so reaching a frame *before* a captured point means starting
 * from something older than it — this is that something.
 */
export interface PositionAnchor {
  readonly frame: number;
  readonly machine: MachineSnapshot;
  readonly registers: RegisterValuesSnapshot;
}

/**
 * A captured position plus its nudge offset, held as restorable state rather than as a frame
 * number: `machine`/`registers` are already resolved at `frame + offset`, so returning to the point
 * costs a restore and no emulation.
 */
export interface CapturedPoint {
  /** Where the point was originally captured, before any nudge. */
  readonly frame: number;
  /** −nudgeRangeFrames()..+nudgeRangeFrames(). */
  readonly offset: number;
  readonly machine: MachineSnapshot;
  readonly registers: RegisterValuesSnapshot;
  readonly anchor: PositionAnchor;
}

export type CueSlot = CapturedPoint;

/**
 * The loop's exit point: a frame plus its nudge, and nothing else. It is compared against the
 * position counter once per tick rather than restored, so it needs no machine image — which is what
 * keeps a whole loop costing the memory of a single cue.
 */
export interface LoopOutPoint {
  readonly frame: number;
  /** −nudgeRangeFrames()..+nudgeRangeFrames(). */
  readonly offset: number;
}

/**
 * One punch-in slot: a loop's two ends held together, so four loops can be marked up independently
 * and engaged against each other.
 *
 * A slot comes into being on its first tap, whichever end that is, and only *plays* once both ends
 * are marked and still in order with their nudges applied.
 */
export interface LoopSlot {
  /** Restorable state, exactly as a cue holds it — re-entry is a restore, never a replay. */
  readonly in: CapturedPoint | null;
  /** A frame plus its nudge; compared against the counter, never restored. */
  readonly out: LoopOutPoint | null;
}

/** A slot whose ends are both marked and still in order — a pass there is something to play. */
interface ResolvedLoop {
  readonly start: CapturedPoint;
  readonly outFrame: number;
}

/**
 * One tick of a sequence the engine owes the stream, drained in order by `onTick`.
 *
 * Only `packet` replaces the tick's frame; every other kind runs the tune's frame as usual and
 * differs solely in what goes out afterwards. That is what lets a retune hold the tune's place
 * across the silence rather than pausing it.
 */
type PendingStep =
  /** A precomputed packet that replaces this tick's frame — the cue-hop resync. */
  | { readonly kind: 'packet'; readonly snapshot: FrameSnapshot }
  /** Run the frame normally, but emit it with the three voice control registers forced to 0. */
  | { readonly kind: 'gated-frame' }
  /** Run the frame, switch the host clock's interval, send the recipe. No SID packet this tick. */
  | { readonly kind: 'retime' }
  /** Run the frame, then emit every register at its true value. Sound returns here. */
  | { readonly kind: 'resync' };

/** Counters and measurements the diagnostics panel reads. */
export interface EngineStats {
  readonly framesRendered: number;
  readonly packetsSent: number;
  readonly bytesSent: number;
  readonly recipeResends: number;
  readonly suppressedWrites: number;
  readonly illegalOpcodeCount: number;
  /** The tune's multispeed: how many ticks the engine runs per video frame. */
  readonly callsPerFrame: number;
  /**
   * The interval the frame clock is actually pacing at, which deliberately lags the speed fader
   * while a retune waits out its debounce and gate lead — the readout is the acceptance instrument
   * for the retune sequence, so it must not claim a rate nothing is running yet.
   */
  readonly effectiveIntervalUs: number;
  readonly measuredMeanIntervalUs: number;
  readonly driftMs: number;
  /** Standard deviation of the audio-callback gap — the scatter that empties the cartridge queue. */
  readonly jitterMs: number;
  /** The longest single audio-callback gap since play started. */
  readonly worstGapMs: number;
  /** Callbacks that arrived more than 2x the nominal buffer duration late. */
  readonly lateCallbacks: number;
}

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

const MICROSECONDS_PER_SECOND = 1_000_000;
/** The assumed length the scrub and playhead percentages are measured against — not the tune's real,
 * unmeasured length. A single tunable constant, not derived from anything about the file. */
export const JUMP_CEILING_SECONDS = 300;

/**
 * How long a speed change settles before `clock-and-recipe` mode begins its retune.
 *
 * Every recipe costs the cartridge four blocking queue drains plus four lines printed to the C64
 * screen, so a fader sweep at 150 ms stacks interruptions faster than the cartridge clears them.
 *
 * Deliberately lower than the 500 ms this used to be, because the retune sequence now sits on top
 * of it: the clock does not move until the `retime` step, so nothing about the pitch changes until
 * this debounce *plus* `RETUNE_GATE_LEAD_FRAMES` has elapsed — ~570 ms at 250 ms, against ~820 ms
 * at 500. That the pitch is frozen while the fader is being swept is the price of host and
 * cartridge changing rate in the same instant, and is not a bug to be fixed by unfreezing the
 * clock. Anyone who needs to *hear* the pitch move while riding the fader wants `clock-only` mode,
 * which tracks the fader live and sends no recipe at all — that is what it is for.
 */
export const RECIPE_RESEND_DEBOUNCE_MS = 250;

/**
 * How many gated frames drain ahead of the recipe. The gate-off has to actually reach the C64
 * before the cartridge flushes, and the buffer's depth is a value the host cannot read — 16 covers
 * the cartridge's power-on default of roughly 13 frames with margin. ~320 ms on a normal PAL tune.
 */
export const RETUNE_GATE_LEAD_FRAMES = 16;

/**
 * Frames between `stats` publishes. A signal write per frame would run Angular change detection at
 * the frame rate, which is jitter this experiment cannot afford.
 */
const STATS_PUBLISH_FRAME_INTERVAL = 25;

/**
 * Anchor images kept at once: three recent ones plus the frame-0 seed that never leaves index 0.
 * Each is a 64 KB memory image, so this is a memory-against-replay-distance trade and nothing more.
 */
const ANCHOR_RING_SIZE = 4;

const RECIPE_MAX_INTERVAL_US = 0xffff;

const EMPTY_STATS: EngineStats = {
  framesRendered: 0,
  packetsSent: 0,
  bytesSent: 0,
  recipeResends: 0,
  suppressedWrites: 0,
  illegalOpcodeCount: 0,
  callsPerFrame: 1,
  effectiveIntervalUs: 0,
  measuredMeanIntervalUs: 0,
  driftMs: 0,
  jitterMs: 0,
  worstGapMs: 0,
  lateCallbacks: 0,
};

/**
 * Drives a tune out to the cartridge: one emulated frame and one ASID SID-data packet per clock
 * tick, plus the transport, speed and timing controls the listening session needs.
 *
 * Injectable rather than `providedIn: 'root'` so the view can provide it beside `MidiOutputService`
 * and keep both out of the app injector. It owns the `C64Machine` and `RegisterFrame`, which are
 * rebuilt on every `loadTune`.
 */
@Injectable()
export class DjPlayerEngine implements OnDestroy {
  private readonly midi = inject(MidiOutputService);
  private readonly clock = inject(FRAME_CLOCK);

  readonly state = signal<EngineState>('stopped');
  readonly currentSubtune = signal<number>(1);
  readonly subtuneCount = signal<number>(1);
  readonly speedMultiplier = signal<number>(1);
  /**
   * Bumped whenever the machine or its multispeed can change, purely to give `slowestSpeed` a signal
   * to recompute on: `machine.callsPerFrame` is a plain readonly field, not itself a signal.
   */
  private readonly tuneRevision = signal(0);
  /**
   * The slowest multiplier this tune can be told about. Never looser than 1 − SPEED_HARD_SPAN.
   *
   * On a normal PAL tune (19950 µs, callsPerFrame 1) this resolves to ~0.3044 — the protocol floor,
   * since the recipe's 16-bit interval field would otherwise overflow before the hard span does. On
   * a 2x-multispeed PAL tune it resolves to 0.3 — the hard span wins instead, because halving the
   * interval for the second play call halves the protocol floor with it. The asymmetry is real, not
   * a bug: it is `max()` picking whichever constraint actually binds for the tune in hand.
   */
  readonly slowestSpeed = computed<number>(() => {
    this.tuneRevision();
    const callsPerFrame = this.machine?.callsPerFrame ?? 1;
    const protocolFloor = this.nominalIntervalUs() / (RECIPE_MAX_INTERVAL_US * callsPerFrame);
    return Math.max(1 - SPEED_HARD_SPAN, protocolFloor);
  });
  readonly fastestSpeed = computed<number>(() => 1 + SPEED_HARD_SPAN);
  private readonly _rememberedSpeed = signal<number | null>(null);
  /** The speed being ridden before the current jump excursion; null when not on an excursion. */
  readonly rememberedSpeed: Signal<number | null> = this._rememberedSpeed.asReadonly();
  /** Which jump button opened the current excursion — null when `rememberedSpeed` is null. Tracked
   * separately because "same button again" vs. "opposite button" cannot be told apart from the
   * multiplier's value alone once a jump has clamped. */
  private excursionDirection: 'up' | 'down' | null = null;
  readonly speedMode = signal<SpeedMode>('clock-and-recipe');
  readonly recipeEnabled = signal<boolean>(true);
  /**
   * Whether a recipe packet has gone out since this engine was constructed — which means the
   * cartridge's frame timer is on, because the firmware's `APT_ContFramerate` handler does
   * `FrameTimerMode = true` unconditionally on receipt.
   *
   * Deliberately sticky: `stop()`, `loadTune()` and `resetCounters()` all leave the cartridge's flag
   * set, and so does un-checking `recipeEnabled` — that only stops us sending *more* recipes. The
   * flag clears on the cartridge only when the ASID player app is exited and re-entered, where
   * `InitHndlr_ASID` sets it false, which this browser cannot observe. So this tracks what we know
   * we caused rather than pretending to read the cartridge.
   */
  readonly recipeSent = signal<boolean>(false);
  readonly nominalIntervalUs = signal<number>(PAL_FRAME_INTERVAL_US);
  readonly scheduleAheadMs = signal<number>(0);
  readonly lastError = signal<string | null>(null);
  readonly stats = signal<EngineStats>(EMPTY_STATS);
  readonly mutedVoices = signal<readonly boolean[]>([false, false, false]);
  /** Momentary hold state — the button beside each checkbox, held down. */
  readonly heldVoices = signal<readonly boolean[]>([false, false, false]);
  /** What the chip actually does: latched XOR held. */
  readonly effectiveMutes = computed<readonly boolean[]>(() =>
    this.mutedVoices().map((latched, i) => latched !== this.heldVoices()[i])
  );
  readonly cues = signal<readonly (CueSlot | null)[]>([null, null, null, null]);
  /**
   * Four loops marked up side by side. Each holds its entry as restorable state — re-entry is a
   * snapshot restore, so a pass costs the same whether the point sits at frame 10 or frame 10,000 —
   * and its exit as a frame number alone, which is only ever compared against the position counter.
   */
  readonly loopSlots = signal<readonly (LoopSlot | null)[]>([null, null, null, null]);
  /** The slot currently looping, or null. */
  readonly activeLoopSlot = signal<number | null>(null);
  /** The slot that takes over when the active one finishes its lap, or null. */
  readonly queuedLoopSlot = signal<number | null>(null);

  /**
   * The nudge range in frames for the loaded tune.
   *
   * Derived from the tune's own rate (`nominalIntervalUs` divided by `callsPerFrame`), never the
   * live `speedMultiplier` — riding the speed fader must not make the range breathe, and the anchor
   * spacing below is only valid because this stays fixed for a given tune.
   */
  readonly nudgeRangeFrames = computed<number>(() => this.msToFrames(NUDGE_RANGE_MS));

  /** Converts a real-time duration to frames at the tune's own rate (`nominalIntervalUs` divided by
   *  `callsPerFrame`), never the live `speedMultiplier` — shared by the nudge range and the loop
   *  audition pre-roll so both breathe with the tune, never the speed fader. */
  private msToFrames(ms: number): number {
    const callsPerFrame = this.machine?.callsPerFrame ?? 1;
    const nominalUs = this.nominalIntervalUs();
    const tuneIntervalUs = nominalUs > 0 ? nominalUs / callsPerFrame : PAL_FRAME_INTERVAL_US;
    return Math.round((ms * 1000) / tuneIntervalUs);
  }

  /**
   * Frames between the anchor images `onTick` retains for the nudge to replay forward from.
   *
   * Derived from the nudge range rather than fixed, to hold the ring's actual reach: eviction keeps
   * the seed plus the 3 newest recordings, i.e. `ANCHOR_RING_SIZE − 2` gaps of this interval between
   * the oldest kept (non-seed) anchor and the newest. A query can land right on the newest recording
   * (nothing rounds that away), so the guarantee needs `(ANCHOR_RING_SIZE − 2) × interval ≥
   * nudgeRangeFrames()` — one fewer factor than `(ANCHOR_RING_SIZE − 1)` would suggest, since the
   * seed anchor is not part of this evenly-spaced run. A wider range on a multispeed tune widens the
   * spacing accordingly, or the ring falls short of it and every nudge that deep replays from the
   * frame-0 seed instead of a recent anchor — the O(distance-from-start) stall this ring exists to
   * avoid.
   */
  private readonly anchorSnapshotFrameInterval = computed<number>(() =>
    Math.max(1, Math.ceil(this.nudgeRangeFrames() / (ANCHOR_RING_SIZE - 2)))
  );

  private file: SidFile | null = null;
  private machine: C64Machine | null = null;
  private frame: RegisterFrame | null = null;
  private recipeResendTimer: ReturnType<typeof setTimeout> | null = null;
  private framesRendered = 0;
  private packetsSent = 0;
  private bytesSent = 0;
  private recipeResends = 0;
  private framesSincePublish = 0;
  /** Steps a jump or a retune still owes the stream, drained one per tick by `onTick`. */
  private pending: PendingStep[] = [];
  /**
   * What the frame clock is actually pacing at, or null before it has ever been started.
   *
   * Kept apart from `effectiveIntervalUs()` — which reads the *new* rate the moment the fader
   * moves — because a `clock-and-recipe` retune deliberately leaves the clock alone until its
   * `retime` step. Diagnostics report this one.
   */
  private runningIntervalUs: number | null = null;
  /**
   * Recent machine images, oldest first, that a nudge can replay forward from.
   *
   * Index 0 is the frame-0 seed and is never evicted: it is the only anchor guaranteed to sit
   * before every capture, so it is what a point taken in the first seconds of a tune falls back to.
   */
  private anchorRing: PositionAnchor[] = [];

  /** Rebuilds the machine and register frame for `file` and initialises its start subtune. */
  loadTune(file: SidFile): void {
    if (this.state() === 'playing' || this.state() === 'paused') {
      this.clock.stop();
      this.sendControl(buildStopPacket());
    }
    this.clearRecipeResend();

    this.file = file;
    this.frame = new RegisterFrame();
    this.mutedVoices.set([false, false, false]);
    // A fresh RegisterFrame starts fully unmuted, so a held button must not survive into a tune it
    // never pressed against — otherwise effectiveMutes would disagree with the chip it just replaced.
    this.heldVoices.set([false, false, false]);
    this.machine = new C64Machine(file, this.frame);
    // A new machine can carry a different multispeed than whatever tune played last — see
    // `slowestSpeed`, the one reader this exists for.
    this.tuneRevision.update((revision) => revision + 1);
    this.subtuneCount.set(Math.max(1, file.songs));
    this.nominalIntervalUs.set(
      file.clock === 'ntsc' ? NTSC_FRAME_INTERVAL_US : PAL_FRAME_INTERVAL_US
    );
    this.resetCounters();
    // Cues and loop entries hold machine state, not frame numbers, so a new tune invalidates every
    // captured snapshot — this is the only path that clears them. Stop, play-from-stopped and
    // subtune changes reuse the same machine and must leave captured points alone. Whatever was
    // looping goes with the points: there is nothing left to loop against.
    this.cues.set([null, null, null, null]);
    this.loopSlots.set([null, null, null, null]);
    this.stopLoop();

    if (this.initSubtune(file.startSong)) {
      this.state.set('stopped');
    }
    this.publishStats();
  }

  /**
   * Starts (or resumes) playback. Must be called from a user gesture — the clock resumes an
   * `AudioContext`.
   */
  async play(): Promise<void> {
    const file = this.file;
    if (file === null || this.machine === null || this.frame === null) {
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
      this.frame.markAllDirty();
    } else {
      if (!this.initSubtune(this.currentSubtune())) {
        return;
      }
      this.resetCounters();
    }

    this.lastError.set(null);
    // The header already told us the model and the cartridge displays it.
    this.sendControl(buildSidTypePacket(0, file.model === 'mos8580'));
    this.sendControl(buildStartPacket());
    if (this.recipeEnabled()) {
      this.sendRecipe();
    }

    const intervalUs = this.effectiveIntervalUs();
    try {
      await this.clock.start(intervalUs, () => this.onTick());
    } catch (error) {
      // The cartridge is already in ASID mode waiting on a frame stream that will never start, so
      // close the session rather than leaving it open for the tester to notice and stop by hand.
      this.sendControl(buildStopPacket());
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
    this.clearRecipeResend();
    // No tick will come to drain them, and the gate-off below supersedes them anyway.
    this.pending = [];
    this.sendControl(buildSidDataPacket(buildVoiceGateOffSnapshot()));
    this.state.set('paused');
    this.publishStats();
    logInfo(LogType.Paused, 'DJ engine: paused, voices gated off.');
  }

  /** Stops the clock, tells the cartridge to leave ASID mode, and resets the machine. */
  stop(): void {
    this.clock.stop();
    this.clearRecipeResend();
    // A sequence must never survive a transport change: no tick is coming to drain it, and the
    // subtune re-init below invalidates whatever it was holding anyway.
    this.pending = [];
    if (this.file !== null) {
      this.sendControl(buildStopPacket());
    }
    this.state.set('stopped');
    if (this.machine !== null) {
      this.initSubtune(this.currentSubtune());
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
    this.clearRecipeResend();
    if (this.state() === 'playing' || this.state() === 'paused') {
      this.sendControl(buildStopPacket());
    }
  }

  nextSubtune(): void {
    this.selectSubtune(this.currentSubtune() + 1);
  }

  previousSubtune(): void {
    this.selectSubtune(this.currentSubtune() - 1);
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
    this.frame?.setVoiceMuted(voice, this.effectiveMutes()[voice]);
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

  /**
   * The master switch for the framerate recipe: without it the cartridge never engages its own frame
   * timer, and `clock-and-recipe` has nothing to resend.
   */
  setRecipeEnabled(enabled: boolean): void {
    this.recipeEnabled.set(enabled);
    if (enabled && this.state() === 'playing') {
      this.sendRecipe();
    }
  }

  /**
   * `clock-only` changes the interval the instant the fader moves — the pitch tracks the hand, but
   * the cartridge's frame timer stays seeded to the old rate and its queue drifts.
   * `clock-and-recipe` instead runs the managed retune (see `beginRetune`), which keeps both ends
   * on the same rate at the cost of the pitch not moving at all until the sequence lands.
   */
  setSpeedMode(mode: SpeedMode): void {
    this.speedMode.set(mode);
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

  /**
   * `0` sends every packet immediately; a positive value hands `performance.now() + ms` to Web MIDI
   * so the subsystem's own clock releases it. Applied to the frame stream only — control packets
   * still go out at once, so a stop is never queued behind music.
   */
  setScheduleAhead(ms: number): void {
    if (!Number.isFinite(ms) || ms < 0) {
      logWarn(`DJ engine: ignoring a schedule-ahead of ${ms} ms.`);
      return;
    }
    this.scheduleAheadMs.set(ms);
  }

  /**
   * Captures the current position into one of four cue slots — as machine state, not as a frame
   * number.
   *
   * The whole point: you are already *at* this position, so there is nothing to re-derive. Storing
   * the state itself is what lets `hopToCue` skip the replay that `jumpToFrame` cannot avoid.
   *
   * The point is paired with an anchor from the ring on the way in, which is what makes a later
   * backward nudge of it possible at all.
   */
  addCue(slot: number): void {
    if (slot < 0 || slot > 3) return;
    const cue = this.captureAnchoredPoint();
    if (cue === null) return;
    this.cues.update((cues) => cues.map((c, i) => (i === slot ? cue : c)));
  }

  /**
   * Walks a captured cue up to ±`nudgeRangeFrames()` onto the exact transient; a no-op for an empty
   * slot. Clamped to that range, and rounded — a frame is the finest position there is.
   *
   * Re-derives the slot's resolved snapshot by replaying from its anchor, which is why this is a
   * setup gesture and `hopToCue` is not: the cost here is bounded by the anchor distance plus the
   * nudge range, never by how deep into the tune the point was taken.
   */
  setCueOffset(slot: number, offset: number): void {
    if (slot < 0 || slot > 3 || !Number.isFinite(offset)) return;
    const cue = this.cues()[slot] ?? null;
    if (cue === null) return;

    const range = this.nudgeRangeFrames();
    const clamped = clamp(Math.round(offset), -range, range);
    if (clamped === cue.offset) return;

    const resolved = this.resolvePoint(cue, clamped);
    if (resolved === null) return;
    this.cues.update((cues) => cues.map((c, i) => (i === slot ? resolved : c)));
  }

  /**
   * Returns to a captured cue slot in constant time; a no-op for an empty slot. See `restorePoint`
   * for why the hop costs no emulation.
   *
   * A nudged cue changes nothing here: its snapshot is already resolved at `frame + offset`, so the
   * hop restores it as-is. Re-deriving it on the way through would put the stall straight back.
   */
  hopToCue(slot: number): void {
    const cue = this.cues()[slot] ?? null;
    if (cue === null) return;
    this.restorePoint(cue);
  }

  /** Empties a cue slot, returning it to "Add". */
  clearCue(slot: number): void {
    if (slot < 0 || slot > 3) return;
    this.cues.update((cues) => cues.map((c, i) => (i === slot ? null : c)));
  }

  /**
   * Marks a slot's entry at the current position, capturing it exactly as `addCue` does — the
   * snapshot is what lets every later pass re-enter without replaying the tune. Leaves whatever
   * exit the slot already holds.
   */
  tapLoopIn(slot: number): void {
    if (slot < 0 || slot > 3) return;
    const point = this.captureAnchoredPoint();
    if (point === null) return;
    this.updateLoopSlot(slot, (current) => ({ in: point, out: current?.out ?? null }));
  }

  /** Marks a slot's exit at the current frame. No snapshot: the exit is only ever compared. */
  tapLoopOut(slot: number): void {
    if (slot < 0 || slot > 3 || this.machine === null) return;
    const point: LoopOutPoint = { frame: this.framesRendered, offset: 0 };
    this.updateLoopSlot(slot, (current) => ({ in: current?.in ?? null, out: point }));
  }

  /**
   * Walks a slot's entry up to ±`nudgeRangeFrames()` onto the transient, re-deriving its snapshot
   * from the point's anchor; a no-op with no entry marked. A setup gesture, for the same reason
   * `setCueOffset` is: the re-derivation replays frames, so it must not run per drag tick.
   */
  setLoopInOffset(slot: number, frames: number): void {
    if (slot < 0 || slot > 3 || !Number.isFinite(frames)) return;
    const point = this.loopSlots()[slot]?.in ?? null;
    if (point === null) return;

    const range = this.nudgeRangeFrames();
    const clamped = clamp(Math.round(frames), -range, range);
    if (clamped === point.offset) return;

    const resolved = this.resolvePoint(point, clamped);
    if (resolved === null) return;
    this.updateLoopSlot(slot, (current) => (current === null ? null : { ...current, in: resolved }));
  }

  /**
   * Walks a slot's exit up to ±`nudgeRangeFrames()`; a no-op with no exit marked. Arithmetic
   * alone — the exit is a number the tick compares, so moving it replays nothing.
   */
  setLoopOutOffset(slot: number, frames: number): void {
    if (slot < 0 || slot > 3 || !Number.isFinite(frames)) return;
    const point = this.loopSlots()[slot]?.out ?? null;
    if (point === null) return;

    const range = this.nudgeRangeFrames();
    const nudged: LoopOutPoint = { ...point, offset: clamp(Math.round(frames), -range, range) };
    this.updateLoopSlot(slot, (current) => (current === null ? null : { ...current, out: nudged }));
  }

  /**
   * Re-enters `slot` far enough before its out-point to hear the loop-back seam, and makes it the
   * active loop so the wrap actually happens. No-op for a slot that is not playable.
   *
   * Re-entry is a restore, not a replay — see `engageLoop` — and the pre-roll itself replays forward
   * on the live machine from that restored in-point, so the cost is bounded by the loop's own length
   * however deep the loop sits in the tune. Reaching the pre-roll point with `jumpToFrame` would
   * replay from `init` instead, reintroducing the stall a prior iteration removed.
   */
  auditionLoopOut(slot: number): void {
    if (slot < 0 || slot > 3) return;
    const loop = this.resolveLoopSlot(this.loopSlots()[slot] ?? null);
    if (loop === null) return;
    const machine = this.machine;
    const frame = this.frame;
    if (machine === null || frame === null) return;

    this.engageLoop(slot);

    const inFrame = resolvedFrame(loop.start);
    const prerollFrames = this.msToFrames(LOOP_AUDITION_PREROLL_MS);
    const target = Math.max(inFrame, loop.outFrame - prerollFrames);
    const framesToReplay = target - inFrame;
    if (framesToReplay <= 0) return;

    for (let i = 0; i < framesToReplay; i++) {
      let result: FrameResult;
      try {
        result = machine.runFrame();
      } catch (error) {
        this.fail(`the loop audition for slot ${slot} failed during replay — ${describeError(error)}`);
        return;
      }
      if (!result.completed) {
        this.fail(`the loop audition for slot ${slot} exceeded its cycle budget during replay`);
        return;
      }
      frame.takeSnapshot(); // discarded — resets per-frame duplicate-write tracking only;
                             // the accumulated register values persist across the call regardless
    }

    this.framesRendered = target;
    this.queueResync();
  }

  /**
   * Re-enters `slot` at its in-point and makes it the active loop, immediately and without going
   * through the queue — a setup gesture on a specific slot, not a performance punch, mirroring
   * `auditionLoopOut`. Unlike the out-point audition there is no seam ahead to pre-roll toward:
   * restoring the in-point snapshot is itself the audible feedback. No-op for a slot that is not
   * playable.
   */
  auditionLoopIn(slot: number): void {
    if (slot < 0 || slot > 3) return;
    if (this.resolveLoopSlot(this.loopSlots()[slot] ?? null) === null) return;
    this.engageLoop(slot);
  }

  /** Empties a slot, and lets go of it if it was the one playing or the one waiting to. */
  clearLoopSlot(slot: number): void {
    if (slot < 0 || slot > 3) return;
    this.updateLoopSlot(slot, () => null);
    if (this.activeLoopSlot() === slot) {
      this.activeLoopSlot.set(null);
    }
    if (this.queuedLoopSlot() === slot) {
      this.queuedLoopSlot.set(null);
    }
  }

  /**
   * Punches a slot in: engages it now if nothing is looping, queues it behind the current lap if
   * something is. A slot that is not playable — an end missing, or ends nudged until they crossed —
   * is a no-op.
   *
   * The asymmetry with `stopLoop` is the point of the gesture: a punch is musical and waits for the
   * bar it is already in to finish, so the switch lands where the operator hears it land.
   */
  punchLoop(slot: number): void {
    if (slot < 0 || slot > 3) return;
    if (this.resolveLoopSlot(this.loopSlots()[slot] ?? null) === null) return;

    const active = this.activeLoopSlot();
    // Punching the slot already playing, with nothing waiting behind it, is a re-trigger — the same
    // gesture as re-hopping a cue.
    if (active === null || (active === slot && this.queuedLoopSlot() === null)) {
      this.engageLoop(slot);
      return;
    }
    // Newest punch wins, and playback is left alone to finish its lap.
    this.queuedLoopSlot.set(slot);
  }

  /**
   * Drops out of the loop at once, leaving playback running on linearly from wherever it is, and
   * forgets anything queued behind it.
   *
   * Deliberately immediate where a punched switch waits for the lap: stopping is a get-out, not a
   * musical transition.
   */
  stopLoop(): void {
    this.activeLoopSlot.set(null);
    this.queuedLoopSlot.set(null);
  }

  /**
   * How far the active slot is through its bounds, 0–100; 0 for every other slot, playable or not.
   *
   * Reads the published `stats` rather than the live counter, so it moves with the same
   * every-25-frames cadence the playhead does instead of demanding change detection per frame.
   */
  progressPercentFor(slot: number): number {
    if (slot !== this.activeLoopSlot()) return 0;
    const loop = this.resolveLoopSlot(this.loopSlots()[slot] ?? null);
    if (loop === null) return 0;

    const startFrame = resolvedFrame(loop.start);
    const span = loop.outFrame - startFrame;
    return clamp(((this.stats().framesRendered - startFrame) / span) * 100, 0, 100);
  }

  /**
   * The slot as `onTick` needs it: the point to restore, and the frame that triggers the restore.
   * Null unless both ends are marked and, with their nudges applied, still in order — ends that
   * have crossed or met describe no pass at all, and a loop running on them would re-enter on every
   * tick rather than play anything.
   */
  private resolveLoopSlot(slot: LoopSlot | null): ResolvedLoop | null {
    if (slot === null || slot.in === null || slot.out === null) return null;
    const outFrame = resolvedFrame(slot.out);
    return outFrame > resolvedFrame(slot.in) ? { start: slot.in, outFrame } : null;
  }

  /**
   * Re-enters a slot and makes it the one playing, dropping whatever was queued behind it.
   * Re-checks playability at the point of engagement — a queued slot's ends can be nudged across
   * each other while it waits, so the punch-time check alone isn't enough. Returns whether the
   * engage actually happened.
   */
  private engageLoop(slot: number): boolean {
    const resolved = this.resolveLoopSlot(this.loopSlots()[slot] ?? null);
    if (resolved === null) return false;
    this.restorePoint(resolved.start);
    this.activeLoopSlot.set(slot);
    this.queuedLoopSlot.set(null);
    return true;
  }

  private updateLoopSlot(slot: number, next: (current: LoopSlot | null) => LoopSlot | null): void {
    this.loopSlots.update((slots) => slots.map((s, i) => (i === slot ? next(s) : s)));
  }

  /** Jumps to `percent` of `ceilingFrames()`. */
  scrubTo(percent: number): void {
    if (this.machine === null) return;
    this.jumpToFrame(this.frameForPercent(percent));
  }

  /**
   * One emulated frame, one packet — including frames where nothing changed. A skipped packet loses
   * a frame on the cartridge's queue and the timing drifts.
   */
  private onTick(): void {
    const machine = this.machine;
    const frame = this.frame;
    if (machine === null || frame === null) {
      return;
    }

    if (this.midi.selectedPortId() === null) {
      this.fail('the MIDI output port disappeared — playback stopped');
      return;
    }

    // A sequence's packets ride the tick rather than arriving beside it: the cartridge counts every
    // SID-data packet as a frame and drains exactly one per timer tick, so anything injected between
    // ticks is a frame it never asked for and never drains. See `queueResync` and `beginRetune`.
    const step = this.pending.shift();
    if (step?.kind === 'packet') {
      this.sendFramePacket(buildSidDataPacket(step.snapshot));
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

    switch (step?.kind) {
      case 'gated-frame':
        // `markAllDirty()` first is load-bearing, not tidiness: `takeSnapshot()` compacts `values`
        // to one entry per *present* slot, so on an ordinary running frame `withVoiceGatesOff`'s
        // indices 22/23/24 would land on whichever registers the tune happened to write — leaving
        // the gates open and corrupting three unrelated registers, silently. Only an all-dirty
        // snapshot puts slot n at values[n]. Re-sending a single gate-off packet instead would not
        // work either: the tune rewrites its own control registers every frame.
        frame.markAllDirty();
        this.sendFramePacket(buildSidDataPacket(withVoiceGatesOff(frame.takeSnapshot())));
        break;
      case 'retime':
        // No SID packet: the recipe flushes the cartridge's queue on receipt, so a frame sent on
        // this tick is discarded anyway. Host and cartridge change rate in the same instant here,
        // which is the whole point of freezing the clock until now.
        this.setClockIntervalUs(this.effectiveIntervalUs());
        this.sendRecipe();
        break;
      case 'resync':
        frame.markAllDirty();
        this.sendFramePacket(buildSidDataPacket(frame.takeSnapshot()));
        break;
      default:
        this.sendFramePacket(buildSidDataPacket(frame.takeSnapshot()));
    }
    this.framesRendered++;
    if (this.framesRendered % this.anchorSnapshotFrameInterval() === 0) {
      this.recordAnchor();
    }
    const active = this.activeLoopSlot();
    if (active !== null) {
      const loop = this.resolveLoopSlot(this.loopSlots()[active] ?? null);
      if (loop === null) {
        // Ends nudged until they crossed describe no pass — drop out rather than re-enter every tick.
        this.stopLoop();
      } else if (this.framesRendered >= loop.outFrame) {
        const queued = this.queuedLoopSlot();
        if (queued === null) {
          // A restore, not a replay: the pass costs nothing per frame however deep the entry sits.
          this.restorePoint(loop.start);
        } else if (!this.engageLoop(queued)) {
          // The lap the punch waited for is over, but the queued slot's ends were nudged across
          // each other while it waited — nothing playable to switch to, so drop out.
          this.stopLoop();
        }
        return; // the resync it queued goes out on the next tick; don't publish stats twice
      }
    }
    if (++this.framesSincePublish >= STATS_PUBLISH_FRAME_INTERVAL) {
      this.publishStats();
    }
  }

  private selectSubtune(song: number): void {
    if (this.machine === null) {
      return;
    }
    const clamped = clamp(song, 1, this.subtuneCount());
    // A subtune can carry a different multispeed — initSubtune() bumps tuneRevision on success, so
    // slowestSpeed re-resolves against whichever subtune actually loaded.
    if (clamped === this.currentSubtune() || !this.initSubtune(clamped)) {
      return;
    }
    // The tick rate itself also has to be re-resolved.
    this.applyIntervalChange();
  }

  /** Re-inits the machine and marks every register dirty, so the chip cannot inherit the old state. */
  private initSubtune(song: number): boolean {
    const machine = this.machine;
    const frame = this.frame;
    if (machine === null || frame === null) {
      return false;
    }

    const clamped = clamp(song, 1, this.subtuneCount());
    try {
      const result = machine.initSubtune(clamped);
      if (!result.completed) {
        logWarn(
          `DJ engine: subtune ${clamped} init ran out of cycles (${result.cyclesUsed}) — playing it anyway.`
        );
      }
    } catch (error) {
      this.fail(`subtune ${clamped} could not be initialised — ${describeError(error)}`);
      return false;
    }

    frame.markAllDirty();
    this.framesRendered = 0;
    // The ring is dropped rather than carried: its entries describe a machine that no longer exists,
    // at frame numbers the reset counter has just invalidated. Cues and the loop's entry survive
    // this deliberately — each owns its own anchor, so none of them needs the ring to persist.
    this.anchorRing = [];
    this.recordAnchor();
    // This subtune's CIA multispeed is now resolved on the machine, so slowestSpeed's floor may have
    // moved — see the constructor-time comment on tuneRevision.
    this.tuneRevision.update((revision) => revision + 1);
    this.currentSubtune.set(clamped);
    this.lastError.set(null);
    return true;
  }

  /** Frames in the fixed jump ceiling at the current nominal interval. Was a private method.
   * Ignores multispeed deliberately: for a callsPerFrame > 1 tune the ceiling represents a shorter
   * real-world duration than JUMP_CEILING_SECONDS, since more play-calls land in the same frame
   * count. Acceptable simplification for this iteration — most of the tune list is callsPerFrame 1. */
  readonly ceilingFrames = computed<number>(() =>
    Math.round((JUMP_CEILING_SECONDS * MICROSECONDS_PER_SECOND) / this.nominalIntervalUs())
  );
  // Known, accepted coupling: this reads the same nominalIntervalUs signal the existing Timing panel
  // lets a tester change mid-session (50.125 / 19975 / 20000 µs), so a scrub percentage resolves to a
  // slightly different frame after such a change — well under 1%, and cheaper to accept than to
  // snapshot the interval at tune-load time for a session-only spike control. Cues and the loop are
  // frame-denominated and unaffected.

  /** Current playback position as a percentage of the ceiling, for the playhead. Clamped to 0–100
   * because JUMP_CEILING_SECONDS is a fixed fiction, not the tune's real length — past ~5 PAL minutes
   * of continuous play framesRendered/ceilingFrames exceeds 100% and the thumb should pin, not
   * overflow. */
  readonly positionPercent = computed<number>(() => {
    const ceiling = this.ceilingFrames();
    return ceiling === 0 ? 0 : clamp((this.stats().framesRendered / ceiling) * 100, 0, 100);
  });

  private frameForPercent(percent: number): number {
    const clamped = clamp(percent, 0, 100);
    return Math.round((clamped / 100) * this.ceilingFrames());
  }

  /**
   * The shared silent-replay primitive: rebuilds the tune from a clean `init` on a throwaway
   * machine/frame pair, runs it forward frame-by-frame with output discarded, then emits the
   * accumulated state as one resync packet and adopts the replayed pair as live.
   *
   * A fresh `C64Machine` + `RegisterFrame` pair, never the live one — reusing the live pair would let
   * RAM state from wherever playback currently is bleed into the replay.
   */
  private jumpToFrame(targetFrame: number): void {
    const file = this.file;
    if (file === null || this.machine === null || this.frame === null) return;
    const clampedTarget = Math.max(0, Math.round(targetFrame));

    const replayFrame = new RegisterFrame();
    this.effectiveMutes().forEach((muted, voice) => replayFrame.setVoiceMuted(voice, muted));
    const replayMachine = new C64Machine(file, replayFrame);

    try {
      replayMachine.initSubtune(this.currentSubtune());
    } catch (error) {
      this.fail(`jump to frame ${clampedTarget} failed during init — ${describeError(error)}`);
      return;
    }

    for (let i = 0; i < clampedTarget; i++) {
      let result: FrameResult;
      try {
        result = replayMachine.runFrame();
      } catch (error) {
        this.fail(`jump to frame ${clampedTarget} failed during replay — ${describeError(error)}`);
        return;
      }
      if (!result.completed) {
        this.fail(`jump to frame ${clampedTarget} exceeded its cycle budget during replay`);
        return;
      }
      replayFrame.takeSnapshot(); // discarded — resets per-frame duplicate-write tracking only;
                                  // the accumulated register values persist across the call regardless
    }

    this.machine = replayMachine;
    this.frame = replayFrame;
    this.framesRendered = clampedTarget;
    this.queueResync();
  }

  /**
   * Snapshots the live machine at the current position and pairs it with an anchor from the ring.
   * Returns null when no tune is loaded.
   *
   * `offset` starts at 0, so the resolved snapshot *is* the captured one — capture costs a copy and
   * no replay.
   */
  private captureAnchoredPoint(): CapturedPoint | null {
    const machine = this.machine;
    const frame = this.frame;
    if (machine === null || frame === null) return null;

    const anchor = this.selectAnchor(this.framesRendered);
    if (anchor === null) return null;

    return {
      frame: this.framesRendered,
      offset: 0,
      machine: machine.snapshot(),
      registers: frame.snapshotValues(),
      anchor,
    };
  }

  /**
   * The newest ring entry far enough back that a full backward nudge from `frame` still lands after
   * it, falling back to the frame-0 seed.
   */
  private selectAnchor(frame: number): PositionAnchor | null {
    const latestUsable = frame - this.nudgeRangeFrames();
    for (let i = this.anchorRing.length - 1; i >= 0; i--) {
      if (this.anchorRing[i].frame <= latestUsable) {
        return this.anchorRing[i];
      }
    }
    return this.anchorRing[0] ?? null;
  }

  /** Adds the live machine to the ring, dropping the oldest non-seed entry once it is full. */
  private recordAnchor(): void {
    const machine = this.machine;
    const frame = this.frame;
    if (machine === null || frame === null) return;

    this.anchorRing.push({
      frame: this.framesRendered,
      machine: machine.snapshot(),
      registers: frame.snapshotValues(),
    });
    if (this.anchorRing.length > ANCHOR_RING_SIZE) {
      this.anchorRing.splice(1, 1);
    }
  }

  /**
   * Replays forward from `point.anchor` to `point.frame + newOffset`, returning the resolved point.
   * Returns null and fails the engine if the replay cannot complete.
   *
   * Deliberately does *not* adopt the throwaway pair as live the way `jumpToFrame` does: a nudge is
   * a setup gesture and must leave playback exactly where it is.
   */
  private resolvePoint(point: CapturedPoint, newOffset: number): CapturedPoint | null {
    const file = this.file;
    if (file === null) return null;

    const target = resolvedFrame({ ...point, offset: newOffset });
    const replayFrame = new RegisterFrame();
    this.effectiveMutes().forEach((muted, voice) => replayFrame.setVoiceMuted(voice, muted));
    const replayMachine = new C64Machine(file, replayFrame);
    replayMachine.restore(point.anchor.machine);
    replayFrame.restoreValues(point.anchor.registers);

    for (let i = point.anchor.frame; i < target; i++) {
      let result: FrameResult;
      try {
        result = replayMachine.runFrame();
      } catch (error) {
        this.fail(`the cue nudge to frame ${target} failed during replay — ${describeError(error)}`);
        return null;
      }
      if (!result.completed) {
        this.fail(`the cue nudge to frame ${target} exceeded its cycle budget during replay`);
        return null;
      }
      replayFrame.takeSnapshot(); // discarded — clears per-frame duplicate-write tracking only
    }

    return {
      ...point,
      offset: newOffset,
      machine: replayMachine.snapshot(),
      registers: replayFrame.snapshotValues(),
    };
  }

  /**
   * Puts a captured point back onto the live machine: restore, adopt its frame number, resync.
   *
   * No emulation, so the main thread never stalls and the frame clock (a main-thread
   * `ScriptProcessorNode`) keeps ticking straight through. That stall is what made a deep cue hop —
   * and a loop with a deep entry — hold its last note: with the thread blocked, no packets went out
   * and the SID simply kept sounding whatever it was last told.
   */
  private restorePoint(point: CapturedPoint): void {
    const machine = this.machine;
    const frame = this.frame;
    if (machine === null || frame === null) return;

    machine.restore(point.machine);
    frame.restoreValues(point.registers);
    // The stored snapshot is the nudged one, so the counter has to name the frame it actually is —
    // otherwise the playhead and the row's frame readout both drift by the offset.
    this.framesRendered = resolvedFrame(point);
    this.queueResync();
  }

  /**
   * Hands the chip-resync packets to the frame clock instead of sending them here.
   *
   * The cartridge treats every SID-data packet as one frame and drains exactly one per timer tick,
   * so a packet injected between ticks is a frame it never drains: the queue grows by that much and
   * stays grown until the re-timer claws it back. Two packets per hop, hopped repeatedly, walks the
   * queue straight into the overflow that resets it — an audible dropout. Riding the tick keeps the
   * rate at exactly one packet per frame no matter how hard the cue buttons are hit.
   *
   * The gate-off leads in a packet of its own so it drains a whole frame ahead of the resync, giving
   * every voice a real release window before it re-attacks. Folding both into one packet via the
   * ASID secondary gate slots would halve the frames but collapse that window to a few cycles.
   *
   * Costs the hop up to two frames of latency (~40 ms at 50 Hz), which is well under what a hand
   * hitting a cue button can hear.
   */
  private queueResync(): void {
    const frame = this.frame;
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
      this.sendFramePacket(buildSidDataPacket(outgoing));
      this.publishStats();
      return;
    }

    // Replaces any sequence still owed rather than appending to it. Spamming hops then costs one
    // packet per tick forever, instead of building a backlog that plays every hop the button ever
    // took — the newest hop is always the one that lands.
    this.pending = [
      { kind: 'packet', snapshot: buildVoiceGateOffSnapshot() },
      { kind: 'packet', snapshot },
    ];
  }

  /**
   * Queues the managed retune: a lead of gated frames, then the tick that re-times both ends, then
   * the one that brings the sound back.
   *
   * The cartridge discards its whole buffer on receiving a recipe and refills before it resumes,
   * and nothing here can prevent that — only control what the chip is holding when it happens. The
   * lead is what makes that buffer's contents silent; the tune plays on through it regardless, so
   * the sequence costs the tune's place nothing.
   *
   * Assigns rather than appends: a second speed change mid-sequence starts a fresh lead rather than
   * stacking dropouts.
   */
  private beginRetune(): void {
    this.pending = [
      ...Array.from({ length: RETUNE_GATE_LEAD_FRAMES }, () => ({ kind: 'gated-frame' } as const)),
      { kind: 'retime' },
      { kind: 'resync' },
    ];
  }

  /**
   * Where the "one instant" rule lives: in `clock-and-recipe` the clock is *not* moved here, so the
   * host never feeds a rate the cartridge is not pacing. `beginRetune`'s `retime` step moves both.
   */
  private applyIntervalChange(): void {
    if (this.state() !== 'playing') {
      // Nothing is pacing anything — `play()` reads the interval fresh when it starts the clock.
      this.publishStats();
      return;
    }
    if (this.speedMode() === 'clock-only' || !this.recipeEnabled()) {
      // No recipe goes out in these modes, so there is no cartridge-side rate to disagree with and
      // the clock can follow the fader live. That is the whole point of `clock-only`.
      this.setClockIntervalUs(this.effectiveIntervalUs());
      this.publishStats();
      return;
    }
    this.publishStats();
    this.scheduleRetune();
  }

  private scheduleRetune(): void {
    this.clearRecipeResend();
    this.recipeResendTimer = setTimeout(() => {
      this.recipeResendTimer = null;
      if (this.state() === 'playing') {
        this.beginRetune();
      }
    }, RECIPE_RESEND_DEBOUNCE_MS);
  }

  /** Moves the clock and records what it is now pacing, so diagnostics report the rate actually
   *  running rather than the one the fader has already asked for. */
  private setClockIntervalUs(intervalUs: number): void {
    this.clock.setIntervalUs(intervalUs);
    this.runningIntervalUs = intervalUs;
  }

  private clearRecipeResend(): void {
    if (this.recipeResendTimer !== null) {
      clearTimeout(this.recipeResendTimer);
      this.recipeResendTimer = null;
    }
  }

  private sendRecipe(): void {
    const file = this.file;
    const machine = this.machine;
    if (file === null || machine === null) {
      return;
    }

    this.sendControl(
      buildFramerateRecipePacket({
        ntsc: file.clock === 'ntsc',
        // The cartridge only displays this; its timer runs off the interval below. Leaving it at 1
        // while sending a divided interval would describe the stream incorrectly.
        speedMultiplier: machine.callsPerFrame,
        bufferingRequested: true,
        frameIntervalUs: clamp(Math.round(this.effectiveIntervalUs()), 0, RECIPE_MAX_INTERVAL_US),
      })
    );
    this.recipeSent.set(true);
    this.recipeResends++;
    this.publishStats();
  }

  /**
   * The real inter-packet time. Multispeed is a tick rate, never a batch: `runFrame` plays the
   * routine once, so a 2x tune ticks twice per video frame at half the interval.
   */
  private effectiveIntervalUs(): number {
    const callsPerFrame = this.machine?.callsPerFrame ?? 1;
    return this.nominalIntervalUs() / this.speedMultiplier() / callsPerFrame;
  }

  private sendFramePacket(packet: Uint8Array): void {
    const aheadMs = this.scheduleAheadMs();
    if (aheadMs > 0) {
      this.midi.send(packet, performance.now() + aheadMs);
    } else {
      this.midi.send(packet);
    }
    this.packetsSent++;
    this.bytesSent += packet.length;
  }

  private sendControl(packet: Uint8Array): void {
    this.midi.send(packet);
    this.packetsSent++;
    this.bytesSent += packet.length;
  }

  /** Stops playback and records why, leaving the page usable without a reload. */
  private fail(reason: string): void {
    this.clock.stop();
    this.clearRecipeResend();
    this.lastError.set(reason);
    this.state.set('error');
    this.publishStats();
    logError(`DJ engine: ${reason}`);
  }

  private resetCounters(): void {
    this.framesRendered = 0;
    this.packetsSent = 0;
    this.bytesSent = 0;
    this.recipeResends = 0;
    this.pending = [];
  }

  /**
   * The interval the diagnostics readout reports: what the clock is running, not what the fader has
   * asked for. The two differ for the length of a retune's debounce plus its gate lead, and the
   * readout is the acceptance instrument for that sequence — reporting the derived value there
   * would have it claim a rate nothing is pacing yet.
   */
  private reportedIntervalUs(): number {
    if (this.file === null) return 0;
    return this.state() === 'playing' && this.runningIntervalUs !== null
      ? this.runningIntervalUs
      : this.effectiveIntervalUs();
  }

  private publishStats(): void {
    const clockStats = this.clock.stats;
    this.framesSincePublish = 0;
    this.stats.set({
      framesRendered: this.framesRendered,
      packetsSent: this.packetsSent,
      bytesSent: this.bytesSent,
      recipeResends: this.recipeResends,
      suppressedWrites: this.frame?.suppressedWriteCount ?? 0,
      illegalOpcodeCount: this.machine?.illegalOpcodeCount ?? 0,
      callsPerFrame: this.machine?.callsPerFrame ?? 1,
      effectiveIntervalUs: this.reportedIntervalUs(),
      measuredMeanIntervalUs: clockStats.measuredMeanIntervalUs,
      driftMs: clockStats.driftMs,
      jitterMs: clockStats.jitterMs,
      worstGapMs: clockStats.worstGapMs,
      lateCallbacks: clockStats.lateCallbacks,
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
 * Callers are a jump landing while paused, and each gated frame of a retune's lead.
 */
function withVoiceGatesOff(snapshot: FrameSnapshot): FrameSnapshot {
  const values = [...snapshot.values];
  values[22] = 0;
  values[23] = 0;
  values[24] = 0;
  return { ...snapshot, values };
}

/** Where a point actually sits once its nudge is applied — never before the start of the tune. */
function resolvedFrame(point: { readonly frame: number; readonly offset: number }): number {
  return Math.max(0, point.frame + point.offset);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
