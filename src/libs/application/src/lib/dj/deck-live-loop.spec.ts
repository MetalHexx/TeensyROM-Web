import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FakeClock, SID_REGISTER_COUNT, milliseconds, replayToFrame } from '@sidablist/core';
import type {
  RegisterRecord,
  ReplayRequest,
  ReplayResponse,
  ReplayRunner,
} from '@sidablist/core';
import type { MidiOutputPort } from '@sidablist/asid';
import { InMemoryLoopPositionsStore } from '@sidablist/tunes';
import type { LoopMarker, Playable, TuneIdentity } from '@sidablist/tunes';
import { logWarn } from '@teensyrom-nx/utils';
import { DeckLiveLoop } from './deck-live-loop';
import { DeckLoops } from './deck-loops';
import { DeckRuntime } from './deck-runtime';
import { DjStore, type DeckBeatGrid } from './dj-store';
import {
  FRAME_CLOCK_FACTORY,
  MIDI_ACCESS,
  REGISTER_RECORDER_FACTORY,
  REPLAY_RUNNER_FACTORY,
} from './ports';
import type {
  IMidiAccess,
  MidiAccessState,
  MidiPermission,
  MidiPortOption,
} from './ports/midi-access';
import type { Slot } from './slot';

vi.mock('@teensyrom-nx/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@teensyrom-nx/utils')>();
  return { ...actual, logWarn: vi.fn(), logError: vi.fn() };
});

const INTERVAL_US = 20_000;

/** A grid of 24 frames a beat from frame 0, so the ladder runs 2, 3, 6, 12, 24, 48, 96 … frames. */
const GRID: DeckBeatGrid = {
  beatFrames: 24,
  beatOneFrame: 0,
  startFrame: 0,
  endFrame: null,
  source: 'scan',
};

/** Answers every request with the real `replayToFrame`, and counts them: a push that starts from a
 *  saved image asks for none. */
class FakeReplayRunner implements ReplayRunner {
  requests = 0;

