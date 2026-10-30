import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { describe, it, expect, beforeEach, vi, type MockInstance } from 'vitest';
import { FakeClock, milliseconds, replayToFrame } from '@sidablist/core';
import type { ReplayRequest, ReplayResponse, ReplayRunner } from '@sidablist/core';
import type { MidiOutputPort } from '@sidablist/asid';
import { InMemoryLoopPositionsStore } from '@sidablist/tunes';
import type { LoopMarker, LoopPositionsStore, Playable, TuneIdentity } from '@sidablist/tunes';
import { logError, logWarn } from '@teensyrom-nx/utils';
import { DeckLoops, type DeckLoopsHolding } from './deck-loops';
import { DeckRuntime } from './deck-runtime';
import {
  DjStore,
  HOME_DECK_PANEL,
  type DeckLoopMarker,
  type DeckMixerSettings,
  type DeckPanelState,
} from './dj-store';
import { MixerApplier } from './mixer-applier';
import { decodeMixerSettings, encodeMixerSettings } from './loops/marker-settings-codec';
import { engineSettingsOf } from './mixer/engine-settings';
import { MARKER_NAME_MAX_LENGTH, MAX_MARKERS_PER_SUBTUNE } from './sets/set-limits';
import { voicePitchMultiplier } from './mixer/pitch';
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

