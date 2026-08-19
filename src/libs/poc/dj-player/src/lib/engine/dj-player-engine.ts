import { inject, Injectable, InjectionToken, OnDestroy, signal } from '@angular/core';
import { logError, logInfo, LogType, logWarn } from '@teensyrom-nx/utils';
import { NTSC_FRAME_INTERVAL_US, PAL_FRAME_INTERVAL_US } from '../asid/asid-constants';
import {
  buildFramerateRecipePacket,
  buildSidDataPacket,
  buildSidTypePacket,
  buildStartPacket,
  buildStopPacket,
} from '../asid/asid-encoder';
import { RegisterFrame } from '../asid/register-frame';
import type { FrameSnapshot } from '../asid/register-frame';
import { C64Machine } from '../cpu/c64-machine';
import type { FrameResult } from '../cpu/c64-machine';
import type { SidFile } from '../sid/sid-file.model';
import { MidiOutputService } from '../midi/midi-output.service';
import type { FrameClock } from '../clock/frame-clock';

export type EngineState = 'stopped' | 'playing' | 'paused' | 'error';
export type SpeedMode = 'clock-only' | 'clock-and-recipe';

/** Counters and measurements the diagnostics panel reads. */
export interface EngineStats {
  readonly framesRendered: number;
  readonly packetsSent: number;
  readonly recipeResends: number;
  readonly suppressedWrites: number;
  /** The tune's multispeed: how many ticks the engine runs per video frame. */
  readonly callsPerFrame: number;
  readonly effectiveIntervalUs: number;
  readonly measuredMeanIntervalUs: number;
  readonly driftMs: number;
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

/**
 * How long a speed change settles before `clock-and-recipe` mode resends the recipe.
 *
 * Every resend costs the cartridge four blocking queue drains plus four lines printed to the C64
 * screen, so a fader sweep at 150 ms stacks interruptions faster than the cartridge clears them.
 * Retune it here: finding the window at which stepped speed changes stop sounding broken is part of
 * the experiment.
 */
export const RECIPE_RESEND_DEBOUNCE_MS = 500;

/** `$D404`, `$D40B`, `$D412` — the per-voice control registers whose bit 0 is the gate. */
const VOICE_CONTROL_REGISTERS: readonly number[] = [4, 11, 18];

/**
 * Frames between `stats` publishes. A signal write per frame would run Angular change detection at
 * the frame rate, which is jitter this experiment cannot afford.
 */
const STATS_PUBLISH_FRAME_INTERVAL = 25;

const RECIPE_MAX_INTERVAL_US = 0xffff;

const EMPTY_STATS: EngineStats = {
  framesRendered: 0,
  packetsSent: 0,
  recipeResends: 0,
  suppressedWrites: 0,
  callsPerFrame: 1,
  effectiveIntervalUs: 0,
  measuredMeanIntervalUs: 0,
  driftMs: 0,
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

  private file: SidFile | null = null;
  private machine: C64Machine | null = null;
  private frame: RegisterFrame | null = null;
  private recipeResendTimer: ReturnType<typeof setTimeout> | null = null;
  private framesRendered = 0;
  private packetsSent = 0;
  private recipeResends = 0;
  private framesSincePublish = 0;

  /** Rebuilds the machine and register frame for `file` and initialises its start subtune. */
  loadTune(file: SidFile): void {
    if (this.state() === 'playing' || this.state() === 'paused') {
      this.clock.stop();
      this.sendControl(buildStopPacket());
    }
    this.clearRecipeResend();

    this.file = file;
    this.frame = new RegisterFrame();
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
    this.currentSubtune.set(clamped);
    this.lastError.set(null);
    return true;
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
  }

  private sendControl(packet: Uint8Array): void {
    this.midi.send(packet);
    this.packetsSent++;
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
    this.recipeResends = 0;
  }

  private publishStats(): void {
    const clockStats = this.clock.stats;
    this.framesSincePublish = 0;
    this.stats.set({
      framesRendered: this.framesRendered,
      packetsSent: this.packetsSent,
      recipeResends: this.recipeResends,
      suppressedWrites: this.frame?.suppressedWriteCount ?? 0,
      callsPerFrame: this.machine?.callsPerFrame ?? 1,
      effectiveIntervalUs: this.file === null ? 0 : this.effectiveIntervalUs(),
      measuredMeanIntervalUs: clockStats.measuredMeanIntervalUs,
      driftMs: clockStats.driftMs,
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
