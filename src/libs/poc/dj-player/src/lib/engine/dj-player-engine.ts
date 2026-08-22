import { inject, Injectable, InjectionToken, OnDestroy, signal } from '@angular/core';
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

/**
 * A captured position, held as restorable state rather than as a frame number.
 *
 * `frame` is carried only so the diagnostics and stats stay honest about where a hop landed; the
 * machine and register snapshots are what actually make the return trip.
 */
export interface CueSlot {
  readonly frame: number;
  readonly machine: MachineSnapshot;
  readonly registers: RegisterValuesSnapshot;
}

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

/** Enough range to feel latency and hear pitch move — a tuning parameter, not a product decision. */
export const MIN_SPEED_MULTIPLIER = 0.8;
export const MAX_SPEED_MULTIPLIER = 1.2;

const MICROSECONDS_PER_SECOND = 1_000_000;
/** The assumed length loop/scrub percentages are measured against — not the tune's real,
 * unmeasured length. A single tunable constant, not derived from anything about the file. */
export const JUMP_CEILING_SECONDS = 300;

/**
 * How long a speed change settles before `clock-and-recipe` mode resends the recipe.
 *
 * Every resend costs the cartridge four blocking queue drains plus four lines printed to the C64
 * screen, so a fader sweep at 150 ms stacks interruptions faster than the cartridge clears them.
 * Retune it here: finding the window at which stepped speed changes stop sounding broken is part of
 * the experiment.
 */
export const RECIPE_RESEND_DEBOUNCE_MS = 500;

/**
 * Frames between `stats` publishes. A signal write per frame would run Angular change detection at
 * the frame rate, which is jitter this experiment cannot afford.
 */