  run(request: ReplayRequest): Promise<ReplayResponse> {
    this.requests++;
    try {
      return Promise.resolve({
        id: request.id,
        ok: true,
        result: replayToFrame(
          request.file,
          request.subtune,
          request.targetFrame,
          request.mutes,
          request.start
        ),
      });
    } catch (error) {
      return Promise.resolve({
        id: request.id,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  dispose(): void {
    // nothing to release
  }
}

function fakeMidiAccess(): IMidiAccess {
  return {
    accessState: signal<MidiAccessState>('granted'),
    ports: signal<readonly MidiPortOption[]>([]),
    lastError: signal<string | null>(null),
    queryPermission: (): Promise<MidiPermission> => Promise.resolve('granted'),
    requestAccess: (): Promise<void> => Promise.resolve(),
    holderOf: (): string | null => null,
    claim: (): boolean => true,
    release: (): void => undefined,
    outputPortFor: (): MidiOutputPort | null => null,
  };
}

const PSID_HEADER_SIZE = 0x7c;

/** A minimal well-formed PSID v2 file whose init and play routines return at once. */
function sidBytes(): Uint8Array {
  const payload = [0xa9, 0x00, 0x60, 0x60]; // init: LDA #0; RTS — play: RTS
  const buffer = new Uint8Array(PSID_HEADER_SIZE + payload.length);
  const view = new DataView(buffer.buffer);
  buffer.set([0x50, 0x53, 0x49, 0x44], 0x00); // 'PSID'
  view.setUint16(0x04, 2, false);
  view.setUint16(0x06, PSID_HEADER_SIZE, false);
  view.setUint16(0x08, 0x1000, false);
  view.setUint16(0x0a, 0x1000, false);
  view.setUint16(0x0c, 0x1003, false);
  view.setUint16(0x0e, 3, false);
  view.setUint16(0x10, 1, false);
  buffer.set(payload, PSID_HEADER_SIZE);
  return buffer;
}

function playableOf(identity: TuneIdentity): Playable {
  return {
    bytes: sidBytes(),
    reference: { identity },
    index: { loopStartFrame: null, loopPeriodFrames: null, endedAtFrame: null },
  } as unknown as Playable;
}

function loopOf(id: string, startFrame: number, endFrame: number): LoopMarker {
  return {
    id,
    start: { frame: startFrame, offsetFrames: 0 },
    end: { frame: endFrame, offsetFrames: 0 },
    voices: [0, 1, 2],
  };
}

/** A register record of `frames` silent entries: enough for the player to land on. */
function recordOf(frames: number): RegisterRecord {
  return {
    frames,
    values: new Uint8Array(frames * SID_REGISTER_COUNT),
    retriggerEntries: new Uint32Array(0),
    retriggerRegisters: new Uint8Array(0),
    retriggerValues: new Uint8Array(0),
  };
}

/** Lets every pending promise callback run. */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

const TUNE: TuneIdentity = { sidHash: 'tune-live', subtune: 1 };

describe('DeckLiveLoop', () => {
  let live: DeckLiveLoop;
  let loops: DeckLoops;
  let runtime: DeckRuntime;
  let store: InstanceType<typeof DjStore>;
  let positions: InMemoryLoopPositionsStore;
  let replayRunners: FakeReplayRunner[];
  let prepareRunners: FakeReplayRunner[];
  let clockOf: Record<Slot, FakeClock>;
  let tickCount: number;
  let record: RegisterRecord | null;

  beforeEach(() => {
    vi.mocked(logWarn).mockClear();
    replayRunners = [];
    prepareRunners = [];
    const clocks: FakeClock[] = [];
    tickCount = 0;
    record = null;
    positions = new InMemoryLoopPositionsStore();
    let created = 0;

    TestBed.configureTestingModule({
      providers: [
        {
          provide: FRAME_CLOCK_FACTORY,
          useValue: (): FakeClock => {
            const clock = new FakeClock();
            clocks.push(clock);
            return clock;
          },
        },
        {
          provide: REGISTER_RECORDER_FACTORY,
          useValue: () => ({ record: () => Promise.resolve(record), dispose: () => undefined }),
        },
        {
          provide: REPLAY_RUNNER_FACTORY,
          useValue: (): ReplayRunner => {
            const runner = new FakeReplayRunner();
            (created++ % 2 === 0 ? replayRunners : prepareRunners).push(runner);
            return runner;
          },
        },
        { provide: MIDI_ACCESS, useValue: fakeMidiAccess() },
      ],
    });

    runtime = TestBed.inject(DeckRuntime);
    store = TestBed.inject(DjStore);
    loops = TestBed.inject(DeckLoops);
    live = TestBed.inject(DeckLiveLoop);
    for (const slot of ['A', 'B'] as const) {
      runtime.build(slot);
      // What `DeckService` does for every engine notification.
      runtime.subscribe(slot, () => {
        live.reflect(slot);
        loops.reflect(slot);
      });
    }
    clockOf = { A: clocks[0], B: clocks[1] };
  });

  const stateOf = (slot: Slot) => store.loops()[slot];
  const liveOf = (slot: Slot) => stateOf(slot).live;
  const engineLoop = (slot: Slot) => runtime.snapshot(slot).loop;
  const engineQueue = (slot: Slot) => runtime.snapshot(slot).tune?.queuedJump ?? null;
  const loopChange = (slot: Slot) => runtime.snapshot(slot).tune?.loopChange ?? null;
  const replays = () => replayRunners.reduce((sum, runner) => sum + runner.requests, 0);

  /** Fires `count` frames of the deck's clock. */
  function tick(slot: Slot, count = 1): void {
    for (let i = 0; i < count; i++) {
      clockOf[slot].tick(milliseconds(++tickCount));
    }
  }

  /** Fires frames one at a time until `done`, so an outcome is seen on the very frame it happens. */
  function tickUntil(slot: Slot, done: () => boolean, limit = 800): void {
    for (let i = 0; i < limit && !done(); i++) {
      tick(slot);
    }
    expect(done()).toBe(true);
  }

  /** Plays frames until the playhead is at `frame`. */
  function playTo(slot: Slot, frame: number): void {
    tickUntil(slot, () => runtime.position(slot) === frame);
  }

  /**
   * A tune loaded and playing on `slot`, with a grid, the markers the holding keeps, and the kept
   * size `beats`; the crossing lines are declared as the app does, by its effect.
   */
  async function play(
    slot: Slot,
    options: {
      beats?: number;
      grid?: DeckBeatGrid | null;
      markers?: readonly LoopMarker[];
      record?: RegisterRecord | null;
    } = {}
  ): Promise<void> {
    record = options.record ?? null;
    await positions.save(TUNE, options.markers ?? []);
    loops.detach(slot);
    runtime.load(slot, playableOf(TUNE));
    store.setDeckTiming({ slot, playCallIntervalUs: INTERVAL_US });
    store.setDeckBeatGrid({ slot, beatGrid: options.grid === undefined ? GRID : options.grid });
    store.setDeckSettings({ slot, liveLoopBeats: options.beats ?? 1 });
    TestBed.flushEffects();
    await loops.attach(slot, {
      placementKey: 'set-1:row-1',
      identity: TUNE,
      positions,
    });
    await flush();
    await runtime.play(slot);
  }


  /** Plays until the playhead falls back, and returns how many frames that took. */
  function lapTicks(slot: Slot): number {
    let previous = Number(runtime.position(slot));
    for (let ticks = 1; ticks <= 800; ticks++) {
      tick(slot);
      const position = Number(runtime.position(slot));
      if (position < previous) {
        return ticks;
      }
      previous = position;
    }
    throw new Error('the playhead never wrapped');
  }

  /** The positions of the next `count` frames. */
  function positionsOver(slot: Slot, count: number): number[] {
    const seen: number[] = [];
    for (let i = 0; i < count; i++) {
      tick(slot);
      seen.push(Number(runtime.position(slot)));
    }
    return seen;
  }

  /** Sets the kept size the way `DeckService.setLiveLoopBeats` does, and resizes. */
  function turnTo(slot: Slot, beats: number): void {
    store.setDeckSettings({ slot, liveLoopBeats: beats });
    TestBed.flushEffects();
    live.resize(slot);
  }

  describe('declaring the lines to save at', () => {
    it('keeps images of the beat lines crossed, two of each, and no others for a size of a beat', async () => {
      await play('A', { beats: 1 });

      tick('A', 80);

      expect([0, 24, 48, 72].map((frame) => runtime.holdsImageAt('A', frame))).toEqual([
        false,
        false,
        true,
        true,
      ]);
      expect(runtime.holdsImageAt('A', 60)).toBe(false);
    });

    it('also keeps the lines of a size shorter than a beat', async () => {
      await play('A', { beats: 0.25 });

      tick('A', 80);

      expect([60, 66, 72, 78].map((frame) => runtime.holdsImageAt('A', frame))).toEqual([
        false,
        false,
        true,
        true,
      ]);
    });

    it('declares the new size when the kept size changes, once effects run', async () => {
      await play('A', { beats: 1 });
      tick('A', 30);
      expect(runtime.holdsImageAt('A', 30)).toBe(false);

      store.setDeckSettings({ slot: 'A', liveLoopBeats: 0.25 });
      TestBed.flushEffects();
      tick('A', 8);

      expect(runtime.holdsImageAt('A', 36)).toBe(true);
    });

    it('frees the images when the deck loses its grid', async () => {
      await play('A', { beats: 1 });
      tick('A', 80);
      expect(runtime.holdsImageAt('A', 72)).toBe(true);

      store.setDeckBeatGrid({ slot: 'A', beatGrid: null });
      TestBed.flushEffects();

      expect(runtime.holdsImageAt('A', 72)).toBe(false);
    });
  });

  describe('the start line of a push', () => {
    it('starts a loop of a beat or more on the last beat line behind the next frame', async () => {
      await play('A', { beats: 1 });
      playTo('A', 30);
      const before = replays();

      live.toggle('A');

      expect(liveOf('A')).toEqual({ startFrame: 24, endFrame: 48, pendingEndFrame: null });
      expect(engineLoop('A')).toEqual({ startFrame: 24, endFrame: 48, varispeedStart: 'wrap' });
      tick('A', 100);
      expect(replays()).toBe(before);
    });

    it('starts a four-beat loop on a beat line, not on a line of its own length', async () => {
      await play('A', { beats: 4 });
      playTo('A', 130);

      live.toggle('A');

      expect(liveOf('A')).toMatchObject({ startFrame: 120, endFrame: 216 });
      expect(engineLoop('A')).toEqual({ startFrame: 120, endFrame: 216, varispeedStart: 'wrap' });
    });

    it('starts a loop shorter than a beat on the last line of its own length', async () => {
      await play('A', { beats: 0.5 });
      playTo('A', 31);

      live.toggle('A');
      expect(liveOf('A')).toMatchObject({ startFrame: 24, endFrame: 36 });

      live.toggle('A');
      turnTo('A', 0.125);
      playTo('A', 40);
      live.toggle('A');
      expect(liveOf('A')).toMatchObject({ startFrame: 39, endFrame: 42 });
    });

    it('starts from a crossing image, replaying nothing', async () => {
      await play('A', { beats: 0.5 });
      playTo('A', 40);
      expect(runtime.holdsImageAt('A', 36)).toBe(true);
      const before = replays();

      live.toggle('A');
      tick('A', 60);

      expect(liveOf('A')).toMatchObject({ startFrame: 36, endFrame: 48 });
      expect(replays()).toBe(before);
    });

    it('puts the first lap on the grid when the next line is one frame ahead', async () => {
      await play('A', { beats: 1 });
      playTo('A', 23);
      const before = replays();

      live.toggle('A');

      expect(engineLoop('A')).toEqual({ startFrame: 24, endFrame: 48, varispeedStart: 'wrap' });
      expect(lapTicks('A')).toBe(24);
      expect(lapTicks('A')).toBe(24);
      expect(replays()).toBe(before);
    });

    it('puts the first lap on the grid for a push mid-lap, wrapping where later laps do', async () => {
      await play('A', { beats: 1 });
      playTo('A', 30);

      live.toggle('A');

      expect(lapTicks('A')).toBe(17);
      expect(lapTicks('A')).toBe(24);
      expect(Number(runtime.position('A'))).toBe(24);
    });

    it('does nothing without a grid, off a usable ladder, or on a deck that is not playing', async () => {
      await play('A', { grid: null });
      tick('A', 30);
      live.toggle('A');
      expect(liveOf('A')).toBeNull();
      expect(engineLoop('A')).toBeNull();

      await play('B', { grid: { ...GRID, beatFrames: 0.3 } });
      tick('B', 30);
      live.toggle('B');
      expect(liveOf('B')).toBeNull();

      await play('A', { beats: 1 });
      runtime.pause('A');
      live.toggle('A');
      expect(liveOf('A')).toBeNull();
    });
  });

  describe('a start whose image is not held', () => {
    /** Plays to a frame off the grid with the images behind it dropped: a worker jump. */
    async function jumpTo(slot: Slot, frame: number): Promise<void> {
      await runtime.seekToFrame(slot, frame);
      await flush();
    }

    it('starts on the next line ahead with no record, and arms from the crossing', async () => {
      await play('A', { beats: 1 });
      tick('A', 30);
      await jumpTo('A', 100);
      expect(runtime.holdsImageAt('A', 96)).toBe(false);
      const before = replays();

      live.toggle('A');

      expect(liveOf('A')).toMatchObject({ startFrame: 120, endFrame: 144 });
      expect(engineLoop('A')).toEqual({ startFrame: 120, endFrame: 144, varispeedStart: 'wrap' });
      playTo('A', 119);
      expect(lapTicks('A')).toBe(24);
      expect(replays()).toBe(before);
    });

    it('pushes as normal on a deck holding a register record', async () => {
      await play('A', { beats: 1, record: recordOf(2000) });
      tick('A', 30);
      await jumpTo('A', 100);
      expect(runtime.holdsImageAt('A', 96)).toBe(false);

      live.toggle('A');

      expect(liveOf('A')).toMatchObject({ startFrame: 96, endFrame: 120 });
      expect(engineLoop('A')).toEqual({ startFrame: 96, endFrame: 120, varispeedStart: 'wrap' });
      tickUntil('A', () => Number(runtime.position('A')) < 100);
      expect(Number(runtime.position('A'))).toBeGreaterThanOrEqual(96);
    });

    it('pushes as normal soon after a landing on the record, which hands back for seconds', async () => {
      await play('A', { beats: 1, record: recordOf(2000) });
      tick('A', 30);
      expect(runtime.land('A', 100)).toBe(true);
      tick('A', 3);

      live.toggle('A');

      expect(liveOf('A')).toMatchObject({ startFrame: 96, endFrame: 120 });
      expect(engineLoop('A')).toEqual({ startFrame: 96, endFrame: 120, varispeedStart: 'wrap' });
      const positions = positionsOver('A', 60);
      expect(Math.max(...positions)).toBeLessThan(120);
      expect(Math.min(...positions)).toBeGreaterThanOrEqual(96);
    });
  });

  describe('resizing', () => {
    it('grows at once, keeping the start', async () => {
      await play('A', { beats: 1 });
      playTo('A', 30);
      live.toggle('A');

      turnTo('A', 2);

      expect(liveOf('A')).toEqual({ startFrame: 24, endFrame: 72, pendingEndFrame: null });
      expect(engineLoop('A')).toEqual({ startFrame: 24, endFrame: 72, varispeedStart: 'wrap' });
    });

    it('shrinks at once while the first lap of the new size ends two frames or more ahead', async () => {
      await play('A', { beats: 1 });
      playTo('A', 30);
      live.toggle('A');
      tick('A', 4);
      expect(Number(runtime.position('A'))).toBe(34);

      turnTo('A', 0.5);

      expect(liveOf('A')).toEqual({ startFrame: 24, endFrame: 36, pendingEndFrame: null });
      expect(engineLoop('A')).toEqual({ startFrame: 24, endFrame: 36, varispeedStart: 'wrap' });
      expect(loopChange('A')).toBeNull();
    });

    it('names a shrink for the lap end it falls in when the wrap lead leaves no time before the new end', async () => {
      await play('A', { beats: 1 });
      playTo('A', 30);
      live.toggle('A');
      tick('A', 5);
      expect(Number(runtime.position('A'))).toBe(35);

      turnTo('A', 0.5);

      expect(liveOf('A')).toEqual({ startFrame: 24, endFrame: 48, pendingEndFrame: 36 });
      expect(loopChange('A')).toMatchObject({
        atFrame: 48,
        loop: { startFrame: 24, endFrame: 36 },
      });
    });

    it('lands a named shrink on its frame and then runs the new size', async () => {
      await play('A', { beats: 1 });
      playTo('A', 30);
      live.toggle('A');
      tick('A', 5);
      turnTo('A', 0.5);
      const at = Number(loopChange('A')?.atFrame);
      const position = Number(runtime.position('A'));

      let ticks = 0;
      while (loopChange('A') !== null && ticks < 100) {
        tick('A');
        ticks++;
      }

      expect(ticks).toBe(at - 1 - position);
      expect(Number(runtime.position('A'))).toBe(24);
      expect(liveOf('A')).toEqual({ startFrame: 24, endFrame: 36, pendingEndFrame: null });
      expect(engineLoop('A')).toEqual({ startFrame: 24, endFrame: 36, varispeedStart: 'wrap' });
      expect(lapTicks('A')).toBe(12);
    });

    it('builds up a loop from a beat to an eighth, each shrink on its own frame with the start kept', async () => {
      await play('A', { beats: 1 });
      playTo('A', 30);
      live.toggle('A');
      const landed: unknown[] = [];

      const shrinkTo = (beats: number, expectedEnd: number): void => {
        turnTo('A', beats);
        tickUntil('A', () => loopChange('A') === null && liveOf('A')?.pendingEndFrame === null);
        landed.push(liveOf('A'));
        expect(engineLoop('A')).toEqual({
          startFrame: 24,
          endFrame: expectedEnd,
          varispeedStart: 'wrap',
        });
      };

      tick('A', 5);
      shrinkTo(0.5, 36);
      playTo('A', 30);
      shrinkTo(0.25, 30);
      playTo('A', 27);
      shrinkTo(0.125, 27);

      expect(landed).toEqual([
        { startFrame: 24, endFrame: 36, pendingEndFrame: null },
        { startFrame: 24, endFrame: 30, pendingEndFrame: null },
        { startFrame: 24, endFrame: 27, pendingEndFrame: null },
      ]);
    });

    it('lands only the last of a quick stack of turns', async () => {
      await play('A', { beats: 1 });
      playTo('A', 30);
      live.toggle('A');
      tick('A', 5);
      const seen = new Set<string>();

      turnTo('A', 0.5);
      turnTo('A', 0.25);
      turnTo('A', 0.125);

      expect(loopChange('A')).toMatchObject({ loop: { startFrame: 24, endFrame: 27 } });
      expect(liveOf('A')).toEqual({ startFrame: 24, endFrame: 48, pendingEndFrame: 27 });
      tickUntil('A', () => {
        seen.add(JSON.stringify(engineLoop('A')));
        return loopChange('A') === null;
      });
      expect([...seen]).not.toContain(JSON.stringify({ startFrame: 24, endFrame: 36, varispeedStart: 'wrap' }));
      expect(engineLoop('A')).toEqual({ startFrame: 24, endFrame: 27, varispeedStart: 'wrap' });
    });

    it('drops a shrink waiting when the loop is grown again', async () => {
      await play('A', { beats: 1 });
      playTo('A', 35);
      live.toggle('A');
      turnTo('A', 0.5);
      expect(loopChange('A')).not.toBeNull();

      turnTo('A', 2);

      expect(loopChange('A')).toBeNull();
      expect(liveOf('A')).toEqual({ startFrame: 24, endFrame: 72, pendingEndFrame: null });
    });

    it('steps one rung of the ladder and stops at its ends, from the nearest rung to a kept size off it', async () => {
      await play('A', { beats: 1 });
      expect(live.steppedBeats('A', 'halve')).toBe(0.5);
      expect(live.steppedBeats('A', 'double')).toBe(2);

      store.setDeckSettings({ slot: 'A', liveLoopBeats: 100 });
      expect(live.steppedBeats('A', 'double')).toBeNull();
      expect(live.steppedBeats('A', 'halve')).toBe(64);

      store.setDeckSettings({ slot: 'A', liveLoopBeats: 1 / 12 });
      expect(live.steppedBeats('A', 'halve')).toBeNull();
    });

    it('resizes to the nearest rung for a kept size the grid lacks, leaving the kept size alone', async () => {
      await play('A', { beats: 1 });
      playTo('A', 30);
      live.toggle('A');

      turnTo('A', 3.1);

      expect(liveOf('A')).toMatchObject({ startFrame: 24, endFrame: 24 + 96 });
      expect(store.decks()['A'].liveLoopBeats).toBe(3.1);
    });
  });

  describe('over a marker loop', () => {
    const M = loopOf('m', 48, 96);
    const M_LOOP = { startFrame: 48, endFrame: 96, varispeedStart: 'stop' };
    const B = loopOf('b', 300, 324);

    /** A deck playing marker `m` at its start, with `beats` as the live loop size. */
    async function underMarker(
      options: { beats?: number; record?: RegisterRecord | null } = {}
    ): Promise<void> {
      await play('A', { markers: [M, B], ...options });
      await flush();
      loops.toggle('A', 'm');
      await flush();
      expect(stateOf('A').runningId).toBe('m');
      expect(Number(runtime.position('A'))).toBe(48);
    }

    it('returns into the marker without restarting it', async () => {
      await underMarker({ beats: 1 });
      tick('A', 12);
      live.toggle('A');
      expect(liveOf('A')).toMatchObject({ startFrame: 48, endFrame: 72 });
      expect(stateOf('A').runningId).toBe('m');
      tick('A', 6);
      const position = Number(runtime.position('A'));

      live.end('A');

      expect(liveOf('A')).toBeNull();
      expect(stateOf('A').runningId).toBe('m');
      expect(engineLoop('A')).toEqual(M_LOOP);
      expect(Number(runtime.position('A'))).toBe(position);
      expect(positionsOver('A', 3)).toEqual([position + 1, position + 2, position + 3]);
    });

    it('keeps the marker laps on its own grid once the live loop has gone', async () => {
      await underMarker({ beats: 1 });
      tick('A', 12);
      live.toggle('A');
      tick('A', 6);
      live.end('A');

      expect(lapTicks('A')).toBe(30);
      expect(lapTicks('A')).toBe(48);
    });

    it('folds a playhead past the loop end into the loop on the record, carrying the lap phase', async () => {
      await underMarker({ beats: 4, record: recordOf(2000) });
      expect(runtime.snapshot('A').tune?.recordedFrames).toBe(2000);
      tick('A', 12);
      live.toggle('A');
      expect(liveOf('A')).toMatchObject({ startFrame: 48, endFrame: 144 });
      playTo('A', 100);

      live.end('A');

      expect(engineLoop('A')).toEqual(M_LOOP);
      expect(stateOf('A').runningId).toBe('m');
      expect(Number(runtime.position('A'))).toBe(52);
      expect(positionsOver('A', 3)).toEqual([53, 54, 55]);
    });

    it('lands on the loop start with the gate-off pending when the playhead is at the wrap point', async () => {
      await underMarker({ beats: 4, record: recordOf(2000) });
      tick('A', 12);
      live.toggle('A');
      playTo('A', 95);

      live.end('A');

      expect(engineLoop('A')).toEqual(M_LOOP);
      expect(Number(runtime.position('A'))).toBe(48);
      expect(positionsOver('A', 3)).toEqual([48, 49, 50]);
    });

    it('makes a worker jump to the fold when no record is held, never to the loop start', async () => {
      await underMarker({ beats: 4 });
      tick('A', 12);
      live.toggle('A');
      playTo('A', 100);

      live.end('A');

      expect(liveOf('A')).toBeNull();
      expect(engineLoop('A')).toBeNull();
      expect(stateOf('A').runningId).toBe('m');
      await flush();
      expect(engineLoop('A')).toEqual(M_LOOP);
      expect(stateOf('A').runningId).toBe('m');
      expect(Number(runtime.position('A'))).toBe(52);
    });

    it('does not resume a held marker once something else has taken the loop', async () => {
      await underMarker({ beats: 4 });
      tick('A', 12);
      live.toggle('A');
      playTo('A', 100);

      live.end('A');
      loops.stop('A');
      await flush();

      expect(engineLoop('A')).toBeNull();
      expect(stateOf('A').runningId).toBeNull();
    });

    it('re-queues the running marker\'s held end-of-pass edit when it returns', async () => {
      await underMarker({ beats: 1 });
      loops.setLength('A', 4);
      const edit = { startFrame: 48, endFrame: 144, varispeedStart: 'stop' };
      expect(engineQueue('A')).toEqual(edit);
      tick('A', 12);

      live.toggle('A');
      expect(engineQueue('A')).toBeNull();
      loops.setLength('A', 8);
      expect(engineLoop('A')).toMatchObject({ startFrame: 48, endFrame: 72, varispeedStart: 'wrap' });
      expect(engineQueue('A')).toBeNull();

      live.end('A');

      expect(engineLoop('A')).toEqual(M_LOOP);
      expect(engineQueue('A')).toEqual({ ...edit, endFrame: 48 + 192 });
    });

    it('leaves an edit to the running marker out of the engine while the live loop runs', async () => {
      await underMarker({ beats: 1 });
      tick('A', 12);
      live.toggle('A');

      const position = Number(runtime.position('A'));

      loops.nudge('A', 'end', 4);
      loops.audition('A', 'end', 'm');

      expect(liveOf('A')).not.toBeNull();
      expect(engineLoop('A')).toMatchObject({ startFrame: 48, endFrame: 72, varispeedStart: 'wrap' });
      expect(Number(runtime.position('A'))).toBe(position);

      live.end('A');

      expect(engineLoop('A')).toEqual({ ...M_LOOP, endFrame: 100 });
    });

    it('stops the marker underneath when it is toggled off, leaving the live loop running', async () => {
      await underMarker({ beats: 1 });
      tick('A', 12);
      live.toggle('A');
      const running = engineLoop('A');

      loops.toggle('A', 'm');

      expect(stateOf('A').runningId).toBeNull();
      expect(liveOf('A')).not.toBeNull();
      expect(engineLoop('A')).toEqual(running);

      live.end('A');
      expect(engineLoop('A')).toBeNull();
    });
  });

  describe('a marker fired during a live loop', () => {
    const B = loopOf('b', 300, 324);
    const B_LOOP = { startFrame: 300, endFrame: 324, varispeedStart: 'stop' };

    async function pushed(beats = 1): Promise<void> {
      await play('A', { beats, markers: [B, loopOf('m', 48, 96)] });
      await flush();
      playTo('A', 30);
      live.toggle('A');
    }

    it('queues at the live loop\'s lap end when toggled, and ends the live loop on landing', async () => {
      await pushed();

      loops.toggle('A', 'b');

      expect(stateOf('A').queuedId).toBe('b');
      expect(engineQueue('A')).toEqual(B_LOOP);
      expect(liveOf('A')).not.toBeNull();
      tickUntil('A', () => stateOf('A').runningId === 'b');
      expect(liveOf('A')).toBeNull();
      expect(stateOf('A').queuedId).toBeNull();
      expect(engineLoop('A')).toEqual(B_LOOP);
      expect(Number(runtime.position('A'))).toBeGreaterThanOrEqual(300);
    });

    it('lands at once when played now, ending the live loop', async () => {
      await pushed();

      loops.playNow('A', 'b');
      await flush();

      expect(stateOf('A').runningId).toBe('b');
      expect(liveOf('A')).toBeNull();
      expect(engineLoop('A')).toEqual(B_LOOP);
      expect(Number(runtime.position('A'))).toBe(300);
    });

    it('restarts the marker running underneath when it is played now, back on its own bounds', async () => {
      await play('A', { beats: 1, markers: [loopOf('m', 48, 96)] });
      await flush();
      loops.toggle('A', 'm');
      await flush();
      tick('A', 12);
      live.toggle('A');
      tick('A', 3);

      loops.playNow('A', 'm');
      await flush();

      expect(liveOf('A')).toBeNull();
      expect(engineLoop('A')).toEqual({ startFrame: 48, endFrame: 96, varispeedStart: 'stop' });
      expect(Number(runtime.position('A'))).toBe(48);
    });

    it('stays queued through a size change, whichever way it lands', async () => {
      await pushed();
      loops.toggle('A', 'b');

      turnTo('A', 2);
      expect(engineQueue('A')).toEqual(B_LOOP);

      turnTo('A', 1);
      expect(engineQueue('A')).toEqual(B_LOOP);

      turnTo('A', 2);
      playTo('A', 60);
      turnTo('A', 0.5);
      expect(loopChange('A')).not.toBeNull();
      expect(engineQueue('A')).toEqual(B_LOOP);
      expect(stateOf('A').queuedId).toBe('b');
    });

    it('engages at once when the live loop ends with nothing underneath', async () => {
      await pushed();
      loops.toggle('A', 'b');

      live.end('A');
      await flush();

      expect(liveOf('A')).toBeNull();
      expect(stateOf('A').runningId).toBe('b');
      expect(stateOf('A').queuedId).toBeNull();
      expect(engineLoop('A')).toEqual(B_LOOP);
      expect(Number(runtime.position('A'))).toBe(300);
    });

    it('plays on with no loop when the live loop ends with nothing underneath or queued', async () => {
      await pushed();
      tick('A', 3);
      const position = Number(runtime.position('A'));

      live.end('A');

      expect(engineLoop('A')).toBeNull();
      expect(positionsOver('A', 2)).toEqual([position + 1, position + 2]);
    });
  });

  describe('adding while a live loop runs', () => {
    it('keeps the live loop as the running marker, with no change in the engine\'s loop', async () => {
      await play('A', { beats: 1 });
      await flush();
      playTo('A', 30);
      live.toggle('A');
      tick('A', 3);
      const loop = engineLoop('A');
      const position = Number(runtime.position('A'));

      loops.add('A');

      const marker = stateOf('A').markers[0];
      expect(stateOf('A').markers).toHaveLength(1);
      expect(marker.start).toEqual({ frame: 24, offsetFrames: 0 });
      expect(marker.end).toEqual({ frame: 48, offsetFrames: 0 });
      expect(stateOf('A').runningId).toBe(marker.id);
      expect(stateOf('A').selectedId).toBe(marker.id);
      expect(stateOf('A').runningBounds).toEqual({ start: 24, end: 48 });
      expect(liveOf('A')).toBeNull();
      expect(engineLoop('A')).toEqual(loop);
      expect(Number(runtime.position('A'))).toBe(position);
      expect(await positions.load(TUNE)).toHaveLength(1);
    });

    it('takes the place of the marker running underneath, and leaves a queued marker queued', async () => {
      await play('A', { beats: 1, markers: [loopOf('m', 48, 96), loopOf('b', 300, 324)] });
      await flush();
      loops.toggle('A', 'm');
      await flush();
      tick('A', 12);
      live.toggle('A');
      loops.toggle('A', 'b');

      loops.add('A');

      const added = stateOf('A').markers.find((marker) => marker.id === stateOf('A').runningId);
      expect(added?.start.frame).toBe(48);
      expect(added?.end?.frame).toBe(72);
      expect(stateOf('A').queuedId).toBe('b');
      expect(engineQueue('A')).toEqual({ startFrame: 300, endFrame: 324, varispeedStart: 'stop' });
    });
  });

  describe('ending without a return', () => {
    it('ends the live loop and the marker underneath on a drop', async () => {
      await play('A', { beats: 1, markers: [loopOf('m', 48, 96)] });
      await flush();
      loops.toggle('A', 'm');
      await flush();
      tick('A', 12);
      live.toggle('A');

      live.drop('A');

      expect(liveOf('A')).toBeNull();
      expect(engineLoop('A')).toBeNull();
      expect(stateOf('A').runningId).toBeNull();
    });

    it('ends when the engine drops its loop', async () => {
      await play('A', { beats: 1 });
      playTo('A', 30);
      live.toggle('A');

      runtime.stop('A');

      expect(liveOf('A')).toBeNull();
    });

    it('ends when the deck loses its grid', async () => {
      await play('A', { beats: 1 });
      playTo('A', 30);
      live.toggle('A');

      store.setDeckBeatGrid({ slot: 'A', beatGrid: null });
      TestBed.flushEffects();

      expect(liveOf('A')).toBeNull();
      expect(engineLoop('A')).toBeNull();
    });

    it('is cleared when the deck\'s loops are detached for a load', async () => {
      await play('A', { beats: 1 });
      playTo('A', 30);
      live.toggle('A');

      loops.detach('A');

      expect(liveOf('A')).toBeNull();
    });
  });
});
