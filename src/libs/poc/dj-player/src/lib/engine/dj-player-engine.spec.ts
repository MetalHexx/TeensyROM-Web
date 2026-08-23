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
import { C64Machine } from '../cpu/c64-machine';
import {
  DjPlayerEngine,
  FRAME_CLOCK,
  JUMP_CEILING_SECONDS,
  NUDGE_RANGE_MS,
  RECIPE_RESEND_DEBOUNCE_MS,
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

/** init sets each voice's control register once, non-zero, and never touches it again; play
 * increments a zero-page counter and stores it into $D400 every frame. Mirrors `doubleSpeedTune`'s
 * hand-assembled-bytes style, but — unlike `silentTune` — its output actually depends on how many
 * frames ran, which is what the jump primitive's tests need. */
function counterTune(): SidFile {
  return tune({
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

/** The value byte for a given present slot within a SID data packet (see `buildSidDataPacket`). */
function slotValue(packet: SentPacket, slot: number): number {
  return packet.bytes[SID_DATA_PACKET_OVERHEAD - 1 + slot];
}

/** After a jump's `markAllDirty()` snapshot, slots 22/23/24 are the three voice control registers
 * ($D404/$D40B/$D412) — see `withVoiceGatesOff` in `dj-player-engine.ts`. */
function voiceGateValues(packet: SentPacket): number[] {
  return [22, 23, 24].map((slot) => slotValue(packet, slot));
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

  it('resets mutedVoices to all-unmuted when a new tune loads', () => {
    engine.loadTune(silentTune());
    engine.setVoiceMuted(1, true);
    expect(engine.mutedVoices()).toEqual([false, true, false]);

    engine.loadTune(silentTune());

    expect(engine.mutedVoices()).toEqual([false, false, false]);
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

  describe('the jump primitive: cue, loop and scrub', () => {
    it('produces byte-identical replayed output when jumping to the same frame twice', () => {
      engine.loadTune(counterTune());

      engine.scrubTo(5);
      const first = lastDataPacket(midi).bytes;
      engine.scrubTo(5);
      const second = lastDataPacket(midi).bytes;

      expect(second).toEqual(first);
      // Sanity: the replay actually depends on how many frames ran, so a bug that always landed on
      // frame 0 could not pass the identity check above by coincidence.
      expect(slotValue(lastDataPacket(midi), 0)).toBeGreaterThan(0);
    });

    it('hops to a captured cue at exactly the frame it was captured, regardless of what played after', async () => {
      engine.loadTune(counterTune());
      await engine.play();
      clock.tick(5);
      engine.addCue(0);
      clock.tick(10);

      engine.hopToCue(0);
      clock.tick(2); // gate-off, then the resync — the packet under test
      const hopped = lastDataPacket(midi).bytes;

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
      freshEngine.addCue(0);
      freshEngine.hopToCue(0); // captured and restored back to back, nothing played in between
      freshClock.tick(2);

      expect(hopped).toEqual(lastDataPacket(freshMidi).bytes);
    });

    it('clears a captured cue back to null, and leaves other slots untouched', () => {
      engine.loadTune(counterTune());
      engine.addCue(0);
      engine.addCue(2);

      engine.clearCue(0);

      const cues = engine.cues();
      expect(cues[0]).toBeNull();
      expect(cues[2]).not.toBeNull();
      expect([cues[1], cues[3]]).toEqual([null, null]);
    });

    it('survives stop() and a play from stopped, since neither rebuilds the tune', async () => {
      engine.loadTune(counterTune());
      await engine.play();
      clock.tick(5);
      engine.addCue(0);

      engine.stop();
      expect(engine.cues()[0]).not.toBeNull();

      await engine.play();
      expect(engine.cues()[0]).not.toBeNull();
    });

    it('clears every slot on loadTune, since a new tune invalidates every captured snapshot', async () => {
      engine.loadTune(counterTune());
      await engine.play();
      clock.tick(5);
      engine.addCue(0);
      engine.addCue(2);

      engine.loadTune(counterTune());

      expect(engine.cues()).toEqual([null, null, null, null]);
    });

    it('restores a cue without re-emulating, so the machine keeps running forward from it', async () => {
      engine.loadTune(counterTune());
      await engine.play();
      clock.tick(5);
      engine.addCue(0);
      const atCue = slotValue(lastDataPacket(midi), 0);

      clock.tick(20);
      expect(slotValue(lastDataPacket(midi), 0)).not.toBe(atCue);

      engine.hopToCue(0);
      clock.tick(2); // gate-off, then the resync carrying the cue's registers
      expect(slotValue(lastDataPacket(midi), 0)).toBe(atCue);
      expect(engine.stats().framesRendered).toBe(5);

      // The restored machine is live, not a frozen snapshot: the counter keeps climbing from where
      // the cue put it back, which a shallow value-only restore would not manage.
      clock.tick(1);
      expect(slotValue(lastDataPacket(midi), 0)).toBeGreaterThan(atCue);
    });

    it('sends nothing of its own on a hop, then gate-off and resync on the next two ticks', async () => {
      engine.loadTune(counterTune());
      await engine.play();
      clock.tick(5);
      engine.addCue(0);
      clock.tick(5);

      const before = dataPackets(midi).length;
      engine.hopToCue(0);
      // The cartridge drains exactly one packet per timer tick, so a hop that sent its own packets
      // here would hand it frames it never drains.
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
      // re-attacks it — the chip sees 1 -> 0 -> 1 rather than carrying the pre-hop note across.
      expect(voiceGateValues(resync[0])).toEqual([0x11, 0x11, 0x11]);
    });

    it('holds the packet rate at one per tick however hard cues are spammed', async () => {
      engine.loadTune(counterTune());
      await engine.play();
      clock.tick(5);
      engine.addCue(0);
      clock.tick(5);
      engine.addCue(1);

      const before = dataPackets(midi).length;
      for (let i = 0; i < 50; i++) engine.hopToCue(i % 2);
      expect(dataPackets(midi)).toHaveLength(before);

      // Fifty hops between two ticks still cost two packets, not a hundred: a hop arriving while one
      // is pending replaces it rather than queueing behind it, so the newest hop is the one that
      // lands and no backlog survives to be played out.
      clock.tick(2);
      expect(dataPackets(midi)).toHaveLength(before + 2);

      clock.tick(1);
      expect(dataPackets(midi)).toHaveLength(before + 3);
    });

    it('resyncs immediately when a jump lands with the clock stopped', () => {
      engine.loadTune(counterTune());

      const before = dataPackets(midi).length;
      engine.scrubTo(5);

      // Nothing is ticking, so there is no tick to ride and nothing to stay in step with.
      expect(dataPackets(midi).length).toBeGreaterThan(before);
    });

    it('forces the voice gates off in the resync packet when a jump lands while paused', async () => {
      engine.loadTune(counterTune());
      await engine.play();
      clock.tick(3);
      engine.pause();

      engine.scrubTo(5);
      const pausedPacket = lastDataPacket(midi);

      expect(voiceGateValues(pausedPacket)).toEqual([0, 0, 0]);
      expect(engine.state()).toBe('paused');

      // The replay's own computed state is not actually zero — resuming and repeating the same jump
      // while playing proves the masking above is a paused-only override, not the tune's real state.
      await engine.play();
      engine.scrubTo(5);
      clock.tick(2); // playing now, so the resync rides the clock rather than going out here
      const playingPacket = lastDataPacket(midi);

      expect(voiceGateValues(playingPacket)).toEqual([0x11, 0x11, 0x11]);
    });

    it("reports a muted voice's control register as 0 in a jump's resync packet, leaving the others live", () => {
      engine.loadTune(counterTune());
      engine.setVoiceMuted(1, true);

      engine.scrubTo(5);

      const gates = voiceGateValues(lastDataPacket(midi));
      expect(gates[1]).toBe(0);
      expect(gates[0]).toBeGreaterThan(0);
      expect(gates[2]).toBeGreaterThan(0);
    });

    it("seeds a jump's replay frame from the effective (held) set rather than the latched one", () => {
      engine.loadTune(counterTune());
      engine.setVoiceHeld(1, true); // voice 1 is audible (latched); held inverts it to muted

      engine.scrubTo(5);

      const gates = voiceGateValues(lastDataPacket(midi));
      expect(gates[1]).toBe(0);
      expect(gates[0]).toBeGreaterThan(0);
      expect(gates[2]).toBeGreaterThan(0);
    });

    it('resets position when the subtune changes, but leaves captured points alone', async () => {
      engine.loadTune(silentTune(2));
      await engine.play();
      clock.tick(5);
      engine.addCue(0);
      engine.tapLoopIn(0);
      clock.tick(5);
      engine.tapLoopOut(0);
      engine.setVoiceMuted(1, true);

      engine.nextSubtune();

      expect(engine.stats().framesRendered).toBe(0);
      expect(engine.cues()[0]).not.toBeNull();
      expect(engine.loopSlots()[0]?.in).not.toBeNull();
      expect(engine.loopSlots()[0]?.out).not.toBeNull();
      expect(engine.mutedVoices()).toEqual([false, true, false]);
    });

    it('resolves 0%/100% to frame 0 and the jump ceiling exactly, clamping out-of-range input', () => {
      engine.loadTune(counterTune());
      const ceiling = expectedCeilingFrames();

      engine.scrubTo(0);
      expect(engine.stats().framesRendered).toBe(0);

      engine.scrubTo(100);
      expect(engine.stats().framesRendered).toBe(ceiling);

      engine.scrubTo(-25);
      expect(engine.stats().framesRendered).toBe(0);

      engine.scrubTo(140);
      expect(engine.stats().framesRendered).toBe(ceiling);
    });

    it('aborts the whole jump, not just one frame of it, when the play routine never returns', () => {
      engine.loadTune(runawayTune());
      const packetsBefore = dataPackets(midi).length;

      engine.scrubTo(1);

      expect(engine.state()).toBe('error');
      expect(engine.lastError()).toBeTruthy();
      expect(dataPackets(midi)).toHaveLength(packetsBefore);
    });
  });

  describe('the cue nudge', () => {
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

    /** Hops, then rides the two ticks the resync takes, and reads the frame it landed on. */
    function hopAndReadFrame(slot: number): number {
      engine.hopToCue(slot);
      clock.tick(2); // gate-off, then the resync carrying the resolved registers
      return slotValue(lastDataPacket(midi), COUNTER_SLOT);
    }

    it('walks a cue backward onto an earlier frame without replaying from init', async () => {
      await playTo(60);
      engine.addCue(0);

      engine.setCueOffset(0, -10);

      expect(hopAndReadFrame(0)).toBe(counterAt(50));
      // The counter has to agree with the state that was restored, or the playhead and the row's
      // frame readout both drift by the offset.
      expect(engine.stats().framesRendered).toBe(50);
    });

    it('walks a cue forward onto a later frame', async () => {
      await playTo(60);
      engine.addCue(0);

      engine.setCueOffset(0, 10);

      expect(hopAndReadFrame(0)).toBe(counterAt(70));
      expect(engine.stats().framesRendered).toBe(70);
    });

    it('resolves to the same state a direct replay to that frame produces', async () => {
      await playTo(60);
      engine.addCue(0);
      engine.setCueOffset(0, -10);
      engine.hopToCue(0);
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
      freshEngine.addCue(0);
      freshEngine.hopToCue(0);
      freshClock.tick(5);

      expect(nudged).toEqual(dataPackets(freshMidi).slice(-4).map((packet) => packet.bytes));
    });

    it('hops to a nudged cue without emulating a frame, however deep it was captured', async () => {
      await playTo(200);
      engine.addCue(0);
      engine.setCueOffset(0, -20);
      const runFrame = vi.spyOn(C64Machine.prototype, 'runFrame');

      engine.hopToCue(0);

      // The stall this whole design exists to avoid: a hop that re-derived the nudged point would
      // block the main thread, and with it the frame clock's own audio callback.
      expect(runFrame).not.toHaveBeenCalled();
      clock.tick(2);
      expect(slotValue(lastDataPacket(midi), COUNTER_SLOT)).toBe(counterAt(180));
    });

    it('falls back to the frame-0 anchor for a cue captured before the ring has filled', async () => {
      await playTo(5);
      engine.addCue(0);

      engine.setCueOffset(0, -5);

      expect(hopAndReadFrame(0)).toBe(counterAt(0));
      expect(engine.stats().framesRendered).toBe(0);
    });

    it('leaves playback exactly where it is, since the re-derivation runs on a throwaway machine', async () => {
      await playTo(60);
      engine.addCue(0);

      engine.setCueOffset(0, -10);

      clock.tick(1);
      expect(slotValue(lastDataPacket(midi), COUNTER_SLOT)).toBe(counterAt(61));
    });

    it('clamps the offset to the nudge range in both directions', async () => {
      await playTo(60);
      engine.addCue(0);

      const range = engine.nudgeRangeFrames();
      engine.setCueOffset(0, 999);
      expect(engine.cues()[0]?.offset).toBe(range);

      engine.setCueOffset(0, -999);
      expect(engine.cues()[0]?.offset).toBe(-range);
    });

    it('is a no-op on an empty slot', async () => {
      await playTo(30);

      engine.setCueOffset(1, 5);

      expect(engine.cues()[1]).toBeNull();
    });
  });

  describe('the loop slots', () => {
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

    /** Marks a slot from the current position: in here, out `length` frames later. */
    function markSlotHere(slot: number, length: number): void {
      engine.tapLoopIn(slot);
      clock.tick(length);
      engine.tapLoopOut(slot);
    }

    /** Marks one slot on a fresh tune: in at `inFrame`, out `length` frames later. */
    async function markLoop(slot: number, inFrame: number, length: number): Promise<void> {
      await playTo(inFrame);
      markSlotHere(slot, length);
    }

    /**
     * Three ten-frame loops in at 10, 50 and 90, with slot 0 punched in and its re-entry already
     * ridden out — so the playhead sits on slot 0's in-point with ten frames of lap left to run.
     */
    async function threeSlotsWithFirstLooping(): Promise<void> {
      await playTo(10);
      markSlotHere(0, 10);
      clock.tick(30);
      markSlotHere(1, 10);
      clock.tick(30);
      markSlotHere(2, 10);
      engine.punchLoop(0);
      clock.tick(2); // the gate-off and resync the engagement rides out on
    }

    it('engages a punched slot at once when nothing is looping', async () => {
      await markLoop(0, 200, 10);
      clock.tick(5);
      const runFrame = vi.spyOn(C64Machine.prototype, 'runFrame');

      engine.punchLoop(0);

      // A restore, never a replay: engaging a slot whose in-point sits deep in the tune must not
      // block the main thread the frame clock's audio callback rides.
      expect(runFrame).not.toHaveBeenCalled();
      expect(engine.activeLoopSlot()).toBe(0);
      clock.tick(2); // gate-off, then the resync carrying the in-point's registers
      expect(slotValue(lastDataPacket(midi), COUNTER_SLOT)).toBe(counterAt(200));
      expect(engine.stats().framesRendered).toBe(200);
    });

    it('re-enters at the tapped in-point on the tick that reaches the out-point, without stopping the clock', async () => {
      await markLoop(0, 10, 10);
      engine.punchLoop(0);
      clock.tick(2);

      clock.tick(10); // the tenth renders frame 20, the out-point, so it re-enters

      expect(clock.running).toBe(true);
      expect(engine.activeLoopSlot()).toBe(0);

      clock.tick(2);
      expect(slotValue(lastDataPacket(midi), COUNTER_SLOT)).toBe(counterAt(10));
      expect(engine.stats().framesRendered).toBe(10);
    });

    it('re-enters by restoring the in-point, emulating no frame of its own however deep it sits', async () => {
      await markLoop(0, 200, 10);
      engine.punchLoop(0);
      clock.tick(2 + 9); // the resync pair, then up to the frame before the out-point
      const runFrame = vi.spyOn(C64Machine.prototype, 'runFrame');

      clock.tick(1);

      // The tick's own frame and nothing else: a re-entry that replayed to the in-point would run
      // two hundred more, blocking the main thread the frame clock's audio callback rides — on
      // every single pass.
      expect(runFrame).toHaveBeenCalledTimes(1);

      clock.tick(2);
      expect(slotValue(lastDataPacket(midi), COUNTER_SLOT)).toBe(counterAt(200));
    });

    it('sends nothing of its own on re-entry, then rides the clock for the gate-off and resync', async () => {
      await markLoop(0, 10, 10);
      engine.punchLoop(0);
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

    it('leaves the playing slot alone until its out-point, then switches to the punched one', async () => {
      await threeSlotsWithFirstLooping();

      engine.punchLoop(1);

      expect(engine.activeLoopSlot()).toBe(0);
      expect(engine.queuedLoopSlot()).toBe(1);
      // Nine frames of the lap left: the switch must not cut them off.
      clock.tick(9);
      expect(engine.activeLoopSlot()).toBe(0);

      clock.tick(1);
      expect(engine.activeLoopSlot()).toBe(1);
      expect(engine.queuedLoopSlot()).toBeNull();

      clock.tick(2);
      expect(slotValue(lastDataPacket(midi), COUNTER_SLOT)).toBe(counterAt(50));
      expect(engine.stats().framesRendered).toBe(50);
    });

    it('replaces the queued slot when another is punched before the switch lands', async () => {
      await threeSlotsWithFirstLooping();

      engine.punchLoop(1);
      engine.punchLoop(2);

      expect(engine.queuedLoopSlot()).toBe(2);

      clock.tick(10);
      expect(engine.activeLoopSlot()).toBe(2);

      clock.tick(2);
      expect(slotValue(lastDataPacket(midi), COUNTER_SLOT)).toBe(counterAt(90));
    });

    it('sends no more packets on the switching tick than a plain re-entry does', async () => {
      await threeSlotsWithFirstLooping();
      engine.punchLoop(1);
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

    it('re-triggers the playing slot when it is punched again with nothing queued', async () => {
      await markLoop(0, 10, 10);
      engine.punchLoop(0);
      clock.tick(2 + 3);

      engine.punchLoop(0);

      clock.tick(2);
      expect(engine.activeLoopSlot()).toBe(0);
      expect(engine.stats().framesRendered).toBe(10);
      expect(slotValue(lastDataPacket(midi), COUNTER_SLOT)).toBe(counterAt(10));
    });

    it('stops on the spot when told to, dropping the queue and playing on linearly', async () => {
      await threeSlotsWithFirstLooping();
      engine.punchLoop(1);

      clock.tick(3);
      engine.stopLoop();

      expect(engine.activeLoopSlot()).toBeNull();
      expect(engine.queuedLoopSlot()).toBeNull();
      // Straight past slot 0's out-point at frame 20 rather than wrapping at it.
      clock.tick(30);
      expect(engine.stats().framesRendered).toBeGreaterThan(20);
    });

    it('reports progress through the active slot bounds and none for the others', async () => {
      await markLoop(0, 10, 100); // in 10, out 110
      engine.punchLoop(0);

      clock.tick(2 + 50); // the resync pair, then halfway through the lap

      expect(engine.progressPercentFor(0)).toBeCloseTo(50, 5);
      expect(engine.progressPercentFor(1)).toBe(0);

      engine.stopLoop();
      expect(engine.progressPercentFor(0)).toBe(0);
    });

    it('refuses to punch a slot until both ends are marked and in order', async () => {
      await playTo(10);

      engine.punchLoop(0);
      expect(engine.activeLoopSlot()).toBeNull();

      engine.tapLoopIn(0);
      engine.punchLoop(0);
      expect(engine.activeLoopSlot()).toBeNull();

      engine.tapLoopOut(0); // same frame — no pass to play
      engine.punchLoop(0);
      expect(engine.activeLoopSlot()).toBeNull();

      clock.tick(10);
      engine.tapLoopOut(0);
      engine.punchLoop(0);
      expect(engine.activeLoopSlot()).toBe(0);
    });

    it('creates a slot from whichever end is tapped first', async () => {
      await playTo(10);

      engine.tapLoopOut(2);

      expect(engine.loopSlots()[2]?.out?.frame).toBe(10);
      expect(engine.loopSlots()[2]?.in).toBeNull();

      engine.tapLoopIn(2);
      expect(engine.loopSlots()[2]?.in?.frame).toBe(10);
      expect(engine.loopSlots()[2]?.out?.frame).toBe(10);
    });

    it('drops out rather than spinning when a nudge crosses the ends', async () => {
      await markLoop(0, 10, 20);
      engine.punchLoop(0);
      clock.tick(2);

      engine.setLoopOutOffset(0, -engine.nudgeRangeFrames()); // the exit walks back behind the entry

      clock.tick(1);
      expect(engine.activeLoopSlot()).toBeNull();

      // Playback carries on past the crossed exit instead of re-entering on every tick.
      clock.tick(30);
      expect(engine.stats().framesRendered).toBeGreaterThan(30);
    });

    it('moves where the next pass wraps when the out-point is nudged, replaying nothing', async () => {
      await markLoop(0, 5, 35); // in 5, out 40
      const runFrame = vi.spyOn(C64Machine.prototype, 'runFrame');

      engine.setLoopOutOffset(0, -25); // the pass now wraps at frame 15

      expect(runFrame).not.toHaveBeenCalled();
      expect(engine.loopSlots()[0]?.out?.offset).toBe(-25);

      engine.punchLoop(0);
      clock.tick(100);

      expect(engine.stats().framesRendered).toBeLessThanOrEqual(15);
      expect(engine.stats().framesRendered).toBeGreaterThanOrEqual(5);
    });

    it('clamps the out-point offset to the nudge range in both directions', async () => {
      await markLoop(0, 60, 30);

      const range = engine.nudgeRangeFrames();
      engine.setLoopOutOffset(0, 999);
      expect(engine.loopSlots()[0]?.out?.offset).toBe(range);

      engine.setLoopOutOffset(0, -999);
      expect(engine.loopSlots()[0]?.out?.offset).toBe(-range);
    });

    it('walks the in-point onto an earlier frame and re-enters there when punched', async () => {
      await markLoop(0, 60, 10);

      engine.setLoopInOffset(0, -10);
      engine.punchLoop(0);
      clock.tick(2);

      expect(engine.loopSlots()[0]?.in?.offset).toBe(-10);
      expect(slotValue(lastDataPacket(midi), COUNTER_SLOT)).toBe(counterAt(50));
      expect(engine.stats().framesRendered).toBe(50);
    });

    it('is a no-op to nudge either end of an unmarked slot', async () => {
      await playTo(10);

      engine.setLoopInOffset(1, -5);
      engine.setLoopOutOffset(1, 5);

      expect(engine.loopSlots()[1]).toBeNull();
    });

    it('keeps each slot to itself when another is nudged or cleared', async () => {
      await playTo(10);
      markSlotHere(0, 10);
      clock.tick(10);
      markSlotHere(2, 10); // in 30, out 40

      engine.setLoopOutOffset(0, -3);
      engine.clearLoopSlot(1);

      expect(engine.loopSlots()[2]?.in?.frame).toBe(30);
      expect(engine.loopSlots()[2]?.out).toEqual({ frame: 40, offset: 0 });
      expect(engine.loopSlots()[0]?.out?.offset).toBe(-3);
    });

    it('lets go of a cleared slot that was playing, leaving the rest marked', async () => {
      await threeSlotsWithFirstLooping();
      engine.punchLoop(1);

      engine.clearLoopSlot(0);
      engine.clearLoopSlot(1);

      expect(engine.activeLoopSlot()).toBeNull();
      expect(engine.queuedLoopSlot()).toBeNull();
      expect(engine.loopSlots()[0]).toBeNull();
      expect(engine.loopSlots()[2]).not.toBeNull();
    });

    it('keeps every marked slot through pause, stop and a play from stopped', async () => {
      await markLoop(0, 10, 10);

      engine.pause();
      expect(engine.loopSlots()[0]?.in).not.toBeNull();
      expect(engine.loopSlots()[0]?.out).not.toBeNull();

      await engine.play();
      engine.stop();
      expect(engine.loopSlots()[0]?.in).not.toBeNull();

      await engine.play();
      expect(engine.loopSlots()[0]?.in).not.toBeNull();
      expect(engine.loopSlots()[0]?.out).not.toBeNull();
    });

    it('clears every slot on loadTune, since an in-point holds a machine image', async () => {
      await threeSlotsWithFirstLooping();
      engine.punchLoop(1);

      engine.loadTune(counterTune());

      expect(engine.loopSlots()).toEqual([null, null, null, null]);
      expect(engine.activeLoopSlot()).toBeNull();
      expect(engine.queuedLoopSlot()).toBeNull();
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

    it('resolves a cue captured deep into a 2x-multispeed tune against a recent anchor, not the frame-0 seed', async () => {
      engine.loadTune(doubleSpeedCounterTune());
      await engine.play();
      // Well past the old fixed 75-frame ring span, deep enough that replaying from the frame-0 seed
      // would need hundreds of frames — the regression this ring resize exists to prevent.
      clock.tick(400);
      engine.addCue(0);

      const runFrame = vi.spyOn(C64Machine.prototype, 'runFrame');
      engine.setCueOffset(0, -engine.nudgeRangeFrames());

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
});
