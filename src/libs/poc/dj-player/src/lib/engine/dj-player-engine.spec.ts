import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createEnvironmentInjector, EnvironmentInjector, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ASID_MSG_SID_DATA,
  ASID_MSG_SID_TYPE,
  ASID_MSG_START,
  ASID_MSG_STOP,
  PAL_FRAME_INTERVAL_US,
} from '../asid/asid-constants';
import { MidiOutputService } from '../midi/midi-output.service';
import { TUNE_INDEX_FORMAT_VERSION } from '../analysis/tune-index.model';
import type { TuneIndexRecord } from '../analysis/tune-index.model';
import type { SidClock, SidFile, SidModel } from '../sid/sid-file.model';
import type { FrameClock, FrameClockStats } from '../clock/frame-clock';
import { C64Machine } from '../cpu/c64-machine';
import { REPLAY_RUNNER } from '../replay/replay-runner';
import type { ReplayRequest, ReplayResponse, ReplayRunner } from '../replay/replay-runner';
import { replayToFrame } from '../replay/replay-to-frame';
import { DEFAULT_TIMING_MODE } from './play-rate';
import {
  DjPlayerEngine,
  FRAME_CLOCK,
  JUMP_CEILING_SECONDS,
  LOOP_AUDITION_PREROLL_MS,
  NUDGE_RANGE_MS,
  UNCANCELLABLE_SCHEDULE_AHEAD_CEILING_MS,
} from './dj-player-engine';

/** Bytes before the values in a SID data packet, plus the trailing `F7`. */
const SID_DATA_PACKET_OVERHEAD = 12;

/**
 * Replaces `ScriptProcessorFrameClock` — the only collaborator that needs a real audio graph and
 * real elapsed time. Ticking it by hand is what makes the frame contract testable at all; timing
 * itself is verified on hardware, by ear.
 */
class FakeFrameClock implements FrameClock {
  intervalUs = 0;
  running = false;
  startCount = 0;
  /** Set to reject the next `start()`, as a real `AudioContext.resume()` can outside a gesture. */
  startError: Error | null = null;
  stats: FrameClockStats = {
    framesEmitted: 0,
    measuredMeanIntervalUs: 0,
    nominalIntervalUs: 0,
    driftMs: 0,
    jitterMs: 0,
    worstGapMs: 0,
    lateCallbacks: 0,
  };

  private onFrame: ((dueAtMs: number, catchUpClamped: boolean) => void) | null = null;

  start(
    intervalUs: number,
    onFrame: (dueAtMs: number, catchUpClamped: boolean) => void
  ): Promise<void> {
    this.startCount++;
    if (this.startError !== null) {
      return Promise.reject(this.startError);
    }
    this.intervalUs = intervalUs;
    this.onFrame = onFrame;
    this.running = true;
    return Promise.resolve();
  }

  setIntervalUs(intervalUs: number): void {
    this.intervalUs = intervalUs;
  }

  stop(): void {
    this.running = false;
  }

  tick(count = 1): void {
    for (let i = 0; i < count && this.running; i++) {
      // No measured time runs behind a hand-driven tick, so each frame is due as it is released —
      // and none of them comes out of a clamped catch-up.
      this.onFrame?.(performance.now(), false);
    }
  }

  /** Releases one frame with a caller-chosen due time and clamp flag — the only way a test gets a
   *  known lag, an out-of-order delivery time, or a catch-up-clamped frame, all of which `tick()`
   *  deliberately never produces. */
  tickWithDueAt(dueAtMs: number, catchUpClamped = false): void {
    if (this.running) {
      this.onFrame?.(dueAtMs, catchUpClamped);
    }
  }
}

/**
 * Replaces `WorkerReplayRunner`, the boundary onto the worker thread: jsdom has no `Worker`, and a
 * real one would answer on its own schedule — which is precisely what a supersede, a discard and a
 * mute-changed-mid-flight need held still to be observable at all.
 *
 * The replay itself is the production `replayToFrame`, so what lands here is what the worker would
 * have sent back.
 */
class FakeReplayRunner implements ReplayRunner {
  readonly requests: ReplayRequest[] = [];
  disposed = false;
  /** Holds every request until `resolveAll()`, so a test can drive the clock across one in flight. */
  manual = false;

  private readonly held: ((response: ReplayResponse) => void)[] = [];
  private readonly heldRequests: ReplayRequest[] = [];
  private settling: Promise<ReplayResponse>[] = [];

  run(request: ReplayRequest): Promise<ReplayResponse> {
    this.requests.push(request);
    const promise = this.manual
      ? new Promise<ReplayResponse>((resolve) => {
          this.held.push(resolve);
          this.heldRequests.push(request);
        })
      : Promise.resolve(answer(request));
    this.settling.push(promise);
    return promise;
  }

  dispose(): void {
    this.disposed = true;
  }

  /** Answers every held request, oldest first. */
  resolveAll(): void {
    const resolvers = this.held.splice(0);
    const requests = this.heldRequests.splice(0);
    resolvers.forEach((resolve, i) => resolve(answer(requests[i])));
  }

  /** Waits until every answered request has reached the engine. */
  async settle(): Promise<void> {
    while (this.settling.length > 0) {
      const batch = this.settling;
      this.settling = [];
      await Promise.all(batch);
    }
    // One more turn, so the engine's own continuation on the last response has run before the test
    // looks at what it did with it.
    await Promise.resolve();
  }
}

