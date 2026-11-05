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
  type DeckBeatGrid,
  type DeckLoopMarker,
  type DeckMixerSettings,
  type DeckPanelState,
} from './dj-store';
import { MixerApplier } from './mixer-applier';
import type { MoveStepBeats } from './grid/beat-math';
import { markerKind, markerLabel, oneSecondFrames, resolvedFrame } from './loops/loop-marker-math';
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

/** 50 play calls a second. */
const INTERVAL_US = 20_000;

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
  let scrubRunners: FakeReplayRunner[];
  let clockOf: Record<Slot, FakeClock>;
  let tickCount: number;

  beforeEach(() => {
    vi.mocked(logWarn).mockClear();
    vi.mocked(logError).mockClear();
    gates = { A: { holding: false }, B: { holding: false } };
    prepareRunners = [];
    scrubRunners = [];
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
              const scrub = new FakeReplayRunner(null);
              scrubRunners.push(scrub);
              return scrub;
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
    store.setDeckSettings({ slot: 'A', slip: false });
    store.setDeckSettings({ slot: 'B', slip: false });
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
        nudgeHeld: deck.nudgeHeld,
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
    holding: DeckLoopsHolding = holdingFor(identity)
  ): Promise<void> {
    loops.detach(slot);
    runtime.load(slot, playableOf(identity));
    store.setDeckTiming({ slot, playCallIntervalUs: INTERVAL_US });
    await loops.attach(slot, holding);
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

  /** Shifts the selected marker, start and end together, by `frames` frames on the frame Move step,
   *  which needs no grid. */
  function shiftSelected(slot: Slot, frames: number): void {
    loops.setMoveStep(slot, 'frame');
    for (let press = 0; press < Math.abs(frames); press++) {
      loops.moveLoop(slot, frames > 0 ? 1 : -1);
    }
  }

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

    it('selects nothing for a tune with no markers', async () => {
      await loadOn('A', TUNE_X);

      expect(stateOf('A').selectedId).toBeNull();
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

      const attaching = loops.attach('A', holdingFor(TUNE_X));
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

      const older = loops.attach('A', holdingFor(TUNE_X));
      await flush();
      await loops.attach('A', holdingFor(TUNE_Y));
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

      shiftSelected('A', 20);
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
      await loops.attach('A', holdingFor(TUNE_X));

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

  describe('duplicating an idle marker', () => {
    const SETTINGS: DeckMixerSettings = { panel: panelOf(3), mutes: [true, false, false] };

    beforeEach(async () => {
      await positions.save(TUNE_X, [
        cue('a', 10),
        {
          ...loopOf('b', 300, 320),
          wraps: true,
          settings: encodeMixerSettings(SETTINGS),
          usesOwnSettings: true,
        },
        cue('c', 50),
      ]);
      await loadOn('A', TUNE_X);
      await settle();
    });

    const namesOf = (slot: Slot) => stateOf(slot).markers.map((marker) => marker.name);

    it('inserts "‹label› copy" right after the original with the same frames, settings and WRAP, selects it and saves it', async () => {
      loops.select('A', 'b');

      loops.duplicate('A');

      const [, original, copy] = stateOf('A').markers;
      expect(idsOf('A')).toEqual(['a', 'b', copy.id, 'c']);
      expect(copy.id).not.toBe(original.id);
      expect(copy).toEqual({ ...original, id: copy.id, name: 'Loop 1 copy' });
      expect(copy.settings).toBe(original.settings);
      expect(copy.ownSettings).toBe(true);
      expect(copy.wraps).toBe(true);
      expect(original.name).toBeNull();
      expect(stateOf('A').selectedId).toBe(copy.id);

      const saved = await positions.load(TUNE_X);
      expect(saved.map((marker) => marker.id)).toEqual(idsOf('A'));
      expect(saved[2]).toEqual({ ...saved[1], id: copy.id, name: 'Loop 1 copy' });
    });

    it('copies a cue to a cue', () => {
      loops.select('A', 'c');

      loops.duplicate('A');

      expect(namesOf('A')).toEqual([null, null, null, 'Cue 2 copy']);
      expect(stateOf('A').markers[3].end).toBeNull();
    });

    it('names the copy after the name the original was given, cutting a long one so " copy" still fits', () => {
      loops.rename('A', 'a', 'Drop');
      loops.select('A', 'a');
      loops.duplicate('A');
      expect(namesOf('A')[1]).toBe('Drop copy');

      loops.rename('A', 'c', 'x'.repeat(MARKER_NAME_MAX_LENGTH));
      loops.select('A', 'c');
      loops.duplicate('A');
      const longCopy = stateOf('A').markers[4].name;
      expect(longCopy).toBe(`${'x'.repeat(MARKER_NAME_MAX_LENGTH - ' copy'.length)} copy`);
      expect(longCopy).toHaveLength(MARKER_NAME_MAX_LENGTH);
    });

    it('takes the readiness of its start from the engine, and declares nothing to it', () => {
      const declare = vi.spyOn(runtime, 'setJumpTargets');
      loops.select('A', 'b');

      loops.duplicate('A');

      expect(readyOf('A')).toEqual([true, true, true, true]);
      expect(declare).not.toHaveBeenCalled();
    });

    it('shows the copy on the other deck holding the tune, which keeps its own selection', async () => {
      await loadOn('B', TUNE_X);
      loops.select('B', 'c');
      loops.select('A', 'b');

      loops.duplicate('A');

      expect(idsOf('B')).toEqual(idsOf('A'));
      expect(stateOf('B').selectedId).toBe('c');
    });

    it('refuses with a warning, changing nothing, when nothing is selected', async () => {
      await positions.save(TUNE_Y, []);
      await loadOn('A', TUNE_Y);

      loops.duplicate('A');

      expect(stateOf('A').markers).toEqual([]);
      expect(refusals()).toHaveLength(1);
      expect(await positions.load(TUNE_Y)).toEqual([]);
    });

    it('refuses with a warning, changing nothing, at the most markers a subtune keeps', async () => {
      await positions.save(
        TUNE_Y,
        Array.from({ length: MAX_MARKERS_PER_SUBTUNE }, (_, i) => cue(`m${i}`, i + 1))
      );
      await loadOn('A', TUNE_Y);

      loops.duplicate('A');

      expect(stateOf('A').markers).toHaveLength(MAX_MARKERS_PER_SUBTUNE);
      expect(stateOf('A').selectedId).toBe('m0');
      expect(refusals()).toHaveLength(1);
      expect(await positions.load(TUNE_Y)).toHaveLength(MAX_MARKERS_PER_SUBTUNE);
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

  describe('clearing', () => {
    beforeEach(async () => {
      await positions.save(TUNE_X, [loopOf('a', 100, 180)]);
      await loadOn('A', TUNE_X);
    });

    it('turns a loop back into a cue, and does nothing to a cue', async () => {
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

      loops.clearEnd('A');
      loops.remove('A');

      expect(refusals()).toHaveLength(2);
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

  describe('beat commands', () => {
    /** 24 play calls a beat from frame 0: beats sit on multiples of 24, and the ladder starts at 1/8
     *  (3 frames): 1/16 would be 1.5 frames, under the 2 every size needs. */
    const GRID: DeckBeatGrid = {
      beatFrames: 24,
      beatOneFrame: 0,
      startFrame: 0,
      endFrame: null,
      source: 'scan',
    };

    function setGrid(beatGrid: DeckBeatGrid | null): void {
      store.setDeckBeatGrid({ slot: 'A', beatGrid });
    }

    function setLength(lengthFrames: number): void {
      store.setDeckStructure({
        slot: 'A',
        structure: { loopStartFrame: null, loopPeriodFrames: null, endedAtFrame: null },
        lengthFrames,
      });
    }

    const markerOf = (id: string) => stateOf('A').markers.find((marker) => marker.id === id);
    /** A marker's resolved start and end. */
    const spanOf = (id: string) => {
      const marker = markerOf(id);
      return [
        marker && resolvedFrame(marker.start),
        marker?.end ? resolvedFrame(marker.end) : null,
      ];
    };
    const savedSpans = async () =>
      (await positions.load(TUNE_X)).map((marker) => [
        marker.id,
        marker.start.frame + marker.start.offsetFrames,
        marker.end === null ? null : marker.end.frame + marker.end.offsetFrames,
      ]);

    beforeEach(async () => {
      await positions.save(TUNE_X, [
        cue('cue', 100),
        loopOf('loop', 240, 336),
        loopOf('odd', 100, 200),
        loopOf('big', 0, 768),
        loopOf('tiny', 240, 243),
        { ...loopOf('off', 600, 700), start: { frame: 600, offsetFrames: 3 } },
      ]);
      await loadOn('A', TUNE_X);
      setGrid(GRID);
      setLength(2000);
      loops.select('A', 'cue');
    });

    describe('adding', () => {
      it('puts the cue on the nearest beat and leaves its image to the declaration', async () => {
        await runtime.seekToFrame('A', 100);
        const capture = vi.spyOn(runtime, 'capturePosition');

        loops.add('A');
        await settle();

        const added = stateOf('A').markers.at(-1);
        expect(added?.start).toEqual({ frame: 96, offsetFrames: 0 });
        expect(added?.ready).toBe(true);
        expect(capture).not.toHaveBeenCalled();
      });

      it('captures the playhead when it is exactly on a beat', async () => {
        await runtime.seekToFrame('A', 120);
        const capture = vi.spyOn(runtime, 'capturePosition');

        loops.add('A');

        expect(stateOf('A').markers.at(-1)?.start.frame).toBe(120);
        expect(capture).toHaveBeenCalledTimes(1);
      });

      it('captures the playhead outside the grid span and with no grid', async () => {
        setGrid({ ...GRID, endFrame: 200 });
        await runtime.seekToFrame('A', 301);
        loops.add('A');
        setGrid(null);
        await runtime.seekToFrame('A', 413);
        loops.add('A');

        expect(
          stateOf('A')
            .markers.slice(-2)
            .map((marker) => marker.start.frame)
        ).toEqual([301, 413]);
      });
    });

    describe('resizing', () => {
      it('halves and doubles a loop, keeping its start', async () => {
        loops.select('A', 'loop');

        loops.resize('A', 'halve');
        expect(spanOf('loop')).toEqual([240, 288]);

        loops.resize('A', 'double');
        loops.resize('A', 'double');
        expect(spanOf('loop')).toEqual([240, 432]);
        expect(await savedSpans()).toContainEqual(['loop', 240, 432]);
      });

      it('lands an off-ladder length on the ladder in the direction pressed', () => {
        loops.select('A', 'odd');
        loops.resize('A', 'halve');
        expect(spanOf('odd')).toEqual([100, 196]);

        loops.resize('A', 'double');
        loops.resize('A', 'double');
        expect(spanOf('odd')).toEqual([100, 100 + 384]);
      });

      it('gives a cue a 4-beat end whichever way it is pressed', () => {
        loops.resize('A', 'halve');
        expect(spanOf('cue')).toEqual([100, 196]);

        loops.clearEnd('A');
        loops.resize('A', 'double');
        expect(spanOf('cue')).toEqual([100, 196]);
      });

      it("stops doubling at 128 beats and at the tune's end, and halving at the shortest size", () => {
        setLength(4000);
        loops.select('A', 'big');
        loops.resize('A', 'double');
        loops.resize('A', 'double');
        loops.resize('A', 'double');
        // 1/8 is the shortest size, so it halves no further: there is no odd division below it.
        loops.select('A', 'tiny');
        loops.resize('A', 'halve');
        loops.resize('A', 'halve');
        setLength(450);
        loops.select('A', 'loop');
        loops.resize('A', 'double');
        loops.resize('A', 'double');

        expect(spanOf('big')).toEqual([0, 3072]);
        expect(spanOf('tiny')).toEqual([240, 243]);
        expect(spanOf('loop')).toEqual([240, 432]);
        expect(refusals()).toHaveLength(4);
      });

      it('halves and doubles through a size whose end falls between two frames', () => {
        // 28 frames a beat: 1/4 is 7 frames, 1/8 is 3.5, and there is nothing shorter.
        setGrid({ ...GRID, beatFrames: 28 });
        loops.select('A', 'tiny');

        // 3 frames is off this ladder: doubling lands on the smallest size above it.
        loops.resize('A', 'double');
        expect(spanOf('tiny')).toEqual([240, 243.5]);
        loops.resize('A', 'double');
        expect(spanOf('tiny')).toEqual([240, 247]);
        loops.resize('A', 'halve');
        expect(spanOf('tiny')).toEqual([240, 243.5]);
        loops.resize('A', 'halve');

        expect(spanOf('tiny')).toEqual([240, 243.5]);
        expect(refusals()).toHaveLength(1);
      });

      it('does nothing, once, off the grid or outside its span', () => {
        loops.select('A', 'loop');
        setGrid({ ...GRID, endFrame: 200 });
        loops.resize('A', 'halve');
        setGrid(null);
        loops.resize('A', 'halve');

        expect(spanOf('loop')).toEqual([240, 336]);
        expect(refusals()).toHaveLength(2);
      });
    });

    describe('setting a length', () => {
      it('ends a loop or a cue exactly that ladder size after its start', () => {
        loops.setLength('A', 0.5);
        expect(spanOf('cue')).toEqual([100, 112]);

        loops.select('A', 'loop');
        loops.setLength('A', 8);
        expect(spanOf('loop')).toEqual([240, 432]);
      });

      it('refuses a size under 2 frames on the grid, which the ladder lacks', () => {
        loops.select('A', 'loop');

        // 1/16 of a 24-frame beat is 1.5 frames.
        loops.setLength('A', 1 / 16);

        expect(spanOf('loop')).toEqual([240, 336]);
        expect(refusals()).toHaveLength(1);
      });

      it('ends a loop between two frames for a size that is not a whole number of them', async () => {
        setGrid({ ...GRID, beatFrames: 28 });
        loops.select('A', 'loop');

        loops.setLength('A', 1 / 8);

        expect(spanOf('loop')).toEqual([240, 243.5]);
        expect(markerOf('loop')?.end).toEqual({ frame: 243.5, offsetFrames: 0 });
        expect(await savedSpans()).toContainEqual(['loop', 240, 243.5]);
        expect(refusals()).toHaveLength(0);
      });
    });

    describe('stepping a length', () => {
      const lengthTextOf = () => store.loopsSummary('A')().selected?.lengthText;

      it('gives a loop the next whole beat up or down, keeping its start', async () => {
        loops.select('A', 'loop');

        loops.stepLength('A', 1);
        expect(spanOf('loop')).toEqual([240, 360]);
        expect(lengthTextOf()).toBe('5 BEATS');

        loops.stepLength('A', -1);
        loops.stepLength('A', -1);
        expect(spanOf('loop')).toEqual([240, 312]);
        expect(await savedSpans()).toContainEqual(['loop', 240, 312]);
        expect(refusals()).toHaveLength(0);
      });

      it('takes the whole beat above or below a length that is not a whole number of beats', () => {
        // 100 to 200 is 4 1/6 beats, and its start is off the beats.
        loops.select('A', 'odd');
        loops.stepLength('A', -1);
        expect(spanOf('odd')).toEqual([100, 196]);

        loops.select('A', 'odd');
        loops.stepLength('A', 1);
        loops.stepLength('A', 1);
        expect(spanOf('odd')).toEqual([100, 244]);
      });

      it('counts beats from the start, not from the beat nearest the end', async () => {
        setGrid({ ...GRID, beatFrames: 28 });
        await positions.save(TUNE_X, [loopOf('four', 100, 212)]);
        await loadOn('A', TUNE_X);

        loops.stepLength('A', 1);

        expect(spanOf('four')).toEqual([100, 240]);
      });

      it('steps off a whole number of beats on a grid whose beat is not a whole number of frames', async () => {
        const beatFrames = 24.7351;
        const end = 13 * beatFrames;
        setGrid({ ...GRID, beatFrames });
        await positions.save(TUNE_X, [
          {
            ...loopOf('fraction', 0, 0),
            end: { frame: Math.floor(end), offsetFrames: end - Math.floor(end) },
          },
        ]);
        await loadOn('A', TUNE_X);

        loops.stepLength('A', 1);
        expect(spanOf('fraction')[1]).toBeCloseTo(14 * beatFrames, 6);

        loops.stepLength('A', -1);
        loops.stepLength('A', -1);
        expect(spanOf('fraction')[1]).toBeCloseTo(12 * beatFrames, 6);
      });

      it('refuses a step to a whole beat shorter than the engine can lap', async () => {
        setGrid({ ...GRID, beatFrames: 1.5 });
        await positions.save(TUNE_X, [loopOf('tiny', 100, 103)]);
        await loadOn('A', TUNE_X);

        loops.stepLength('A', -1);

        expect(spanOf('tiny')).toEqual([100, 103]);
        expect(refusals()).toHaveLength(1);
      });

      it('goes from 1/8 and 1/4 of a beat up to 1 beat, and refuses to go below 1', () => {
        // 28 frames a beat: 1/8 is 3.5 frames.
        setGrid({ ...GRID, beatFrames: 28 });
        loops.select('A', 'tiny');
        loops.setLength('A', 1 / 8);
        expect(spanOf('tiny')).toEqual([240, 243.5]);

        loops.stepLength('A', -1);
        expect(spanOf('tiny')).toEqual([240, 243.5]);
        expect(refusals()).toHaveLength(1);

        loops.stepLength('A', 1);
        expect(spanOf('tiny')).toEqual([240, 268]);

        loops.stepLength('A', -1);
        expect(spanOf('tiny')).toEqual([240, 268]);
        expect(refusals()).toHaveLength(2);

        loops.setLength('A', 1 / 4);
        loops.stepLength('A', -1);
        expect(spanOf('tiny')).toEqual([240, 247]);
        expect(refusals()).toHaveLength(3);
      });

      it('reaches 24 beats from 16 in eight presses on a 28-frame grid', () => {
        setGrid({ ...GRID, beatFrames: 28 });
        loops.select('A', 'big');
        loops.setLength('A', 16);

        for (let press = 0; press < 8; press++) {
          loops.stepLength('A', 1);
        }

        expect(spanOf('big')).toEqual([0, 672]);
        expect(lengthTextOf()).toBe('24 BEATS');
      });

      it('ignores the Move step', () => {
        loops.select('A', 'loop');
        loops.setMoveStep('A', 8);

        loops.stepLength('A', 1);

        expect(spanOf('loop')).toEqual([240, 360]);
      });

      it('refuses a cue, and a deck with no grid or a start outside its span', () => {
        loops.stepLength('A', 1);
        expect(spanOf('cue')).toEqual([100, null]);

        loops.select('A', 'loop');
        setGrid({ ...GRID, endFrame: 200 });
        loops.stepLength('A', 1);
        setGrid(null);
        loops.stepLength('A', 1);

        expect(spanOf('loop')).toEqual([240, 336]);
        expect(refusals()).toHaveLength(3);
      });

      it("refuses a length past the tune's end", () => {
        setLength(350);
        loops.select('A', 'loop');

        loops.stepLength('A', 1);

        expect(spanOf('loop')).toEqual([240, 336]);
        expect(refusals()).toHaveLength(1);
      });
    });

    describe('moving a loop', () => {
      it('shifts start and end together by the Move step, keeping the length', async () => {
        loops.select('A', 'loop');

        loops.moveLoop('A', 1);
        expect(spanOf('loop')).toEqual([264, 360]);

        loops.setMoveStep('A', 4);
        loops.moveLoop('A', -1);
        expect(spanOf('loop')).toEqual([168, 264]);
        expect(await savedSpans()).toContainEqual(['loop', 168, 264]);
      });

      it('lands a start off the beats on the next beat that way, the end following', () => {
        loops.select('A', 'off');

        loops.moveLoop('A', 1);

        expect(markerOf('off')?.start).toEqual({ frame: 624, offsetFrames: 0 });
        expect(spanOf('off')).toEqual([624, 721]);
      });

      it('moves a cue alone', () => {
        loops.moveLoop('A', -1);
        expect(spanOf('cue')).toEqual([96, null]);

        loops.moveLoop('A', 1);
        expect(spanOf('cue')).toEqual([120, null]);
      });

      it("refuses a move before the tune's start, past its end or off the grid", () => {
        loops.setMoveStep('A', 16);
        loops.moveLoop('A', -1);
        loops.moveLoop('A', -1);
        loops.select('A', 'loop');
        setLength(450);
        loops.setMoveStep('A', 8);
        loops.moveLoop('A', 1);
        setGrid(null);
        loops.moveLoop('A', 1);

        expect(spanOf('cue')).toEqual([96, null]);
        expect(spanOf('loop')).toEqual([240, 336]);
        expect(refusals()).toHaveLength(3);
      });
    });

    describe('the Move step', () => {
      it('starts at one beat and is kept across loads', async () => {
        expect(store.decks().A.moveStepBeats).toBe(1);

        loops.setMoveStep('A', 8);
        await loadOn('A', TUNE_Y);

        expect(store.decks().A.moveStepBeats).toBe(8);
      });

      it('refuses a step the controls do not offer', () => {
        loops.setMoveStep('A', 3 as MoveStepBeats);

        expect(store.decks().A.moveStepBeats).toBe(1);
        expect(refusals()).toHaveLength(1);
      });
    });

    describe('moving by a frame', () => {
      beforeEach(() => {
        loops.setMoveStep('A', 'frame');
      });

      it('shifts a loop a frame at a time by its offsets, keeping its beats, its length and the grid', async () => {
        loops.select('A', 'loop');

        loops.moveLoop('A', 1);
        loops.moveLoop('A', 1);
        loops.moveLoop('A', -1);

        expect(markerOf('loop')?.start).toEqual({ frame: 240, offsetFrames: 1 });
        expect(markerOf('loop')?.end).toEqual({ frame: 336, offsetFrames: 1 });
        expect(store.decks().A.beatGrid).toEqual(GRID);
        expect(await savedSpans()).toContainEqual(['loop', 241, 337]);
      });

      it('moves a cue alone, with or without a grid', () => {
        setGrid(null);

        loops.moveLoop('A', -1);

        expect(markerOf('cue')?.start).toEqual({ frame: 100, offsetFrames: -1 });
        expect(markerOf('cue')?.end).toBeNull();
      });

      it('goes back onto a beat at the first beat-step move', () => {
        loops.select('A', 'loop');
        loops.moveLoop('A', 1);

        loops.setMoveStep('A', 1);
        loops.moveLoop('A', 1);

        expect(markerOf('loop')?.start).toEqual({ frame: 264, offsetFrames: 0 });
        expect(spanOf('loop')).toEqual([264, 360]);
      });

      it('stops a second off the beat', () => {
        loops.select('A', 'loop');
        const second = oneSecondFrames(store.decks().A.playCallIntervalUs);
        expect(second).toBeGreaterThan(0);

        for (let press = 0; press <= second; press++) {
          loops.moveLoop('A', -1);
        }

        expect(markerOf('loop')?.start).toEqual({ frame: 240, offsetFrames: -second });
        expect(markerOf('loop')?.end).toEqual({ frame: 336, offsetFrames: -second });
        expect(refusals()).toHaveLength(1);
      });
    });

    it("never seeks or sets the engine's loop", async () => {
      const seek = vi.spyOn(runtime, 'seekToFrame');
      const setActiveLoop = vi.spyOn(runtime, 'setActiveLoop');
      await runtime.seekToFrame('A', 300);
      seek.mockClear();

      loops.resize('A', 'double');
      loops.setLength('A', 2);
      loops.stepLength('A', 1);
      loops.moveLoop('A', 1);

      expect(seek).not.toHaveBeenCalled();
      expect(setActiveLoop).not.toHaveBeenCalled();
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

    it('takes a length, a move and a delete across too', async () => {
      await positions.save(TUNE_X, [loopOf('a', 100, 180)]);
      await loadOn('A', TUNE_X);
      await loadOn('B', TUNE_X);
      store.setDeckBeatGrid({
        slot: 'A',
        beatGrid: { beatFrames: 20, beatOneFrame: 0, startFrame: 0, endFrame: null, source: 'scan' },
      });
      loops.stepLength('A', 1);
      shiftSelected('A', 10);
      expect(stateOf('B').markers[0].end).toEqual({ frame: 200, offsetFrames: 10 });
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
      await loadOn('A', TUNE_X, holdingFor(TUNE_X, 'set-1:row-1', first));
      await loadOn('B', TUNE_X, holdingFor(TUNE_X, 'set-2:row-9', second));

      await placeMarker('A', 100);

      expect(stateOf('B').markers).toEqual([]);
      expect(await first.load(TUNE_X)).toHaveLength(1);
      expect(await second.load(TUNE_X)).toEqual([]);
    });

    it('shares one row, written once by the deck that edits', async () => {
      const row = new InMemoryLoopPositionsStore();
      const save = vi.spyOn(row, 'save');
      await loadOn('A', TUNE_X, holdingFor(TUNE_X, 'set-1:row-1', row));
      await loadOn('B', TUNE_X, holdingFor(TUNE_X, 'set-1:row-1', row));

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
        shiftSelected('A', 5);
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
        expect(engineLoop('A')).toEqual({ startFrame: 305, endFrame: 325, varispeedStart: 'stop' });
        expect(runtime.position('A')).toBe(305);
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
        shiftSelected('A', 5);
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
        expect(engineLoop('A')).toEqual({ startFrame: 305, endFrame: 325, varispeedStart: 'stop' });
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
        shiftSelected('A', 5);
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
        expect(engineLoop('A')).toEqual({ startFrame: 105, endFrame: 125, varispeedStart: 'stop' });
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
      it('keeps a marker queued through the engine when the running loop is edited', async () => {
        await engage('a');
        loops.toggle('A', 'b');

        shiftSelected('A', 10);

        expect(stateOf('A').queuedId).toBe('b');
        expect(engineQueue('A')).toEqual({
          startFrame: 300,
          endFrame: 320,
          varispeedStart: 'stop',
        });
        tickUntil('A', () => handOffsOf('A') === 1);
        expect(stateOf('A').runningId).toBe('b');
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

    describe('edits to a running loop at the end of the pass', () => {
      /** 20 play calls a beat from frame 0: loop `a` is one beat long, and its start is ready. */
      const GRID_20: DeckBeatGrid = {
        beatFrames: 20,
        beatOneFrame: 0,
        startFrame: 0,
        endFrame: null,
        source: 'scan',
      };
      const loopBounds = (startFrame: number, endFrame: number, varispeedStart = 'stop') => ({
        startFrame,
        endFrame,
        varispeedStart,
      });
      const runningBoundsOf = (slot: Slot) => stateOf(slot).runningBounds;

      beforeEach(() => {
        store.setDeckBeatGrid({ slot: 'A', beatGrid: GRID_20 });
      });

      it('keeps lapping the old bounds and hands off to the edit when the pass ends', async () => {
        await engage('a');
        expect(runningBoundsOf('A')).toEqual({ start: 100, end: 120 });
        const setActiveLoop = vi.spyOn(runtime, 'setActiveLoop');

        loops.resize('A', 'double');

        expect(engineLoop('A')).toEqual(loopBounds(100, 120));
        expect(engineQueue('A')).toEqual(loopBounds(100, 140));
        expect(runningBoundsOf('A')).toEqual({ start: 100, end: 120 });
        expect(setActiveLoop).not.toHaveBeenCalled();

        tickUntil('A', () => handOffsOf('A') === 1);

        expect(engineLoop('A')).toEqual(loopBounds(100, 140));
        expect(engineQueue('A')).toBeNull();
        expect(stateOf('A').runningId).toBe('a');
        expect(runningBoundsOf('A')).toEqual({ start: 100, end: 140 });
        expect(setActiveLoop).not.toHaveBeenCalled();
      });

      it('lands a length step at the end of the pass, on the beat', async () => {
        await engage('a');
        const setActiveLoop = vi.spyOn(runtime, 'setActiveLoop');

        loops.stepLength('A', 1);

        expect(engineLoop('A')).toEqual(loopBounds(100, 120));
        expect(engineQueue('A')).toEqual(loopBounds(100, 140));
        expect(runningBoundsOf('A')).toEqual({ start: 100, end: 120 });

        tickUntil('A', () => handOffsOf('A') === 1);

        expect(engineLoop('A')).toEqual(loopBounds(100, 140));
        expect(runningBoundsOf('A')).toEqual({ start: 100, end: 140 });
        expect(setActiveLoop).not.toHaveBeenCalled();
      });

      it('waits more passes for a start that is not ready, then hands off', async () => {
        await engage('a');
        gates.A.holding = true;

        loops.moveLoop('A', 1);

        tick('A', 150);
        expect(handOffsOf('A')).toBe(0);
        expect(engineLoop('A')).toEqual(loopBounds(100, 120));
        expect(runningBoundsOf('A')).toEqual({ start: 100, end: 120 });

        await settle();
        tickUntil('A', () => handOffsOf('A') === 1);

        expect(engineLoop('A')).toEqual(loopBounds(120, 140));
        expect(runningBoundsOf('A')).toEqual({ start: 120, end: 140 });
      });

      it('leaves the old bounds in force through an engine notification mid-pass', async () => {
        await engage('a');
        const setActiveLoop = vi.spyOn(runtime, 'setActiveLoop');
        loops.resize('A', 'double');

        runtime.setVoiceMuted('A', 0, true);
        runtime.setTempo('A', 1.1);
        tick('A', 3);

        expect(engineLoop('A')).toEqual(loopBounds(100, 120));
        expect(engineQueue('A')).toEqual(loopBounds(100, 140));
        expect(setActiveLoop).not.toHaveBeenCalled();
      });

      it('never gives the engine an end already behind the playhead', async () => {
        await engage('a');
        tickUntil('A', () => runtime.position('A') >= 112);
        const setActiveLoop = vi.spyOn(runtime, 'setActiveLoop');

        loops.resize('A', 'halve');

        expect(setActiveLoop).not.toHaveBeenCalled();
        expect(engineLoop('A')).toEqual(loopBounds(100, 120));
        // The old pass runs out to its end. The engine's wrap falls due a frame before it (119), so
        // the re-entry's gate-off takes the pass's last slot and the last position it shows is 118.
        expect(peakBeforeWrap('A')).toBeGreaterThanOrEqual(118);
        expect(engineLoop('A')).toEqual(loopBounds(100, 110));
        expect(runtime.position('A')).toBeLessThan(110);
      });

      it('lands a marker queued behind from the old end, and the edit stays in the list', async () => {
        await engage('a');
        loops.toggle('A', 'b');

        loops.resize('A', 'double');

        expect(engineQueue('A')).toEqual(loopBounds(300, 320));
        expect(stateOf('A').queuedId).toBe('b');

        tickUntil('A', () => handOffsOf('A') === 1);

        expect(stateOf('A').runningId).toBe('b');
        expect(engineLoop('A')).toEqual(loopBounds(300, 320));
        expect(runningBoundsOf('A')).toEqual({ start: 300, end: 320 });
        expect(engineQueue('A')).toBeNull();
        tick('A', 100);
        expect(handOffsOf('A')).toBe(1);
        expect(stateOf('A').markers[0].end?.frame).toBe(140);
      });

      it('queues the saved edit when the marker queued ahead of it is cancelled', async () => {
        await engage('a');
        loops.toggle('A', 'b');
        loops.resize('A', 'double');

        loops.toggle('A', 'b');

        expect(stateOf('A').queuedId).toBeNull();
        expect(engineQueue('A')).toEqual(loopBounds(100, 140));
        tickUntil('A', () => handOffsOf('A') === 1);
        expect(stateOf('A').runningId).toBe('a');
        expect(engineLoop('A')).toEqual(loopBounds(100, 140));
        expect(runningBoundsOf('A')).toEqual({ start: 100, end: 140 });
      });

      it('lets a marker queued after the edit take the engine, and queues the edit if it is cancelled', async () => {
        await engage('a');
        loops.resize('A', 'double');

        loops.toggle('A', 'b');
        expect(engineQueue('A')).toEqual(loopBounds(300, 320));

        loops.toggle('A', 'b');
        expect(engineQueue('A')).toEqual(loopBounds(100, 140));

        loops.toggle('A', 'b');
        tickUntil('A', () => handOffsOf('A') === 1);
        expect(stateOf('A').runningId).toBe('b');
        expect(engineLoop('A')).toEqual(loopBounds(300, 320));
        expect(runningBoundsOf('A')).toEqual({ start: 300, end: 320 });
        expect(engineQueue('A')).toBeNull();
      });

      it('recognises the edit landing during a wait for another marker to be ready', async () => {
        gates.A.holding = true;
        loops.select('A', 'b');
        shiftSelected('A', 5);
        loops.select('A', 'a');
        await engage('a');
        loops.resize('A', 'double');

        loops.playNow('A', 'b');
        expect(stateOf('A').queuedId).toBe('b');
        expect(engineQueue('A')).toEqual(loopBounds(100, 140));
        tickUntil('A', () => handOffsOf('A') === 1);

        expect(stateOf('A').runningId).toBe('a');
        expect(stateOf('A').queuedId).toBe('b');
        expect(engineLoop('A')).toEqual(loopBounds(100, 140));
        expect(runningBoundsOf('A')).toEqual({ start: 100, end: 140 });

        await settle();

        expect(stateOf('A').runningId).toBe('b');
        expect(runningBoundsOf('A')).toEqual({ start: 305, end: 325 });
      });

      it('queues an edit made during a wait for another marker to be ready', async () => {
        gates.A.holding = true;
        loops.select('A', 'b');
        shiftSelected('A', 5);
        loops.select('A', 'a');
        await engage('a');
        loops.playNow('A', 'b');

        loops.resize('A', 'double');

        expect(engineQueue('A')).toEqual(loopBounds(100, 140));
        tickUntil('A', () => handOffsOf('A') === 1);
        expect(runningBoundsOf('A')).toEqual({ start: 100, end: 140 });
      });

      it('drops a pending edit when Play now engages another ready marker', async () => {
        await engage('a');
        loops.resize('A', 'double');

        loops.playNow('A', 'b');
        await flush();

        expect(stateOf('A').runningId).toBe('b');
        expect(runningBoundsOf('A')).toEqual({ start: 300, end: 320 });
        expect(engineQueue('A')).toBeNull();
        tick('A', 200);
        expect(handOffsOf('A')).toBe(0);
        expect(engineLoop('A')).toEqual(loopBounds(300, 320));
      });

      it('drops a pending edit when the loop is stopped', async () => {
        await engage('a');
        loops.resize('A', 'double');

        loops.stop('A');

        expect(runningBoundsOf('A')).toBeNull();
        expect(engineQueue('A')).toBeNull();
        tick('A', 200);
        expect(handOffsOf('A')).toBe(0);
        expect(stateOf('A').runningId).toBeNull();
      });

      it('builds a pending edit’s start before queuing it, with no off-thread capture', async () => {
        await engage('a');
        const capture = vi.spyOn(scrubRunners[0], 'run');

        loops.moveLoop('A', 1);
        await flush();

        expect(engineQueue('A')).toEqual(loopBounds(120, 140));
        expect(capture).not.toHaveBeenCalled();
      });

      it('builds the start of an edited queued marker before queuing it, too', async () => {
        await engage('a');
        loops.toggle('A', 'b');
        loops.select('A', 'b');
        const capture = vi.spyOn(scrubRunners[0], 'run');

        shiftSelected('A', 5);
        await flush();

        expect(engineQueue('A')).toEqual(loopBounds(305, 325));
        expect(capture).not.toHaveBeenCalled();
      });

      it('applies a WRAP change at once and queues the edit again', async () => {
        await engage('a');
        loops.resize('A', 'double');

        loops.toggleWrap('A');

        expect(engineLoop('A')).toEqual(loopBounds(100, 120, 'wrap'));
        expect(engineQueue('A')).toEqual(loopBounds(100, 140, 'wrap'));
        tickUntil('A', () => handOffsOf('A') === 1);
        expect(engineLoop('A')).toEqual(loopBounds(100, 140, 'wrap'));
      });

      it('lets an edit that brings the list back to the bounds in force clear the pending one', async () => {
        await engage('a');
        loops.resize('A', 'double');

        loops.resize('A', 'halve');

        expect(stateOf('A').markers[0].end?.frame).toBe(120);
        expect(engineQueue('A')).toBeNull();
        tick('A', 200);
        expect(handOffsOf('A')).toBe(0);
      });

      it("leaves the running loop's pending edit alone when another marker is moved", async () => {
        await engage('a');
        loops.resize('A', 'double');
        loops.select('A', 'b');

        shiftSelected('A', 5);

        expect(engineQueue('A')).toEqual(loopBounds(100, 140));
        expect(engineLoop('A')).toEqual(loopBounds(100, 120));
        tickUntil('A', () => handOffsOf('A') === 1);
        expect(engineLoop('A')).toEqual(loopBounds(100, 140));
      });

      it('replaces a pending edit with a newer one, landing only the newest', async () => {
        await engage('a');
        loops.resize('A', 'double');
        loops.resize('A', 'double');

        expect(engineQueue('A')).toEqual(loopBounds(100, 180));
        tickUntil('A', () => handOffsOf('A') === 1);
        expect(engineLoop('A')).toEqual(loopBounds(100, 180));
      });
    });

    describe('editing a queued marker', () => {
      it('queues the new target when its start or end changes', async () => {
        await engage('a');
        loops.toggle('A', 'b');
        loops.select('A', 'b');

        shiftSelected('A', 5);
        expect(engineQueue('A')).toEqual({
          startFrame: 305,
          endFrame: 325,
          varispeedStart: 'stop',
        });

        shiftSelected('A', 10);
        expect(engineQueue('A')).toEqual({
          startFrame: 315,
          endFrame: 335,
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

    describe('the same tune on the other deck', () => {
      beforeEach(async () => {
        await loadOn('B', TUNE_X);
        await settle();
        await runtime.play('B');
        loops.toggle('B', 'a');
        await flush();
      });

      const canStopB = () => store.loopsSummary('B')().canStop;
      /** 20 play calls a beat from frame 0: loop `a` is one beat long. */
      const ONE_BEAT_GRID: DeckBeatGrid = {
        beatFrames: 20,
        beatOneFrame: 0,
        startFrame: 0,
        endFrame: null,
        source: 'scan',
      };

      it("carries a length changed on one deck to the other deck's engine at the end of its pass, without moving it", () => {
        store.setDeckBeatGrid({ slot: 'A', beatGrid: ONE_BEAT_GRID });
        loops.select('A', 'a');
        const seek = vi.spyOn(runtime, 'seekToFrame');

        loops.stepLength('A', 1);

        expect(stateOf('B').runningId).toBe('a');
        expect(engineLoop('B')).toEqual({ startFrame: 100, endFrame: 120, varispeedStart: 'stop' });
        expect(engineQueue('B')).toEqual({
          startFrame: 100,
          endFrame: 140,
          varispeedStart: 'stop',
        });
        expect(stateOf('B').runningBounds).toEqual({ start: 100, end: 120 });
        expect(seek).not.toHaveBeenCalled();

        tickUntil('B', () => handOffsOf('B') === 1);

        expect(engineLoop('B')).toEqual({ startFrame: 100, endFrame: 140, varispeedStart: 'stop' });
        expect(stateOf('B').runningBounds).toEqual({ start: 100, end: 140 });
        expect(stateOf('A').runningId).toBeNull();
        expect(engineLoop('A')).toBeNull();
      });

      it('lands a start changed on one deck once it is ready, at the end of a pass on the other', async () => {
        gates.B.holding = true;
        loops.select('A', 'a');

        shiftSelected('A', 10);

        expect(engineLoop('B')).toEqual({ startFrame: 100, endFrame: 120, varispeedStart: 'stop' });
        tick('B', 120);
        expect(handOffsOf('B')).toBe(0);
        await settle();
        tickUntil('B', () => handOffsOf('B') === 1);
        expect(engineLoop('B')).toEqual({ startFrame: 110, endFrame: 130, varispeedStart: 'stop' });
      });

      it("re-issues the other deck's queue after the edit", () => {
        store.setDeckBeatGrid({ slot: 'A', beatGrid: ONE_BEAT_GRID });
        loops.toggle('B', 'b');
        loops.select('A', 'a');

        loops.stepLength('A', 1);

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

    describe('duplicating', () => {
      /** 20 play calls a beat from frame 0: loop `a` is one beat long. */
      const GRID_20: DeckBeatGrid = {
        beatFrames: 20,
        beatOneFrame: 0,
        startFrame: 0,
        endFrame: null,
        source: 'scan',
      };
      const listOf = (slot: Slot) => stateOf(slot).markers;

      /** Duplicates deck A's selected marker and returns the copy. */
      function duplicate(): DeckLoopMarker {
        const before = new Set(idsOf('A'));
        loops.duplicate('A');
        const copy = listOf('A').find((marker) => !before.has(marker.id));
        if (copy === undefined) {
          throw new Error('duplicate added no marker');
        }
        return copy;
      }

      /** Watches the engine calls that move the playhead or rebuild the engine's loop and queue. */
      function watchEngine() {
        const seek = vi.spyOn(runtime, 'seekToFrame');
        const queue = vi.spyOn(runtime, 'queueJump');
        const setLoop = vi.spyOn(runtime, 'setActiveLoop');
        return {
          seek,
          expectUntouched: () => {
            expect(seek).not.toHaveBeenCalled();
            expect(queue).not.toHaveBeenCalled();
            expect(setLoop).not.toHaveBeenCalled();
          },
        };
      }

      it('makes the copy of the running loop the running marker without seeking, queuing or re-arming', async () => {
        await engage('a');
        tick('A', 5);
        const position = runtime.position('A');
        const engine = watchEngine();

        const copy = duplicate();

        expect(idsOf('A')).toEqual(['a', copy.id, 'b', 'c', 'wide']);
        expect(stateOf('A').runningId).toBe(copy.id);
        expect(stateOf('A').queuedId).toBeNull();
        expect(stateOf('A').selectedId).toBe(copy.id);
        expect(stateOf('A').runningBounds).toEqual({ start: 100, end: 120 });
        expect(engineLoop('A')).toEqual({ startFrame: 100, endFrame: 120, varispeedStart: 'stop' });
        expect(runtime.position('A')).toBe(position);
        expect(store.loopsSummary('A')().items.map((item) => item.activity)).toEqual([
          'idle',
          'running',
          'idle',
          'idle',
          'idle',
        ]);
        engine.expectUntouched();
      });

      it('sends later edits to the copy, leaving the original as it was', async () => {
        store.setDeckBeatGrid({ slot: 'A', beatGrid: GRID_20 });
        await engage('a');
        const copy = duplicate();

        loops.stepLength('A', 1);

        expect(stateOf('A').runningId).toBe(copy.id);
        expect(engineQueue('A')).toEqual({ startFrame: 100, endFrame: 140, varispeedStart: 'stop' });
        expect(listOf('A')[0].end).toEqual({ frame: 120, offsetFrames: 0 });
        expect(listOf('A')[1].end).toEqual({ frame: 140, offsetFrames: 0 });
      });

      it('carries an end-of-pass edit waiting in the engine over to the copy', async () => {
        store.setDeckBeatGrid({ slot: 'A', beatGrid: GRID_20 });
        await engage('a');
        loops.resize('A', 'double');
        const engine = watchEngine();

        const copy = duplicate();

        expect(engineLoop('A')).toEqual({ startFrame: 100, endFrame: 120, varispeedStart: 'stop' });
        expect(engineQueue('A')).toEqual({ startFrame: 100, endFrame: 140, varispeedStart: 'stop' });
        engine.expectUntouched();

        tickUntil('A', () => handOffsOf('A') === 1);

        expect(stateOf('A').runningId).toBe(copy.id);
        expect(engineLoop('A')).toEqual({ startFrame: 100, endFrame: 140, varispeedStart: 'stop' });
        expect(stateOf('A').runningBounds).toEqual({ start: 100, end: 140 });
      });

      it('makes the copy of a marker queued in the engine the queued marker, which lands at the end of the lap', async () => {
        await engage('a');
        loops.toggle('A', 'b');
        loops.select('A', 'b');
        const engine = watchEngine();

        const copy = duplicate();

        expect(stateOf('A').runningId).toBe('a');
        expect(stateOf('A').queuedId).toBe(copy.id);
        expect(engineQueue('A')).toEqual({ startFrame: 300, endFrame: 320, varispeedStart: 'stop' });
        engine.expectUntouched();

        tickUntil('A', () => handOffsOf('A') === 1);

        expect(stateOf('A').runningId).toBe(copy.id);
        expect(stateOf('A').queuedId).toBeNull();
        expect(engineLoop('A')).toEqual({ startFrame: 300, endFrame: 320, varispeedStart: 'stop' });
        expect(stateOf('A').selectedId).toBe(copy.id);
      });

      it('passes the wait of a marker queued for readiness to the copy', async () => {
        gates.A.holding = true;
        loops.select('A', 'b');
        shiftSelected('A', 5);
        loops.toggle('A', 'b');
        const engine = watchEngine();

        const copy = duplicate();

        expect(stateOf('A').runningId).toBeNull();
        expect(stateOf('A').queuedId).toBe(copy.id);
        engine.expectUntouched();

        await settle();

        expect(stateOf('A').runningId).toBe(copy.id);
        expect(stateOf('A').queuedId).toBeNull();
        expect(engineLoop('A')).toEqual({ startFrame: 305, endFrame: 325, varispeedStart: 'stop' });
        expect(runtime.position('A')).toBe(305);
      });

      describe('with the same tune on the other deck', () => {
        beforeEach(async () => {
          await loadOn('B', TUNE_X);
          await settle();
          await runtime.play('B');
        });

        it('gives the other deck the copy and leaves what it runs, queues and selects alone', async () => {
          loops.toggle('B', 'a');
          await flush();
          loops.toggle('B', 'b');
          loops.select('B', 'c');
          loops.select('A', 'a');
          const engine = watchEngine();

          const copy = duplicate();

          expect(idsOf('B')).toEqual(['a', copy.id, 'b', 'c', 'wide']);
          expect(stateOf('B').runningId).toBe('a');
          expect(stateOf('B').queuedId).toBe('b');
          expect(stateOf('B').selectedId).toBe('c');
          expect(engineLoop('B')).toEqual({ startFrame: 100, endFrame: 120, varispeedStart: 'stop' });
          expect(engineQueue('B')).toEqual({ startFrame: 300, endFrame: 320, varispeedStart: 'stop' });
          engine.expectUntouched();
        });
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

  describe('a loop whose length is not a whole number of frames', () => {
    /** 28 play calls a beat from frame 0: 1/8 is 3.5 frames, and its lines round to 0, 4, 7, 11 …
     *  A 1/8 loop on an odd line (25, 39) laps 3 frames then 4; on an even one (28), 4 then 3. */
    const GRID_28: DeckBeatGrid = {
      beatFrames: 28,
      beatOneFrame: 0,
      startFrame: 0,
      endFrame: null,
      source: 'scan',
    };

    beforeEach(async () => {
      await positions.save(TUNE_X, [
        loopOf('odd', 25, 53),
        loopOf('even', 28, 56),
        loopOf('next', 39, 42.5),
      ]);
      await loadOn('A', TUNE_X);
      store.setDeckBeatGrid({ slot: 'A', beatGrid: GRID_28 });
      await settle();
      await runtime.play('A');
    });

    async function engage(id: string): Promise<void> {
      loops.toggle('A', id);
      await flush();
    }

    /** Plays until the playhead falls back, and returns how many frames that took. */
    function lapTicks(): number {
      let previous = Number(runtime.position('A'));
      for (let ticks = 1; ticks <= 400; ticks++) {
        tick('A');
        const position = Number(runtime.position('A'));
        if (position < previous) {
          return ticks;
        }
        previous = position;
      }
      throw new Error('the playhead never wrapped');
    }

    it('runs a 1/8 Length between two frames at the lap phase of its start line', async () => {
      loops.select('A', 'odd');
      loops.setLength('A', 1 / 8);
      await settle();

      await engage('odd');

      expect(stateOf('A').runningId).toBe('odd');
      expect(engineLoop('A')).toEqual({
        startFrame: 25,
        endFrame: 28.5,
        varispeedStart: 'stop',
        lapPhase: 0.5,
      });
      expect(stateOf('A').runningBounds).toEqual({ start: 25, end: 28.5, lapPhase: 0.5 });
      lapTicks();
      // The 1/8 lines after 28 are 32, 35, 39, 42: laps of 4, 3, 4, 3.
      expect([lapTicks(), lapTicks(), lapTicks(), lapTicks()]).toEqual([4, 3, 4, 3]);
    });

    it('arms a loop on a whole-frame line with no lap phase, as it always has', async () => {
      await engage('even');

      expect(engineLoop('A')).toEqual({ startFrame: 28, endFrame: 56, varispeedStart: 'stop' });
      expect(stateOf('A').runningBounds).toEqual({ start: 28, end: 56 });
    });

    it('queues a 1/8 marker with its own lap phase, hands off to it there, and queues it once', async () => {
      await engage('even');

      loops.toggle('A', 'next');

      expect(engineQueue('A')).toEqual({
        startFrame: 39,
        endFrame: 42.5,
        varispeedStart: 'stop',
        lapPhase: 0.5,
      });
      const queue = vi.spyOn(runtime, 'queueJump');
      tick('A', 5);
      loops.reflect('A');
      expect(queue).not.toHaveBeenCalled();
      const setLoop = vi.spyOn(runtime, 'setActiveLoop');
      const changeLoop = vi.spyOn(runtime, 'changeLoopAt');

      tickUntil('A', () => handOffsOf('A') === 1);

      expect(stateOf('A').runningId).toBe('next');
      expect(engineLoop('A')).toEqual({
        startFrame: 39,
        endFrame: 42.5,
        varispeedStart: 'stop',
        lapPhase: 0.5,
      });
      expect(stateOf('A').runningBounds).toEqual({ start: 39, end: 42.5, lapPhase: 0.5 });
      // The landing is left as the engine made it: the lap it laps from is the engine's (it may
      // carry the clock of the loop it took over on), and a loop set again would restart it.
      expect(setLoop).not.toHaveBeenCalled();
      expect(changeLoop).not.toHaveBeenCalled();
      expect(queue).not.toHaveBeenCalled();
      // It laps on from the clock of the whole 28..56 loop it took over (phase 0), not from its own
      // grid phase (0.5, which would lap 3,4,3): a core that re-based hand-offs drifts and fails here.
      expect(runtime.getLapPhase('A')).toBe(0);
      expect([lapTicks(), lapTicks(), lapTicks()]).toEqual([4, 3, 4]);
    });

    it('holds a 1/8 Length on the running loop for the end of the pass with its lap phase, queued once', async () => {
      await engage('odd');
      expect(engineLoop('A')).toEqual({ startFrame: 25, endFrame: 53, varispeedStart: 'stop' });

      loops.setLength('A', 1 / 8);

      const edit = { startFrame: 25, endFrame: 28.5, varispeedStart: 'stop', lapPhase: 0.5 };
      expect(engineQueue('A')).toEqual(edit);
      const queue = vi.spyOn(runtime, 'queueJump');
      tick('A', 5);
      loops.reflect('A');
      loops.reflect('A');
      expect(queue).not.toHaveBeenCalled();

      tickUntil('A', () => handOffsOf('A') === 1);

      expect(engineLoop('A')).toEqual(edit);
      expect(stateOf('A').runningBounds).toEqual({ start: 25, end: 28.5, lapPhase: 0.5 });
    });

    it('keeps the lap in progress through a WRAP change', async () => {
      await engage('next');
      loops.select('A', 'next');
      lapTicks();
      tick('A');
      // The second lap, 4 frames long: phase 0, where the loop's own first lap is at 0.5.
      expect(runtime.getLapPhase('A')).toBe(0);

      loops.toggleWrap('A');

      expect(engineLoop('A')).toEqual({
        startFrame: 39,
        endFrame: 42.5,
        varispeedStart: 'wrap',
        lapPhase: 0.5,
      });
      expect(runtime.getLapPhase('A')).toBe(0);
      expect(lapTicks()).toBe(3);
    });
  });

  describe('a stored marker of a part frame under two frames long', () => {
    // No edit here makes one, but a tune memory written elsewhere may hold it. The engine refuses
    // to lap it, so it plays as a cue: the store never shows it running or queued as a loop while
    // the engine loops something else.
    beforeEach(async () => {
      await positions.save(TUNE_X, [loopOf('beat', 28, 56), loopOf('short', 100, 101.5)]);
      await loadOn('A', TUNE_X);
      await settle();
      await runtime.play('A');
      loops.toggle('A', 'beat');
      await flush();
      expect(engineLoop('A')).toEqual({ startFrame: 28, endFrame: 56, varispeedStart: 'stop' });
    });

    it('queues as a cue over a running loop, and lands as one', async () => {
      loops.toggle('A', 'short');

      expect(stateOf('A').queuedId).toBe('short');
      expect(engineQueue('A')).toEqual({ startFrame: 100, endFrame: null });

      tickUntil('A', () => handOffsOf('A') === 1);

      expect(stateOf('A').runningId).toBeNull();
      expect(stateOf('A').queuedId).toBeNull();
      expect(stateOf('A').runningBounds).toBeNull();
      expect(engineLoop('A')).toBeNull();
      expect(Number(runtime.position('A'))).toBe(100);
    });

    it('plays now as a cue, running nothing in the store or the engine', async () => {
      loops.playNow('A', 'short');
      await flush();

      expect(stateOf('A').runningId).toBeNull();
      expect(stateOf('A').runningBounds).toBeNull();
      expect(engineLoop('A')).toBeNull();
      expect(Number(runtime.position('A'))).toBe(100);
    });

    it('is labelled and treated as a cue', () => {
      loops.select('A', 'short');

      loops.toggleWrap('A');

      expect(markerKind(stateOf('A').markers[1])).toBe('cue');
      expect(markerLabel(stateOf('A').markers, 1)).toBe('Cue 1');
      expect(refusals()).toHaveLength(1);
    });
  });

  describe('a stored marker whose end is at or before its start', () => {
    // No edit here makes one, but a tune memory written elsewhere may hold it. It reads as a cue,
    // and moving it shifts both edges and keeps what they were, as for any marker.
    beforeEach(async () => {
      await positions.save(TUNE_X, [loopOf('inverted', 200, 150)]);
      await loadOn('A', TUNE_X);
      await settle();
      loops.select('A', 'inverted');
      loops.setMoveStep('A', 'frame');
    });

    it('moves by a frame with both edges shifted, refusing nothing', () => {
      expect(markerKind(stateOf('A').markers[0])).toBe('cue');

      loops.moveLoop('A', 1);

      expect(stateOf('A').markers[0].start).toEqual({ frame: 200, offsetFrames: 1 });
      expect(stateOf('A').markers[0].end).toEqual({ frame: 150, offsetFrames: 1 });
      expect(refusals()).toHaveLength(0);
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

    it('replays a running loop whose start was edited away with its settings put in at the press, and a seek without them', async () => {
      await engage('A', 'a');
      loops.select('A', 'a');
      shiftSelected('A', 5);
      await flush();
      expect(preparedOn('A')).not.toContain(100);
      const seek = vi.spyOn(runtime, 'seekToFrame');

      loops.playNow('A', 'a');

      expect(seek).toHaveBeenCalledExactlyOnceWith('A', 100);
      expect(panelOn('A')).toEqual(SETTINGS_A.panel);
      expect(engineMutes('A')).toEqual(SETTINGS_A.mutes);
      expect(stateOf('A').settingsInPlayId).toBe('a');
      await flush();
      expect(runtime.position('A')).toBe(100);
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

        loops.playNow('A', 'c');
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

        loops.playNow('A', 'b');
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

        loops.playNow('A', 'a');
        await flush();

        expect(panelOn('A').cutoff).toBe(321);
        expect(stateOf('A').mainSettings?.panel).toBe(HOME_DECK_PANEL);
      });

      it('waits for a start that is not ready, then lands the settings with it', async () => {
        gates.A.holding = true;
        loops.select('A', 'b');
        shiftSelected('A', 5);

        loops.playNow('A', 'b');
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

      it('are left alone by Length, Clear End and Move', async () => {
        store.setDeckBeatGrid({
          slot: 'A',
          beatGrid: { beatFrames: 20, beatOneFrame: 0, startFrame: 0, endFrame: null, source: 'scan' },
        });
        loops.select('A', 'e');
        loops.resize('A', 'double');
        expect(markerOf('A', 'e')).toMatchObject({ ownSettings: true });
        expect(markerOf('A', 'e').end).not.toBeNull();
        expect(markerOf('A', 'e').settings).toEqual(SETTINGS_E);

        loops.stepLength('A', 1);
        shiftSelected('A', 4);
        expect(markerOf('A', 'e').settings).toEqual(SETTINGS_E);

        loops.clearEnd('A');
        expect(markerOf('A', 'e')).toMatchObject({ ownSettings: true, end: null });
        expect(markerOf('A', 'e').settings).toEqual(SETTINGS_E);

        loops.select('A', 'c');
        loops.resize('A', 'double');
        expect(markerOf('A', 'c')).toMatchObject({ ownSettings: false, settings: null });
      });
    });

    describe('duplicating a marker whose settings are in play or queued', () => {
      function watchEngine() {
        const calls = [
          vi.spyOn(runtime, 'seekToFrame'),
          vi.spyOn(runtime, 'queueJump'),
          vi.spyOn(runtime, 'setActiveLoop'),
          vi.spyOn(runtime, 'setVoiceMuted'),
        ];
        return () => calls.forEach((spy) => expect(spy).not.toHaveBeenCalled());
      }

      it('puts the copy in play, running, with the same settings and leaves the sound and the engine alone', async () => {
        await engage('A', 'a');
        const { mainSettings } = stateOf('A');
        const sounding = { panel: panelOn('A'), mutes: engineMutes('A') };
        const expectEngineUntouched = watchEngine();

        loops.duplicate('A');

        const copy = stateOf('A').markers[1];
        expect(copy.settings).toBe(markerOf('A', 'a').settings);
        expect(stateOf('A').runningId).toBe(copy.id);
        expect(stateOf('A').settingsInPlayId).toBe(copy.id);
        expect(stateOf('A').mainSettings).toBe(mainSettings);
        expect(panelOn('A')).toBe(sounding.panel);
        expect(engineMutes('A')).toEqual(sounding.mutes);
        expect(store.settingsInPlay('A')()).toEqual({ markerId: copy.id, name: 'Loop 1 copy' });
        expectEngineUntouched();
      });

      it('puts the copy of a cue in play, and saves later edits to the copy alone', async () => {
        await engage('A', 'e');
        loops.select('A', 'e');

        loops.duplicate('A');
        tweak('A', 33);

        const copy = stateOf('A').markers[5];
        expect(stateOf('A').runningId).toBeNull();
        expect(stateOf('A').settingsInPlayId).toBe(copy.id);
        expect(store.settingsInPlay('A')()).toEqual({ markerId: copy.id, name: 'Cue 2 copy' });
        expect(copy.settings?.panel.cutoff).toBe(33);
        expect(markerOf('A', 'e').settings?.panel.cutoff).toBe(100);
      });

      it('keeps an independent marker queued in the engine as it was, the copy carrying the same settings', async () => {
        await engage('A', 'd');
        loops.toggle('A', 'a');
        loops.select('A', 'a');
        const queue = vi.spyOn(runtime, 'queueJump');

        loops.duplicate('A');

        const copy = stateOf('A').markers[1];
        expect(stateOf('A').queuedId).toBe(copy.id);
        expect(queue).not.toHaveBeenCalled();

        tickUntil('A', () => handOffsOf('A') === 1);

        expect(stateOf('A').runningId).toBe(copy.id);
        expect(stateOf('A').settingsInPlayId).toBe(copy.id);
        expect(panelOn('A')).toEqual(SETTINGS_A.panel);
        expect(engineMutes('A')).toEqual(SETTINGS_A.mutes);
      });
    });

    describe('a settings-only edit', () => {
      it('declares nothing to the engine', async () => {
        await startDeckB();
        await engage('B', 'd');
        await engage('A', 'a');
        const declare = vi.spyOn(runtime, 'setJumpTargets');

        tweak('A', 61);
        mute('A', 1, true);

        expect(declare).not.toHaveBeenCalled();
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
        loops.playNow('B', 'a');
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
