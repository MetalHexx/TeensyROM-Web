import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { describe, it, expect, beforeEach, vi, type MockInstance } from 'vitest';
import { FakeClock, milliseconds, replayToFrame } from '@sidablist/core';
import type { ReplayRequest, ReplayResponse, ReplayRunner } from '@sidablist/core';
import type { MidiOutputPort } from '@sidablist/asid';
import { InMemoryLoopPositionsStore } from '@sidablist/tunes';
import type { LoopMarker, Playable, TuneIdentity } from '@sidablist/tunes';
import { logError, logWarn } from '@teensyrom-nx/utils';
import { DeckLoops } from './deck-loops';
import { DeckRuntime } from './deck-runtime';
import { DjStore } from './dj-store';
import {
  FRAME_CLOCK_FACTORY,
  LOOP_POSITIONS_STORE,
  MIDI_ACCESS,
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

/** 50 play calls a second, so a nudge reaches 50 frames either way. */
const INTERVAL_US = 20_000;
const SECOND = 50;

interface Gate {
  holding: boolean;
}

/** Answers every request with the real `replayToFrame`. When its gate is holding, the answers wait
 *  until the spec lets them go, which is how a spec sees a marker before the engine has built it. */
class FakeReplayRunner implements ReplayRunner {
  disposed = false;
  private held: (() => void)[] = [];

  constructor(private readonly gate: Gate | null) {}

  get hasHeld(): boolean {
    return this.held.length > 0;
  }

  run(request: ReplayRequest): Promise<ReplayResponse> {
    const answer = (): ReplayResponse => {
      try {
        return {
          id: request.id,
          ok: true,
          result: replayToFrame(
            request.file,
            request.subtune,
            request.targetFrame,
            request.mutes,
            request.start
          ),
        };
      } catch (error) {
        return {
          id: request.id,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    };
    if (this.gate === null || !this.gate.holding) {
      return Promise.resolve(answer());
    }
    return new Promise((resolve) => {
      this.held.push(() => resolve(answer()));
    });
  }

  releaseNext(): void {
    this.held.shift()?.();
  }

  releaseAll(): void {
    const held = this.held;
    this.held = [];
    held.forEach((answer) => answer());
  }

  dispose(): void {
    this.disposed = true;
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

/** A minimal well-formed PSID v2 file with three subtunes, whose init and play routines both
 *  return at once — so a replay to any frame stays inside its cycle budget. */
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

function cue(id: string, frame: number, offsetFrames = 0): LoopMarker {
  return { id, start: { frame, offsetFrames }, end: null, voices: [0, 1, 2] };
}

function loopOf(id: string, startFrame: number, endFrame: number): LoopMarker {
  return {
    id,
    start: { frame: startFrame, offsetFrames: 0 },
    end: { frame: endFrame, offsetFrames: 0 },
    voices: [0, 1, 2],
  };
}

/** Lets every pending promise callback run. */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

const TUNE_X: TuneIdentity = { sidHash: 'tune-x', subtune: 1 };
const TUNE_Y: TuneIdentity = { sidHash: 'tune-y', subtune: 1 };

describe('DeckLoops', () => {
  let loops: DeckLoops;
  let runtime: DeckRuntime;
  let store: InstanceType<typeof DjStore>;
  let positions: InMemoryLoopPositionsStore;
  let gates: Record<Slot, Gate>;
  let prepareRunners: FakeReplayRunner[];
  let clockOf: Record<Slot, FakeClock>;
  let tickCount: number;

  beforeEach(() => {
    vi.mocked(logWarn).mockClear();
    vi.mocked(logError).mockClear();
    gates = { A: { holding: false }, B: { holding: false } };
    prepareRunners = [];
    const clocks: FakeClock[] = [];
    tickCount = 0;
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
          provide: REPLAY_RUNNER_FACTORY,
          useValue: (): ReplayRunner => {
            const index = created++;
            if (index % 2 === 0) {
              return new FakeReplayRunner(null);
            }
            const runner = new FakeReplayRunner(gates[index < 2 ? 'A' : 'B']);
            prepareRunners.push(runner);
            return runner;
          },
        },
        { provide: MIDI_ACCESS, useValue: fakeMidiAccess() },
        { provide: LOOP_POSITIONS_STORE, useValue: positions },
      ],
    });

    runtime = TestBed.inject(DeckRuntime);
    store = TestBed.inject(DjStore);
    loops = TestBed.inject(DeckLoops);
    for (const slot of ['A', 'B'] as const) {
      runtime.build(slot);
      // What `DeckService` does for every engine notification.
      runtime.subscribe(slot, () => loops.reflect(slot));
    }
    clockOf = { A: clocks[0], B: clocks[1] };
  });

  /** Replays what `DeckService.load` does around the markers: detach, hand the tune to the engine,
   *  attach. */
  async function loadOn(
    slot: Slot,
    identity: TuneIdentity,
    detectedMoments: readonly number[] = []
  ): Promise<void> {
    loops.detach(slot);
    runtime.load(slot, playableOf(identity));
    store.setDeckTiming({ slot, playCallIntervalUs: INTERVAL_US });
    await loops.attach(slot, identity, detectedMoments);
  }

  /** Moves the playhead to `frame` and marks it. */
  async function placeMarker(slot: Slot, frame: number): Promise<void> {
    await runtime.seekToFrame(slot, frame);
    loops.add(slot);
  }

  /** Lets the engine finish every build it was holding. */
  async function settle(): Promise<void> {
    await flush();
    while (prepareRunners.some((runner) => runner.hasHeld)) {
      prepareRunners.forEach((runner) => runner.releaseAll());
      await flush();
    }
  }

  /** The refusals this collaborator warned about; the runtime has warnings of its own. */
  const refusals = () =>
    vi.mocked(logWarn).mock.calls.filter(([message]) => message.startsWith('DeckLoops:'));
  const stateOf = (slot: Slot) => store.loops()[slot];
  const idsOf = (slot: Slot) => stateOf(slot).markers.map((marker) => marker.id);
  const startsOf = (slot: Slot) => stateOf(slot).markers.map((marker) => marker.start.frame);
  const readyOf = (slot: Slot) => stateOf(slot).markers.map((marker) => marker.ready);
  const preparedOn = (slot: Slot) => runtime.snapshot(slot).tune?.preparedFrames;
  const engineLoop = (slot: Slot) => runtime.snapshot(slot).loop;
  const engineQueue = (slot: Slot) => runtime.snapshot(slot).tune?.queuedJump ?? null;
  const handOffsOf = (slot: Slot) => runtime.snapshot(slot).tune?.handOffs;

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

  /** Plays until the playhead wraps back, and returns the furthest it got first. */
  function peakBeforeWrap(slot: Slot): number {
    let peak = runtime.position(slot);
    tickUntil(slot, () => {
      const position = runtime.position(slot);
      if (position < peak) {
        return true;
      }
      peak = position;
      return false;
    });
    return peak;
  }

  describe('restoring a tune', () => {
    it("brings back a tune's markers when it is loaded again, with the first selected", async () => {
      await loadOn('A', TUNE_X);
      await placeMarker('A', 100);
      await placeMarker('A', 200);
      const saved = idsOf('A');

      await loadOn('A', TUNE_Y);
      expect(stateOf('A').markers).toEqual([]);

      await loadOn('A', TUNE_X);
      expect(idsOf('A')).toEqual(saved);
      expect(startsOf('A')).toEqual([100, 200]);
      expect(stateOf('A').selectedId).toBe(saved[0]);
    });

    it("keeps each subtune's list apart", async () => {
      await loadOn('A', TUNE_X);
      await placeMarker('A', 100);
      await loadOn('A', { ...TUNE_X, subtune: 2 });
      expect(stateOf('A').markers).toEqual([]);
      await placeMarker('A', 300);

      await loadOn('A', TUNE_X);
      expect(startsOf('A')).toEqual([100]);
      await loadOn('A', { ...TUNE_X, subtune: 2 });
      expect(startsOf('A')).toEqual([300]);
    });

    it('selects nothing for a tune with no markers, and carries its detected moments', async () => {
      await loadOn('A', TUNE_X, [300, 100, 200]);

      expect(stateOf('A').selectedId).toBeNull();
      expect(stateOf('A').detectedMoments).toEqual([100, 200, 300]);
    });

    it('clears the deck on detach and leaves the saved markers in the store', async () => {
      await loadOn('A', TUNE_X);
      await placeMarker('A', 100);

      loops.detach('A');

      expect(stateOf('A').markers).toEqual([]);
      expect(stateOf('A').selectedId).toBeNull();
      expect(await positions.load(TUNE_X)).toHaveLength(1);
    });

    it('drops a superseded attach whose load resolves after a detach', async () => {
      await positions.save(TUNE_X, [cue('stale', 5)]);
      let release!: () => void;
      const real = positions.load.bind(positions);
      vi.spyOn(positions, 'load').mockImplementationOnce(async (identity) => {
        const markers = await real(identity);
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        return markers;
      });

      const attaching = loops.attach('A', TUNE_X, []);
      await flush();
      loops.detach('A');
      release();
      await attaching;

      expect(stateOf('A').markers).toEqual([]);
    });

    it('drops a superseded attach whose load resolves after a newer attach', async () => {
      await positions.save(TUNE_X, [cue('stale', 5)]);
      await positions.save(TUNE_Y, [cue('fresh', 7)]);
      let release!: () => void;
      const real = positions.load.bind(positions);
      vi.spyOn(positions, 'load').mockImplementationOnce(async (identity) => {
        const markers = await real(identity);
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        return markers;
      });

      const older = loops.attach('A', TUNE_X, []);
      await flush();
      await loops.attach('A', TUNE_Y, []);
      release();
      await older;

      expect(idsOf('A')).toEqual(['fresh']);
    });

    it('logs a store that fails to load and leaves the deck with no markers', async () => {
      vi.spyOn(positions, 'load').mockRejectedValueOnce(new Error('offline'));

      await expect(loadOn('A', TUNE_X)).resolves.toBeUndefined();

      expect(stateOf('A').markers).toEqual([]);
      expect(logError).toHaveBeenCalledWith(expect.stringContaining('deck A'), expect.any(Error));
    });
  });

  describe('readiness', () => {
    it('turns each marker ready as the engine publishes its frame', async () => {
      await positions.save(TUNE_X, [cue('a', 50), cue('b', 120)]);
      gates.A.holding = true;

      await loadOn('A', TUNE_X);
      await flush();
      expect(readyOf('A')).toEqual([false, false]);

      prepareRunners[0].releaseNext();
      await flush();
      expect(readyOf('A')).toEqual([true, false]);

      await settle();
      expect(readyOf('A')).toEqual([true, true]);
      expect(preparedOn('A')).toEqual([50, 120]);
    });

    it('has a marker added at the playhead ready at once', async () => {
      gates.A.holding = true;
      await loadOn('A', TUNE_X);

      await placeMarker('A', 200);

      expect(readyOf('A')).toEqual([true]);
    });

    it('declares the sorted, unique resolved starts of every marker and never an end', async () => {
      await positions.save(TUNE_X, [loopOf('far', 300, 450), cue('near', 100), cue('twin', 100)]);
      const declare = vi.spyOn(runtime, 'setJumpTargets');

      await loadOn('A', TUNE_X);
      await settle();

      expect(declare).toHaveBeenLastCalledWith('A', [100, 300]);
      expect(preparedOn('A')).toEqual([100, 300]);
    });

    it('declares again after an edit, so the moved start is built and the old one dropped', async () => {
      await positions.save(TUNE_X, [cue('a', 100)]);
      await loadOn('A', TUNE_X);
      await settle();
      const declare = vi.spyOn(runtime, 'setJumpTargets');

      loops.nudge('A', 'start', 20);
      await settle();

      expect(declare).toHaveBeenLastCalledWith('A', [120]);
      expect(preparedOn('A')).toEqual([120]);
      expect(readyOf('A')).toEqual([true]);
    });
  });

  describe('adding', () => {
    it('captures the playhead as a cue on every voice, selects it and saves it', async () => {
      await loadOn('A', TUNE_X);

      await placeMarker('A', 100);

      const [marker] = stateOf('A').markers;
      expect(marker.start).toEqual({ frame: 100, offsetFrames: 0 });
      expect(marker.end).toBeNull();
      expect(marker.voices).toEqual([0, 1, 2]);
      expect(stateOf('A').selectedId).toBe(marker.id);
      expect(await positions.load(TUNE_X)).toEqual([
        { id: marker.id, start: { frame: 100, offsetFrames: 0 }, end: null, voices: [0, 1, 2] },
      ]);
    });

    it('appends after the existing markers and selects the new one', async () => {
      await positions.save(TUNE_X, [cue('a', 50)]);
      await loadOn('A', TUNE_X);

      await placeMarker('A', 100);

      expect(startsOf('A')).toEqual([50, 100]);
      expect(stateOf('A').selectedId).toBe(idsOf('A')[1]);
    });

    it('refuses with a warning when the engine has nothing to capture', async () => {
      await loops.attach('A', TUNE_X, []);

      loops.add('A');

      expect(stateOf('A').markers).toEqual([]);
      expect(refusals()).toHaveLength(1);
    });

    it('refuses with a warning on a deck with no tune attached', () => {
      loops.add('A');

      expect(stateOf('A').markers).toEqual([]);
      expect(refusals()).toHaveLength(1);
    });
  });

  describe('selecting', () => {
    beforeEach(async () => {
      await positions.save(TUNE_X, [cue('a', 10), cue('b', 20), cue('c', 30)]);
      await loadOn('A', TUNE_X);
    });

    it('selects the first marker on attach', () => {
      expect(stateOf('A').selectedId).toBe('a');
    });

    it('selects a marker by id, and refuses an id it does not hold', () => {
      loops.select('A', 'c');
      expect(stateOf('A').selectedId).toBe('c');

      loops.select('A', 'nope');

      expect(stateOf('A').selectedId).toBe('c');
      expect(refusals()).toHaveLength(1);
    });

    it('moves by a delta and stops at the ends without wrapping', () => {
      loops.move('A', 1);
      expect(stateOf('A').selectedId).toBe('b');
      loops.move('A', 5);
      expect(stateOf('A').selectedId).toBe('c');
      loops.move('A', 1);
      expect(stateOf('A').selectedId).toBe('c');
      loops.move('A', -9);
      expect(stateOf('A').selectedId).toBe('a');
      loops.move('A', -1);
      expect(stateOf('A').selectedId).toBe('a');
    });

    it('selects by index, rounding and clamping into the list', () => {
      loops.selectAt('A', 1.6);
      expect(stateOf('A').selectedId).toBe('c');
      loops.selectAt('A', -4);
      expect(stateOf('A').selectedId).toBe('a');
      loops.selectAt('A', 99);
      expect(stateOf('A').selectedId).toBe('c');
    });

    it('does nothing when there are no markers', async () => {
      await loadOn('A', TUNE_Y);

      loops.move('A', 1);
      loops.selectAt('A', 0);

      expect(stateOf('A').selectedId).toBeNull();
    });

    it('notes a selection that moved while a jump is queued, and only then', () => {
      loops.move('A', 1);
      expect(stateOf('A').selectionMovedWhileQueued).toBe(false);

      store.setLoopActivity({
        slot: 'A',
        runningId: null,
        queuedId: 'b',
        selectionMovedWhileQueued: false,
      });
      loops.select('A', 'b');
      expect(stateOf('A').selectionMovedWhileQueued).toBe(false);
      loops.select('A', 'c');

      expect(stateOf('A').selectionMovedWhileQueued).toBe(true);
    });
  });

  describe('ending and clearing', () => {
    beforeEach(async () => {
      await positions.save(TUNE_X, [cue('a', 100)]);
      await loadOn('A', TUNE_X);
    });

    it('ends the selected marker at the playhead, making it a loop, and saves it', async () => {
      await runtime.seekToFrame('A', 180);

      loops.setEnd('A');

      expect(stateOf('A').markers[0].end).toEqual({ frame: 180, offsetFrames: 0 });
      expect(await positions.load(TUNE_X)).toEqual([loopOf('a', 100, 180)]);
    });

    it('refuses an end that is not after the start', async () => {
      await runtime.seekToFrame('A', 100);

      loops.setEnd('A');

      expect(stateOf('A').markers[0].end).toBeNull();
      expect(refusals()).toHaveLength(1);
    });

    it('counts the start nudge when judging the end', async () => {
      loops.nudge('A', 'start', 30);
      await runtime.seekToFrame('A', 120);

      loops.setEnd('A');

      expect(stateOf('A').markers[0].end).toBeNull();
      expect(refusals()).toHaveLength(1);
    });

    it('turns a loop back into a cue, and does nothing to a cue', async () => {
      await runtime.seekToFrame('A', 180);
      loops.setEnd('A');

      loops.clearEnd('A');
      expect(stateOf('A').markers[0].end).toBeNull();
      expect(await positions.load(TUNE_X)).toEqual([cue('a', 100)]);

      const before = stateOf('A').markers;
      loops.clearEnd('A');
      expect(stateOf('A').markers).toBe(before);
      expect(refusals()).toHaveLength(0);
    });

    it('refuses with a warning when no marker is selected', async () => {
      await loadOn('A', TUNE_Y);

      loops.setEnd('A');
      loops.clearEnd('A');
      loops.remove('A');

      expect(refusals()).toHaveLength(3);
    });
  });

  describe('deleting', () => {
    beforeEach(async () => {
      await positions.save(TUNE_X, [cue('a', 10), cue('b', 20), cue('c', 30)]);
      await loadOn('A', TUNE_X);
    });

    it('moves the selection to the marker that took its place, then the previous one, then none', async () => {
      loops.select('A', 'b');

      loops.remove('A');
      expect(idsOf('A')).toEqual(['a', 'c']);
      expect(stateOf('A').selectedId).toBe('c');

      loops.remove('A');
      expect(idsOf('A')).toEqual(['a']);
      expect(stateOf('A').selectedId).toBe('a');

      loops.remove('A');
      expect(idsOf('A')).toEqual([]);
      expect(stateOf('A').selectedId).toBeNull();
      expect(await positions.load(TUNE_X)).toEqual([]);
    });

    it('declares only what is left', async () => {
      const declare = vi.spyOn(runtime, 'setJumpTargets');

      loops.remove('A');

      expect(declare).toHaveBeenLastCalledWith('A', [20, 30]);
    });
  });

  describe('nudging', () => {
    beforeEach(async () => {
      await positions.save(TUNE_X, [cue('cue', 100), loopOf('loop', 300, 320)]);
      await loadOn('A', TUNE_X);
    });

    it('holds a nudge to a second either way', async () => {
      loops.nudge('A', 'start', 80);
      expect(stateOf('A').markers[0].start.offsetFrames).toBe(SECOND);

      loops.nudge('A', 'start', -80);
      expect(stateOf('A').markers[0].start.offsetFrames).toBe(-SECOND);

      expect(await positions.load(TUNE_X)).toEqual([
        cue('cue', 100, -SECOND),
        loopOf('loop', 300, 320),
      ]);
    });

    it('keeps a loop end at least one frame after its start, from either side', () => {
      loops.select('A', 'loop');

      loops.nudge('A', 'start', 40);
      expect(stateOf('A').markers[1].start.offsetFrames).toBe(19);

      loops.nudge('A', 'start', 0);
      loops.nudge('A', 'end', -30);
      expect(stateOf('A').markers[1].end?.offsetFrames).toBe(-19);

      loops.nudge('A', 'end', 80);
      expect(stateOf('A').markers[1].end?.offsetFrames).toBe(SECOND);
    });

    it('counts the other boundary nudge when limiting', () => {
      loops.select('A', 'loop');
      loops.nudge('A', 'end', -10);

      loops.nudge('A', 'start', 40);

      expect(stateOf('A').markers[1].start.offsetFrames).toBe(9);
    });

    it('refuses an end nudge on a cue', () => {
      expect(loops.nudge('A', 'end', 5)).toBeNull();

      expect(refusals()).toHaveLength(1);
      expect(stateOf('A').markers[0]).toMatchObject({ end: null });
    });

    it('ignores a value that is not a number', () => {
      const before = stateOf('A').markers;

      expect(loops.nudge('A', 'start', Number.NaN)).toBeNull();

      expect(stateOf('A').markers).toBe(before);
    });

    it('returns the edited marker, also when the boundary stays where it was', () => {
      expect(loops.nudge('A', 'start', 5)).toBe('cue');
      const before = stateOf('A').markers;

      expect(loops.nudge('A', 'start', 5)).toBe('cue');

      expect(stateOf('A').markers).toBe(before);
    });
  });

  describe('snapping', () => {
    beforeEach(async () => {
      await positions.save(TUNE_X, [cue('cue', 100), loopOf('loop', 300, 320)]);
      await loadOn('A', TUNE_X, [60, 95, 130, 400, 305, 330]);
    });

    const startOffset = (index: number) => stateOf('A').markers[index].start.offsetFrames;

    it('steps through the moments within a second, and stops at the last one each way', () => {
      loops.snap('A', 'start', 'previous');
      expect(startOffset(0)).toBe(-5);
      loops.snap('A', 'start', 'previous');
      expect(startOffset(0)).toBe(-40);
      loops.snap('A', 'start', 'previous');
      expect(startOffset(0)).toBe(-40);

      loops.snap('A', 'start', 'next');
      loops.snap('A', 'start', 'next');
      expect(startOffset(0)).toBe(30);
      loops.snap('A', 'start', 'next');
      expect(startOffset(0)).toBe(30);
    });

    it('applies a snap as a nudge, so a loop start still stops short of its end', () => {
      loops.select('A', 'loop');

      loops.snap('A', 'start', 'next');

      expect(startOffset(1)).toBe(5);
      loops.snap('A', 'end', 'next');
      expect(stateOf('A').markers[1].end?.offsetFrames).toBe(10);
      loops.snap('A', 'end', 'previous');
      loops.snap('A', 'end', 'previous');
      expect(stateOf('A').markers[1].end?.offsetFrames).toBe(-14);
    });

    it('leaves the boundary alone when no moment is in reach, and still returns the marker', () => {
      loops.select('A', 'loop');
      const before = stateOf('A').markers;

      expect(loops.snap('A', 'start', 'previous')).toBe('loop');

      expect(stateOf('A').markers).toBe(before);
    });

    it('returns the snapped marker', () => {
      expect(loops.snap('A', 'start', 'next')).toBe('cue');
    });

    it('refuses an end snap on a cue', () => {
      expect(loops.snap('A', 'end', 'next')).toBeNull();

      expect(refusals()).toHaveLength(1);
    });
  });

  describe('the same tune on both decks', () => {
    beforeEach(async () => {
      await loadOn('A', TUNE_X);
      await loadOn('B', TUNE_X);
    });

    it('shows an edit from either deck on both, with selections of their own', async () => {
      await placeMarker('A', 100);
      expect(idsOf('B')).toEqual(idsOf('A'));
      expect(stateOf('B').selectedId).toBe(idsOf('A')[0]);

      await placeMarker('A', 200);
      expect(startsOf('B')).toEqual([100, 200]);
      expect(stateOf('A').selectedId).toBe(idsOf('A')[1]);
      expect(stateOf('B').selectedId).toBe(idsOf('A')[0]);

      loops.select('B', idsOf('B')[1]);
      await placeMarker('B', 300);
      expect(startsOf('A')).toEqual([100, 200, 300]);
      expect(stateOf('B').selectedId).toBe(idsOf('B')[2]);
      expect(stateOf('A').selectedId).toBe(idsOf('A')[1]);
    });

    it('takes an end, a nudge and a delete across too', async () => {
      await placeMarker('A', 100);
      await runtime.seekToFrame('A', 180);
      loops.setEnd('A');
      loops.nudge('A', 'start', 10);
      expect(stateOf('B').markers[0].end).toEqual({ frame: 180, offsetFrames: 0 });
      expect(stateOf('B').markers[0].start.offsetFrames).toBe(10);

      loops.remove('A');
      expect(stateOf('B').markers).toEqual([]);
      expect(stateOf('B').selectedId).toBeNull();
    });

    it("moves the other deck's selection on when its selected marker is deleted", async () => {
      await positions.save(TUNE_X, [cue('a', 10), cue('b', 20), cue('c', 30)]);
      await loadOn('A', TUNE_X);
      await loadOn('B', TUNE_X);
      loops.select('A', 'b');
      loops.select('B', 'b');

      loops.remove('A');

      expect(stateOf('B').selectedId).toBe('c');
    });

    it("reads the other deck's readiness from its own engine", async () => {
      gates.B.holding = true;

      await placeMarker('A', 100);

      expect(readyOf('A')).toEqual([true]);
      expect(readyOf('B')).toEqual([false]);

      await settle();
      expect(readyOf('B')).toEqual([true]);
      expect(preparedOn('B')).toEqual([100]);
    });

    it('re-declares the other deck after an edit', async () => {
      const declare = vi.spyOn(runtime, 'setJumpTargets');

      await placeMarker('A', 100);

      expect(declare).toHaveBeenCalledWith('B', [100]);
    });

    it('leaves a deck holding another tune or another subtune alone', async () => {
      await loadOn('B', TUNE_Y);
      await placeMarker('A', 100);
      expect(stateOf('B').markers).toEqual([]);

      await loadOn('B', { ...TUNE_X, subtune: 2 });
      await placeMarker('A', 200);
      expect(stateOf('B').markers).toEqual([]);
    });
  });

  describe('performing markers', () => {
    beforeEach(async () => {
      await positions.save(TUNE_X, [
        loopOf('a', 100, 120),
        loopOf('b', 300, 320),
        cue('c', 500),
        loopOf('wide', 600, 800),
      ]);
      await loadOn('A', TUNE_X);
      await settle();
      await runtime.play('A');
    });

    /** Engages `id` and lets its jump land. */
    async function engage(id: string): Promise<void> {
      loops.toggle('A', id);
      await flush();
    }

    describe('toggling', () => {
      it('engages an idle loop now when nothing is looping', async () => {
        await engage('a');

        expect(stateOf('A').runningId).toBe('a');
        expect(stateOf('A').queuedId).toBeNull();
        expect(engineLoop('A')).toEqual({ startFrame: 100, endFrame: 120 });
        expect(runtime.position('A')).toBe(100);
      });

      it('engages an idle cue now with no loop running', async () => {
        await engage('c');

        expect(stateOf('A').runningId).toBeNull();
        expect(stateOf('A').queuedId).toBeNull();
        expect(engineLoop('A')).toBeNull();
        expect(runtime.position('A')).toBe(500);
      });

      it('keeps one loop per deck, queuing a second behind the first', async () => {
        await engage('a');

        loops.toggle('A', 'b');

        expect(stateOf('A').runningId).toBe('a');
        expect(stateOf('A').queuedId).toBe('b');
        expect(engineLoop('A')).toEqual({ startFrame: 100, endFrame: 120 });
        expect(engineQueue('A')).toEqual({ startFrame: 300, endFrame: 320 });
      });

      it('replaces the queued marker when another is pressed', async () => {
        await engage('a');
        loops.toggle('A', 'b');

        loops.toggle('A', 'c');

        expect(stateOf('A').queuedId).toBe('c');
        expect(engineQueue('A')).toEqual({ startFrame: 500, endFrame: null });
      });

      it('cancels a queued marker when it is pressed again, leaving the running loop', async () => {
        await engage('a');
        loops.toggle('A', 'b');

        loops.toggle('A', 'b');
        tick('A', 120);

        expect(stateOf('A').queuedId).toBeNull();
        expect(stateOf('A').runningId).toBe('a');
        expect(engineQueue('A')).toBeNull();
        expect(handOffsOf('A')).toBe(0);
      });

      it('lets a running marker go when it is pressed, leaving the playhead where it was', async () => {
        await engage('a');
        tick('A', 5);
        const position = runtime.position('A');

        loops.toggle('A', 'a');

        expect(stateOf('A').runningId).toBeNull();
        expect(engineLoop('A')).toBeNull();
        expect(runtime.position('A')).toBe(position);
      });

      it('stops the running loop and everything queued behind it without moving the playhead', async () => {
        await engage('a');
        loops.toggle('A', 'b');
        tick('A', 5);
        const position = runtime.position('A');

        loops.stop('A');

        expect(stateOf('A').runningId).toBeNull();
        expect(stateOf('A').queuedId).toBeNull();
        expect(engineLoop('A')).toBeNull();
        expect(engineQueue('A')).toBeNull();
        expect(runtime.position('A')).toBe(position);
      });

      it('refuses a marker the deck does not hold', async () => {
        loops.toggle('A', 'missing');

        expect(refusals()).toHaveLength(1);
        expect(stateOf('A').runningId).toBeNull();
      });
    });

    describe('landing', () => {
      it('hands off to the queued loop at the end of the lap', async () => {
        await engage('a');
        loops.toggle('A', 'b');
        expect(stateOf('A').runningId).toBe('a');

        tickUntil('A', () => handOffsOf('A') === 1);

        expect(stateOf('A').runningId).toBe('b');
        expect(stateOf('A').queuedId).toBeNull();
        expect(engineLoop('A')).toEqual({ startFrame: 300, endFrame: 320 });
        expect(engineQueue('A')).toBeNull();
        expect(runtime.position('A')).toBeGreaterThanOrEqual(300);
        expect(runtime.position('A')).toBeLessThan(320);
      });

      it('hands off to a queued cue, which leaves nothing looping', async () => {
        await engage('a');
        loops.toggle('A', 'c');

        tickUntil('A', () => handOffsOf('A') === 1);

        expect(stateOf('A').runningId).toBeNull();
        expect(stateOf('A').queuedId).toBeNull();
        expect(engineLoop('A')).toBeNull();
        expect(runtime.position('A')).toBeGreaterThanOrEqual(500);
      });

      it('waits for a queued marker that is not ready, and lands it once it is', async () => {
        gates.A.holding = true;
        loops.select('A', 'b');
        loops.nudge('A', 'start', 5);
        loops.select('A', 'a');
        await engage('a');
        loops.toggle('A', 'b');

        tick('A', 120);
        expect(handOffsOf('A')).toBe(0);
        expect(stateOf('A').runningId).toBe('a');
        expect(stateOf('A').queuedId).toBe('b');

        await settle();
        tickUntil('A', () => handOffsOf('A') === 1);

        expect(stateOf('A').runningId).toBe('b');
        expect(engineLoop('A')).toEqual({ startFrame: 305, endFrame: 320 });
      });

      it('moves the selection to the landed marker', async () => {
        await engage('a');
        loops.toggle('A', 'b');
        expect(stateOf('A').selectedId).toBe('a');

        tickUntil('A', () => handOffsOf('A') === 1);

        expect(stateOf('A').selectedId).toBe('b');
      });

      it('leaves the selection where the performer moved it while the jump waited', async () => {
        await engage('a');
        loops.toggle('A', 'b');
        loops.select('A', 'c');

        tickUntil('A', () => handOffsOf('A') === 1);

        expect(stateOf('A').runningId).toBe('b');
        expect(stateOf('A').selectedId).toBe('c');
        expect(stateOf('A').selectionMovedWhileQueued).toBe(false);
      });

      it('never reads a stop as a landing', async () => {
        await engage('a');
        loops.toggle('A', 'b');

        loops.stop('A');
        tick('A', 120);

        expect(stateOf('A').runningId).toBeNull();
        expect(stateOf('A').queuedId).toBeNull();
        expect(stateOf('A').selectedId).toBe('a');
        expect(handOffsOf('A')).toBe(0);
      });

      it('clears a running and a queued marker when the transport stops, without a landing', async () => {
        await engage('a');
        loops.toggle('A', 'b');

        runtime.stop('A');

        expect(stateOf('A').runningId).toBeNull();
        expect(stateOf('A').queuedId).toBeNull();
        expect(stateOf('A').selectedId).toBe('a');
        expect(engineLoop('A')).toBeNull();
      });
    });

    describe('waiting for readiness', () => {
      async function notReady(id: string): Promise<void> {
        gates.A.holding = true;
        loops.select('A', id);
        loops.nudge('A', 'start', 5);
        expect(stateOf('A').markers.find((marker) => marker.id === id)?.ready).toBe(false);
      }

      it('holds a marker with nothing looping until its start is ready, then engages it', async () => {
        await notReady('a');

        loops.toggle('A', 'a');
        await flush();

        expect(stateOf('A').queuedId).toBe('a');
        expect(stateOf('A').runningId).toBeNull();
        expect(engineLoop('A')).toBeNull();
        expect(engineQueue('A')).toBeNull();

        await settle();

        expect(stateOf('A').queuedId).toBeNull();
        expect(stateOf('A').runningId).toBe('a');
        expect(engineLoop('A')).toEqual({ startFrame: 105, endFrame: 120 });
        expect(runtime.position('A')).toBe(105);
      });

      it('follows the waiting marker with the selection unless it moved', async () => {
        await notReady('b');
        loops.select('A', 'a');

        loops.toggle('A', 'b');
        await settle();

        expect(stateOf('A').runningId).toBe('b');
        expect(stateOf('A').selectedId).toBe('b');
      });

      it('leaves the selection where it was moved while the marker waited', async () => {
        await notReady('b');
        loops.select('A', 'a');
        loops.toggle('A', 'b');
        loops.select('A', 'c');

        await settle();

        expect(stateOf('A').runningId).toBe('b');
        expect(stateOf('A').selectedId).toBe('c');
        expect(stateOf('A').selectionMovedWhileQueued).toBe(false);
      });

      it('drops the wait when the marker is pressed again', async () => {
        await notReady('a');
        loops.toggle('A', 'a');

        loops.toggle('A', 'a');
        await settle();

        expect(stateOf('A').queuedId).toBeNull();
        expect(stateOf('A').runningId).toBeNull();
        expect(engineLoop('A')).toBeNull();
      });

      it('drops the wait when disengaged, and never engages once the start is ready', async () => {
        await notReady('a');
        loops.toggle('A', 'a');
        const at = runtime.position('A');

        loops.disengage('A');
        await settle();

        expect(stateOf('A').queuedId).toBeNull();
        expect(stateOf('A').runningId).toBeNull();
        expect(engineLoop('A')).toBeNull();
        expect(runtime.position('A')).toBe(at);
      });

      it('drops the wait when the marker is deleted', async () => {
        await notReady('a');
        loops.toggle('A', 'a');

        loops.remove('A');
        await settle();

        expect(stateOf('A').queuedId).toBeNull();
        expect(stateOf('A').runningId).toBeNull();
      });
    });

    describe('editing a running marker', () => {
      it('applies a new end at once, with no seek', async () => {
        await engage('a');
        const seek = vi.spyOn(runtime, 'seekToFrame');

        loops.nudge('A', 'end', 10);

        expect(engineLoop('A')).toEqual({ startFrame: 100, endFrame: 130 });
        expect(stateOf('A').runningId).toBe('a');
        expect(seek).not.toHaveBeenCalled();
      });

      it('lets the lap in progress run on to the new end before it wraps', async () => {
        await engage('a');
        loops.nudge('A', 'end', 10);

        expect(peakBeforeWrap('A')).toBeGreaterThanOrEqual(125);
      });

      it('holds a new start on the old bounds until it is ready, then applies it with no seek', async () => {
        await engage('a');
        const seek = vi.spyOn(runtime, 'seekToFrame');
        gates.A.holding = true;

        loops.nudge('A', 'start', 10);

        expect(engineLoop('A')).toEqual({ startFrame: 100, endFrame: 120 });
        await settle();
        expect(engineLoop('A')).toEqual({ startFrame: 110, endFrame: 120 });
        expect(stateOf('A').runningId).toBe('a');
        expect(seek).not.toHaveBeenCalled();
      });

      it('re-enters at the new start on the next lap', async () => {
        await engage('a');
        gates.A.holding = true;
        loops.nudge('A', 'start', 10);
        await settle();

        peakBeforeWrap('A');

        expect(runtime.position('A')).toBeGreaterThanOrEqual(110);
      });

      it('keeps a marker queued through the engine when the running loop is edited', async () => {
        await engage('a');
        loops.toggle('A', 'b');

        loops.nudge('A', 'end', 10);

        expect(stateOf('A').queuedId).toBe('b');
        expect(engineQueue('A')).toEqual({ startFrame: 300, endFrame: 320 });
        tickUntil('A', () => handOffsOf('A') === 1);
        expect(stateOf('A').runningId).toBe('b');
      });

      it('keeps the queued marker when a start change is applied once ready', async () => {
        await engage('a');
        loops.toggle('A', 'b');
        gates.A.holding = true;
        loops.nudge('A', 'start', 10);

        await settle();

        expect(engineLoop('A')).toEqual({ startFrame: 110, endFrame: 120 });
        expect(engineQueue('A')).toEqual({ startFrame: 300, endFrame: 320 });
      });

      it('lets a loop go as a stop when its end is cleared', async () => {
        await engage('a');
        tick('A', 5);
        const position = runtime.position('A');

        loops.clearEnd('A');

        expect(stateOf('A').runningId).toBeNull();
        expect(engineLoop('A')).toBeNull();
        expect(runtime.position('A')).toBe(position);
      });

      it('lets a loop go as a stop when it is deleted', async () => {
        await engage('a');
        loops.toggle('A', 'b');

        loops.remove('A');

        expect(stateOf('A').runningId).toBeNull();
        expect(stateOf('A').queuedId).toBeNull();
        expect(engineLoop('A')).toBeNull();
        expect(engineQueue('A')).toBeNull();
      });
    });

    describe('editing a queued marker', () => {
      it('queues the new target when its start or end changes', async () => {
        await engage('a');
        loops.toggle('A', 'b');
        loops.select('A', 'b');

        loops.nudge('A', 'start', 5);
        expect(engineQueue('A')).toEqual({ startFrame: 305, endFrame: 320 });

        loops.nudge('A', 'end', 10);
        expect(engineQueue('A')).toEqual({ startFrame: 305, endFrame: 330 });
        expect(stateOf('A').queuedId).toBe('b');
      });

      it('queues a cue when the queued loop loses its end, and lands it as one', async () => {
        await engage('a');
        loops.toggle('A', 'b');
        loops.select('A', 'b');

        loops.clearEnd('A');
        expect(engineQueue('A')).toEqual({ startFrame: 300, endFrame: null });
        tickUntil('A', () => handOffsOf('A') === 1);

        expect(stateOf('A').runningId).toBeNull();
        expect(engineLoop('A')).toBeNull();
      });

      it('cancels the queue when the queued marker is deleted, leaving the running loop', async () => {
        await engage('a');
        loops.toggle('A', 'b');
        loops.select('A', 'b');

        loops.remove('A');

        expect(stateOf('A').queuedId).toBeNull();
        expect(engineQueue('A')).toBeNull();
        expect(stateOf('A').runningId).toBe('a');
        expect(engineLoop('A')).toEqual({ startFrame: 100, endFrame: 120 });
      });
    });

    describe('auditioning', () => {
      it('engages the edited marker from its start, taking over from the running one', async () => {
        await engage('a');
        loops.toggle('A', 'c');
        loops.select('A', 'b');

        loops.audition('A', 'start', 'b');
        await flush();

        expect(stateOf('A').runningId).toBe('b');
        expect(stateOf('A').queuedId).toBeNull();
        expect(engineQueue('A')).toBeNull();
        expect(engineLoop('A')).toEqual({ startFrame: 300, endFrame: 320 });
        expect(runtime.position('A')).toBe(300);
      });

      it('waits for a start that is not ready, then engages it', async () => {
        gates.A.holding = true;
        loops.select('A', 'b');
        loops.nudge('A', 'start', 5);

        loops.audition('A', 'start', 'b');
        expect(stateOf('A').runningId).toBeNull();
        expect(stateOf('A').queuedId).toBe('b');

        await settle();

        expect(stateOf('A').runningId).toBe('b');
        expect(engineLoop('A')).toEqual({ startFrame: 305, endFrame: 320 });
      });

      it('drops a marker queued in the engine when it waits instead for a start', async () => {
        await engage('a');
        loops.toggle('A', 'c');
        gates.A.holding = true;
        loops.select('A', 'b');
        loops.nudge('A', 'start', 5);

        loops.audition('A', 'start', 'b');

        expect(engineQueue('A')).toBeNull();
        tick('A', 120);
        expect(handOffsOf('A')).toBe(0);
        await settle();
        expect(stateOf('A').runningId).toBe('b');
      });

      it('arms a loop and lands two seconds before its end', async () => {
        loops.select('A', 'wide');

        loops.audition('A', 'end', 'wide');
        await flush();

        expect(stateOf('A').runningId).toBe('wide');
        expect(engineLoop('A')).toEqual({ startFrame: 600, endFrame: 800 });
        expect(runtime.position('A')).toBe(800 - 2 * SECOND);
      });

      it('lands no earlier than the loop start', async () => {
        loops.select('A', 'a');

        loops.audition('A', 'end', 'a');
        await flush();

        expect(runtime.position('A')).toBe(100);
      });

      it('does nothing for the end of a cue', async () => {
        loops.select('A', 'c');
        const seek = vi.spyOn(runtime, 'seekToFrame');

        loops.audition('A', 'end', 'c');
        await flush();

        expect(stateOf('A').runningId).toBeNull();
        expect(engineLoop('A')).toBeNull();
        expect(seek).not.toHaveBeenCalled();
      });

      it('does not start playback', async () => {
        runtime.pause('A');
        loops.select('A', 'b');

        loops.audition('A', 'start', 'b');
        await flush();

        expect(runtime.snapshot('A').transport).toBe('paused');
        expect(stateOf('A').runningId).toBe('b');
      });

      it('skips a marker that is no longer the selected one, or is gone', async () => {
        loops.select('A', 'a');
        const seek = vi.spyOn(runtime, 'seekToFrame');

        loops.audition('A', 'start', 'b');
        loops.audition('A', 'start', 'missing');
        await flush();

        expect(stateOf('A').runningId).toBeNull();
        expect(engineLoop('A')).toBeNull();
        expect(seek).not.toHaveBeenCalled();
      });

      describe('a queued marker', () => {
        beforeEach(async () => {
          await engage('a');
          loops.toggle('A', 'wide');
          loops.select('A', 'wide');
        });

        it('lands at once for an end edit, with nothing left in the engine queue', async () => {
          loops.nudge('A', 'end', 10);
          loops.audition('A', 'end', 'wide');
          await flush();

          expect(stateOf('A').runningId).toBe('wide');
          expect(stateOf('A').queuedId).toBeNull();
          expect(engineQueue('A')).toBeNull();
          expect(engineLoop('A')).toEqual({ startFrame: 600, endFrame: 810 });
          expect(runtime.position('A')).toBe(810 - 2 * SECOND);
        });

        it('drops the engine queue for a start edit and lands once the start is ready', async () => {
          gates.A.holding = true;
          loops.nudge('A', 'start', 10);
          loops.audition('A', 'start', 'wide');

          expect(engineQueue('A')).toBeNull();
          expect(stateOf('A').runningId).toBe('a');
          expect(stateOf('A').queuedId).toBe('wide');
          tick('A', 120);
          expect(handOffsOf('A')).toBe(0);

          await settle();

          expect(stateOf('A').runningId).toBe('wide');
          expect(stateOf('A').queuedId).toBeNull();
          expect(engineLoop('A')).toEqual({ startFrame: 610, endFrame: 800 });
          expect(runtime.position('A')).toBe(610);
        });
      });
    });

    describe('auditioning a running marker', () => {
      beforeEach(async () => {
        await engage('wide');
        loops.select('A', 'wide');
      });

      function editStart(offsetFrames: number): void {
        loops.nudge('A', 'start', offsetFrames);
        loops.audition('A', 'start', 'wide');
      }

      function editEnd(offsetFrames: number): void {
        loops.nudge('A', 'end', offsetFrames);
        loops.audition('A', 'end', 'wide');
      }

      it('seeks to two seconds before a new end, leaving the engine on the bounds it holds', async () => {
        loops.nudge('A', 'end', 10);
        const setActiveLoop = vi.spyOn(runtime, 'setActiveLoop');

        loops.audition('A', 'end', 'wide');
        await flush();

        expect(setActiveLoop).not.toHaveBeenCalled();
        expect(engineLoop('A')).toEqual({ startFrame: 600, endFrame: 810 });
        expect(stateOf('A').runningId).toBe('wide');
        expect(runtime.position('A')).toBe(810 - 2 * SECOND);
      });

      it('drops what is queued, and the loop plays on without handing off', async () => {
        loops.toggle('A', 'b');

        editEnd(10);
        await flush();
        tick('A', 400);

        expect(stateOf('A').queuedId).toBeNull();
        expect(engineQueue('A')).toBeNull();
        expect(stateOf('A').runningId).toBe('wide');
        expect(handOffsOf('A')).toBe(0);
      });

      it('seeks to a new start at once when it is already ready', async () => {
        await placeMarker('A', 610);
        await settle();
        loops.select('A', 'wide');
        const seek = vi.spyOn(runtime, 'seekToFrame');

        editStart(10);
        await flush();

        expect(engineLoop('A')).toEqual({ startFrame: 610, endFrame: 800 });
        expect(seek).toHaveBeenCalledTimes(1);
        expect(seek).toHaveBeenCalledWith('A', 610);
        expect(stateOf('A').queuedId).toBeNull();
      });

      describe('while a new start is not ready', () => {
        let seek: MockInstance<DeckRuntime['seekToFrame']>;

        beforeEach(() => {
          seek = vi.spyOn(runtime, 'seekToFrame');
          gates.A.holding = true;
        });

        it('keeps the old bounds and the running marker, then seeks once to the new start', async () => {
          const setActiveLoop = vi.spyOn(runtime, 'setActiveLoop');

          editStart(10);
          await flush();

          expect(engineLoop('A')).toEqual({ startFrame: 600, endFrame: 800 });
          expect(stateOf('A').runningId).toBe('wide');
          expect(stateOf('A').queuedId).toBeNull();
          expect(setActiveLoop).not.toHaveBeenCalled();
          expect(seek).not.toHaveBeenCalled();

          await settle();

          expect(engineLoop('A')).toEqual({ startFrame: 610, endFrame: 800 });
          expect(setActiveLoop).toHaveBeenCalledTimes(1);
          expect(seek).toHaveBeenCalledTimes(1);
          expect(seek).toHaveBeenCalledWith('A', 610);
          expect(runtime.position('A')).toBe(610);
        });

        it('goes to the newest start when the start is edited again', async () => {
          editStart(10);
          editStart(20);

          await settle();

          expect(engineLoop('A')).toEqual({ startFrame: 620, endFrame: 800 });
          expect(seek).toHaveBeenCalledTimes(1);
          expect(seek).toHaveBeenCalledWith('A', 620);
        });

        it('auditions an end edit at once and never jumps back to the start', async () => {
          editStart(10);

          editEnd(-10);
          await flush();

          expect(seek).toHaveBeenCalledTimes(1);
          expect(seek).toHaveBeenLastCalledWith('A', 790 - 2 * SECOND);

          await settle();

          expect(seek).toHaveBeenCalledTimes(1);
          expect(engineLoop('A')).toEqual({ startFrame: 610, endFrame: 790 });
        });

        it('is dropped by a Stop', async () => {
          editStart(10);

          loops.stop('A');
          await settle();

          expect(seek).not.toHaveBeenCalled();
          expect(stateOf('A').runningId).toBeNull();
          expect(engineLoop('A')).toBeNull();

          loops.toggle('A', 'wide');
          await flush();

          expect(seek).toHaveBeenCalledTimes(1);
          expect(seek).toHaveBeenCalledWith('A', 610);
        });

        it('is dropped by a transport stop', async () => {
          editStart(10);

          runtime.stop('A');
          await settle();

          expect(seek).not.toHaveBeenCalled();
          expect(stateOf('A').runningId).toBeNull();
        });

        it('is dropped by a queued marker landing', async () => {
          editStart(10);
          loops.toggle('A', 'b');

          tickUntil('A', () => handOffsOf('A') === 1);
          await settle();

          expect(stateOf('A').runningId).toBe('b');
          expect(seek).not.toHaveBeenCalled();
        });

        it('is dropped by another marker being queued', async () => {
          editStart(10);
          loops.toggle('A', 'c');

          await settle();

          expect(stateOf('A').runningId).toBe('wide');
          expect(stateOf('A').queuedId).toBe('c');
          expect(seek).not.toHaveBeenCalled();
        });

        it('is dropped by another marker being engaged', async () => {
          editStart(10);

          loops.select('A', 'b');
          loops.audition('A', 'start', 'b');
          await settle();

          expect(stateOf('A').runningId).toBe('b');
          expect(seek).toHaveBeenCalledTimes(1);
          expect(seek).toHaveBeenCalledWith('A', 300);
        });

        it("is dropped by an edit arriving from the other deck, which never moves this deck's playhead", async () => {
          await loadOn('B', TUNE_X);
          editStart(10);
          seek.mockClear();

          loops.select('B', 'wide');
          loops.nudge('B', 'end', -10);
          await settle();

          expect(seek).not.toHaveBeenCalled();
          expect(engineLoop('A')).toEqual({ startFrame: 610, endFrame: 790 });
        });
      });
    });

    describe('the same tune on the other deck', () => {
      beforeEach(async () => {
        await loadOn('B', TUNE_X);
        await settle();
        await runtime.play('B');
        loops.toggle('B', 'a');
        await flush();
      });

      const canStopB = () => store.loopsSummary('B')().canStop;

      it("carries an end changed on one deck to the other deck's engine", () => {
        loops.select('A', 'a');

        loops.nudge('A', 'end', 10);

        expect(stateOf('B').runningId).toBe('a');
        expect(engineLoop('B')).toEqual({ startFrame: 100, endFrame: 130 });
        expect(stateOf('A').runningId).toBeNull();
        expect(engineLoop('A')).toBeNull();
      });

      it('applies a start changed on one deck once it is ready on the other', async () => {
        gates.B.holding = true;
        loops.select('A', 'a');

        loops.nudge('A', 'start', 10);

        expect(engineLoop('B')).toEqual({ startFrame: 100, endFrame: 120 });
        await settle();
        expect(engineLoop('B')).toEqual({ startFrame: 110, endFrame: 120 });
      });

      it("re-issues the other deck's queue after the edit", () => {
        loops.toggle('B', 'b');
        loops.select('A', 'a');

        loops.nudge('A', 'end', 10);

        expect(stateOf('B').queuedId).toBe('b');
        expect(engineQueue('B')).toEqual({ startFrame: 300, endFrame: 320 });
      });

      it('lets the other deck go when the marker it runs loses its end', () => {
        expect(canStopB()).toBe(true);
        loops.select('A', 'a');

        loops.clearEnd('A');

        expect(stateOf('B').runningId).toBeNull();
        expect(engineLoop('B')).toBeNull();
        expect(canStopB()).toBe(false);
      });

      it('lets the other deck go when the marker it runs is deleted', () => {
        loops.select('A', 'a');

        loops.remove('A');

        expect(stateOf('B').runningId).toBeNull();
        expect(engineLoop('B')).toBeNull();
        expect(canStopB()).toBe(false);
      });

      it("cancels the other deck's queue when the queued marker is deleted", () => {
        loops.toggle('B', 'b');
        loops.select('A', 'b');

        loops.remove('A');

        expect(stateOf('B').queuedId).toBeNull();
        expect(engineQueue('B')).toBeNull();
        expect(stateOf('B').runningId).toBe('a');
        expect(engineLoop('B')).toEqual({ startFrame: 100, endFrame: 120 });
      });
    });

    it('leaves the tempo alone through a toggle, a landing and a stop', async () => {
      runtime.setTempo('A', 1.25);
      const multiplier = runtime.snapshot('A').tempo.multiplier;

      await engage('a');
      loops.toggle('A', 'b');
      tickUntil('A', () => handOffsOf('A') === 1);
      loops.stop('A');

      expect(multiplier).toBe(1.25);
      expect(runtime.snapshot('A').tempo.multiplier).toBe(multiplier);
    });
  });

  describe('when the store fails', () => {
    it('logs a failed save and keeps the edit', async () => {
      await loadOn('A', TUNE_X);
      const failure = new Error('quota');
      vi.spyOn(positions, 'save').mockRejectedValue(failure);

      await expect(placeMarker('A', 100)).resolves.toBeUndefined();
      await flush();

      expect(startsOf('A')).toEqual([100]);
      expect(logError).toHaveBeenCalledWith(expect.stringContaining('saving deck A'), failure);
    });
  });
});