function answer(request: ReplayRequest): ReplayResponse {
  try {
    return {
      id: request.id,
      ok: true,
      result: replayToFrame(request.file, request.subtune, request.targetFrame, request.mutes),
    };
  } catch (error) {
    return {
      id: request.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

interface SentPacket {
  readonly bytes: Uint8Array;
  readonly timestampMs: number | undefined;
}

/**
 * Replaces `MidiOutputService`, the boundary onto Web MIDI. It keeps the one piece of state the
 * engine reads back — the selected port — so a port disappearing mid-playback can be simulated.
 */
class FakeMidiOutputService {
  readonly selectedPortId = signal<string | null>('port-1');
  /** The transport double for `MidiOutputService.supportsCancel` — see the file header comment on
   *  why this and `MIDIOutputLike.clear` are two separate fakes, not one. */
  readonly supportsCancel = signal<boolean>(false);
  readonly sent: SentPacket[] = [];
  cancelPendingCallCount = 0;
  /** What `cancelPending()` reports back — mirrors the real service's "true only if it actually
   *  cancelled" contract, so a test simulating a capable port sets this alongside `supportsCancel`. */
  cancelPendingReturns = false;

  send(bytes: Uint8Array, timestampMs?: number): void {
    this.sent.push({ bytes: Uint8Array.from(bytes), timestampMs });
  }

  cancelPending(): boolean {
    this.cancelPendingCallCount++;
    return this.cancelPendingReturns;
  }
}

interface CodeBlock {
  readonly at: number;
  readonly bytes: readonly number[];
}

interface TuneOptions {
  initAddress?: number;
  playAddress?: number;
  songs?: number;
  clock?: SidClock;
  model?: SidModel;
  blocks: readonly CodeBlock[];
}

/** Assembles hand-written blocks into a `SidFile` whose payload is the machine's memory image. */
function tune(options: TuneOptions): SidFile {
  const loadAddress = 0x1000;
  const codeEnd = options.blocks.reduce(
    (end, block) => Math.max(end, block.at + block.bytes.length),
    loadAddress
  );
  const data = new Uint8Array(codeEnd - loadAddress);
  for (const block of options.blocks) {
    data.set(block.bytes, block.at - loadAddress);
  }

  return {
    format: 'PSID',
    version: 2,
    loadAddress,
    initAddress: options.initAddress ?? loadAddress,
    playAddress: options.playAddress ?? 0x1010,
    songs: options.songs ?? 1,
    startSong: 1,
    speedFlags: 0,
    name: '',
    author: '',
    released: '',
    clock: options.clock ?? 'pal',
    model: options.model ?? 'unknown',
    secondSidAddress: null,
    thirdSidAddress: null,
    data,
  };
}

const RTS = 0x60;

/** init and play both return at once and touch no register — every frame after the first is silent. */
function silentTune(songs = 1): SidFile {
  return tune({
    songs,
    blocks: [
      { at: 0x1000, bytes: [RTS] },
      { at: 0x1010, bytes: [RTS] },
    ],
  });
}

/** init programs CIA 1 timer A for two play calls per frame; play still writes nothing. */
function doubleSpeedTune(): SidFile {
  // LDA #$63 / STA $DC04 / LDA #$26 / STA $DC05 / RTS — a latch of 9827, half a PAL frame.
  return tune({
    blocks: [
      { at: 0x1000, bytes: [0xa9, 0x63, 0x8d, 0x04, 0xdc, 0xa9, 0x26, 0x8d, 0x05, 0xdc, RTS] },
      { at: 0x1010, bytes: [RTS] },
    ],
  });
}

/** init programs CIA 1 timer A for exactly 2.4 play calls per frame — a rate that does not divide
 *  the frame evenly, ordinary for a CIA-timer tune and precisely the case rounding gets wrong. */
function fractionalSpeedTune(): SidFile {
  // LDA #$FD / STA $DC04 / LDA #$1F / STA $DC05 / RTS — latch $1FFD, 8190 cycles per call.
  return tune({
    blocks: [
      { at: 0x1000, bytes: [0xa9, 0xfd, 0x8d, 0x04, 0xdc, 0xa9, 0x1f, 0x8d, 0x05, 0xdc, RTS] },
      { at: 0x1010, bytes: [RTS] },
    ],
  });
}

/** init sets each voice's control register once, non-zero, and never touches it again; play
 * increments a zero-page counter and stores it into $D400 every frame. Mirrors `doubleSpeedTune`'s
 * hand-assembled-bytes style, but — unlike `silentTune` — its output actually depends on how many
 * frames ran, which is what the jump primitive's tests need. */
function counterTune(songs = 1): SidFile {
  return tune({
    songs,
    blocks: [
      {
        at: 0x1000,
        bytes: [
          0xa9, 0x11, // LDA #$11
          0x8d, 0x04, 0xd4, // STA $D404 (voice 1 control)
          0x8d, 0x0b, 0xd4, // STA $D40B (voice 2 control)
          0x8d, 0x12, 0xd4, // STA $D412 (voice 3 control)
          RTS,
        ],
      },
      {
        at: 0x1010,
        bytes: [
          0xe6, 0xfb, // INC $FB
          0xa5, 0xfb, // LDA $FB
          0x8d, 0x00, 0xd4, // STA $D400
          RTS,
        ],
      },
    ],
  });
}

/** Combines `doubleSpeedTune`'s CIA-programmed 2x rate with `counterTune`'s per-play-call counter,
 * so a nudge test can identify exactly which frame a 2x-multispeed tune landed on. */
function doubleSpeedCounterTune(): SidFile {
  return tune({
    blocks: [
      { at: 0x1000, bytes: [0xa9, 0x63, 0x8d, 0x04, 0xdc, 0xa9, 0x26, 0x8d, 0x05, 0xdc, RTS] },
      {
        at: 0x1010,
        bytes: [
          0xe6, 0xfb, // INC $FB
          0xa5, 0xfb, // LDA $FB
          0x8d, 0x00, 0xd4, // STA $D400
          RTS,
        ],
      },
    ],
  });
}

/** The play routine never returns, so the frame burns its whole cycle budget. */
function runawayTune(): SidFile {
  return tune({
    blocks: [
      { at: 0x1000, bytes: [RTS] },
      { at: 0x1010, bytes: [0x4c, 0x10, 0x10] }, // JMP $1010
    ],
  });
}

function packetsOfType(midi: FakeMidiOutputService, message: number): SentPacket[] {
  return midi.sent.filter((packet) => packet.bytes[2] === message);
}

function dataPackets(midi: FakeMidiOutputService): SentPacket[] {
  return packetsOfType(midi, ASID_MSG_SID_DATA);
}

function lastDataPacket(midi: FakeMidiOutputService): SentPacket {
  const packets = dataPackets(midi);
  if (packets.length === 0) {
    throw new Error('no SID data packet has been sent');
  }
  return packets[packets.length - 1];
}

/** How many registers a SID data packet carries. */
function valueCount(packet: SentPacket): number {
  return packet.bytes.length - SID_DATA_PACKET_OVERHEAD;
}

function messageSequence(midi: FakeMidiOutputService): number[] {
  return midi.sent.map((packet) => packet.bytes[2]);
}

/**
 * The engine's own `ceilingFrames` formula (`dj-player-engine.ts`), duplicated only to compute the
 * boundary values a scrub should land on — not a re-test of the formula itself.
 */
function expectedCeilingFrames(intervalUs = PAL_FRAME_INTERVAL_US): number {
  return Math.round((JUMP_CEILING_SECONDS * 1_000_000) / intervalUs);
}

/**
 * The engine's own pre-roll formula (`msToFrames` in `dj-player-engine.ts`), duplicated only to
 * compute the frame count an audition should land on — not a re-test of the formula itself.
 */
function expectedPrerollFrames(callsPerFrame = 1, intervalUs = PAL_FRAME_INTERVAL_US): number {
  return Math.round((LOOP_AUDITION_PREROLL_MS * 1000) / (intervalUs / callsPerFrame));
}

/** The value byte for a given present slot within a SID data packet (see `buildSidDataPacket`). */
function slotValue(packet: SentPacket, slot: number): number {
  return packet.bytes[SID_DATA_PACKET_OVERHEAD - 1 + slot];
}

/** After a jump's `markAllDirty()` snapshot, slots 22/23/24 are the three voice control registers
 * ($D404/$D40B/$D412) — see `withVoiceGatesOff` in `dj-player-engine.ts`. */
function voiceGateValues(packet: SentPacket): number[] {
  return [22, 23, 24].map((slot) => slotValue(packet, slot));
}

/** A minimal record, otherwise unused beyond `overrides` — its base identity as an object is what
 *  the round-trip test below cares about. */
function fakeTuneIndexRecord(overrides: Partial<TuneIndexRecord> = {}): TuneIndexRecord {
  return {
    filename: 'Test.sid',
    subtune: 1,
    loopStartFrame: null,
    loopPeriodFrames: null,
    endedAtFrame: null,
    sectionBoundaries: [],
    tonic: null,
    mode: null,
    camelot: null,
    tuningReferenceHz: null,
    tuningCents: null,
    keyConfidence: 'none',
    scalePitchClasses: [],
    dominantIntervalFrames: null,
    pulseConfidence: 'none',
    nativeTempo: null,
    callsPerFrame: 1,
    exactCallsPerFrame: 1,
    timingMode: DEFAULT_TIMING_MODE,
    formatVersion: TUNE_INDEX_FORMAT_VERSION,
    computedAt: '2026-08-29T00:00:00.000Z',
    ...overrides,
  };
}

describe('DjPlayerEngine', () => {
  let engine: DjPlayerEngine;
  let clock: FakeFrameClock;
  let midi: FakeMidiOutputService;
  let replay: FakeReplayRunner;

  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    clock = new FakeFrameClock();
    midi = new FakeMidiOutputService();
    replay = new FakeReplayRunner();

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        DjPlayerEngine,
        { provide: FRAME_CLOCK, useValue: clock },
        { provide: MidiOutputService, useValue: midi as unknown as MidiOutputService },
        { provide: REPLAY_RUNNER, useValue: replay },
      ],
    });
    engine = TestBed.inject(DjPlayerEngine);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends one SID data packet per tick, including frames that changed nothing', async () => {
    engine.loadTune(silentTune());
    await engine.play();

    clock.tick(3);

    const packets = dataPackets(midi);
    expect(packets).toHaveLength(3);
    // The first frame carries the whole chip because the subtune was just initialised; the tune
    // writes nothing after that, and those frames still each get a packet.
    expect(valueCount(packets[0])).toBe(25);
    expect(valueCount(packets[1])).toBe(0);
    expect(valueCount(packets[2])).toBe(0);
  });

  it('brackets playback with the ASID start and stop packets', async () => {
    engine.loadTune(silentTune());

    await engine.play();

    expect(messageSequence(midi)).toEqual([ASID_MSG_SID_TYPE, ASID_MSG_START]);

    clock.tick(2);
    engine.stop();

    expect(messageSequence(midi).at(-1)).toBe(ASID_MSG_STOP);
    expect(clock.running).toBe(false);
    expect(engine.state()).toBe('stopped');
  });

  it('carries every register again after a subtune change', async () => {
    engine.loadTune(silentTune(3));
    await engine.play();
    clock.tick(2);
    expect(valueCount(lastDataPacket(midi))).toBe(0);

    engine.nextSubtune();
    clock.tick(1);

    expect(engine.currentSubtune()).toBe(2);
    expect(valueCount(lastDataPacket(midi))).toBe(25);
  });

  it("clamps subtune stepping to the tune's range", async () => {
    engine.loadTune(silentTune(2));
    await engine.play();

    engine.previousSubtune();
    expect(engine.currentSubtune()).toBe(1);

    engine.nextSubtune();
    engine.nextSubtune();
    expect(engine.currentSubtune()).toBe(2);
  });

  it('resets mutedVoices to all-unmuted when a new tune loads', () => {
    engine.loadTune(silentTune());
    engine.setVoiceMuted(1, true);
    expect(engine.mutedVoices()).toEqual([false, true, false]);

    engine.loadTune(silentTune());

    expect(engine.mutedVoices()).toEqual([false, false, false]);
  });

  it('tuneIndex reflects whatever setTuneIndex was last given, including a reset to null', () => {
    const record = fakeTuneIndexRecord();
    expect(engine.tuneIndex()).toBeNull();

    engine.setTuneIndex(record);
    expect(engine.tuneIndex()).toBe(record);

    engine.setTuneIndex(null);
    expect(engine.tuneIndex()).toBeNull();
  });

  describe('momentary voice hold', () => {
    it('composes effectiveMutes as latched XOR held, in both directions', () => {
      engine.loadTune(silentTune());

      engine.setVoiceHeld(0, true); // audible -> held silences it
      expect(engine.effectiveMutes()).toEqual([true, false, false]);

      engine.setVoiceMuted(1, true);
      engine.setVoiceHeld(1, true); // checkbox-muted -> held makes it sound
      expect(engine.effectiveMutes()).toEqual([true, false, false]);
    });

    it('restores the latched state when the hold releases', () => {
      engine.loadTune(silentTune());
      engine.setVoiceMuted(0, true);

      engine.setVoiceHeld(0, true);
      expect(engine.effectiveMutes()[0]).toBe(false);

      engine.setVoiceHeld(0, false);
      expect(engine.effectiveMutes()[0]).toBe(true);
      expect(engine.mutedVoices()[0]).toBe(true);
    });

    it('honours a checkbox change made mid-hold once the button releases', () => {
      engine.loadTune(silentTune());

      engine.setVoiceHeld(0, true);
      expect(engine.effectiveMutes()[0]).toBe(true);

      engine.setVoiceMuted(0, true); // latched value toggled while still held
      expect(engine.effectiveMutes()[0]).toBe(false); // held still wins until release

      engine.setVoiceHeld(0, false);
      expect(engine.effectiveMutes()[0]).toBe(true); // release honours the new latched value
    });

    it('clears only the latched signal, leaving a held voice untouched', () => {
      engine.loadTune(silentTune());
      engine.setVoiceMuted(0, true);
      engine.setVoiceMuted(1, true);
      engine.setVoiceHeld(1, true);

      engine.clearVoiceMutes();

      expect(engine.mutedVoices()).toEqual([false, false, false]);
      expect(engine.heldVoices()).toEqual([false, true, false]);
      expect(engine.effectiveMutes()).toEqual([false, true, false]);
    });

    it('is a no-op for an out-of-range voice', () => {
      engine.loadTune(silentTune());

      engine.setVoiceHeld(3, true);
      engine.setVoiceHeld(-1, true);

      expect(engine.heldVoices()).toEqual([false, false, false]);
    });
  });

  it('gates the voices off on pause and restores the chip on resume', async () => {
    engine.loadTune(silentTune());
    await engine.play();
    clock.tick(2);

    engine.pause();

    expect(engine.state()).toBe('paused');
    expect(clock.running).toBe(false);
    // $D404, $D40B and $D412 only — enough to release every note.
    expect(valueCount(lastDataPacket(midi))).toBe(3);

    await engine.play();
    clock.tick(1);

    expect(engine.state()).toBe('playing');
    expect(valueCount(lastDataPacket(midi))).toBe(25);
  });

  it('ticks a multispeed tune faster rather than batching its play calls', async () => {
    engine.loadTune(doubleSpeedTune());

    await engine.play();
    clock.tick(1);

    expect(clock.intervalUs).toBe(PAL_FRAME_INTERVAL_US / 2);
    expect(dataPackets(midi)).toHaveLength(1);
  });

  describe('timing mode', () => {
    it('paces a fractional-rate tune at the exact rate by default, and re-resolves the running clock to the rounded rate live, with no reload', async () => {
      engine.loadTune(fractionalSpeedTune());
      await engine.play();
      expect(clock.intervalUs).toBeCloseTo(PAL_FRAME_INTERVAL_US / 2.4, 6);

      engine.setTimingMode('rounded');

      // The clock itself moved to the rounded rate, not merely `timingMode()` flipping — proof this
      // re-resolves the clock rather than only setting a signal.
      expect(engine.timingMode()).toBe('rounded');
      expect(clock.intervalUs).toBeCloseTo(PAL_FRAME_INTERVAL_US / 2, 6);
    });
  });

  it('divides the clock interval by the speed multiplier, clamped to the input span', async () => {
    engine.loadTune(silentTune());
    await engine.play();

    engine.setSpeed(1.3);
    expect(clock.intervalUs).toBeCloseTo(PAL_FRAME_INTERVAL_US / 1.3, 6);

    engine.setSpeed(5);
    expect(engine.speedMultiplier()).toBe(1.5);

    engine.setSpeed(-5);
    expect(engine.speedMultiplier()).toBe(0.5);
  });

  describe('the speed floor', () => {
    it('resolves the 0.3 hard span on a normal PAL tune', () => {
      engine.loadTune(silentTune());

      expect(engine.slowestSpeed()).toBeCloseTo(0.3, 6);
    });

    it('resolves the same 0.3 hard span on an NTSC tune and on a 2x-multispeed one', () => {
      engine.loadTune(tune({ clock: 'ntsc', blocks: [{ at: 0x1000, bytes: [RTS] }] }));
      expect(engine.slowestSpeed()).toBeCloseTo(0.3, 6);

      engine.loadTune(doubleSpeedTune());
      expect(engine.slowestSpeed()).toBeCloseTo(0.3, 6);
    });

    it('carries a down jump all the way to the hard span, with nothing narrowing it', async () => {
      engine.loadTune(silentTune());
      await engine.play();
      engine.setSpeed(0.5); // the fader minimum

      engine.jumpSpeedDown(); // additive from 0.5 lands under the span, so it clamps up to it

      expect(engine.speedMultiplier()).toBeCloseTo(0.3, 6);
      expect(clock.intervalUs).toBeCloseTo(PAL_FRAME_INTERVAL_US / 0.3, 6);
    });
  });

  describe('the speed jump excursion', () => {
    it('jumps additively from the current value, clamped to the hard range', () => {
      engine.loadTune(silentTune());
      engine.setSpeed(1.15);

      engine.jumpSpeedUp();
      expect(engine.speedMultiplier()).toBeCloseTo(1.65, 6);

      engine.homeSpeed(); // close the excursion before the next one opens
      engine.setSpeed(1.15);
      engine.jumpSpeedDown();
      expect(engine.speedMultiplier()).toBeCloseTo(0.65, 6);
    });

    it('records the pre-jump speed into rememberedSpeed on the first jump of an excursion', () => {
      engine.loadTune(silentTune());
      engine.setSpeed(1.15);

      expect(engine.rememberedSpeed()).toBeNull();
      engine.jumpSpeedUp();
      expect(engine.rememberedSpeed()).toBeCloseTo(1.15, 6);
    });

    it('returns to the remembered speed exactly on the opposite button, and clears the excursion', () => {
      engine.loadTune(silentTune());
      engine.setSpeed(1.15);
      engine.jumpSpeedUp();

      engine.jumpSpeedDown();

      expect(engine.speedMultiplier()).toBeCloseTo(1.15, 6);
      expect(engine.rememberedSpeed()).toBeNull();
    });

    it('is a no-op to press the same button again mid-excursion', () => {
      engine.loadTune(silentTune());
      engine.setSpeed(1);
      engine.jumpSpeedUp();
      const afterFirstJump = engine.speedMultiplier();

      engine.jumpSpeedUp();

      expect(engine.speedMultiplier()).toBe(afterFirstJump);
      expect(engine.rememberedSpeed()).toBe(1);
    });

    it('returns exactly to the remembered speed even when the outbound jump clamped, never by re-deriving with arithmetic', () => {
      engine.loadTune(silentTune());
      engine.setSpeed(1.5); // the fader maximum

      engine.jumpSpeedUp(); // 1.5 + 0.5 = 2.0, clamped to the 1.7 hard ceiling
      expect(engine.speedMultiplier()).toBeCloseTo(1.7, 6);

      engine.jumpSpeedDown(); // the opposite button — must land exactly on 1.5, not 1.7 - 0.5 = 1.2

      expect(engine.speedMultiplier()).toBeCloseTo(1.5, 6);
    });

    it('is dual-purpose: Home sets 1.0 with no excursion open, or restores the ridden speed and closes it', () => {
      engine.loadTune(silentTune());
      engine.setSpeed(1.15);
      engine.jumpSpeedUp();

      engine.homeSpeed();
      expect(engine.speedMultiplier()).toBeCloseTo(1.15, 6);
      expect(engine.rememberedSpeed()).toBeNull();

      engine.homeSpeed();
      expect(engine.speedMultiplier()).toBe(1);
    });

    it('reaches the hard span rather than the input span, unlike setSpeed', () => {
      engine.loadTune(silentTune());
      engine.setSpeed(1.6); // beyond the input span
      expect(engine.speedMultiplier()).toBe(1.5);

      engine.jumpSpeedUp(); // additive from 1.5 -> 2.0, clamped to the 1.7 hard span

      expect(engine.speedMultiplier()).toBeCloseTo(1.7, 6);
    });
  });

  it('stops and reports why when a frame runs out of cycles', async () => {
    engine.loadTune(runawayTune());
    await engine.play();
    const packetsBefore = dataPackets(midi).length;

    clock.tick(1);

    expect(engine.state()).toBe('error');
    expect(engine.lastError()).toBeTruthy();
    expect(clock.running).toBe(false);
    expect(dataPackets(midi)).toHaveLength(packetsBefore);
  });

  it('stops when the selected MIDI port disappears mid-playback', async () => {
    engine.loadTune(silentTune());
    await engine.play();
    clock.tick(1);
    const packetsBefore = dataPackets(midi).length;

    midi.selectedPortId.set(null);
    clock.tick(2);

    expect(engine.state()).toBe('error');
    expect(engine.lastError()).toBeTruthy();
    expect(clock.running).toBe(false);
    expect(dataPackets(midi)).toHaveLength(packetsBefore);
  });

  it('refuses to start with no MIDI port selected', async () => {
    engine.loadTune(silentTune());
    midi.selectedPortId.set(null);

    await engine.play();

    expect(engine.state()).toBe('error');
    expect(clock.startCount).toBe(0);
  });

  it('closes the ASID session when the clock fails to start', async () => {
    engine.loadTune(silentTune());
    clock.startError = new Error('the audio context could not resume');

    await engine.play();

    expect(engine.state()).toBe('error');
    expect(engine.lastError()).toBeTruthy();
    expect(clock.running).toBe(false);
    // The cartridge was told to enter ASID mode before the clock was known to run, so the sequence
    // has to close rather than leave it waiting on frames.
    expect(messageSequence(midi).at(-1)).toBe(ASID_MSG_STOP);
  });

  it('stops the clock and closes the session when its injector is destroyed', async () => {
    // A route change destroys the component that provides the engine; the clock's audio graph
    // outlives the injector unless the engine's destroy hook tears it down.
    const injector = createEnvironmentInjector(
      [
        DjPlayerEngine,
        { provide: FRAME_CLOCK, useValue: clock },
        { provide: MidiOutputService, useValue: midi as unknown as MidiOutputService },
      ],
      TestBed.inject(EnvironmentInjector)
    );
    const scopedEngine = injector.get(DjPlayerEngine);
    scopedEngine.loadTune(silentTune());
    await scopedEngine.play();
    clock.tick(2);

    injector.destroy();

    expect(clock.running).toBe(false);
    expect(messageSequence(midi).at(-1)).toBe(ASID_MSG_STOP);
  });

  it('timestamps only the frame stream when a schedule-ahead is set', async () => {
    engine.loadTune(silentTune());
    engine.setScheduleAhead(20);

    await engine.play();
    clock.tick(1);

    expect(packetsOfType(midi, ASID_MSG_START)[0].timestampMs).toBeUndefined();
    expect(typeof dataPackets(midi)[0].timestampMs).toBe('number');
  });

  it('schedules every frame packet against its own due time, with no schedule-ahead offset set', async () => {
    engine.loadTune(silentTune());
    await engine.play();

    clock.tickWithDueAt(1_000_000);

    // Anchored to when the frame fell due rather than to whenever the main thread reached it, which
    // is what keeps packet spacing independent of callback timing.
    expect(lastDataPacket(midi).timestampMs).toBeCloseTo(1_000_000, 6);
  });

  it('reaches the clock at once on a speed change, queueing no sequence of its own', async () => {
    engine.loadTune(silentTune());
    await engine.play();
    clock.tick(1); // consumes the tune's initial full-dirty snapshot

    engine.setSpeed(1.2);
    expect(clock.intervalUs).toBeCloseTo(PAL_FRAME_INTERVAL_US / 1.2, 6);

    const before = dataPackets(midi).length;
    clock.tick(3);

    // Every packet since the change stays an ordinary, undirtied delta — nothing was queued ahead
    // of them to silence or re-emit the chip.
    for (const packet of dataPackets(midi).slice(before)) {
      expect(valueCount(packet)).toBe(0);
    }
  });


  describe('reschedule on tempo change', () => {
    it('cancels and re-times every still-committed send once, at the new interval, with a port that can cancel', async () => {
      midi.supportsCancel.set(true);
      midi.cancelPendingReturns = true;
      engine.loadTune(silentTune());
      engine.setScheduleAhead(200); // supportsCancel lifts setScheduleAhead's 40 ms ceiling

      await engine.play();
      clock.tick(2);
      const committed = dataPackets(midi).slice(-2).map((packet) => packet.bytes);

      engine.setSpeed(1.2);

      expect(midi.cancelPendingCallCount).toBe(1);
      const resent = dataPackets(midi).slice(-2);
      // Re-timed, not regenerated: the same bytes the tick already computed, only the delivery times
      // move.
      expect(resent.map((packet) => packet.bytes)).toEqual(committed);
      const newIntervalMs = PAL_FRAME_INTERVAL_US / 1.2 / 1000;
      expect((resent[1].timestampMs ?? 0) - (resent[0].timestampMs ?? 0)).toBeCloseTo(newIntervalMs, 6);
    });

    it('leaves committed sends untouched and never calls cancelPending with a port that cannot cancel', async () => {
      engine.loadTune(silentTune());
      engine.setScheduleAhead(UNCANCELLABLE_SCHEDULE_AHEAD_CEILING_MS);

      await engine.play();
      clock.tick(1);
      const before = midi.sent.length;

      expect(() => engine.setSpeed(1.2)).not.toThrow();

      expect(midi.cancelPendingCallCount).toBe(0);
      expect(midi.sent.length).toBe(before);
      // The change still applies going forward — only the already-committed frame is left alone.
      expect(clock.intervalUs).toBeCloseTo(PAL_FRAME_INTERVAL_US / 1.2, 6);
    });

    it('does not resend when cancelPending() reports it did not actually cancel anything', async () => {
      midi.supportsCancel.set(true);
      midi.cancelPendingReturns = false; // detected as capable, but the call itself reports failure
      engine.loadTune(silentTune());
      engine.setScheduleAhead(200);

      await engine.play();
      clock.tick(1);
      const before = midi.sent.length;

      expect(() => engine.setSpeed(1.2)).not.toThrow();

      expect(midi.cancelPendingCallCount).toBe(1);
      expect(midi.sent.length).toBe(before);
    });

    it('measures the cancel and anchors the resend against one and the same clock reading', async () => {
      midi.supportsCancel.set(true);
      midi.cancelPendingReturns = true;
      engine.loadTune(silentTune());
      engine.setScheduleAhead(200);
      await engine.play();
      clock.tickWithDueAt(1_000_000);
      const committedAtMs = lastDataPacket(midi).timestampMs ?? 0;

      // A clock that moves a full second between readings, so two readings inside the reschedule
      // would put the measurement and the first re-sent packet a second apart.
      let nowMs = 900_000;
      const movingClock = vi.spyOn(performance, 'now').mockImplementation(() => (nowMs += 1000));
      engine.setSpeed(1.2);
      movingClock.mockRestore();

      // Both derivations of "when the cancel happened" have to land on the same instant: one from
      // the reported reach of the furthest committed send, one from where the resend was placed.
      const anchorBehindMeasurement = committedAtMs - engine.stats().lastCancelLatencyMs;
      const anchorBehindResend = (lastDataPacket(midi).timestampMs ?? 0) - 200;
      expect(anchorBehindResend).toBe(anchorBehindMeasurement);
    });

    it('re-times only the sends still in the future, never one whose delivery time has already passed', async () => {
      midi.supportsCancel.set(true);
      midi.cancelPendingReturns = true;
      engine.loadTune(silentTune());
      engine.setScheduleAhead(200);
      await engine.play();

      // A main-thread stall between the frame falling due and the packet reaching the transport
      // leaves it past its delivery time even with the window applied.
      clock.tickWithDueAt(performance.now() - 1000);
      clock.tickWithDueAt(1_000_000);
      const before = midi.sent.length;

      engine.setSpeed(1.2);

      // One resend, not two: the stalled frame has already been delivered, and re-sending it would
      // play it a second time rather than move it.
      expect(midi.sent.length).toBe(before + 1);
    });
  });

  describe('setScheduleAhead ceiling', () => {
    it('clamps to the uncancellable ceiling when the selected port cannot cancel pending sends', () => {
      midi.supportsCancel.set(false);

      engine.setScheduleAhead(500);

      expect(engine.scheduleAheadMs()).toBe(UNCANCELLABLE_SCHEDULE_AHEAD_CEILING_MS);
    });

    it('does not clamp when the selected port can cancel pending sends', () => {
      midi.supportsCancel.set(true);

      engine.setScheduleAhead(500);

      expect(engine.scheduleAheadMs()).toBe(500);
    });

    it('leaves a value already within the ceiling untouched regardless of cancel support', () => {
      midi.supportsCancel.set(false);

      engine.setScheduleAhead(10);

      expect(engine.scheduleAheadMs()).toBe(10);
    });

    it('re-clamps the window actually sent on a mid-session loss of cancel support, without a fresh setScheduleAhead() call', async () => {
      midi.supportsCancel.set(true);
      engine.loadTune(silentTune());
      engine.setScheduleAhead(200); // a deep window, allowed while the port can cancel

      await engine.play();
      clock.tickWithDueAt(1_000_000);
      expect(lastDataPacket(midi).timestampMs).toBeCloseTo(1_000_000 + 200, 6);

      // Simulates a port swap or a same-device reconnect: the capability signal changes on its own,
      // with nobody re-touching the schedule-ahead control.
      midi.supportsCancel.set(false);
      // The stored value is untouched — this is exactly what a stale, unbounded window would look
      // like if the ceiling were only enforced back when setScheduleAhead() last ran.
      expect(engine.scheduleAheadMs()).toBe(200);

      clock.tickWithDueAt(1_001_000);
      expect(lastDataPacket(midi).timestampMs).toBeCloseTo(
        1_001_000 + UNCANCELLABLE_SCHEDULE_AHEAD_CEILING_MS,
        6
      );
    });
  });

  describe('delivery-against-due-time stats', () => {
    it('starts with a complete, zeroed empty state before any tune loads', () => {
      const stats = engine.stats();

      expect(stats.scheduledFrames).toBe(0);
      expect(stats.lateFrames).toBe(0);
      expect(stats.meanLagMs).toBe(0);
      expect(stats.worstLagMs).toBe(0);
      expect(stats.reorderedFrames).toBe(0);
      expect(stats.clampedFrames).toBe(0);
      expect(stats.cancelSupported).toBe(false);
      expect(stats.lastCancelLatencyMs).toBe(-1);
    });

    it('computes mean and worst lag from known due/hand-off pairs, and flags a frame late past one interval', async () => {
      vi.spyOn(performance, 'now').mockReturnValue(100_000);
      engine.loadTune(silentTune());
      await engine.play();
      clock.tick(1); // due "now" on the mocked clock — zero lag

      // PAL_FRAME_INTERVAL_US is ~19950 µs (≈19.95 ms): 10 ms sits under one interval, 30 ms over it.
      clock.tickWithDueAt(100_000 - 10);
      clock.tickWithDueAt(100_000 - 30);
      engine.pause(); // forces a fresh publish through the existing path, adding no scheduled frame

      const stats = engine.stats();
      expect(stats.scheduledFrames).toBe(3);
      expect(stats.worstLagMs).toBeCloseTo(30, 6);
      expect(stats.meanLagMs).toBeCloseTo((0 + 10 + 30) / 3, 6);
      expect(stats.lateFrames).toBe(1);
    });

    it('counts a frame scheduled earlier than its predecessor as reordered', async () => {
      engine.loadTune(silentTune());
      await engine.play();

      clock.tickWithDueAt(1_000_000); // nothing to compare against yet
      clock.tickWithDueAt(1_001_000); // later — in order
      clock.tickWithDueAt(1_000_500); // earlier than its predecessor's — an inversion
      engine.pause();

      expect(engine.stats().reorderedFrames).toBe(1);
    });

    it('flags a frame emitted from a catch-up-clamped advance, without excluding it from the lag figures', async () => {
      engine.loadTune(silentTune());
      await engine.play();

      clock.tickWithDueAt(performance.now(), true);
      engine.pause();

      const stats = engine.stats();
      expect(stats.clampedFrames).toBe(1);
      expect(stats.scheduledFrames).toBe(1);
    });

    it("reports the transport's cancel support once a stats publish reads it", () => {
      midi.supportsCancel.set(true);
      engine.loadTune(silentTune()); // loadTune() publishes on the existing path

      expect(engine.stats().cancelSupported).toBe(true);
      expect(engine.stats().lastCancelLatencyMs).toBe(-1);
    });

    describe('cancel latency', () => {
      beforeEach(() => {
        vi.useFakeTimers();
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      it('records how far the furthest-out committed send reached past the cancel request', async () => {
        midi.supportsCancel.set(true);
        midi.cancelPendingReturns = true;
        engine.loadTune(silentTune());
          engine.setScheduleAhead(200);

        await engine.play();
        clock.tick(2);

        engine.setSpeed(1.2); // triggers retimeCommittedHostSends() -> cancelPending()

        const stats = engine.stats();
        expect(stats.cancelSupported).toBe(true);
        // Both committed sends carried a ~200 ms window; the cancel landed practically at once, so
        // the furthest reach should sit close to that 200 ms rather than at 0 or wildly beyond it.
        expect(stats.lastCancelLatencyMs).toBeGreaterThan(100);
        expect(stats.lastCancelLatencyMs).toBeLessThan(300);
      });

      it('leaves the latency at -1 when the selected port cannot cancel', async () => {
        engine.loadTune(silentTune());
          engine.setScheduleAhead(UNCANCELLABLE_SCHEDULE_AHEAD_CEILING_MS);

        await engine.play();
        clock.tick(1);
        engine.setSpeed(1.2);

        expect(engine.stats().lastCancelLatencyMs).toBe(-1);
      });

      it('falls back to -1 on a mid-session swap to a port that cannot cancel, without a tune reload', async () => {
        midi.supportsCancel.set(true);
        midi.cancelPendingReturns = true;
        engine.loadTune(silentTune());
          engine.setScheduleAhead(200);

        await engine.play();
        clock.tick(2);
        engine.setSpeed(1.2); // records a real cancel latency

        expect(engine.stats().lastCancelLatencyMs).toBeGreaterThan(-1);

        midi.supportsCancel.set(false); // simulates a port swap mid-session, no tune reload
        engine.pause(); // forces a fresh publish through the existing path, no tune reload involved

        expect(engine.stats().lastCancelLatencyMs).toBe(-1);
      });
    });
  });

  describe('the jump primitive: marker and scrub', () => {
    it('produces byte-identical replayed output when jumping to the same frame twice', async () => {
      engine.loadTune(counterTune());

      engine.scrubTo(5);
      await replay.settle();
      const first = lastDataPacket(midi).bytes;
      engine.scrubTo(5);
      await replay.settle();
      const second = lastDataPacket(midi).bytes;

      expect(second).toEqual(first);
      // Sanity: the replay actually depends on how many frames ran, so a bug that always landed on
      // frame 0 could not pass the identity check above by coincidence.
      expect(slotValue(lastDataPacket(midi), 0)).toBeGreaterThan(0);
    });

    it('triggers a captured marker at exactly the frame it was captured, regardless of what played after', async () => {
      engine.loadTune(counterTune());
      await engine.play();
      clock.tick(5);
      engine.addMarker();
      clock.tick(10);

      engine.triggerMarker(0);
      clock.tick(2); // gate-off, then the resync — the packet under test
      const triggered = lastDataPacket(midi).bytes;

      const freshClock = new FakeFrameClock();
      const freshMidi = new FakeMidiOutputService();
      const freshInjector = createEnvironmentInjector(
        [
          DjPlayerEngine,
          { provide: FRAME_CLOCK, useValue: freshClock },
          { provide: MidiOutputService, useValue: freshMidi as unknown as MidiOutputService },
        ],
        TestBed.inject(EnvironmentInjector)
      );
      const freshEngine = freshInjector.get(DjPlayerEngine);
      freshEngine.loadTune(counterTune());
      await freshEngine.play();
      freshClock.tick(5);
      freshEngine.addMarker();
      freshEngine.triggerMarker(0); // captured and restored back to back, nothing played in between
      freshClock.tick(2);

      expect(triggered).toEqual(lastDataPacket(freshMidi).bytes);
    });

    it('clears a captured marker back to empty, and leaves other rows untouched', () => {
      engine.loadTune(counterTune());
      engine.addMarker();
      engine.addMarker();

      engine.clearMarker(0);

      const markers = engine.markers();
      expect(markers[0]).toEqual({ start: null, end: null });
      expect(markers[1].start).not.toBeNull();
    });

    it('survives stop() and a play from stopped, since neither rebuilds the tune', async () => {
      engine.loadTune(counterTune());
      await engine.play();
      clock.tick(5);
      engine.addMarker();

      engine.stop();
      expect(engine.markers()[0].start).not.toBeNull();

      await engine.play();
      expect(engine.markers()[0].start).not.toBeNull();
    });

    it('clears every marker on loadTune, since a new tune invalidates every captured snapshot', async () => {
      engine.loadTune(counterTune());
      await engine.play();
      clock.tick(5);
      engine.addMarker();
      engine.addMarker();

      engine.loadTune(counterTune());

      expect(engine.markers()).toEqual([]);
    });

    it('restores a marker without re-emulating, so the machine keeps running forward from it', async () => {
      engine.loadTune(counterTune());
      await engine.play();
      clock.tick(5);
      engine.addMarker();
      const atMarker = slotValue(lastDataPacket(midi), 0);

      clock.tick(20);
      expect(slotValue(lastDataPacket(midi), 0)).not.toBe(atMarker);

      engine.triggerMarker(0);
      clock.tick(2); // gate-off, then the resync carrying the marker's registers
      expect(slotValue(lastDataPacket(midi), 0)).toBe(atMarker);
      expect(engine.stats().framesRendered).toBe(5);

      // The restored machine is live, not a frozen snapshot: the counter keeps climbing from where
      // the marker put it back, which a shallow value-only restore would not manage.
      clock.tick(1);
      expect(slotValue(lastDataPacket(midi), 0)).toBeGreaterThan(atMarker);
    });

    it('sends nothing of its own on a trigger, then gate-off and resync on the next two ticks', async () => {
      engine.loadTune(counterTune());
      await engine.play();
      clock.tick(5);
      engine.addMarker();
      clock.tick(5);

      const before = dataPackets(midi).length;
      engine.triggerMarker(0);
      // The cartridge drains exactly one packet per timer tick, so a trigger that sent its own
      // packets here would hand it frames it never drains.
      expect(dataPackets(midi)).toHaveLength(before);

      clock.tick(1);
      const gateOff = dataPackets(midi).slice(before);
      expect(gateOff).toHaveLength(1);
      // Three present slots and nothing else — the seam packet touches only the gate registers and
      // leaves frequency, waveform and ADSR to the resync behind it. `voiceGateValues` does not
      // apply here: it reads slots 22/23/24 of a full 25-register re-emit.
      expect(valueCount(gateOff[0])).toBe(3);
      expect([0, 1, 2].map((slot) => slotValue(gateOff[0], slot))).toEqual([0, 0, 0]);

      clock.tick(1);
      const resync = dataPackets(midi).slice(before + 1);
      expect(resync).toHaveLength(1);
      // A full frame after the gate-off, so every voice gets a real release window before this
      // re-attacks it — the chip sees 1 -> 0 -> 1 rather than carrying the pre-trigger note across.
      expect(voiceGateValues(resync[0])).toEqual([0x11, 0x11, 0x11]);
    });

    it('holds the packet rate at one per tick however hard markers are triggered', async () => {
      engine.loadTune(counterTune());
      await engine.play();
      clock.tick(5);
      engine.addMarker();
      clock.tick(5);
      engine.addMarker();

      const before = dataPackets(midi).length;
      for (let i = 0; i < 50; i++) engine.triggerMarker(i % 2);
      expect(dataPackets(midi)).toHaveLength(before);

      // Fifty triggers between two ticks still cost two packets, not a hundred: a trigger arriving
      // while one is pending replaces it rather than queueing behind it, so the newest trigger is
      // the one that lands and no backlog survives to be played out.
      clock.tick(2);
      expect(dataPackets(midi)).toHaveLength(before + 2);

      clock.tick(1);
      expect(dataPackets(midi)).toHaveLength(before + 3);
    });

    it('resyncs immediately when a jump lands with the clock stopped', async () => {
      engine.loadTune(counterTune());

      const before = dataPackets(midi).length;
      engine.scrubTo(5);
      await replay.settle();

      // Nothing is ticking, so there is no tick to ride and nothing to stay in step with.
      expect(dataPackets(midi).length).toBeGreaterThan(before);
    });

    it('forces the voice gates off in the resync packet when a jump lands while paused', async () => {
      engine.loadTune(counterTune());
      await engine.play();
      clock.tick(3);
      engine.pause();

      engine.scrubTo(5);
      await replay.settle();
      const pausedPacket = lastDataPacket(midi);

      expect(voiceGateValues(pausedPacket)).toEqual([0, 0, 0]);
      expect(engine.state()).toBe('paused');

      // The replay's own computed state is not actually zero — resuming and repeating the same jump
      // while playing proves the masking above is a paused-only override, not the tune's real state.
      await engine.play();
      engine.scrubTo(5);
      await replay.settle();
      clock.tick(2); // playing now, so the resync rides the clock rather than going out here
      const playingPacket = lastDataPacket(midi);

      expect(voiceGateValues(playingPacket)).toEqual([0x11, 0x11, 0x11]);
    });

    it("reports a muted voice's control register as 0 in a jump's resync packet, leaving the others live", async () => {
      engine.loadTune(counterTune());
      engine.setVoiceMuted(1, true);

      engine.scrubTo(5);
      await replay.settle();

      const gates = voiceGateValues(lastDataPacket(midi));
      expect(gates[1]).toBe(0);
      expect(gates[0]).toBeGreaterThan(0);
      expect(gates[2]).toBeGreaterThan(0);
    });

    it("seeds a jump's replay frame from the effective (held) set rather than the latched one", async () => {
      engine.loadTune(counterTune());
      engine.setVoiceHeld(1, true); // voice 1 is audible (latched); held inverts it to muted

      engine.scrubTo(5);
      await replay.settle();

      const gates = voiceGateValues(lastDataPacket(midi));
      expect(gates[1]).toBe(0);
      expect(gates[0]).toBeGreaterThan(0);
      expect(gates[2]).toBeGreaterThan(0);
    });

    it('resets position when the subtune changes, but leaves captured markers alone', async () => {
      engine.loadTune(silentTune(2));
      await engine.play();
      clock.tick(5);
      engine.addMarker(); // a cue
      const loopIndex = engine.addMarker();
      clock.tick(5);
      engine.setMarkerEnd(loopIndex);
      engine.setVoiceMuted(1, true);

      engine.nextSubtune();

      expect(engine.stats().framesRendered).toBe(0);
      expect(engine.markers()[0].start).not.toBeNull();
      expect(engine.markers()[loopIndex].start).not.toBeNull();
      expect(engine.markers()[loopIndex].end).not.toBeNull();
      expect(engine.mutedVoices()).toEqual([false, true, false]);
    });

    it('resolves 0%/100% to frame 0 and the jump ceiling exactly, clamping out-of-range input', async () => {
      engine.loadTune(counterTune());
      const ceiling = expectedCeilingFrames();

      engine.scrubTo(0);
      await replay.settle();
      expect(engine.stats().framesRendered).toBe(0);

      engine.scrubTo(100);
      await replay.settle();
      expect(engine.stats().framesRendered).toBe(ceiling);

      engine.scrubTo(-25);
      await replay.settle();
      expect(engine.stats().framesRendered).toBe(0);

      engine.scrubTo(140);
      await replay.settle();
      expect(engine.stats().framesRendered).toBe(ceiling);
    });

    it('aborts the whole jump, not just one frame of it, when the play routine never returns', async () => {
      engine.loadTune(runawayTune());
      const packetsBefore = dataPackets(midi).length;

      engine.scrubTo(1);
      await replay.settle();

      expect(engine.state()).toBe('error');
      expect(engine.lastError()).toBeTruthy();
      expect(dataPackets(midi)).toHaveLength(packetsBefore);
    });
  });

  describe('the off-thread jump', () => {
    /** `counterTune` stores its play-call count into $D400, so slot 0 of a resync packet names the
     *  frame whatever was restored actually came from. */
    const COUNTER_SLOT = 0;

    async function playTo(frames: number): Promise<void> {
      engine.loadTune(counterTune());
      await engine.play();
      clock.tick(frames);
    }

    it('keeps a packet going out on every tick while a deep scrub is still replaying', async () => {
      await playTo(5);
      replay.manual = true;

      engine.scrubTo(90);
      const before = dataPackets(midi).length;
      clock.tick(20);

      // The whole point of moving the replay off this thread: the clock is not blocked, so the
      // cartridge's queue is fed one frame per tick straight through the request.
      expect(dataPackets(midi)).toHaveLength(before + 20);
      expect(engine.state()).toBe('playing');
    });

    it('scrubTo does not resolve until the replay settles', async () => {
      await playTo(5);
      replay.manual = true;

      const landed = vi.fn();
      void engine.scrubTo(4).then(landed);
      await Promise.resolve(); // let any already-settled microtasks run
      expect(landed).not.toHaveBeenCalled();

      replay.resolveAll();
      await replay.settle();
      expect(landed).toHaveBeenCalled();
    });

    it('applies only the newest of two scrubs issued before either resolves', async () => {
      await playTo(5);
      replay.manual = true;

      engine.scrubTo(1);
      engine.scrubTo(4);
      replay.resolveAll();
      await replay.settle();
      clock.tick(2); // gate-off, then the resync — the second publishes the landed position

      expect(replay.requests).toHaveLength(2);
      expect(engine.stats().framesRendered).toBe(Math.round(expectedCeilingFrames() * 0.04));
    });

    it('discards a result that arrives after a stop', async () => {
      await playTo(5);
      replay.manual = true;

      engine.scrubTo(4);
      engine.stop();
      replay.resolveAll();
      await replay.settle();

      // stop() re-inits the subtune, which puts the counter back to 0; a landing jump would move it.
      expect(engine.stats().framesRendered).toBe(0);
      expect(engine.state()).toBe('stopped');
    });

    it('discards a result that arrives after a new tune is loaded', async () => {
      await playTo(5);
      replay.manual = true;

      engine.scrubTo(4);
      engine.loadTune(counterTune());
      replay.resolveAll();
      await replay.settle();

      expect(engine.stats().framesRendered).toBe(0);
    });

    it('discards a result that arrives after the subtune changed', async () => {
      engine.loadTune(counterTune(3));
      await engine.play();
      clock.tick(5);
      replay.manual = true;

      engine.scrubTo(4);
      engine.nextSubtune();
      replay.resolveAll();
      await replay.settle();

      expect(engine.currentSubtune()).toBe(2);
      expect(engine.stats().framesRendered).toBe(0);
    });

    it('lands with the mutes as they stand now, not as they stood when the scrub was issued', async () => {
      await playTo(5);
      replay.manual = true;

      engine.scrubTo(1);
      engine.setVoiceMuted(1, true); // the operator moves a mute while the worker is replaying
      replay.resolveAll();
      await replay.settle();
      clock.tick(2); // gate-off, then the resync carrying the landed state

      const gates = voiceGateValues(lastDataPacket(midi));
      expect(gates[1]).toBe(0);
      expect(gates[0]).toBeGreaterThan(0);
      expect(gates[2]).toBeGreaterThan(0);
    });

    it('carries the failure message back from the replay rather than swallowing it', async () => {
      engine.loadTune(runawayTune());

      engine.scrubTo(1);
      await replay.settle();

      expect(engine.state()).toBe('error');
      expect(engine.lastError()).toContain('exceeded its cycle budget during replay');
    });

    it('leaves the position where it is until the result lands, then moves it', async () => {
      await playTo(5);
      replay.manual = true;
      const target = Math.round(expectedCeilingFrames() * 0.04);

      engine.scrubTo(4);
      clock.tick(3);
      // The tune ran on across the request rather than jumping the moment it was asked for; the
      // counter it stores into $D400 is what says so.
      expect(slotValue(lastDataPacket(midi), COUNTER_SLOT)).toBe(8);

      replay.resolveAll();
      await replay.settle();
      clock.tick(2); // gate-off, then the resync the landing queued

      expect(engine.stats().framesRendered).toBe(target);
    });

    it('releases the replay thread when the engine is destroyed', () => {
      engine.loadTune(counterTune());

      engine.ngOnDestroy();

      expect(replay.disposed).toBe(true);
    });
  });

  describe('the marker start nudge', () => {
    /** `counterTune` stores its play-call count into $D400, so slot 0 of a resync packet names the
     * frame whatever was restored actually came from. */
    const COUNTER_SLOT = 0;

    /** SysEx data bytes carry seven bits — the eighth lives in the packet's MSB map, which
     * `slotValue` does not reassemble — so the counter reads back modulo 128. */
    function counterAt(frame: number): number {
      return frame % 128;
    }

    async function playTo(frames: number): Promise<void> {
      engine.loadTune(counterTune());
      await engine.play();
      clock.tick(frames);
    }

    /** Triggers, then rides the two ticks the resync takes, and reads the frame it landed on. */
    function triggerAndReadFrame(index: number): number {
      engine.triggerMarker(index);
      clock.tick(2); // gate-off, then the resync carrying the resolved registers
      return slotValue(lastDataPacket(midi), COUNTER_SLOT);
    }

    it('walks a marker backward onto an earlier frame without replaying from init', async () => {
      await playTo(60);
      engine.addMarker();

      engine.setMarkerStartOffset(0, -10);

      expect(triggerAndReadFrame(0)).toBe(counterAt(50));
      // The counter has to agree with the state that was restored, or the playhead and the row's
      // frame readout both drift by the offset.
      expect(engine.stats().framesRendered).toBe(50);
    });

    it('walks a marker forward onto a later frame', async () => {
      await playTo(60);
      engine.addMarker();

      engine.setMarkerStartOffset(0, 10);

      expect(triggerAndReadFrame(0)).toBe(counterAt(70));
      expect(engine.stats().framesRendered).toBe(70);
    });

    it('resolves to the same state a direct replay to that frame produces', async () => {
      await playTo(60);
      engine.addMarker();
      engine.setMarkerStartOffset(0, -10);
      engine.triggerMarker(0);
      clock.tick(5); // the resync, then three frames played on from it
      const nudged = dataPackets(midi).slice(-4).map((packet) => packet.bytes);

      const freshClock = new FakeFrameClock();
      const freshMidi = new FakeMidiOutputService();
      const freshInjector = createEnvironmentInjector(
        [
          DjPlayerEngine,
          { provide: FRAME_CLOCK, useValue: freshClock },
          { provide: MidiOutputService, useValue: freshMidi as unknown as MidiOutputService },
        ],
        TestBed.inject(EnvironmentInjector)
      );
      const freshEngine = freshInjector.get(DjPlayerEngine);
      freshEngine.loadTune(counterTune());
      await freshEngine.play();
      freshClock.tick(50); // played straight through to the frame the nudge walked onto
      freshEngine.addMarker();
      freshEngine.triggerMarker(0);
      freshClock.tick(5);

      expect(nudged).toEqual(dataPackets(freshMidi).slice(-4).map((packet) => packet.bytes));
    });

    it('triggers a nudged marker without emulating a frame, however deep it was captured', async () => {
      await playTo(200);
      engine.addMarker();
      engine.setMarkerStartOffset(0, -20);
      const runFrame = vi.spyOn(C64Machine.prototype, 'runFrame');

      engine.triggerMarker(0);

      // The stall this whole design exists to avoid: a trigger that re-derived the nudged point
      // would block the main thread, and with it the frame clock's own audio callback.
      expect(runFrame).not.toHaveBeenCalled();
      clock.tick(2);
      expect(slotValue(lastDataPacket(midi), COUNTER_SLOT)).toBe(counterAt(180));
    });

    it('falls back to the frame-0 anchor for a marker captured before the ring has filled', async () => {
      await playTo(5);
      engine.addMarker();

      engine.setMarkerStartOffset(0, -5);

      expect(triggerAndReadFrame(0)).toBe(counterAt(0));
      expect(engine.stats().framesRendered).toBe(0);
    });

    it('leaves playback exactly where it is, since the re-derivation runs on a throwaway machine', async () => {
      await playTo(60);
      engine.addMarker();

      engine.setMarkerStartOffset(0, -10);

      clock.tick(1);
      expect(slotValue(lastDataPacket(midi), COUNTER_SLOT)).toBe(counterAt(61));
    });

    it('clamps the offset to the nudge range in both directions', async () => {
      await playTo(60);
      engine.addMarker();

      const range = engine.nudgeRangeFrames();
      engine.setMarkerStartOffset(0, 999);
      expect(engine.markers()[0].start?.offset).toBe(range);

      engine.setMarkerStartOffset(0, -999);
      expect(engine.markers()[0].start?.offset).toBe(-range);
    });

    it('is a no-op on a cleared row', async () => {
      await playTo(30);
      engine.addMarker();
      engine.clearMarker(0);

      engine.setMarkerStartOffset(0, 5);

      expect(engine.markers()[0].start).toBeNull();
    });

    it('is a no-op for an index beyond the collection', async () => {
      await playTo(30);
      engine.addMarker();

      engine.setMarkerStartOffset(1, 5);

      expect(engine.markers()).toHaveLength(1);
      expect(engine.markers()[0].start?.offset).toBe(0);
    });
  });

  describe('loop-shaped markers', () => {
    /** `counterTune` stores its play-call count into $D400, so slot 0 of a resync packet names the
     * frame whatever was restored actually came from. */
    const COUNTER_SLOT = 0;

    /** SysEx data bytes carry seven bits — the eighth lives in the packet's MSB map, which
     * `slotValue` does not reassemble — so the counter reads back modulo 128. */
    function counterAt(frame: number): number {
      return frame % 128;
    }

    async function playTo(frames: number): Promise<void> {
      engine.loadTune(counterTune());
      await engine.play();
      clock.tick(frames);
    }

    /** Appends rows until `index` exists — the tests below re-capture a specific row index the way
     *  a UI would only after adding it, so this stands in for the row having already been added. */
    function ensureMarkerRow(index: number): void {
      while (engine.markers().length <= index) {
        engine.addMarker();
      }
    }

    /** Marks a row from the current position: start here, end `length` frames later. */
    function markSlotHere(index: number, length: number): void {
      ensureMarkerRow(index);
      engine.captureMarkerStart(index);
      clock.tick(length);
      engine.setMarkerEnd(index);
    }

    /** Marks one row on a fresh tune: start at `startFrame`, end `length` frames later. */
    async function markLoop(index: number, startFrame: number, length: number): Promise<void> {
      await playTo(startFrame);
      markSlotHere(index, length);
    }

    /**
     * Three ten-frame loops starting at 10, 50 and 90, with marker 0 triggered and its re-entry
     * already ridden out — so the playhead sits on marker 0's start with ten frames of lap left to
     * run.
     */
    async function threeSlotsWithFirstLooping(): Promise<void> {
      await playTo(10);
      markSlotHere(0, 10);
      clock.tick(30);
      markSlotHere(1, 10);
      clock.tick(30);
      markSlotHere(2, 10);
      await engine.triggerMarker(0);
      clock.tick(2); // the gate-off and resync the engagement rides out on
    }

    it('engages a triggered marker at once when nothing is looping', async () => {
      await markLoop(0, 200, 10);
      clock.tick(5);
      const runFrame = vi.spyOn(C64Machine.prototype, 'runFrame');

      engine.triggerMarker(0);

      // A restore, never a replay: engaging a marker whose start sits deep in the tune must not
      // block the main thread the frame clock's audio callback rides.
      expect(runFrame).not.toHaveBeenCalled();
      expect(engine.loopingMarker()).toBe(0);
      clock.tick(2); // gate-off, then the resync carrying the start's registers
      expect(slotValue(lastDataPacket(midi), COUNTER_SLOT)).toBe(counterAt(200));
      expect(engine.stats().framesRendered).toBe(200);
    });

    it('re-enters at the marked start on the tick that reaches the end, without stopping the clock', async () => {
      await markLoop(0, 10, 10);
      engine.triggerMarker(0);
      clock.tick(2);

      clock.tick(10); // the tenth renders frame 20, the end, so it re-enters

      expect(clock.running).toBe(true);
      expect(engine.loopingMarker()).toBe(0);

      clock.tick(2);
      expect(slotValue(lastDataPacket(midi), COUNTER_SLOT)).toBe(counterAt(10));
      expect(engine.stats().framesRendered).toBe(10);
    });

    it('re-enters by restoring the start, emulating no frame of its own however deep it sits', async () => {
      await markLoop(0, 200, 10);
      engine.triggerMarker(0);
      clock.tick(2 + 9); // the resync pair, then up to the frame before the end
      const runFrame = vi.spyOn(C64Machine.prototype, 'runFrame');

      clock.tick(1);

      // The tick's own frame and nothing else: a re-entry that replayed to the start would run two
      // hundred more, blocking the main thread the frame clock's audio callback rides — on every
      // single pass.
      expect(runFrame).toHaveBeenCalledTimes(1);

      clock.tick(2);
      expect(slotValue(lastDataPacket(midi), COUNTER_SLOT)).toBe(counterAt(200));
    });

    it('sends nothing of its own on re-entry, then rides the clock for the gate-off and resync', async () => {
      await markLoop(0, 10, 10);
      engine.triggerMarker(0);
      clock.tick(2 + 9);
      const before = dataPackets(midi).length;

      // The cartridge drains exactly one packet per timer tick, so a re-entry that sent its own
      // packets here would hand it frames it never drains — and a loop does it over and over.
      clock.tick(1);
      expect(dataPackets(midi)).toHaveLength(before + 1);

      clock.tick(1);
      const gateOff = dataPackets(midi).slice(before + 1);
      expect(gateOff).toHaveLength(1);
      expect(valueCount(gateOff[0])).toBe(3);
      expect([0, 1, 2].map((slot) => slotValue(gateOff[0], slot))).toEqual([0, 0, 0]);

      clock.tick(1);
      const resync = dataPackets(midi).slice(before + 2);
      expect(resync).toHaveLength(1);
      expect(voiceGateValues(resync[0])).toEqual([0x11, 0x11, 0x11]);
    });

    it('leaves the looping marker alone until its end, then switches to the triggered one', async () => {
      await threeSlotsWithFirstLooping();

      engine.triggerMarker(1);

      expect(engine.loopingMarker()).toBe(0);
      expect(engine.queuedMarker()).toBe(1);
      // Nine frames of the lap left: the switch must not cut them off.
      clock.tick(9);
      expect(engine.loopingMarker()).toBe(0);

      clock.tick(1);
      expect(engine.loopingMarker()).toBe(1);
      expect(engine.queuedMarker()).toBeNull();

      clock.tick(2);
      expect(slotValue(lastDataPacket(midi), COUNTER_SLOT)).toBe(counterAt(50));
      expect(engine.stats().framesRendered).toBe(50);
    });

    it('replaces the queued marker when another is triggered before the switch lands', async () => {
      await threeSlotsWithFirstLooping();

      engine.triggerMarker(1);
      engine.triggerMarker(2);

      expect(engine.queuedMarker()).toBe(2);

      clock.tick(10);
      expect(engine.loopingMarker()).toBe(2);

      clock.tick(2);
      expect(slotValue(lastDataPacket(midi), COUNTER_SLOT)).toBe(counterAt(90));
    });

    it('sends no more packets on the switching tick than a plain re-entry does', async () => {
      await threeSlotsWithFirstLooping();
      engine.triggerMarker(1);
      clock.tick(9);
      const before = dataPackets(midi).length;

      // The switch is a restore like any other: one packet on the tick it lands, then the gate-off
      // and resync one per tick. Two on one tick is a frame the cartridge never drains.
      clock.tick(1);
      expect(dataPackets(midi)).toHaveLength(before + 1);

      clock.tick(1);
      const gateOff = dataPackets(midi).slice(before + 1);
      expect(gateOff).toHaveLength(1);
      expect([0, 1, 2].map((slot) => slotValue(gateOff[0], slot))).toEqual([0, 0, 0]);

      clock.tick(1);
      expect(dataPackets(midi).slice(before + 2)).toHaveLength(1);
    });

    it('re-triggers the looping marker when it is triggered again with nothing queued', async () => {
      await markLoop(0, 10, 10);
      engine.triggerMarker(0);
      clock.tick(2 + 3);

      engine.triggerMarker(0);

      clock.tick(2);
      expect(engine.loopingMarker()).toBe(0);
      expect(engine.stats().framesRendered).toBe(10);
      expect(slotValue(lastDataPacket(midi), COUNTER_SLOT)).toBe(counterAt(10));
    });

    it('stops on the spot when told to, dropping the queue and playing on linearly', async () => {
      await threeSlotsWithFirstLooping();
      engine.triggerMarker(1);

      clock.tick(3);
      engine.stopLoop();

      expect(engine.loopingMarker()).toBeNull();
      expect(engine.queuedMarker()).toBeNull();
      // Straight past marker 0's end at frame 20 rather than wrapping at it.
      clock.tick(30);
      expect(engine.stats().framesRendered).toBeGreaterThan(20);
    });

    it('reports progress through the looping marker bounds and none for the others', async () => {
      await markLoop(0, 10, 100); // start 10, end 110
      engine.triggerMarker(0);

      clock.tick(2 + 50); // the resync pair, then halfway through the lap

      expect(engine.progressPercentFor(0)).toBeCloseTo(50, 5);
      expect(engine.progressPercentFor(1)).toBe(0);

      engine.stopLoop();
      expect(engine.progressPercentFor(0)).toBe(0);
    });

    it('engages a marker as a cue rather than refusing until its end resolves after the start', async () => {
      await playTo(10);
      engine.addMarker(); // start at frame 10

      engine.triggerMarker(0);
      expect(engine.loopingMarker()).toBeNull(); // no end yet — a cue, not a loop

      engine.setMarkerEnd(0); // captured at the same frame as the start — still no pass to play
      engine.triggerMarker(0);
      expect(engine.loopingMarker()).toBeNull();

      clock.tick(20); // clears the pending gate-off/resync pairs, and lands well past the start
      engine.setMarkerEnd(0); // now resolves after the start
      engine.triggerMarker(0);
      expect(engine.loopingMarker()).toBe(0);
    });

    it('re-capturing the start leaves an already-marked end untouched', async () => {
      await playTo(10);
      engine.addMarker(); // start at frame 10
      engine.setMarkerEnd(0); // end at frame 10 too

      clock.tick(10);
      engine.captureMarkerStart(0); // re-capture moves only the start

      expect(engine.markers()[0].start?.frame).toBe(20);
      expect(engine.markers()[0].end?.frame).toBe(10);
    });

    it('drops out rather than spinning when a nudge crosses the ends', async () => {
      await markLoop(0, 10, 20);
      engine.triggerMarker(0);
      clock.tick(2);

      engine.setMarkerEndOffset(0, -engine.nudgeRangeFrames()); // the end walks back behind the start

      clock.tick(1);
      expect(engine.loopingMarker()).toBeNull();

      // Playback carries on past the crossed end instead of re-entering on every tick.
      clock.tick(30);
      expect(engine.stats().framesRendered).toBeGreaterThan(30);
    });

    it('moves where the next pass wraps when the end is nudged, replaying nothing', async () => {
      await markLoop(0, 5, 35); // start 5, end 40
      const runFrame = vi.spyOn(C64Machine.prototype, 'runFrame');

      engine.setMarkerEndOffset(0, -25); // the pass now wraps at frame 15

      expect(runFrame).not.toHaveBeenCalled();
      expect(engine.markers()[0]?.end?.offset).toBe(-25);

      engine.triggerMarker(0);
      clock.tick(100);

      expect(engine.stats().framesRendered).toBeLessThanOrEqual(15);
      expect(engine.stats().framesRendered).toBeGreaterThanOrEqual(5);
    });

    it('clamps the end offset to the nudge range in both directions', async () => {
      await markLoop(0, 60, 30);

      const range = engine.nudgeRangeFrames();
      engine.setMarkerEndOffset(0, 999);
      expect(engine.markers()[0]?.end?.offset).toBe(range);

      engine.setMarkerEndOffset(0, -999);
      expect(engine.markers()[0]?.end?.offset).toBe(-range);
    });

    it('walks the start onto an earlier frame and re-enters there when triggered', async () => {
      await markLoop(0, 60, 10);

      engine.setMarkerStartOffset(0, -10);
      engine.triggerMarker(0);
      clock.tick(2);

      expect(engine.markers()[0]?.start?.offset).toBe(-10);
      expect(slotValue(lastDataPacket(midi), COUNTER_SLOT)).toBe(counterAt(50));
      expect(engine.stats().framesRendered).toBe(50);
    });

    it('is a no-op to nudge either point of a row with nothing captured', async () => {
      await playTo(10);
      engine.addMarker();
      engine.clearMarker(0);

      engine.setMarkerStartOffset(0, -5);
      engine.setMarkerEndOffset(0, 5);

      expect(engine.markers()[0]).toEqual({ start: null, end: null });
    });

    it('is a no-op to nudge a row that does not exist', async () => {
      await playTo(10);

      engine.setMarkerStartOffset(0, -5);
      engine.setMarkerEndOffset(0, 5);

      expect(engine.markers()).toHaveLength(0);
    });

    it('keeps each row to itself when another is nudged or cleared', async () => {
      await playTo(10);
      markSlotHere(0, 10);
      clock.tick(10);
      markSlotHere(2, 10); // start 30, end 40

      engine.setMarkerEndOffset(0, -3);
      engine.clearMarker(1);

      expect(engine.markers()[2]?.start?.frame).toBe(30);
      expect(engine.markers()[2]?.end).toEqual({ frame: 40, offset: 0 });
      expect(engine.markers()[0]?.end?.offset).toBe(-3);
    });

    it('lets go of a cleared row that was playing, leaving the rest marked', async () => {
      await threeSlotsWithFirstLooping();
      engine.triggerMarker(1);

      engine.clearMarker(0);
      engine.clearMarker(1);

      expect(engine.loopingMarker()).toBeNull();
      expect(engine.queuedMarker()).toBeNull();
      expect(engine.markers()[0]).toEqual({ start: null, end: null });
      expect(engine.markers()[2].start).not.toBeNull();
      expect(engine.markers()[2].end).not.toBeNull();
    });

    it('keeps every marked row through pause, stop and a play from stopped', async () => {
      await markLoop(0, 10, 10);

      engine.pause();
      expect(engine.markers()[0]?.start).not.toBeNull();
      expect(engine.markers()[0]?.end).not.toBeNull();

      await engine.play();
      engine.stop();
      expect(engine.markers()[0]?.start).not.toBeNull();

      await engine.play();
      expect(engine.markers()[0]?.start).not.toBeNull();
      expect(engine.markers()[0]?.end).not.toBeNull();
    });

    it('clears every marker on loadTune, since a start holds a machine image', async () => {
      await threeSlotsWithFirstLooping();
      engine.triggerMarker(1);

      engine.loadTune(counterTune());

      expect(engine.markers()).toEqual([]);
      expect(engine.loopingMarker()).toBeNull();
      expect(engine.queuedMarker()).toBeNull();
    });
  });

  describe('the whole-tune loop, and a manual scrub that always wins', () => {
    /** `counterTune` stores its play-call count into $D400, so slot 0 of a resync packet names the
     * frame whatever was restored actually came from. */
    const COUNTER_SLOT = 0;

    /** SysEx data bytes carry seven bits, so the counter reads back modulo 128. */
    function counterAt(frame: number): number {
      return frame % 128;
    }

    async function playTo(frames: number): Promise<void> {
      engine.loadTune(counterTune());
      await engine.play();
      clock.tick(frames);
    }

    /** Publishes a record and waits out the off-thread re-entry image it asks for — the tick path no
     *  longer produces one, so a non-zero loop start has nothing to re-enter through until this
     *  settles. */
    async function publishIndex(overrides: Partial<TuneIndexRecord>): Promise<void> {
      engine.setTuneIndex(fakeTuneIndexRecord(overrides));
      await engine.captureTuneLoopEntry();
    }

    it('re-enters at the tune start once the first lap ends, and loops again a lap later', async () => {
      await playTo(0);
      engine.setTuneIndex(fakeTuneIndexRecord({ loopStartFrame: 0, loopPeriodFrames: 20 }));

      clock.tick(20); // reaches the loop point, queuing a restore
      clock.tick(2); // gate-off, then the resync — drains the queued pair and publishes stats

      expect(engine.stats().framesRendered).toBe(0);
      expect(slotValue(lastDataPacket(midi), COUNTER_SLOT)).toBe(counterAt(0));
      expect(engine.state()).toBe('playing'); // an indefinite loop, not a one-shot

      clock.tick(20); // a lap later, crosses the same point again
      clock.tick(2);

      expect(engine.stats().framesRendered).toBe(0);
    });

    it('runs straight past a tune with no detected structure, whichever way repeat is set', async () => {
      await playTo(0);
      engine.setTuneIndex(
        fakeTuneIndexRecord({ loopStartFrame: null, loopPeriodFrames: null, endedAtFrame: null })
      );
      expect(engine.trackEndFrame()).toBeNull();

      clock.tick(25);
      expect(engine.state()).toBe('playing');
      expect(engine.stats().framesRendered).toBe(25);

      engine.setRepeatTrack(false);
      clock.tick(25);

      expect(engine.state()).toBe('playing'); // never enters 'ended' — there is no end point to reach
      expect(engine.stats().framesRendered).toBe(50);
    });

    it('arms a loop that starts after an intro against the end of its first lap, not against the period', async () => {
      await playTo(0);
      await publishIndex({ loopStartFrame: 10, loopPeriodFrames: 20 });

      expect(engine.trackEndFrame()).toBe(30);

      clock.tick(25); // past the bare period, still short of the intro plus a lap
      expect(engine.stats().framesRendered).toBe(25);

      clock.tick(5); // reaches frame 30, queuing a restore
      clock.tick(2); // gate-off, then the resync

      expect(engine.stats().framesRendered).toBe(10); // back to the loop start, not to the top
    });

    it('re-enters an intro tune at its loop start, so the intro plays once and the lap repeats', async () => {
      await playTo(0);
      await publishIndex({ loopStartFrame: 10, loopPeriodFrames: 20 });

      clock.tick(30); // through the intro and the first lap, queuing a restore
      clock.tick(2); // gate-off, then the resync

      expect(engine.stats().framesRendered).toBe(10);
      // The machine as it stood at frame 10 — the intro is behind it, not about to replay.
      expect(slotValue(lastDataPacket(midi), COUNTER_SLOT)).toBe(counterAt(10));

      clock.tick(20); // a lap later, reaching the same out-frame from the loop start
      clock.tick(2);

      expect(engine.stats().framesRendered).toBe(10);
      expect(slotValue(lastDataPacket(midi), COUNTER_SLOT)).toBe(counterAt(10));
    });

    it('re-enters at the loop start after a scrub past it, with no frame of playback ever crossing it', async () => {
      await playTo(0);
      await publishIndex({ loopStartFrame: 10, loopPeriodFrames: 20 });

      await engine.scrubTo(50); // frame 15 — past the loop start, which playback never reached
      clock.tick(2); // drains the scrub's gate-off/resync while still playing
      expect(engine.stats().framesRendered).toBe(15);

      clock.tick(15); // on to the out-frame at 30, queuing a restore
      clock.tick(2); // gate-off, then the resync

      // Straight-through playback cannot reach this: the loop start was skipped over, and only the
      // replayed image makes the wrap land on it rather than degrading to the top of the tune.
      expect(engine.stats().framesRendered).toBe(10);
      expect(slotValue(lastDataPacket(midi), COUNTER_SLOT)).toBe(counterAt(10));
    });

    it('falls back to the tune start while the entry image is still in flight', async () => {
      await playTo(0);
      replay.manual = true;
      engine.setTuneIndex(fakeTuneIndexRecord({ loopStartFrame: 10, loopPeriodFrames: 20 }));

      clock.tick(30); // reaches the out-frame with nothing to re-enter through yet
      clock.tick(2); // gate-off, then the resync

      expect(engine.stats().framesRendered).toBe(0);
      expect(slotValue(lastDataPacket(midi), COUNTER_SLOT)).toBe(counterAt(0));
    });

    it('leaves the incoming tune without an entry image when a tune change lands mid-capture', async () => {
      await playTo(0);
      replay.manual = true;
      engine.setTuneIndex(fakeTuneIndexRecord({ loopStartFrame: 10, loopPeriodFrames: 20 }));
      const capture = engine.captureTuneLoopEntry();

      engine.loadTune(silentTune()); // the held replay describes the tune that just left
      await engine.play();
      // A start of 0 asks for no image of its own, so only a stale adoption could put one here.
      engine.setTuneIndex(fakeTuneIndexRecord({ loopStartFrame: 0, loopPeriodFrames: 20 }));
      replay.resolveAll();
      await capture;

      clock.tick(20); // reaches the out-frame, queuing a restore
      clock.tick(2);

      expect(engine.stats().framesRendered).toBe(0);
    });

    it('drops the entry image when the subtune changes mid-capture, falling back to the reseeded tune start', async () => {
      engine.loadTune(counterTune(2));
      await engine.play();
      replay.manual = true;
      engine.setTuneIndex(fakeTuneIndexRecord({ loopStartFrame: 10, loopPeriodFrames: 20 }));
      const capture = engine.captureTuneLoopEntry();

      engine.nextSubtune(); // re-inits the machine the held replay describes
      replay.resolveAll();
      await capture;

      clock.tick(30); // through the intro and the first lap of the new subtune
      clock.tick(2);

      expect(engine.stats().framesRendered).toBe(0);
    });

    it('replays an ended-detection tune from frame 0 once repeat reaches its end point, intro included', async () => {
      await playTo(0);
      engine.setTuneIndex(fakeTuneIndexRecord({ endedAtFrame: 40 }));

      // Basis and the end-of-track routing are fed from one record, so they are asserted together —
      // drifting apart is the failure mode.
      expect(engine.positionBasisFrames()).toBe(40);
      expect(engine.trackEndFrame()).toBe(40);

      clock.tick(40); // reaches the end point, queuing a restore
      clock.tick(2); // gate-off, then the resync

      expect(engine.stats().framesRendered).toBe(0);
      expect(slotValue(lastDataPacket(midi), COUNTER_SLOT)).toBe(counterAt(0));
      expect(engine.state()).toBe('playing');
    });

    it('ends an ended-detection tune once repeat is off, reporting ended and leaving the playhead at the end', async () => {
      await playTo(0);
      engine.setTuneIndex(fakeTuneIndexRecord({ endedAtFrame: 40 }));
      engine.setRepeatTrack(false);

      clock.tick(40); // reaches the end point

      expect(engine.state()).toBe('ended');
      expect(engine.stats().framesRendered).toBe(40); // left at the track's end, not reset
      expect(messageSequence(midi).at(-1)).toBe(ASID_MSG_STOP);
      expect(clock.running).toBe(false);
    });

    it('arms a verified loop however short it is — no plausibility gate', async () => {
      await playTo(0);
      engine.setTuneIndex(fakeTuneIndexRecord({ loopStartFrame: 0, loopPeriodFrames: 2 }));

      expect(engine.trackEndFrame()).toBe(2);
      expect(engine.positionBasisFrames()).toBe(2);
    });

    it('ends a looping tune once repeat is off, instead of wrapping', async () => {
      await playTo(0);
      engine.setTuneIndex(fakeTuneIndexRecord({ loopStartFrame: 0, loopPeriodFrames: 20 }));
      engine.setRepeatTrack(false);

      clock.tick(20); // reaches the out-frame

      expect(engine.state()).toBe('ended');
      expect(engine.stats().framesRendered).toBe(20); // left at the track's end, not reset
      expect(messageSequence(midi).at(-1)).toBe(ASID_MSG_STOP);
      expect(clock.running).toBe(false);
    });

    it('endTrack leaves framesRendered at the track end; stop() still resets it', async () => {
      await playTo(0);
      engine.setTuneIndex(fakeTuneIndexRecord({ loopStartFrame: 0, loopPeriodFrames: 20 }));
      engine.setRepeatTrack(false);
      clock.tick(20);
      expect(engine.state()).toBe('ended');
      expect(engine.stats().framesRendered).toBe(20);

      engine.stop();

      expect(engine.state()).toBe('stopped');
      expect(engine.stats().framesRendered).toBe(0);
    });

    it('restarts from frame 0 when Play is pressed from ended', async () => {
      await playTo(0);
      engine.setTuneIndex(fakeTuneIndexRecord({ loopStartFrame: 0, loopPeriodFrames: 20 }));
      engine.setRepeatTrack(false);
      clock.tick(20);
      expect(engine.state()).toBe('ended');

      await engine.play();
      clock.tick(1);

      expect(engine.state()).toBe('playing');
      expect(slotValue(lastDataPacket(midi), COUNTER_SLOT)).toBe(counterAt(1));
    });

    it('discards a jump still in flight when the track ends, rather than landing after the state change', async () => {
      await playTo(0);
      engine.setTuneIndex(fakeTuneIndexRecord({ loopStartFrame: 0, loopPeriodFrames: 20 }));
      engine.setRepeatTrack(false);
      replay.manual = true;

      engine.scrubTo(50); // a scrub still replaying off-thread when the track ends
      clock.tick(20); // reaches the out-frame while the scrub is still in flight — ends the track

      expect(engine.state()).toBe('ended');
      expect(engine.stats().framesRendered).toBe(20);

      replay.resolveAll();
      await replay.settle();

      // The late-landing jump never reopened it: no restore, no resync, no audible resume.
      expect(engine.state()).toBe('ended');
      expect(engine.stats().framesRendered).toBe(20);
    });

    it('a manual scrub always wins: it stops a running marker loop, which then never pulls playback back', async () => {
      await playTo(10);
      engine.addMarker(); // start frame 10
      clock.tick(10); // frame 20
      engine.setMarkerEnd(0); // end frame 20
      await engine.triggerMarker(0);
      clock.tick(2); // drains the trigger's gate-off/resync
      expect(engine.loopingMarker()).toBe(0);

      await engine.scrubTo(50);
      clock.tick(2); // drains the scrub's gate-off/resync while still playing

      expect(engine.loopingMarker()).toBeNull();
      const afterScrub = engine.stats().framesRendered;
      expect(afterScrub).toBeGreaterThan(20); // well clear of the marker's out-frame

      clock.tick(30); // drives well past the marker's former out-frame at 20

      expect(engine.stats().framesRendered).toBeGreaterThan(afterScrub); // never pulled back
      expect(engine.loopingMarker()).toBeNull();
    });

    it('a manual scrub does not disturb the detected whole-tune structure, and it still wraps a lap later', async () => {
      await playTo(0);
      engine.setTuneIndex(fakeTuneIndexRecord({ loopStartFrame: 0, loopPeriodFrames: 20 }));
      expect(engine.trackEndFrame()).toBe(20);

      await engine.scrubTo(50); // frame 10, halfway through the lap
      clock.tick(2); // drains the scrub's gate-off/resync while still playing

      expect(engine.trackEndFrame()).toBe(20);
      expect(engine.stats().framesRendered).toBe(10);

      clock.tick(10); // on to the out-frame at 20
      clock.tick(2);

      expect(engine.stats().framesRendered).toBe(0);
    });

    it('an audition click in the Track Analysis panel shares scrubTo, so it drops the marker loop and spares the track loop', async () => {
      await playTo(10);
      engine.addMarker();
      clock.tick(10);
      engine.setMarkerEnd(0);
      await engine.triggerMarker(0);
      clock.tick(2);
      engine.setTuneIndex(fakeTuneIndexRecord({ loopStartFrame: 0, loopPeriodFrames: 20 }));

      await engine.scrubTo(50); // the audition click's own call site

      expect(engine.loopingMarker()).toBeNull();
      expect(engine.trackEndFrame()).toBe(20);
    });

    it('reads setRepeatTrack live: switching it back on before the out-frame arrives still wraps', async () => {
      await playTo(0);
      engine.setTuneIndex(fakeTuneIndexRecord({ loopStartFrame: 0, loopPeriodFrames: 20 }));

      engine.setRepeatTrack(false);
      engine.setRepeatTrack(true); // changed its mind before the out-frame ever arrived

      clock.tick(20); // reaches the out-frame, queuing a restore
      clock.tick(2); // gate-off, then the resync

      expect(engine.state()).toBe('playing');
      expect(engine.stats().framesRendered).toBe(0);
    });
  });

  describe('the repeat-track preference', () => {
    const REPEAT_TRACK_STORAGE_KEY = 'asid-dj-0.repeat-track';

    it('defaults to true when nothing is stored', () => {
      expect(engine.repeatTrack()).toBe(true);
    });

    it('persists a toggled value under the namespaced key', () => {
      engine.setRepeatTrack(false);

      expect(localStorage.getItem(REPEAT_TRACK_STORAGE_KEY)).toBe('false');
    });

    it('rides a tune change unchanged, and is not reset by loadTune', () => {
      engine.setRepeatTrack(false);

      engine.loadTune(silentTune());

      expect(engine.repeatTrack()).toBe(false);
    });

    it('round-trips through localStorage across a fresh construction of the engine, standing in for a reload', () => {
      engine.setRepeatTrack(false);

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          DjPlayerEngine,
          { provide: FRAME_CLOCK, useValue: new FakeFrameClock() },
          { provide: MidiOutputService, useValue: new FakeMidiOutputService() as unknown as MidiOutputService },
          { provide: REPLAY_RUNNER, useValue: new FakeReplayRunner() },
        ],
      });
      const reloaded = TestBed.inject(DjPlayerEngine);

      expect(reloaded.repeatTrack()).toBe(false);
    });

    it('constructs on the default when localStorage throws on read', () => {
      const getItemSpy = vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
        throw new Error('boom');
      });

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          DjPlayerEngine,
          { provide: FRAME_CLOCK, useValue: new FakeFrameClock() },
          { provide: MidiOutputService, useValue: new FakeMidiOutputService() as unknown as MidiOutputService },
          { provide: REPLAY_RUNNER, useValue: new FakeReplayRunner() },
        ],
      });

      let freshEngine!: DjPlayerEngine;
      expect(() => (freshEngine = TestBed.inject(DjPlayerEngine))).not.toThrow();
      expect(freshEngine.repeatTrack()).toBe(true);

      getItemSpy.mockRestore();
    });
  });

  describe('appending and deleting markers', () => {
    async function playTo(frames: number): Promise<void> {
      engine.loadTune(counterTune());
      await engine.play();
      clock.tick(frames);
    }

    it('starts the collection empty', () => {
      engine.loadTune(counterTune());

      expect(engine.markers()).toEqual([]);
    });

    it('appends on add, capturing the playhead and returning the new row index', async () => {
      await playTo(5);

      expect(engine.addMarker()).toBe(0);
      expect(engine.addMarker()).toBe(1);
      expect(engine.markers()).toHaveLength(2);
      expect(engine.markers()[0].start).not.toBeNull();
      expect(engine.markers()[0].end).toBeNull();
      expect(engine.markers()[1].start).not.toBeNull();
    });

    it('removes a row outright on delete, shifting later rows down', async () => {
      await playTo(5);
      engine.addMarker(); // frame 5
      clock.tick(5);
      engine.addMarker(); // frame 10
      clock.tick(5);
      engine.addMarker(); // frame 15

      engine.deleteMarker(0);

      const markers = engine.markers();
      expect(markers).toHaveLength(2);
      expect(markers[0].start?.frame).toBe(10);
      expect(markers[1].start?.frame).toBe(15);
    });

    it('is a no-op to delete an index beyond the collection', async () => {
      await playTo(5);
      engine.addMarker();

      engine.deleteMarker(5);
      engine.deleteMarker(-1);

      expect(engine.markers()).toHaveLength(1);
    });

    it('refills a cleared row by capturing into it again, landing at the new position', async () => {
      await playTo(10);
      engine.addMarker(); // frame 10
      engine.clearMarker(0);

      clock.tick(10);
      engine.captureMarkerStart(0);

      const marker = engine.markers()[0];
      expect(marker.start).not.toBeNull();
      expect(marker.start?.frame).toBe(20);
    });

    it('is a no-op to captureMarkerStart an index beyond the collection', async () => {
      await playTo(10);

      engine.captureMarkerStart(0);

      expect(engine.markers()).toHaveLength(0);
    });
  });

  describe('deleting a marker shifts the looping and queued index seam', () => {
    /** Three rows on a loaded tune — the table below drives `loopingMarker`/`queuedMarker` directly
     *  to isolate the index shift from `engageMarker`'s own resolution checks. */
    function threeRows(): void {
      engine.loadTune(counterTune());
      engine.addMarker();
      engine.addMarker();
      engine.addMarker();
    }

    it.each([
      { label: 'before', deleteIndex: 0, activeBefore: 2, activeAfter: 1 },
      { label: 'at', deleteIndex: 1, activeBefore: 1, activeAfter: null },
      { label: 'after', deleteIndex: 2, activeBefore: 0, activeAfter: 0 },
    ])(
      'deleting $label the looping index leaves loopingMarker at $activeAfter',
      ({ deleteIndex, activeBefore, activeAfter }) => {
        threeRows();
        engine.loopingMarker.set(activeBefore);

        engine.deleteMarker(deleteIndex);

        expect(engine.loopingMarker()).toBe(activeAfter);
      }
    );

    it.each([
      { label: 'before', deleteIndex: 0, queuedBefore: 2, queuedAfter: 1 },
      { label: 'at', deleteIndex: 1, queuedBefore: 1, queuedAfter: null },
      { label: 'after', deleteIndex: 2, queuedBefore: 0, queuedAfter: 0 },
    ])(
      'deleting $label the queued index leaves queuedMarker at $queuedAfter',
      ({ deleteIndex, queuedBefore, queuedAfter }) => {
        threeRows();
        engine.queuedMarker.set(queuedBefore);

        engine.deleteMarker(deleteIndex);

        expect(engine.queuedMarker()).toBe(queuedAfter);
      }
    );

    it('stops looping outright when the deleted row was both looping and queued', () => {
      threeRows();
      engine.loopingMarker.set(1);
      engine.queuedMarker.set(1);

      engine.deleteMarker(1);

      expect(engine.loopingMarker()).toBeNull();
      expect(engine.queuedMarker()).toBeNull();
    });
  });

  describe('launching from stopped or paused', () => {
    it('holds markerLaunchPending true for exactly the span of the play() await', async () => {
      engine.loadTune(counterTune());
      engine.addMarker();
      engine.stop();
      expect(engine.state()).toBe('stopped');
      expect(engine.markerLaunchPending()).toBe(false);

      const trigger = engine.triggerMarker(0);
      expect(engine.markerLaunchPending()).toBe(true);

      await trigger;
      expect(engine.markerLaunchPending()).toBe(false);
    });

    it('never sets markerLaunchPending when already playing, since the trigger stays synchronous', async () => {
      engine.loadTune(counterTune());
      await engine.play();
      engine.addMarker();

      const trigger = engine.triggerMarker(0);
      expect(engine.markerLaunchPending()).toBe(false);
      await trigger;
      expect(engine.markerLaunchPending()).toBe(false);
    });

    it('triggers a cue-shaped marker from stopped, launching playback and landing on it rather than frame 0', async () => {
      engine.loadTune(counterTune());
      await engine.play();
      clock.tick(20);
      engine.addMarker();
      engine.stop();
      expect(engine.state()).toBe('stopped');

      await engine.triggerMarker(0);

      expect(engine.state()).toBe('playing');
      clock.tick(2); // gate-off, then the resync
      expect(engine.stats().framesRendered).toBe(20);
    });

    it('triggers a cue-shaped marker from paused, resuming and landing on it', async () => {
      engine.loadTune(counterTune());
      await engine.play();
      clock.tick(20);
      engine.addMarker();
      clock.tick(10);
      engine.pause();

      await engine.triggerMarker(0);

      expect(engine.state()).toBe('playing');
      clock.tick(2);
      expect(engine.stats().framesRendered).toBe(20);
    });

    it('restores nothing when the launch from stopped fails', async () => {
      engine.loadTune(counterTune());
      await engine.play();
      clock.tick(20);
      engine.addMarker();
      engine.stop();
      midi.selectedPortId.set(null); // play() will now fail

      await engine.triggerMarker(0);

      expect(engine.state()).toBe('error');
      // stop() already reset the counters to 0; a landed marker would have moved them to 20.
      expect(engine.stats().framesRendered).toBe(0);
    });

    it('triggers a loop-shaped marker from stopped, launching playback and engaging it', async () => {
      engine.loadTune(counterTune());
      await engine.play();
      clock.tick(10);
      engine.addMarker();
      clock.tick(10);
      engine.setMarkerEnd(0);
      engine.stop();

      await engine.triggerMarker(0);

      expect(engine.state()).toBe('playing');
      expect(engine.loopingMarker()).toBe(0);
      clock.tick(2);
      expect(engine.stats().framesRendered).toBe(10);
    });

    it('triggers a loop-shaped marker from paused, resuming and engaging it', async () => {
      engine.loadTune(counterTune());
      await engine.play();
      clock.tick(10);
      engine.addMarker();
      clock.tick(10);
      engine.setMarkerEnd(0);
      engine.pause();

      await engine.triggerMarker(0);

      expect(engine.state()).toBe('playing');
      expect(engine.loopingMarker()).toBe(0);
    });

    it('restores nothing when the launch for a loop-shaped trigger from stopped fails', async () => {
      engine.loadTune(counterTune());
      await engine.play();
      clock.tick(10);
      engine.addMarker();
      clock.tick(10);
      engine.setMarkerEnd(0);
      engine.stop();
      midi.selectedPortId.set(null);

      await engine.triggerMarker(0);

      expect(engine.state()).toBe('error');
      expect(engine.loopingMarker()).toBeNull();
    });
  });

  describe('a cue trigger now waits for the lap, reversing the old instant-escape behaviour', () => {
    it('queues behind the running loop rather than clearing it on the spot, keeping every point intact', async () => {
      engine.loadTune(counterTune());
      await engine.play();
      clock.tick(10);
      engine.addMarker(); // marker 0: start 10, end 20
      clock.tick(10);
      engine.setMarkerEnd(0);
      engine.addMarker(); // marker 1: start 30, end 40
      clock.tick(10);
      engine.setMarkerEnd(1);

      await engine.triggerMarker(0);
      clock.tick(2); // rides the engagement's gate-off and resync
      await engine.triggerMarker(1); // nothing is due yet, so this queues behind marker 0's lap

      expect(engine.loopingMarker()).toBe(0);
      expect(engine.queuedMarker()).toBe(1);

      engine.addMarker(); // marker 2: a plain cue
      await engine.triggerMarker(2);

      // The cue replaces marker 1 in the queue rather than escaping the loop immediately — the
      // running lap is still marker 0's, unaffected until it finishes.
      expect(engine.loopingMarker()).toBe(0);
      expect(engine.queuedMarker()).toBe(2);
      expect(engine.markers()[0].start).not.toBeNull();
      expect(engine.markers()[0].end).not.toBeNull();
      expect(engine.markers()[1].start).not.toBeNull();
      expect(engine.markers()[1].end).not.toBeNull();

      // Once the lap finishes, the queued cue takes over and the loop lets go — the same end state
      // F61 used to reach instantly, now deferred to the lap boundary.
      clock.tick(10);
      expect(engine.loopingMarker()).toBeNull();
      expect(engine.queuedMarker()).toBeNull();
    });

    it('does not disturb a loop-to-loop switch, which still waits for the lap', async () => {
      engine.loadTune(counterTune());
      await engine.play();
      clock.tick(10);
      engine.addMarker(); // marker 0: start 10, end 20
      clock.tick(10);
      engine.setMarkerEnd(0);
      engine.addMarker(); // marker 1: start 30, end 40
      clock.tick(10);
      engine.setMarkerEnd(1);

      await engine.triggerMarker(0);
      clock.tick(2);
      await engine.triggerMarker(1); // queued, waiting for marker 0's lap to finish

      expect(engine.queuedMarker()).toBe(1);
      clock.tick(9); // nine of the ten remaining frames in marker 0's lap
      expect(engine.loopingMarker()).toBe(0);

      clock.tick(1); // the lap completes — the queued switch lands on its own, untouched by any cue
      expect(engine.loopingMarker()).toBe(1);
      expect(engine.queuedMarker()).toBeNull();
    });
  });

  describe('the end audition', () => {
    /** `counterTune` stores its play-call count into $D400, so slot 0 of a resync packet names the
     * frame the audition actually landed on. */
    const COUNTER_SLOT = 0;

    function counterAt(frame: number): number {
      return frame % 128;
    }

    async function playTo(frames: number): Promise<void> {
      engine.loadTune(counterTune());
      await engine.play();
      clock.tick(frames);
    }

    /** Appends rows until `index` exists. */
    function ensureMarkerRow(index: number): void {
      while (engine.markers().length <= index) {
        engine.addMarker();
      }
    }

    /** Marks a row from the current position: start here, end `length` frames later. */
    function markSlotHere(index: number, length: number): void {
      ensureMarkerRow(index);
      engine.captureMarkerStart(index);
      clock.tick(length);
      engine.setMarkerEnd(index);
    }

    /** Marks one row on a fresh tune: start at `startFrame`, end `length` frames later. */
    async function markLoop(index: number, startFrame: number, length: number): Promise<void> {
      await playTo(startFrame);
      markSlotHere(index, length);
    }

    it('resumes pre-roll frames before the end and wraps to the start on the seam', async () => {
      await markLoop(0, 10, 200); // start 10, end 210
      const target = 210 - expectedPrerollFrames();

      engine.auditionMarkerEnd(0);
      clock.tick(2); // the gate-off, then the resync carrying the pre-roll's registers

      expect(engine.stats().framesRendered).toBe(target);
      expect(slotValue(lastDataPacket(midi), COUNTER_SLOT)).toBe(counterAt(target));
    });

    it('clamps to the start when the pre-roll is longer than the loop', async () => {
      await markLoop(0, 300, 50); // start 300, end 350 — shorter than the 2 s pre-roll
      const runFrame = vi.spyOn(C64Machine.prototype, 'runFrame');

      engine.auditionMarkerEnd(0);

      // No forward replay at all: target clamps straight to the start restorePoint already reached.
      expect(runFrame).not.toHaveBeenCalled();
      clock.tick(2);
      expect(engine.stats().framesRendered).toBe(300);
      expect(slotValue(lastDataPacket(midi), COUNTER_SLOT)).toBe(counterAt(300));
    });

    it('bounds the replay to the loop length, not to how deep the loop sits in the tune', async () => {
      await markLoop(0, 1000, 300); // start 1000, end 1300 — deep in the tune
      const runFrame = vi.spyOn(C64Machine.prototype, 'runFrame');

      engine.auditionMarkerEnd(0);

      expect(runFrame).toHaveBeenCalledTimes(300 - expectedPrerollFrames());
    });

    it('makes the audited marker active immediately rather than queueing it', async () => {
      await markLoop(0, 5, 100); // start 5, end 105
      await markLoop(1, 200, 300); // start 200, end 500
      engine.triggerMarker(0);
      clock.tick(2);

      engine.auditionMarkerEnd(1);

      // Immediate, not the wait-for-lap rule a trigger follows — a queued switch would leave
      // marker 0 active until its lap finished, with nothing to hear yet.
      expect(engine.loopingMarker()).toBe(1);
      expect(engine.queuedMarker()).toBeNull();
    });

    it('is a no-op for a marker that does not resolve to a loop', async () => {
      await playTo(10);
      engine.addMarker(); // no end marked yet

      engine.auditionMarkerEnd(0);

      expect(engine.loopingMarker()).toBeNull();
    });

    it('derives the pre-roll from the tune rate at 1x and 2x, never the live speed', async () => {
      await markLoop(0, 10, 300); // start 10, end 310
      engine.setSpeed(1.2);
      const runFrame1x = vi.spyOn(C64Machine.prototype, 'runFrame');
      engine.auditionMarkerEnd(0);
      expect(runFrame1x).toHaveBeenCalledTimes(300 - expectedPrerollFrames());

      engine.loadTune(doubleSpeedCounterTune());
      await engine.play();
      clock.tick(10);
      markSlotHere(0, 300); // start 10, end 310, at 2x
      const runFrame2x = vi.spyOn(C64Machine.prototype, 'runFrame');

      engine.auditionMarkerEnd(0);

      expect(runFrame2x).toHaveBeenCalledTimes(300 - expectedPrerollFrames(2));
    });
  });

  describe('the start audition', () => {
    async function playTo(frames: number): Promise<void> {
      engine.loadTune(counterTune());
      await engine.play();
      clock.tick(frames);
    }

    function ensureMarkerRow(index: number): void {
      while (engine.markers().length <= index) {
        engine.addMarker();
      }
    }

    function markSlotHere(index: number, length: number): void {
      ensureMarkerRow(index);
      engine.captureMarkerStart(index);
      clock.tick(length);
      engine.setMarkerEnd(index);
    }

    async function markLoop(index: number, startFrame: number, length: number): Promise<void> {
      await playTo(startFrame);
      markSlotHere(index, length);
    }

    it('makes the audited marker active immediately rather than queueing it', async () => {
      await markLoop(0, 5, 100); // start 5, end 105
      await markLoop(1, 200, 300); // start 200, end 500
      engine.triggerMarker(0);
      clock.tick(2);

      engine.auditionMarkerStart(1);

      // Immediate, not the wait-for-lap rule a trigger follows — a queued switch would leave
      // marker 0 active with nothing to hear yet from the nudged marker.
      expect(engine.loopingMarker()).toBe(1);
      expect(engine.queuedMarker()).toBeNull();
    });

    it('restores the marker to its start', async () => {
      await markLoop(0, 50, 200); // start 50, end 250

      engine.auditionMarkerStart(0);
      clock.tick(2); // the gate-off, then the resync carrying the restored registers

      expect(engine.stats().framesRendered).toBe(50);
    });

    it('is a no-op for a row with no start', async () => {
      await playTo(10);
      engine.addMarker();
      engine.clearMarker(0);

      engine.auditionMarkerStart(0);

      expect(engine.loopingMarker()).toBeNull();
    });
  });

  describe('the nudge range', () => {
    it('derives ~1 s of frames from the tune rate at 1x', () => {
      engine.loadTune(counterTune());

      expect(engine.nudgeRangeFrames()).toBe(
        Math.round((NUDGE_RANGE_MS * 1000) / PAL_FRAME_INTERVAL_US)
      );
    });

    it('doubles the frame count on a 2x-multispeed tune, covering the same wall-clock span', () => {
      engine.loadTune(doubleSpeedCounterTune());

      expect(engine.nudgeRangeFrames()).toBe(
        Math.round((NUDGE_RANGE_MS * 1000 * 2) / PAL_FRAME_INTERVAL_US)
      );
    });

    it('falls back to the PAL nominal interval so the range is never zero or NaN with no tune loaded', () => {
      expect(engine.nudgeRangeFrames()).toBe(
        Math.round((NUDGE_RANGE_MS * 1000) / PAL_FRAME_INTERVAL_US)
      );
    });

    it('does not change when the speed fader moves — only the tune rate, never the live speed', async () => {
      engine.loadTune(counterTune());
      await engine.play();
      const before = engine.nudgeRangeFrames();

      engine.setSpeed(1.2);
      expect(engine.nudgeRangeFrames()).toBe(before);

      engine.setSpeed(0.8);
      expect(engine.nudgeRangeFrames()).toBe(before);
    });

    it('resolves a marker captured deep into a 2x-multispeed tune against a recent anchor, not the frame-0 seed', async () => {
      engine.loadTune(doubleSpeedCounterTune());
      await engine.play();
      // Well past the old fixed 75-frame ring span, deep enough that replaying from the frame-0 seed
      // would need hundreds of frames — the regression this ring resize exists to prevent.
      clock.tick(400);
      engine.addMarker();

      const runFrame = vi.spyOn(C64Machine.prototype, 'runFrame');
      engine.setMarkerStartOffset(0, -engine.nudgeRangeFrames());

      // A replay from the frame-0 seed would run ~400 frames; one from a recent anchor is bounded by
      // the anchor spacing plus the nudge range, well under that.
      expect(runFrame.mock.calls.length).toBeLessThan(200);
    });
  });

  describe('positionPercent', () => {
    it('derives from the published framesRendered against the jump ceiling', async () => {
      engine.loadTune(counterTune());
      await engine.play();

      const ceiling = expectedCeilingFrames();
      clock.tick(Math.round(ceiling * 0.1));

      expect(engine.positionPercent()).toBeCloseTo(engine.stats().framesRendered / ceiling * 100, 6);
    });

    it('clamps to 100 past the fixed ceiling rather than overflowing', async () => {
      engine.loadTune(counterTune());

      engine.scrubTo(100);
      await replay.settle();

      expect(engine.positionPercent()).toBe(100);
    });

    it('is 0 when the nominal interval is 0, guarding a zero ceiling', () => {
      engine.loadTune(counterTune());
      // setNominalIntervalUs() itself refuses <= 0 — this reaches the guard directly, the way a
      // divide-by-zero could otherwise slip through if the ceiling were ever computed as 0.
      engine.nominalIntervalUs.set(0);

      expect(engine.positionPercent()).toBe(0);
    });
  });

  describe('positionBasisFrames', () => {
    it('keeps the fixed ceiling as the basis with no tune index set', () => {
      engine.loadTune(counterTune());

      expect(engine.positionBasisFrames()).toBe(engine.ceilingFrames());
    });

    it('keeps the fixed ceiling when the record carries no loop and no end point', () => {
      engine.loadTune(counterTune());

      engine.setTuneIndex(fakeTuneIndexRecord({ loopStartFrame: null, loopPeriodFrames: null }));

      expect(engine.positionBasisFrames()).toBe(engine.ceilingFrames());
      expect(engine.trackEndFrame()).toBeNull();
    });

    it('keeps the fixed ceiling for a zero or negative loop period', () => {
      engine.loadTune(counterTune());

      engine.setTuneIndex(fakeTuneIndexRecord({ loopStartFrame: 0, loopPeriodFrames: 0 }));
      expect(engine.positionBasisFrames()).toBe(engine.ceilingFrames());

      engine.setTuneIndex(fakeTuneIndexRecord({ loopStartFrame: 0, loopPeriodFrames: -10 }));
      expect(engine.positionBasisFrames()).toBe(engine.ceilingFrames());
    });

    it('adopts one intro plus one lap as the basis, and positionPercent reads 0/50/100 against it', async () => {
      engine.loadTune(counterTune());
      engine.setTuneIndex(fakeTuneIndexRecord({ loopStartFrame: 0, loopPeriodFrames: 2_500 }));

      expect(engine.positionBasisFrames()).toBe(2_500);

      engine.scrubTo(0);
      await replay.settle();
      expect(engine.positionPercent()).toBe(0);

      engine.scrubTo(50);
      await replay.settle();
      expect(engine.stats().framesRendered).toBe(1_250);
      expect(engine.positionPercent()).toBeCloseTo(50, 6);

      engine.scrubTo(100);
      await replay.settle();
      expect(engine.positionPercent()).toBe(100);
    });

    it('moves the basis while a tune is already playing, with no reload', async () => {
      engine.loadTune(counterTune());
      await engine.play();
      clock.tick(1);
      expect(engine.positionBasisFrames()).toBe(engine.ceilingFrames());

      engine.setTuneIndex(fakeTuneIndexRecord({ loopStartFrame: 0, loopPeriodFrames: 100 }));

      expect(engine.positionBasisFrames()).toBe(100);
      expect(engine.positionPercent()).toBeCloseTo(
        (engine.stats().framesRendered / 100) * 100,
        6
      );
    });

    it('reverts to the fixed ceiling and drops the detected loop when a fresh tune replaces the indexed one', () => {
      engine.loadTune(counterTune());
      engine.setTuneIndex(fakeTuneIndexRecord({ loopStartFrame: 0, loopPeriodFrames: 2_500 }));
      expect(engine.positionBasisFrames()).toBe(2_500);
      expect(engine.trackEndFrame()).toBe(2_500);

      engine.loadTune(counterTune());

      expect(engine.positionBasisFrames()).toBe(engine.ceilingFrames());
      expect(engine.trackEndFrame()).toBeNull();
    });

    it("adopts the record's timing mode through the public setter, so the clock moves with it", () => {
      engine.loadTune(counterTune());
      expect(engine.timingMode()).toBe(DEFAULT_TIMING_MODE);

      engine.setTuneIndex(fakeTuneIndexRecord({ timingMode: 'rounded' }));
      expect(engine.timingMode()).toBe('rounded');
      expect(engine.playRate().mode).toBe('rounded');

      engine.setTuneIndex(null);
      expect(engine.timingMode()).toBe(DEFAULT_TIMING_MODE);
    });
  });
});