const STATS_PUBLISH_FRAME_INTERVAL = 25;

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
  readonly speedMode = signal<SpeedMode>('clock-only');
  readonly recipeEnabled = signal<boolean>(true);
  readonly nominalIntervalUs = signal<number>(PAL_FRAME_INTERVAL_US);
  readonly scheduleAheadMs = signal<number>(0);
  readonly lastError = signal<string | null>(null);
  readonly stats = signal<EngineStats>(EMPTY_STATS);
  readonly mutedVoices = signal<readonly boolean[]>([false, false, false]);
  readonly cues = signal<readonly (CueSlot | null)[]>([null, null, null, null]);
  readonly loopInPercent = signal<number>(0);
  readonly loopOutPercent = signal<number>(100);
  readonly loopEnabled = signal<boolean>(false);

  private file: SidFile | null = null;
  private machine: C64Machine | null = null;
  private frame: RegisterFrame | null = null;
  private recipeResendTimer: ReturnType<typeof setTimeout> | null = null;
  private framesRendered = 0;
  private packetsSent = 0;
  private bytesSent = 0;
  private recipeResends = 0;
  private framesSincePublish = 0;
  /** Resync packets a jump still owes the stream, drained one per tick by `onTick`. */
  private pendingResync: FrameSnapshot[] = [];

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
    this.machine = new C64Machine(file, this.frame);
    this.subtuneCount.set(Math.max(1, file.songs));
    this.nominalIntervalUs.set(
      file.clock === 'ntsc' ? NTSC_FRAME_INTERVAL_US : PAL_FRAME_INTERVAL_US
    );
    this.resetCounters();

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
    this.pendingResync = [];
    this.sendControl(buildSidDataPacket(buildVoiceGateOffSnapshot()));
    this.state.set('paused');
    this.publishStats();
    logInfo(LogType.Paused, 'DJ engine: paused, voices gated off.');
  }

  /** Stops the clock, tells the cartridge to leave ASID mode, and resets the machine. */
  stop(): void {
    this.clock.stop();
    this.clearRecipeResend();
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
   * Voice 0/1/2. Replicates the firmware's own hardware-mute technique: forces that voice's control
   * register to 0 once, then drops every further write the tune's code makes to it until unmuted.
   */
  setVoiceMuted(voice: number, muted: boolean): void {
    if (voice < 0 || voice > 2) return;
    this.mutedVoices.update((voices) => voices.map((v, i) => (i === voice ? muted : v)));
    this.frame?.setVoiceMuted(voice, muted);
  }

  /** Clamped to 0.8–1.2. A divisor on the clock and nothing else, which is why it is nearly free. */
  setSpeed(multiplier: number): void {
    if (!Number.isFinite(multiplier)) {
      return;
    }
    this.speedMultiplier.set(clamp(multiplier, MIN_SPEED_MULTIPLIER, MAX_SPEED_MULTIPLIER));
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
   * `clock-only` changes the interval alone — smooth, but the cartridge's frame timer stays seeded
   * to the old rate. `clock-and-recipe` also resends the recipe, which stops the cartridge's
   * playback timer, blocks while it drains the queue and re-initialises it: a hard interruption
   * rather than a glitch.
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
   */
  addCue(slot: number): void {
    if (slot < 0 || slot > 3) return;
    const machine = this.machine;
    const frame = this.frame;
    if (machine === null || frame === null) return;

    const cue: CueSlot = {
      frame: this.framesRendered,
      machine: machine.snapshot(),
      registers: frame.snapshotValues(),
    };
    this.cues.update((cues) => cues.map((c, i) => (i === slot ? cue : c)));
  }

  /**
   * Returns to a captured cue slot in constant time; a no-op for an empty slot.
   *
   * Restores the snapshot onto the live machine and resyncs the chip — no emulation, so the main
   * thread never stalls and the frame clock (a main-thread `ScriptProcessorNode`) keeps ticking
   * straight through. That stall is what made a deep cue hop hold its last note: with the thread
   * blocked, no packets went out and the SID simply kept sounding whatever it was last told.
   */
  hopToCue(slot: number): void {
    const cue = this.cues()[slot] ?? null;
    const machine = this.machine;
    const frame = this.frame;
    if (cue === null || machine === null || frame === null) return;

    machine.restore(cue.machine);
    frame.restoreValues(cue.registers);
    this.framesRendered = cue.frame;
    this.queueResync();
  }

  /** Empties a cue slot, returning it to "Add". */
  clearCue(slot: number): void {
    if (slot < 0 || slot > 3) return;
    this.cues.update((cues) => cues.map((c, i) => (i === slot ? null : c)));
  }

  /** Sets the loop's in/out points as percentages of `ceilingFrames()`, ordered low-to-high. */
  setLoopRange(inPercent: number, outPercent: number): void {
    const clampedIn = clamp(inPercent, 0, 100);
    const clampedOut = clamp(outPercent, 0, 100);
    this.loopInPercent.set(Math.min(clampedIn, clampedOut));
    this.loopOutPercent.set(Math.max(clampedIn, clampedOut));
  }

  /** Arms or disarms looping; re-entry is checked in `onTick`. */
  setLoopEnabled(enabled: boolean): void {
    this.loopEnabled.set(enabled);
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

    // A jump's packets ride the tick rather than arriving beside it: the cartridge counts every
    // SID-data packet as a frame and drains exactly one per timer tick, so anything injected between
    // ticks is a frame it never asked for and never drains. See `queueResync`.
    const pending = this.pendingResync.shift();
    if (pending !== undefined) {
      this.sendFramePacket(buildSidDataPacket(pending));
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

    this.sendFramePacket(buildSidDataPacket(frame.takeSnapshot()));
    this.framesRendered++;
    if (this.loopEnabled() && this.framesRendered >= this.frameForPercent(this.loopOutPercent())) {
      this.jumpToFrame(this.frameForPercent(this.loopInPercent()));
      return; // the resync it queued goes out on the next tick; don't publish stats twice
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
    if (clamped === this.currentSubtune() || !this.initSubtune(clamped)) {
      return;
    }
    // A subtune can carry a different multispeed, so the tick rate has to be re-resolved.
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
    // Cues hold machine state now, not frame numbers, so this clear carries more weight than it did:
    // a re-init leaves any captured snapshot describing a machine that no longer exists. Every path
    // that rebuilds or re-inits — load, stop, play-from-stopped, subtune change — lands here.
    this.cues.set([null, null, null, null]);
    this.loopEnabled.set(false);
    this.currentSubtune.set(clamped);
    this.lastError.set(null);
    return true;
  }

  /** Ignores multispeed deliberately: for a callsPerFrame > 1 tune the ceiling represents a shorter
   * real-world duration than JUMP_CEILING_SECONDS, since more play-calls land in the same frame
   * count. Acceptable simplification for this iteration — most of the tune list is callsPerFrame 1. */
  private ceilingFrames(): number {
    return Math.round((JUMP_CEILING_SECONDS * MICROSECONDS_PER_SECOND) / this.nominalIntervalUs());
  }
  // Known, accepted coupling: this reads the same nominalIntervalUs signal the existing Timing panel
  // lets a tester change mid-session (50.125 / 19975 / 20000 µs). Changing it after a loop or cue is
  // set shifts the resolved frame count by well under 1% — negligible, and cheaper to accept than to
  // snapshot the interval at tune-load time for a session-only spike control.

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
    this.mutedVoices().forEach((muted, voice) => replayFrame.setVoiceMuted(voice, muted));
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
      this.pendingResync = [];
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
    this.pendingResync = [buildVoiceGateOffSnapshot(), snapshot];
  }

  private applyIntervalChange(): void {
    if (this.state() !== 'playing') {
      return;
    }
    this.clock.setIntervalUs(this.effectiveIntervalUs());
    this.publishStats();
    if (this.speedMode() === 'clock-and-recipe' && this.recipeEnabled()) {
      this.scheduleRecipeResend();
    }
  }

  private scheduleRecipeResend(): void {
    this.clearRecipeResend();
    this.recipeResendTimer = setTimeout(() => {
      this.recipeResendTimer = null;
      if (this.state() === 'playing') {
        this.sendRecipe();
      }
    }, RECIPE_RESEND_DEBOUNCE_MS);
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
    this.pendingResync = [];
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
      effectiveIntervalUs: this.file === null ? 0 : this.effectiveIntervalUs(),
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

/** After `markAllDirty()` + `takeSnapshot()`, slots 0-24 are present in ascending order with no
 * gaps, so `values` has exactly one entry per slot — indices 22/23/24 are the three voice control
 * registers. Returns a copy with those three forced to 0; used only when a jump lands while paused. */
function withVoiceGatesOff(snapshot: FrameSnapshot): FrameSnapshot {
  const values = [...snapshot.values];
  values[22] = 0;
  values[23] = 0;
  values[24] = 0;
  return { ...snapshot, values };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
