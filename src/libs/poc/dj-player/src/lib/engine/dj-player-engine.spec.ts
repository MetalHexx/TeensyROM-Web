import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createEnvironmentInjector, EnvironmentInjector, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ASID_MSG_FRAMERATE_RECIPE,
  ASID_MSG_SID_DATA,
  ASID_MSG_SID_TYPE,
  ASID_MSG_START,
  ASID_MSG_STOP,
  PAL_FRAME_INTERVAL_US,
} from '../asid/asid-constants';
import { buildFramerateRecipePacket } from '../asid/asid-encoder';
import { MidiOutputService } from '../midi/midi-output.service';
import type { SidClock, SidFile, SidModel } from '../sid/sid-file.model';
import type { FrameClock, FrameClockStats } from '../clock/frame-clock';
import { DjPlayerEngine, FRAME_CLOCK, RECIPE_RESEND_DEBOUNCE_MS } from './dj-player-engine';

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
  };

  private onFrame: (() => void) | null = null;

  start(intervalUs: number, onFrame: () => void): Promise<void> {
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
      this.onFrame?.();
    }
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
  readonly sent: SentPacket[] = [];

  send(bytes: Uint8Array, timestampMs?: number): void {
    this.sent.push({ bytes: Uint8Array.from(bytes), timestampMs });
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

describe('DjPlayerEngine', () => {
  let engine: DjPlayerEngine;
  let clock: FakeFrameClock;
  let midi: FakeMidiOutputService;

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    clock = new FakeFrameClock();
    midi = new FakeMidiOutputService();

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        DjPlayerEngine,
        { provide: FRAME_CLOCK, useValue: clock },
        { provide: MidiOutputService, useValue: midi as unknown as MidiOutputService },
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

    expect(messageSequence(midi)).toEqual([
      ASID_MSG_SID_TYPE,
      ASID_MSG_START,
      ASID_MSG_FRAMERATE_RECIPE,
    ]);

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
    expect(packetsOfType(midi, ASID_MSG_FRAMERATE_RECIPE)[0].bytes).toEqual(
      buildFramerateRecipePacket({
        ntsc: false,
        speedMultiplier: 2,
        bufferingRequested: true,
        frameIntervalUs: PAL_FRAME_INTERVAL_US / 2,
      })
    );
  });

  it('divides the clock interval by the speed multiplier, clamped to its range', async () => {
    engine.loadTune(silentTune());
    await engine.play();

    engine.setSpeed(1.2);
    expect(clock.intervalUs).toBeCloseTo(PAL_FRAME_INTERVAL_US / 1.2, 6);

    engine.setSpeed(5);
    expect(engine.speedMultiplier()).toBe(1.2);
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

  describe('recipe resends', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('never resends the recipe in clock-only mode', async () => {
      engine.loadTune(silentTune());
      await engine.play();
      const resendsBefore = packetsOfType(midi, ASID_MSG_FRAMERATE_RECIPE).length;

      engine.setSpeed(1.1);
      vi.advanceTimersByTime(RECIPE_RESEND_DEBOUNCE_MS * 4);

      expect(packetsOfType(midi, ASID_MSG_FRAMERATE_RECIPE)).toHaveLength(resendsBefore);
      expect(clock.intervalUs).toBeCloseTo(PAL_FRAME_INTERVAL_US / 1.1, 6);
    });

    it('collapses a sweep of speed changes into one resend after the debounce', async () => {
      engine.loadTune(silentTune());
      engine.setSpeedMode('clock-and-recipe');
      await engine.play();
      const resendsBefore = packetsOfType(midi, ASID_MSG_FRAMERATE_RECIPE).length;

      engine.setSpeed(1.05);
      engine.setSpeed(1.1);
      vi.advanceTimersByTime(RECIPE_RESEND_DEBOUNCE_MS - 1);
      engine.setSpeed(1.15);
      vi.advanceTimersByTime(RECIPE_RESEND_DEBOUNCE_MS - 1);

      expect(packetsOfType(midi, ASID_MSG_FRAMERATE_RECIPE)).toHaveLength(resendsBefore);

      vi.advanceTimersByTime(1);

      const resends = packetsOfType(midi, ASID_MSG_FRAMERATE_RECIPE);
      expect(resends).toHaveLength(resendsBefore + 1);
      expect(resends.at(-1)?.bytes).toEqual(
        buildFramerateRecipePacket({
          ntsc: false,
          speedMultiplier: 1,
          bufferingRequested: true,
          frameIntervalUs: Math.round(PAL_FRAME_INTERVAL_US / 1.15),
        })
      );
    });

    it('drops a pending resend when playback stops before the debounce elapses', async () => {
      engine.loadTune(silentTune());
      engine.setSpeedMode('clock-and-recipe');
      await engine.play();
      engine.setSpeed(1.1);
      const resendsBefore = packetsOfType(midi, ASID_MSG_FRAMERATE_RECIPE).length;

      engine.stop();
      vi.advanceTimersByTime(RECIPE_RESEND_DEBOUNCE_MS * 2);

      expect(packetsOfType(midi, ASID_MSG_FRAMERATE_RECIPE)).toHaveLength(resendsBefore);
    });
  });
});