/** A home panel with its Key and Cutoff moved, a stand-in for a shaped one. */
function panelOf(keySemitones: number, cutoff = 0): DeckPanelState {
  return { ...HOME_DECK_PANEL, keySemitones, cutoff };
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
          provide: REGISTER_RECORDER_FACTORY,
          useValue: () => ({ record: () => Promise.resolve(null), dispose: () => undefined }),
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
      ],
    });

    runtime = TestBed.inject(DeckRuntime);
    store = TestBed.inject(DjStore);
    loops = TestBed.inject(DeckLoops);
    for (const slot of ['A', 'B'] as const) {
      runtime.build(slot);
      // What `DeckService` does for every engine notification: mirror the engine's controls
      // first, so the store's voices follow it before the markers reflect it.
      runtime.subscribe(slot, () => {
        mirrorEngineControls(slot);
        loops.reflect(slot);
      });
    }
    clockOf = { A: clocks[0], B: clocks[1] };
  });

  /** Writes the engine's tempo and voices to the store, only on a difference. */
  function mirrorEngineControls(slot: Slot): void {
    const { tempo, voices } = runtime.snapshot(slot);
    const deck = store.decks()[slot];
    const sameVoices =
      deck.voices.length === voices.length &&
      deck.voices.every(
        (voice, i) => voice.muted === voices[i].muted && voice.held === voices[i].held
      );
    if (deck.speed !== tempo.multiplier || !sameVoices) {
      store.setDeckEngineControls({
        slot,
        speed: tempo.multiplier,
        faderSpeed: deck.faderSpeed,
        nudging: deck.nudging,
        varispeed: false,
        voices,
      });
    }
  }

  /** What `DeckService` attaches: the tune's identity in a row, read and written through `store`
   *  (the shared `positions` unless a spec gives a row of its own). */
  function holdingFor(
    identity: TuneIdentity,
    placementKey = 'set-1:row-1',
    through: LoopPositionsStore = positions
  ): DeckLoopsHolding {
    return { placementKey, identity, positions: through };
  }

  /** Replays what `DeckService.load` does around the markers: detach, hand the tune to the engine,
   *  attach. */
  async function loadOn(
    slot: Slot,
    identity: TuneIdentity,
    detectedMoments: readonly number[] = [],
    holding: DeckLoopsHolding = holdingFor(identity)
  ): Promise<void> {
    loops.detach(slot);
    runtime.load(slot, playableOf(identity));
    store.setDeckTiming({ slot, playCallIntervalUs: INTERVAL_US });
    await loops.attach(slot, holding, detectedMoments);
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

      const attaching = loops.attach('A', holdingFor(TUNE_X), []);
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

      const older = loops.attach('A', holdingFor(TUNE_X), []);
      await flush();
      await loops.attach('A', holdingFor(TUNE_Y), []);
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
      await loops.attach('A', holdingFor(TUNE_X), []);

      loops.add('A');

      expect(stateOf('A').markers).toEqual([]);
      expect(refusals()).toHaveLength(1);
    });

    it('refuses with a warning on a deck with no tune attached', () => {
      loops.add('A');

      expect(stateOf('A').markers).toEqual([]);
      expect(refusals()).toHaveLength(1);
    });

    it('takes the marker that fills the most a subtune keeps, and refuses the next', async () => {
      await positions.save(
        TUNE_X,
        Array.from({ length: MAX_MARKERS_PER_SUBTUNE - 1 }, (_, i) => cue(`m${i}`, i + 1))
      );
      await loadOn('A', TUNE_X);

      await placeMarker('A', 500);
      expect(stateOf('A').markers).toHaveLength(MAX_MARKERS_PER_SUBTUNE);
      expect(refusals()).toHaveLength(0);

      await placeMarker('A', 600);
      expect(stateOf('A').markers).toHaveLength(MAX_MARKERS_PER_SUBTUNE);
      expect(refusals()).toHaveLength(1);
      expect(await positions.load(TUNE_X)).toHaveLength(MAX_MARKERS_PER_SUBTUNE);
    });
  });

  describe('names', () => {
    beforeEach(async () => {
      await positions.save(TUNE_X, [cue('a', 10), cue('b', 20)]);
      await loadOn('A', TUNE_X);
    });

    const namesOf = (slot: Slot) => stateOf(slot).markers.map((marker) => marker.name);

    it('leaves markers unnamed until they are named', () => {
      expect(namesOf('A')).toEqual([null, null]);
    });

    it('names a marker, saves the name with it and shows it on the other deck', async () => {
      await loadOn('B', TUNE_X);

      loops.rename('A', 'b', 'Drop');

      expect(namesOf('A')).toEqual([null, 'Drop']);
      expect(namesOf('B')).toEqual([null, 'Drop']);
      expect(await positions.load(TUNE_X)).toEqual([cue('a', 10), { ...cue('b', 20), name: 'Drop' }]);
    });

    it('brings a stored name back when the tune is loaded again', async () => {
      loops.rename('A', 'a', 'Intro');

      await loadOn('A', TUNE_X);

      expect(namesOf('A')).toEqual(['Intro', null]);
    });

    it('moves nothing in the engine: a name is not a position', () => {
      const declare = vi.spyOn(runtime, 'setJumpTargets');

      loops.rename('A', 'a', 'Intro');

      expect(declare).not.toHaveBeenCalled();
    });

    it('removes control characters, trims and caps the name at the limit', () => {
      loops.rename('A', 'a', '  Big\tDrop\u0007  ');
      expect(namesOf('A')[0]).toBe('BigDrop');

      loops.rename('A', 'b', 'x'.repeat(MARKER_NAME_MAX_LENGTH + 1));
      expect(namesOf('A')[1]).toBe('x'.repeat(MARKER_NAME_MAX_LENGTH));
    });

    it('returns a marker to its place in the list when the name comes out empty', async () => {
      loops.rename('A', 'a', 'Intro');

      loops.rename('A', 'a', ' \t ');

      expect(namesOf('A')).toEqual([null, null]);
      expect(await positions.load(TUNE_X)).toEqual([cue('a', 10), cue('b', 20)]);
    });

    it('saves nothing for a name that did not change', () => {
      loops.rename('A', 'a', 'Intro');
      const save = vi.spyOn(positions, 'save');

      loops.rename('A', 'a', ' Intro ');
      loops.rename('A', 'b', '');

      expect(save).not.toHaveBeenCalled();
    });

    it('refuses with a warning for a marker the deck does not have', () => {
      loops.rename('A', 'gone', 'Intro');

      expect(namesOf('A')).toEqual([null, null]);
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

    it('refuses to end a marker that already has an end, leaving the loop as it was', async () => {
      await runtime.seekToFrame('A', 180);
      loops.setEnd('A');
      await runtime.seekToFrame('A', 190);

      loops.setEnd('A');

      expect(stateOf('A').markers[0].end).toEqual({ frame: 180, offsetFrames: 0 });
      expect(refusals()).toHaveLength(1);
      expect(await positions.load(TUNE_X)).toEqual([loopOf('a', 100, 180)]);
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

  describe('rows of one tune on both decks', () => {
    it('shares nothing between two rows, each deck writing its own', async () => {
      const first = new InMemoryLoopPositionsStore();
      const second = new InMemoryLoopPositionsStore();
      await loadOn('A', TUNE_X, [], holdingFor(TUNE_X, 'set-1:row-1', first));
      await loadOn('B', TUNE_X, [], holdingFor(TUNE_X, 'set-2:row-9', second));

      await placeMarker('A', 100);

      expect(stateOf('B').markers).toEqual([]);
      expect(await first.load(TUNE_X)).toHaveLength(1);
      expect(await second.load(TUNE_X)).toEqual([]);
    });

    it('shares one row, written once by the deck that edits', async () => {
      const row = new InMemoryLoopPositionsStore();
      const save = vi.spyOn(row, 'save');
      await loadOn('A', TUNE_X, [], holdingFor(TUNE_X, 'set-1:row-1', row));
      await loadOn('B', TUNE_X, [], holdingFor(TUNE_X, 'set-1:row-1', row));

      await placeMarker('A', 100);

      expect(idsOf('B')).toEqual(idsOf('A'));
      expect(save).toHaveBeenCalledTimes(1);
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
        expect(engineLoop('A')).toEqual({ startFrame: 100, endFrame: 120, varispeedStart: 'stop' });
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
        expect(engineLoop('A')).toEqual({ startFrame: 100, endFrame: 120, varispeedStart: 'stop' });
        expect(engineQueue('A')).toEqual({
          startFrame: 300,
          endFrame: 320,
          varispeedStart: 'stop',
        });
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

    describe('WRAP', () => {
      const wrapsOf = () => stateOf('A').markers.map((marker) => marker.wraps);

      it('loads a stored wraps flag and starts every other marker without it', async () => {
        await positions.save(TUNE_X, [
          { ...loopOf('a', 100, 120), wraps: true },
          loopOf('b', 300, 320),
        ]);

        await loadOn('A', TUNE_X);

        expect(wrapsOf()).toEqual([true, false]);
      });

      it('flips the selected loop and saves the flag with the list, storing nothing when unlit', async () => {
        loops.toggleWrap('A');

        expect(wrapsOf()).toEqual([true, false, false, false]);
        expect((await positions.load(TUNE_X))[0]).toEqual({
          ...loopOf('a', 100, 120),
          wraps: true,
        });

        loops.toggleWrap('A');

        expect(wrapsOf()).toEqual([false, false, false, false]);
        expect((await positions.load(TUNE_X))[0]).toEqual(loopOf('a', 100, 120));
      });

      it('refuses on a cue, leaving the list as it was', async () => {
        loops.select('A', 'c');
        const before = stateOf('A').markers;

        loops.toggleWrap('A');

        expect(stateOf('A').markers).toBe(before);
        expect(refusals()).toHaveLength(1);
      });

      it('runs a loop in stop mode, and passes WRAP to the engine at once with the queued jump kept', async () => {
        await engage('a');
        loops.toggle('A', 'b');
        loops.select('A', 'a');
        expect(engineLoop('A')).toEqual({ startFrame: 100, endFrame: 120, varispeedStart: 'stop' });

        loops.toggleWrap('A');

        expect(engineLoop('A')).toEqual({ startFrame: 100, endFrame: 120, varispeedStart: 'wrap' });
        expect(stateOf('A').queuedId).toBe('b');
        expect(engineQueue('A')).toEqual({
          startFrame: 300,
          endFrame: 320,
          varispeedStart: 'stop',
        });

        loops.toggleWrap('A');

        expect(engineLoop('A')).toEqual({ startFrame: 100, endFrame: 120, varispeedStart: 'stop' });
        expect(engineQueue('A')).toEqual({
          startFrame: 300,
          endFrame: 320,
          varispeedStart: 'stop',
        });
      });

      it('carries the mode of a queued loop, and follows it being flipped', async () => {
        await engage('a');
        loops.toggle('A', 'b');
        loops.select('A', 'b');

        loops.toggleWrap('A');

        expect(engineQueue('A')).toEqual({
          startFrame: 300,
          endFrame: 320,
          varispeedStart: 'wrap',
        });
        expect(engineLoop('A')).toEqual({ startFrame: 100, endFrame: 120, varispeedStart: 'stop' });

        tickUntil('A', () => handOffsOf('A') === 1);

        expect(stateOf('A').runningId).toBe('b');
        expect(engineLoop('A')).toEqual({ startFrame: 300, endFrame: 320, varispeedStart: 'wrap' });
      });

      it('hands a stored wrapping loop to the engine in wrap mode when it is engaged', async () => {
        await positions.save(TUNE_X, [{ ...loopOf('a', 100, 120), wraps: true }]);
        await loadOn('A', TUNE_X);
        await settle();

        await engage('a');

        expect(engineLoop('A')).toEqual({ startFrame: 100, endFrame: 120, varispeedStart: 'wrap' });
      });
    });

    describe('playing now', () => {
      async function notReady(id: string): Promise<void> {
        gates.A.holding = true;
        loops.select('A', id);
        loops.nudge('A', 'start', 5);
      }

      it('engages an idle marker at once, with nothing looping', async () => {
        loops.playNow('A', 'a');
        await flush();

        expect(stateOf('A').runningId).toBe('a');
        expect(engineLoop('A')).toEqual({ startFrame: 100, endFrame: 120, varispeedStart: 'stop' });
        expect(runtime.position('A')).toBe(100);
      });

      it('takes over from a running loop instead of queuing behind it, dropping what was queued', async () => {
        await engage('a');
        loops.toggle('A', 'b');

        loops.playNow('A', 'wide');
        await flush();

        expect(stateOf('A').runningId).toBe('wide');
        expect(stateOf('A').queuedId).toBeNull();
        expect(engineQueue('A')).toBeNull();
        expect(engineLoop('A')).toEqual({ startFrame: 600, endFrame: 800, varispeedStart: 'stop' });
        expect(runtime.position('A')).toBe(600);
      });

      it('lets a running loop go for a cue', async () => {
        await engage('a');

        loops.playNow('A', 'c');
        await flush();

        expect(stateOf('A').runningId).toBeNull();
        expect(engineLoop('A')).toBeNull();
        expect(runtime.position('A')).toBe(500);
      });

      it('engages the queued marker at once', async () => {
        await engage('a');
        loops.toggle('A', 'b');

        loops.playNow('A', 'b');
        await flush();

        expect(stateOf('A').runningId).toBe('b');
        expect(stateOf('A').queuedId).toBeNull();
        expect(engineQueue('A')).toBeNull();
        expect(runtime.position('A')).toBe(300);
      });

      it('restarts the running marker from its start and leaves a marker queued behind it queued', async () => {
        await engage('wide');
        tick('A', 20);
        loops.toggle('A', 'b');
        const setActiveLoop = vi.spyOn(runtime, 'setActiveLoop');

        loops.playNow('A', 'wide');
        await flush();

        expect(runtime.position('A')).toBe(600);
        expect(setActiveLoop).not.toHaveBeenCalled();
        expect(stateOf('A').runningId).toBe('wide');
        expect(stateOf('A').queuedId).toBe('b');
        expect(engineQueue('A')).toEqual({
          startFrame: 300,
          endFrame: 320,
          varispeedStart: 'stop',
        });
      });

      it('restarts the running marker on every press', async () => {
        await engage('wide');

        for (let press = 0; press < 3; press++) {
          tick('A', 10);
          loops.playNow('A', 'wide');
          await flush();

          expect(runtime.position('A')).toBe(600);
          expect(stateOf('A').runningId).toBe('wide');
        }
        expect(engineLoop('A')).toEqual({ startFrame: 600, endFrame: 800, varispeedStart: 'stop' });
      });

      it('waits for a marker whose start is not ready, replacing a queued one, then engages it', async () => {
        await engage('a');
        loops.toggle('A', 'c');
        await notReady('b');

        loops.playNow('A', 'b');
        await flush();

        expect(stateOf('A').queuedId).toBe('b');
        expect(engineQueue('A')).toBeNull();
        expect(stateOf('A').runningId).toBe('a');

        await settle();

        expect(stateOf('A').runningId).toBe('b');
        expect(stateOf('A').queuedId).toBeNull();
        expect(engineLoop('A')).toEqual({ startFrame: 305, endFrame: 320, varispeedStart: 'stop' });
        expect(runtime.position('A')).toBe(305);
      });

      it('does not seek again to a changed start the running marker was still waiting for', async () => {
        await engage('wide');
        loops.select('A', 'wide');
        gates.A.holding = true;
        loops.nudge('A', 'start', 10);
        loops.audition('A', 'start', 'wide');
        const seek = vi.spyOn(runtime, 'seekToFrame');

        loops.playNow('A', 'wide');
        await flush();
        await settle();

        expect(seek).toHaveBeenCalledExactlyOnceWith('A', 600);
        expect(stateOf('A').runningId).toBe('wide');
      });

      it('refuses a marker the deck does not hold', () => {
        loops.playNow('A', 'missing');

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
        expect(engineLoop('A')).toEqual({ startFrame: 300, endFrame: 320, varispeedStart: 'stop' });
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
        expect(engineLoop('A')).toEqual({ startFrame: 305, endFrame: 320, varispeedStart: 'stop' });
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
        expect(engineLoop('A')).toEqual({ startFrame: 105, endFrame: 120, varispeedStart: 'stop' });
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

        expect(engineLoop('A')).toEqual({ startFrame: 100, endFrame: 130, varispeedStart: 'stop' });
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

        expect(engineLoop('A')).toEqual({ startFrame: 100, endFrame: 120, varispeedStart: 'stop' });
        await settle();
        expect(engineLoop('A')).toEqual({ startFrame: 110, endFrame: 120, varispeedStart: 'stop' });
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
        expect(engineQueue('A')).toEqual({
          startFrame: 300,
          endFrame: 320,
          varispeedStart: 'stop',
        });
        tickUntil('A', () => handOffsOf('A') === 1);
        expect(stateOf('A').runningId).toBe('b');
      });

      it('keeps the queued marker when a start change is applied once ready', async () => {
        await engage('a');
        loops.toggle('A', 'b');
        gates.A.holding = true;
        loops.nudge('A', 'start', 10);

        await settle();

        expect(engineLoop('A')).toEqual({ startFrame: 110, endFrame: 120, varispeedStart: 'stop' });
        expect(engineQueue('A')).toEqual({
          startFrame: 300,
          endFrame: 320,
          varispeedStart: 'stop',
        });
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
        expect(engineQueue('A')).toEqual({
          startFrame: 305,
          endFrame: 320,
          varispeedStart: 'stop',
        });

        loops.nudge('A', 'end', 10);
        expect(engineQueue('A')).toEqual({
          startFrame: 305,
          endFrame: 330,
          varispeedStart: 'stop',
        });
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
        expect(engineLoop('A')).toEqual({ startFrame: 100, endFrame: 120, varispeedStart: 'stop' });
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
        expect(engineLoop('A')).toEqual({ startFrame: 300, endFrame: 320, varispeedStart: 'stop' });
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
        expect(engineLoop('A')).toEqual({ startFrame: 305, endFrame: 320, varispeedStart: 'stop' });
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
        expect(engineLoop('A')).toEqual({ startFrame: 600, endFrame: 800, varispeedStart: 'stop' });
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
          expect(engineLoop('A')).toEqual({
            startFrame: 600,
            endFrame: 810,
            varispeedStart: 'stop',
          });
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
          expect(engineLoop('A')).toEqual({
            startFrame: 610,
            endFrame: 800,
            varispeedStart: 'stop',
          });
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
        expect(engineLoop('A')).toEqual({ startFrame: 600, endFrame: 810, varispeedStart: 'stop' });
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

        expect(engineLoop('A')).toEqual({ startFrame: 610, endFrame: 800, varispeedStart: 'stop' });
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

          expect(engineLoop('A')).toEqual({
            startFrame: 600,
            endFrame: 800,
            varispeedStart: 'stop',
          });
          expect(stateOf('A').runningId).toBe('wide');
          expect(stateOf('A').queuedId).toBeNull();
          expect(setActiveLoop).not.toHaveBeenCalled();
          expect(seek).not.toHaveBeenCalled();

          await settle();

          expect(engineLoop('A')).toEqual({
            startFrame: 610,
            endFrame: 800,
            varispeedStart: 'stop',
          });
          expect(setActiveLoop).toHaveBeenCalledTimes(1);
          expect(seek).toHaveBeenCalledTimes(1);
          expect(seek).toHaveBeenCalledWith('A', 610);
          expect(runtime.position('A')).toBe(610);
        });

        it('goes to the newest start when the start is edited again', async () => {
          editStart(10);
          editStart(20);

          await settle();

          expect(engineLoop('A')).toEqual({
            startFrame: 620,
            endFrame: 800,
            varispeedStart: 'stop',
          });
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
          expect(engineLoop('A')).toEqual({
            startFrame: 610,
            endFrame: 790,
            varispeedStart: 'stop',
          });
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
          expect(engineLoop('A')).toEqual({
            startFrame: 610,
            endFrame: 790,
            varispeedStart: 'stop',
          });
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
        expect(engineLoop('B')).toEqual({ startFrame: 100, endFrame: 130, varispeedStart: 'stop' });
        expect(stateOf('A').runningId).toBeNull();
        expect(engineLoop('A')).toBeNull();
      });

      it('applies a start changed on one deck once it is ready on the other', async () => {
        gates.B.holding = true;
        loops.select('A', 'a');

        loops.nudge('A', 'start', 10);

        expect(engineLoop('B')).toEqual({ startFrame: 100, endFrame: 120, varispeedStart: 'stop' });
        await settle();
        expect(engineLoop('B')).toEqual({ startFrame: 110, endFrame: 120, varispeedStart: 'stop' });
      });

      it("re-issues the other deck's queue after the edit", () => {
        loops.toggle('B', 'b');
        loops.select('A', 'a');

        loops.nudge('A', 'end', 10);

        expect(stateOf('B').queuedId).toBe('b');
        expect(engineQueue('B')).toEqual({
          startFrame: 300,
          endFrame: 320,
          varispeedStart: 'stop',
        });
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
        expect(engineLoop('B')).toEqual({ startFrame: 100, endFrame: 120, varispeedStart: 'stop' });
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

  describe('marker settings', () => {
    const SETTINGS_A: DeckMixerSettings = { panel: panelOf(3), mutes: [true, false, false] };
    const SETTINGS_B: DeckMixerSettings = { panel: panelOf(-2), mutes: [false, true, false] };
    const SETTINGS_E: DeckMixerSettings = { panel: panelOf(5, 100), mutes: [false, false, true] };

    /** The marker as it is stored once GBL is unlatched. */
    function owning(marker: LoopMarker, settings: DeckMixerSettings): LoopMarker {
      return { ...marker, settings: encodeMixerSettings(settings), usesOwnSettings: true };
    }

    const engineMutes = (slot: Slot) => runtime.snapshot(slot).voices.map((voice) => voice.muted);
    const storeMutes = (slot: Slot) => store.decks()[slot].voices.map((voice) => voice.muted);
    const panelOn = (slot: Slot) => store.panel()[slot];

    function markerOf(slot: Slot, id: string): DeckLoopMarker {
      const marker = stateOf(slot).markers.find((candidate) => candidate.id === id);
      if (marker === undefined) {
        throw new Error(`deck ${slot} holds no marker ${id}`);
      }
      return marker;
    }

    /** A performer's panel edit: what `MixerService` does after a knob moves. */
    function tweak(slot: Slot, cutoff: number): void {
      store.setDeckPanel({ slot, patch: { cutoff } });
      loops.saveSettingsInPlay(slot);
    }

    /** A performer's mute, in the order `DeckService.setVoiceMuted` runs it. */
    function mute(slot: Slot, voice: number, muted: boolean): void {
      runtime.setVoiceMuted(slot, voice, muted);
      loops.saveSettingsInPlay(slot);
    }

    async function engage(slot: Slot, id: string): Promise<void> {
      loops.toggle(slot, id);
      await flush();
    }

    async function startDeckB(): Promise<void> {
      await loadOn('B', TUNE_X);
      await settle();
      await runtime.play('B');
    }

    beforeEach(async () => {
      await positions.save(TUNE_X, [
        owning(loopOf('a', 100, 120), SETTINGS_A),
        owning(loopOf('b', 300, 320), SETTINGS_B),
        cue('c', 500),
        loopOf('d', 600, 620),
        owning(cue('e', 700), SETTINGS_E),
        owning(loopOf('w', 800, 1000), SETTINGS_B),
      ]);
      await loadOn('A', TUNE_X);
      await settle();
      await runtime.play('A');
    });

    describe('the stored form', () => {
      it("brings back each marker's settings and GBL state, with the main track at home", () => {
        expect(stateOf('A').markers.map((marker) => marker.ownSettings)).toEqual([
          true,
          true,
          false,
          false,
          true,
          true,
        ]);
        expect(markerOf('A', 'a').settings).toEqual(SETTINGS_A);
        expect(markerOf('A', 'e').settings).toEqual(SETTINGS_E);
        expect(markerOf('A', 'c').settings).toBeNull();
        expect(stateOf('A').settingsInPlayId).toBeNull();
        expect(stateOf('A').mainSettings).toBeNull();
        expect(panelOn('A')).toBe(HOME_DECK_PANEL);
      });

      it("keeps a latched marker's copy through a save and a reload on the other deck", async () => {
        loops.select('A', 'a');

        loops.toggleGlobal('A');
        await flush();
        await loadOn('B', TUNE_X);

        expect(markerOf('B', 'a').ownSettings).toBe(false);
        expect(markerOf('B', 'a').settings).toEqual(SETTINGS_A);
        expect(markerOf('B', 'b').ownSettings).toBe(true);
        expect(panelOn('B')).toBe(HOME_DECK_PANEL);
        const savedA = (await positions.load(TUNE_X)).find((marker) => marker.id === 'a');
        expect(savedA?.usesOwnSettings).toBeUndefined();
        expect(savedA?.settings).toBeDefined();
      });

      it('loads settings it cannot read, and a GBL flag without them, as sharing the main track', async () => {
        await positions.save(TUNE_Y, [
          { ...cue('x', 10), settings: { v: 9 } as never, usesOwnSettings: true },
          { ...cue('y', 20), usesOwnSettings: true },
        ]);

        await loadOn('B', TUNE_Y);

        expect(stateOf('B').markers.map((marker) => [marker.settings, marker.ownSettings])).toEqual(
          [
            [null, false],
            [null, false],
          ]
        );
      });
    });

    describe('GBL', () => {
      it('unlatches a marker that is not running into a copy of what is sounding, and lets the sound alone', () => {
        store.setDeckPanel({ slot: 'A', patch: { cutoff: 250 } });
        mute('A', 1, true);
        loops.select('A', 'c');

        loops.toggleGlobal('A');

        const marker = markerOf('A', 'c');
        expect(marker.ownSettings).toBe(true);
        expect(marker.settings).toEqual({ panel: panelOn('A'), mutes: [false, true, false] });
        expect(stateOf('A').settingsInPlayId).toBeNull();
        expect(engineMutes('A')).toEqual([false, true, false]);
      });

      it('latches again keeping the copy, and unlatches into the kept copy rather than a new one', () => {
        loops.select('A', 'c');
        loops.toggleGlobal('A');
        const kept = markerOf('A', 'c').settings;
        store.setDeckPanel({ slot: 'A', patch: { cutoff: 999 } });

        loops.toggleGlobal('A');
        expect(markerOf('A', 'c')).toMatchObject({ ownSettings: false, settings: kept });

        loops.toggleGlobal('A');
        expect(markerOf('A', 'c')).toMatchObject({ ownSettings: true });
        expect(markerOf('A', 'c').settings).toBe(kept);
      });

      it('changes only the list entry of a marker that is neither running nor in play', async () => {
        await engage('A', 'd');
        loops.select('A', 'b');
        const panel = panelOn('A');

        loops.toggleGlobal('A');

        expect(markerOf('A', 'b')).toMatchObject({ ownSettings: false, settings: SETTINGS_B });
        expect(stateOf('A').settingsInPlayId).toBeNull();
        expect(panelOn('A')).toBe(panel);
        expect(engineMutes('A')).toEqual([false, false, false]);
      });

      it('refuses with the house warning when no marker is selected', async () => {
        await loadOn('B', TUNE_Y);

        loops.toggleGlobal('B');

        expect(refusals()).toHaveLength(1);
        expect(refusals()[0][0]).toContain('toggleGlobal refused');
      });

      it('makes the running marker the one in play at once, holding the main track aside', async () => {
        tweak('A', 250);
        const main = { panel: panelOn('A'), mutes: [false, false, false] };
        await engage('A', 'd');
        loops.select('A', 'd');

        loops.toggleGlobal('A');

        expect(stateOf('A').settingsInPlayId).toBe('d');
        expect(stateOf('A').mainSettings).toEqual(main);
        expect(markerOf('A', 'd')).toMatchObject({ ownSettings: true, settings: main });
        tweak('A', 300);
        expect(markerOf('A', 'd').settings?.panel.cutoff).toBe(300);
        expect(stateOf('A').mainSettings?.panel.cutoff).toBe(250);
      });

      it('goes from stab to latch to unlatch on a running marker, the kept copy reaching the engine', async () => {
        await engage('A', 'a');
        loops.select('A', 'a');
        runtime.setVoiceHeld('A', 0, true);
        runtime.setVoiceHeld('A', 0, false);
        expect(engineMutes('A')).toEqual(SETTINGS_A.mutes);

        loops.toggleGlobal('A');
        expect(stateOf('A').settingsInPlayId).toBeNull();
        expect(panelOn('A')).toBe(HOME_DECK_PANEL);
        expect(engineMutes('A')).toEqual([false, false, false]);
        expect(markerOf('A', 'a')).toMatchObject({ ownSettings: false, settings: SETTINGS_A });
        expect(stateOf('A').runningId).toBe('a');

        const setVoicePitch = vi.spyOn(runtime, 'setVoicePitch');
        loops.toggleGlobal('A');

        expect(markerOf('A', 'a').ownSettings).toBe(true);
        expect(stateOf('A').settingsInPlayId).toBe('a');
        expect(panelOn('A')).toEqual(SETTINGS_A.panel);
        expect(setVoicePitch).toHaveBeenCalledWith('A', 0, voicePitchMultiplier(3, 0, 0));
        expect(engineMutes('A')).toEqual(SETTINGS_A.mutes);
        expect(storeMutes('A')).toEqual(SETTINGS_A.mutes);
        expect(runtime.snapshot('A').voices.map((voice) => voice.held)).toEqual([
          false,
          false,
          false,
        ]);
      });

      it('lets a latched marker in play go at once while it keeps running', async () => {
        await engage('A', 'a');
        loops.select('A', 'a');

        loops.toggleGlobal('A');

        expect(stateOf('A').runningId).toBe('a');
        expect(stateOf('A').mainSettings).toBeNull();
        expect(engineLoop('A')).toEqual({ startFrame: 100, endFrame: 120, varispeedStart: 'stop' });
      });
    });

    describe('an immediate jump', () => {
      it('lands an independent marker with its settings, the main track held aside', async () => {
        tweak('A', 250);
        mute('A', 2, true);
        const main = { panel: panelOn('A'), mutes: [false, false, true] };
        const seek = vi.spyOn(runtime, 'seekToFrame');

        await engage('A', 'a');

        expect(seek).toHaveBeenCalledWith(
          'A',
          100,
          engineSettingsOf(SETTINGS_A.panel, SETTINGS_A.mutes)
        );
        expect(panelOn('A')).toEqual(SETTINGS_A.panel);
        expect(storeMutes('A')).toEqual(SETTINGS_A.mutes);
        expect(engineMutes('A')).toEqual(SETTINGS_A.mutes);
        expect(stateOf('A').settingsInPlayId).toBe('a');
        expect(stateOf('A').mainSettings).toEqual(main);
        expect(runtime.position('A')).toBe(100);
      });

      it('lands an independent marker its settings when played now', async () => {
        const seek = vi.spyOn(runtime, 'seekToFrame');

        loops.playNow('A', 'a');
        await flush();

        expect(seek).toHaveBeenCalledWith(
          'A',
          100,
          engineSettingsOf(SETTINGS_A.panel, SETTINGS_A.mutes)
        );
        expect(stateOf('A').settingsInPlayId).toBe('a');
        expect(engineMutes('A')).toEqual(SETTINGS_A.mutes);
      });

      it("lands the main track's settings when played now from an independent marker into a sharing one", async () => {
        tweak('A', 250);
        const main = { panel: panelOn('A'), mutes: [false, false, false] };
        await engage('A', 'a');

        loops.playNow('A', 'c');
        await flush();

        expect(panelOn('A')).toBe(main.panel);
        expect(stateOf('A').settingsInPlayId).toBeNull();
        expect(engineMutes('A')).toEqual(main.mutes);
      });

      it('carries the running independent marker its settings again when it restarts', async () => {
        await engage('A', 'a');
        const seek = vi.spyOn(runtime, 'seekToFrame');

        loops.playNow('A', 'a');
        await flush();

        expect(seek).toHaveBeenCalledWith(
          'A',
          100,
          engineSettingsOf(SETTINGS_A.panel, SETTINGS_A.mutes)
        );
        expect(stateOf('A').runningId).toBe('a');
        expect(stateOf('A').settingsInPlayId).toBe('a');
      });

      it('lands a cue the same way, with nothing looping', async () => {
        const seek = vi.spyOn(runtime, 'seekToFrame');

        await engage('A', 'e');

        expect(seek).toHaveBeenCalledWith(
          'A',
          700,
          engineSettingsOf(SETTINGS_E.panel, SETTINGS_E.mutes)
        );
        expect(stateOf('A').runningId).toBeNull();
        expect(stateOf('A').settingsInPlayId).toBe('e');
        expect(engineMutes('A')).toEqual(SETTINGS_E.mutes);
      });

      it('seeks plainly into a marker sharing the main track while the main track is in play', async () => {
        const seek = vi.spyOn(runtime, 'seekToFrame');
        const panel = panelOn('A');

        await engage('A', 'c');

        expect(seek).toHaveBeenCalledExactlyOnceWith('A', 500);
        expect(panelOn('A')).toBe(panel);
        expect(stateOf('A').settingsInPlayId).toBeNull();
      });

      it("lands the main track's settings from a jump out of an independent marker into a sharing one", async () => {
        tweak('A', 250);
        mute('A', 2, true);
        const main = { panel: panelOn('A'), mutes: [false, false, true] };
        await engage('A', 'a');
        const seek = vi.spyOn(runtime, 'seekToFrame');
        loops.select('A', 'c');

        loops.audition('A', 'start', 'c');
        await flush();

        expect(seek).toHaveBeenCalledWith('A', 500, engineSettingsOf(main.panel, main.mutes));
        expect(panelOn('A')).toBe(main.panel);
        expect(engineMutes('A')).toEqual(main.mutes);
        expect(storeMutes('A')).toEqual(main.mutes);
        expect(stateOf('A').settingsInPlayId).toBeNull();
        expect(stateOf('A').mainSettings).toBeNull();
      });

      it('moves between two independent markers keeping the one main track aside', async () => {
        tweak('A', 250);
        const main = { panel: panelOn('A'), mutes: [false, false, false] };
        await engage('A', 'a');
        loops.select('A', 'b');

        loops.audition('A', 'start', 'b');
        await flush();

        expect(stateOf('A').settingsInPlayId).toBe('b');
        expect(stateOf('A').mainSettings).toEqual(main);
        expect(panelOn('A')).toEqual(SETTINGS_B.panel);
        expect(engineMutes('A')).toEqual(SETTINGS_B.mutes);
      });

      it('brings the copy again into the marker already in play, carrying a change the other deck made', async () => {
        await startDeckB();
        await engage('A', 'a');
        await engage('B', 'a');
        tweak('B', 321);
        expect(panelOn('A')).toEqual(SETTINGS_A.panel);
        expect(markerOf('A', 'a').settings?.panel.cutoff).toBe(321);

        loops.select('A', 'a');
        loops.audition('A', 'start', 'a');
        await flush();

        expect(panelOn('A').cutoff).toBe(321);
        expect(stateOf('A').mainSettings?.panel).toBe(HOME_DECK_PANEL);
      });

      it('puts the settings in at the press for a target that is not prepared, and seeks without them', async () => {
        loops.select('A', 'w');
        const seek = vi.spyOn(runtime, 'seekToFrame');

        loops.audition('A', 'end', 'w');

        expect(seek).toHaveBeenCalledExactlyOnceWith('A', 900);
        expect(panelOn('A')).toEqual(SETTINGS_B.panel);
        expect(engineMutes('A')).toEqual(SETTINGS_B.mutes);
        expect(stateOf('A').settingsInPlayId).toBe('w');
        await flush();
        expect(runtime.position('A')).toBe(900);
        expect(engineMutes('A')).toEqual(SETTINGS_B.mutes);
      });

      it('keeps the store and the engine together when a let-go comes before the replay lands', async () => {
        tweak('A', 250);
        mute('A', 2, true);
        const main = { panel: panelOn('A'), mutes: [false, false, true] };
        loops.select('A', 'w');

        loops.audition('A', 'end', 'w');
        loops.stop('A');
        await flush();

        expect(stateOf('A').settingsInPlayId).toBeNull();
        expect(panelOn('A')).toBe(main.panel);
        expect(storeMutes('A')).toEqual(main.mutes);
        expect(engineMutes('A')).toEqual(main.mutes);
      });

      it('waits for a start that is not ready, then lands the settings with it', async () => {
        gates.A.holding = true;
        loops.select('A', 'b');
        loops.nudge('A', 'start', 5);

        loops.audition('A', 'start', 'b');
        expect(stateOf('A').settingsInPlayId).toBeNull();
        expect(engineMutes('A')).toEqual([false, false, false]);

        await settle();

        expect(stateOf('A').settingsInPlayId).toBe('b');
        expect(panelOn('A')).toEqual(SETTINGS_B.panel);
        expect(engineMutes('A')).toEqual(SETTINGS_B.mutes);
      });
    });

    describe('a queued jump', () => {
      /** Queues `id` behind a running sharing loop and lets it land. */
      async function queueAndLand(id: string): Promise<void> {
        await engage('A', 'd');
        loops.toggle('A', id);
        tickUntil('A', () => handOffsOf('A') === 1);
      }

      it('carries an independent marker settings with the queue and swaps them in as it lands', async () => {
        tweak('A', 250);
        mute('A', 2, true);
        const main = { panel: panelOn('A'), mutes: [false, false, true] };
        await engage('A', 'd');
        const queue = vi.spyOn(runtime, 'queueJump');

        loops.toggle('A', 'a');

        expect(queue).toHaveBeenLastCalledWith('A', {
          startFrame: 100,
          endFrame: 120,
          varispeedStart: 'stop',
          settings: engineSettingsOf(SETTINGS_A.panel, SETTINGS_A.mutes),
        });
        expect(panelOn('A')).toBe(main.panel);
        expect(engineMutes('A')).toEqual(main.mutes);

        tickUntil('A', () => handOffsOf('A') === 1);

        expect(stateOf('A').runningId).toBe('a');
        expect(stateOf('A').settingsInPlayId).toBe('a');
        expect(stateOf('A').mainSettings).toEqual(main);
        expect(panelOn('A')).toEqual(SETTINGS_A.panel);
        expect(storeMutes('A')).toEqual(SETTINGS_A.mutes);
        expect(engineMutes('A')).toEqual(SETTINGS_A.mutes);
      });

      it("carries the main track's settings into a sharing marker behind an independent one", async () => {
        tweak('A', 250);
        mute('A', 2, true);
        const main = { panel: panelOn('A'), mutes: [false, false, true] };
        await engage('A', 'a');
        const queue = vi.spyOn(runtime, 'queueJump');

        loops.toggle('A', 'd');

        expect(queue).toHaveBeenLastCalledWith('A', {
          startFrame: 600,
          endFrame: 620,
          varispeedStart: 'stop',
          settings: engineSettingsOf(main.panel, main.mutes),
        });

        tickUntil('A', () => handOffsOf('A') === 1);

        expect(stateOf('A').runningId).toBe('d');
        expect(stateOf('A').settingsInPlayId).toBeNull();
        expect(stateOf('A').mainSettings).toBeNull();
        expect(panelOn('A')).toBe(main.panel);
        expect(engineMutes('A')).toEqual(main.mutes);
        expect(storeMutes('A')).toEqual(main.mutes);
      });

      it('queues a sharing marker with nothing while the main track is in play', async () => {
        await engage('A', 'd');
        const queue = vi.spyOn(runtime, 'queueJump');

        loops.toggle('A', 'c');

        expect(queue).toHaveBeenLastCalledWith('A', { startFrame: 500, endFrame: null });
      });

      it('lands a cue with its settings and leaves no engine queue behind', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

        await queueAndLand('e');

        expect(stateOf('A').runningId).toBeNull();
        expect(stateOf('A').settingsInPlayId).toBe('e');
        expect(panelOn('A')).toEqual(SETTINGS_E.panel);
        expect(engineMutes('A')).toEqual(SETTINGS_E.mutes);
        expect(engineQueue('A')).toBeNull();
        expect(stateOf('A').queuedId).toBeNull();
        expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('no loop running'));
        warn.mockRestore();
      });

      it('lands a loop with its settings and leaves no engine queue behind', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const queue = vi.spyOn(runtime, 'queueJump');

        await queueAndLand('b');
        tick('A', 60);

        expect(engineQueue('A')).toBeNull();
        expect(queue.mock.calls.filter(([, target]) => target !== null)).toHaveLength(1);
        expect(handOffsOf('A')).toBe(1);
        expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('no loop running'));
        warn.mockRestore();
      });

      it("follows an edit to the queued marker's copy made on the other deck", async () => {
        await startDeckB();
        await engage('B', 'b');
        await engage('A', 'd');
        loops.toggle('A', 'b');
        const queue = vi.spyOn(runtime, 'queueJump');

        tweak('B', 444);

        const target = queue.mock.calls.at(-1)?.[1];
        expect(target).toMatchObject({ startFrame: 300, endFrame: 320 });
        expect(target?.settings?.fieldOffsets).toContainEqual({
          field: { name: 'cutoff' },
          amount: 444,
        });
        tickUntil('A', () => handOffsOf('A') === 1);
        expect(panelOn('A').cutoff).toBe(444);
      });

      it('follows the queued marker flipping its GBL, in both directions', async () => {
        await engage('A', 'd');
        loops.toggle('A', 'b');
        loops.select('A', 'b');
        const queue = vi.spyOn(runtime, 'queueJump');

        loops.toggleGlobal('A');
        expect(queue).toHaveBeenLastCalledWith('A', {
          startFrame: 300,
          endFrame: 320,
          varispeedStart: 'stop',
        });

        loops.toggleGlobal('A');
        expect(queue).toHaveBeenLastCalledWith('A', {
          startFrame: 300,
          endFrame: 320,
          varispeedStart: 'stop',
          settings: engineSettingsOf(SETTINGS_B.panel, SETTINGS_B.mutes),
        });
        expect(stateOf('A').queuedId).toBe('b');
      });

      it('re-syncs a sharing marker queued behind the running one when its GBL flips, both ways', async () => {
        tweak('A', 250);
        const mainPanel = panelOn('A');
        await engage('A', 'a');
        loops.toggle('A', 'd');
        loops.select('A', 'a');
        const queue = vi.spyOn(runtime, 'queueJump');

        loops.toggleGlobal('A');
        expect(queue).toHaveBeenLastCalledWith('A', {
          startFrame: 600,
          endFrame: 620,
          varispeedStart: 'stop',
        });
        expect(stateOf('A').queuedId).toBe('d');

        loops.toggleGlobal('A');
        expect(stateOf('A').mainSettings?.panel).not.toEqual(SETTINGS_A.panel);
        expect(queue).toHaveBeenLastCalledWith('A', {
          startFrame: 600,
          endFrame: 620,
          varispeedStart: 'stop',
          settings: engineSettingsOf(mainPanel, [false, false, false]),
        });
      });
    });

    describe('letting go', () => {
      let main: DeckMixerSettings;

      beforeEach(async () => {
        tweak('A', 250);
        mute('A', 2, true);
        main = { panel: panelOn('A'), mutes: [false, false, true] };
        await engage('A', 'a');
        expect(stateOf('A').settingsInPlayId).toBe('a');
      });

      function expectMain(): void {
        expect(stateOf('A').settingsInPlayId).toBeNull();
        expect(stateOf('A').mainSettings).toBeNull();
        expect(panelOn('A')).toBe(main.panel);
        expect(storeMutes('A')).toEqual(main.mutes);
        expect(engineMutes('A')).toEqual(main.mutes);
      }

      it('returns the main track on Stop', () => {
        loops.stop('A');
        expectMain();
      });

      it('returns the main track on toggling the running marker off', () => {
        loops.toggle('A', 'a');
        expectMain();
      });

      it('returns the main track on a scrub or a transport stop dropping the marker', () => {
        loops.disengage('A');
        expectMain();
      });

      it('returns the main track when the engine disarms its loop', () => {
        runtime.stop('A');
        expectMain();
      });

      it('returns the main track when the marker in play is deleted', () => {
        loops.select('A', 'a');
        loops.remove('A');
        expectMain();
      });

      it('returns the main track from a cue in play, which runs nothing', async () => {
        loops.stop('A');
        await engage('A', 'e');
        expect(stateOf('A').runningId).toBeNull();
        expect(stateOf('A').settingsInPlayId).toBe('e');
        expect(store.loopsSummary('A')().canStop).toBe(true);

        loops.stop('A');

        expectMain();
        expect(store.loopsSummary('A')().canStop).toBe(false);
      });

      it('returns the main track from a cue in play when it is deleted', async () => {
        loops.stop('A');
        await engage('A', 'e');
        loops.select('A', 'e');

        loops.remove('A');

        expectMain();
      });

      it('leaves the playhead where it was', () => {
        tick('A', 5);
        const position = runtime.position('A');

        loops.stop('A');

        expect(runtime.position('A')).toBe(position);
      });

      it('does nothing a second time, once the main track is back', () => {
        loops.stop('A');
        const setVoiceMuted = vi.spyOn(runtime, 'setVoiceMuted');

        loops.stop('A');

        expect(setVoiceMuted).not.toHaveBeenCalled();
      });
    });

    describe('edits', () => {
      it('reach the copy of the marker in play, and not the main track held aside', async () => {
        await engage('A', 'a');
        const main = stateOf('A').mainSettings;

        tweak('A', 77);
        mute('A', 2, true);

        expect(markerOf('A', 'a').settings?.panel.cutoff).toBe(77);
        expect(markerOf('A', 'a').settings?.mutes).toEqual([true, false, true]);
        expect(markerOf('A', 'b').settings).toEqual(SETTINGS_B);
        expect(stateOf('A').mainSettings).toBe(main);
        expect(panelOn('A').cutoff).toBe(77);
      });

      it('are saved with the marker', async () => {
        await engage('A', 'a');

        tweak('A', 77);
        await flush();

        const saved = (await positions.load(TUNE_X)).find((marker) => marker.id === 'a');
        expect(saved?.usesOwnSettings).toBe(true);
        expect(decodeMixerSettings(saved?.settings)?.panel.cutoff).toBe(77);
      });

      it('go to the main track alone while it is in play, writing no marker', () => {
        loops.select('A', 'a');
        const markers = stateOf('A').markers;

        tweak('A', 77);
        mute('A', 0, true);

        expect(stateOf('A').markers).toBe(markers);
        expect(panelOn('A').cutoff).toBe(77);
      });

      it('change nothing in a selected marker that is not running', () => {
        loops.select('A', 'b');
        const markers = stateOf('A').markers;

        tweak('A', 77);

        expect(stateOf('A').markers).toBe(markers);
        expect(markerOf('A', 'b').settings).toEqual(SETTINGS_B);
      });

      it('write nothing when what is sounding already is the copy', async () => {
        await engage('A', 'a');
        const markers = stateOf('A').markers;
        const save = vi.spyOn(positions, 'save');

        loops.saveSettingsInPlay('A');

        expect(stateOf('A').markers).toBe(markers);
        expect(save).not.toHaveBeenCalled();
      });

      it('take Panic home in the copy and leave the marker independent, with mutes untouched', async () => {
        await engage('A', 'a');

        store.resetDeckPanel({ slot: 'A', reason: 'panic' });
        loops.saveSettingsInPlay('A');

        expect(markerOf('A', 'a').settings?.panel).toBe(HOME_DECK_PANEL);
        expect(markerOf('A', 'a').settings?.mutes).toEqual(SETTINGS_A.mutes);
        expect(markerOf('A', 'a').ownSettings).toBe(true);
        expect(stateOf('A').settingsInPlayId).toBe('a');
      });

      it('are left alone by Set End, Clear End and a nudge', async () => {
        await runtime.seekToFrame('A', 750);
        loops.select('A', 'e');
        loops.setEnd('A');
        expect(markerOf('A', 'e')).toMatchObject({ ownSettings: true });
        expect(markerOf('A', 'e').end).not.toBeNull();
        expect(markerOf('A', 'e').settings).toEqual(SETTINGS_E);

        loops.nudge('A', 'start', 4);
        expect(markerOf('A', 'e').settings).toEqual(SETTINGS_E);

        loops.clearEnd('A');
        expect(markerOf('A', 'e')).toMatchObject({ ownSettings: true, end: null });
        expect(markerOf('A', 'e').settings).toEqual(SETTINGS_E);

        loops.select('A', 'c');
        await runtime.seekToFrame('A', 560);
        loops.setEnd('A');
        expect(markerOf('A', 'c')).toMatchObject({ ownSettings: false, settings: null });
      });
    });

    describe('a settings-only edit', () => {
      it('declares nothing to the engine and does not wake a start audition waiting on the other deck', async () => {
        await startDeckB();
        await engage('B', 'd');
        gates.B.holding = true;
        loops.select('B', 'd');
        loops.nudge('B', 'start', 5);
        loops.audition('B', 'start', 'd');
        await engage('A', 'a');
        const declare = vi.spyOn(runtime, 'setJumpTargets');

        tweak('A', 61);
        mute('A', 1, true);

        expect(declare).not.toHaveBeenCalled();
        gates.B.holding = false;
        await settle();
        expect(runtime.position('B')).toBe(605);
        expect(engineLoop('B')).toEqual({ startFrame: 605, endFrame: 620, varispeedStart: 'stop' });
      });

      it('cancels a start audition waiting on the other deck when a position edit comes from this one', async () => {
        await startDeckB();
        await engage('B', 'd');
        gates.B.holding = true;
        loops.select('B', 'd');
        loops.nudge('B', 'start', 5);
        loops.audition('B', 'start', 'd');
        loops.select('A', 'b');

        loops.nudge('A', 'start', 3);
        gates.B.holding = false;
        await settle();

        expect(runtime.position('B')).not.toBe(605);
      });
    });

    describe('the same tune on both decks', () => {
      beforeEach(startDeckB);

      it("shows an edit on the other deck's list and sound only at its next jump", async () => {
        await engage('A', 'a');
        await engage('B', 'a');
        const soundOnB = { panel: panelOn('B'), mutes: engineMutes('B') };

        tweak('A', 123);

        expect(markerOf('B', 'a').settings?.panel.cutoff).toBe(123);
        expect(panelOn('B')).toBe(soundOnB.panel);
        expect(engineMutes('B')).toEqual(soundOnB.mutes);
      });

      it('lets the other deck go back to Main when it deletes the cue in play there', async () => {
        await engage('B', 'e');
        expect(stateOf('B').settingsInPlayId).toBe('e');
        loops.select('A', 'e');

        loops.remove('A');

        expect(stateOf('B').settingsInPlayId).toBeNull();
        expect(stateOf('B').mainSettings).toBeNull();
        expect(panelOn('B')).toBe(HOME_DECK_PANEL);
        expect(engineMutes('B')).toEqual([false, false, false]);
        expect(store.settingsInPlay('B')()).toEqual({ markerId: null, name: 'Main' });
      });

      it('lets the other deck go when the loop in play there is deleted', async () => {
        await engage('B', 'a');
        loops.select('A', 'a');

        loops.remove('A');

        expect(stateOf('B').runningId).toBeNull();
        expect(stateOf('B').settingsInPlayId).toBeNull();
        expect(panelOn('B')).toBe(HOME_DECK_PANEL);
      });

      it('leaves the other deck playing the settings of a marker latched here, its edits still reaching the copy', async () => {
        await engage('B', 'a');
        loops.select('A', 'a');

        loops.toggleGlobal('A');

        expect(markerOf('B', 'a').ownSettings).toBe(false);
        expect(stateOf('B').settingsInPlayId).toBe('a');
        expect(panelOn('B')).toEqual(SETTINGS_A.panel);
        expect(engineMutes('B')).toEqual(SETTINGS_A.mutes);

        tweak('B', 88);

        expect(markerOf('B', 'a').settings?.panel.cutoff).toBe(88);
        expect(markerOf('A', 'a').settings?.panel.cutoff).toBe(88);
        expect(markerOf('A', 'a').ownSettings).toBe(false);
        expect(stateOf('B').settingsInPlayId).toBe('a');
      });

      it('brings a latched marker back to the main track at the next jump into it on the other deck', async () => {
        await engage('B', 'a');
        loops.select('A', 'a');
        loops.toggleGlobal('A');
        loops.select('B', 'a');

        loops.audition('B', 'start', 'a');
        await flush();

        expect(stateOf('B').settingsInPlayId).toBeNull();
        expect(panelOn('B')).toBe(HOME_DECK_PANEL);
        expect(engineMutes('B')).toEqual([false, false, false]);
      });
    });

    describe('with the mixer applier installed', () => {
      let setVoicePitch: MockInstance<DeckRuntime['setVoicePitch']>;

      beforeEach(() => {
        TestBed.inject(MixerApplier).install();
        TestBed.flushEffects();
        setVoicePitch = vi.spyOn(runtime, 'setVoicePitch');
      });

      it('does not re-apply a panel a prepared jump just landed, but applies the next edit', async () => {
        await engage('A', 'a');
        expect(panelOn('A')).toEqual(SETTINGS_A.panel);
        TestBed.flushEffects();
        expect(setVoicePitch).not.toHaveBeenCalled();

        tweak('A', 5);
        TestBed.flushEffects();

        expect(setVoicePitch).toHaveBeenCalledTimes(3);
      });

      it('does not re-apply a panel a queued landing swapped in', async () => {
        await engage('A', 'd');
        loops.toggle('A', 'b');
        tickUntil('A', () => handOffsOf('A') === 1);

        TestBed.flushEffects();

        expect(panelOn('A')).toEqual(SETTINGS_B.panel);
        expect(setVoicePitch).not.toHaveBeenCalled();
      });

      it('applies a let-go at once and does not apply it twice', async () => {
        await engage('A', 'a');
        TestBed.flushEffects();

        loops.stop('A');
        expect(setVoicePitch).toHaveBeenCalledTimes(3);
        expect(setVoicePitch).toHaveBeenLastCalledWith('A', 2, 1);

        TestBed.flushEffects();
        expect(setVoicePitch).toHaveBeenCalledTimes(3);
      });

      it('applies a kept copy brought back by a GBL unlatch once, synchronously', async () => {
        await engage('A', 'a');
        loops.select('A', 'a');
        loops.toggleGlobal('A');
        TestBed.flushEffects();
        setVoicePitch.mockClear();

        loops.toggleGlobal('A');
        expect(setVoicePitch).toHaveBeenCalledTimes(3);
        expect(setVoicePitch).toHaveBeenCalledWith('A', 0, voicePitchMultiplier(3, 0, 0));

        TestBed.flushEffects();
        expect(setVoicePitch).toHaveBeenCalledTimes(3);
      });

      it('applies a non-prepared jump synchronously and not again from the effect', () => {
        loops.select('A', 'w');

        loops.audition('A', 'end', 'w');
        expect(setVoicePitch).toHaveBeenCalledTimes(3);

        TestBed.flushEffects();
        expect(setVoicePitch).toHaveBeenCalledTimes(3);
      });
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
