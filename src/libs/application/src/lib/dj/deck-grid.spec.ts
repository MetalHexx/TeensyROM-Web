import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DetectedBeatGrid, NoteStarts } from '@sidablist/analysis';
import type { TuneIdentity } from '@sidablist/tunes';
import { logError, logWarn } from '@teensyrom-nx/utils';
import { DeckGrid, TAP_IDLE_MS } from './deck-grid';
import { DeckRuntime } from './deck-runtime';
import { DjStore } from './dj-store';
import { BEAT_GRID_STORE } from './ports';
import type { BeatGridStore, TuneBeatGrids } from './ports';
import type { Slot } from './slot';

vi.mock('@teensyrom-nx/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@teensyrom-nx/utils')>();
  return { ...actual, logWarn: vi.fn(), logError: vi.fn() };
});

const IDENTITY: TuneIdentity = { sidHash: 'h1', subtune: 2 };
const SCAN: DetectedBeatGrid = { beatFrames: 30, beatOneFrame: 5, startFrame: 100, endFrame: 900 };

/** Note starts on every 24th frame, so taps near them fit a 24-frame grid. */
function noteStartsEvery24(): NoteStarts {
  const frames = Uint32Array.from({ length: 200 }, (_, i) => i * 24);
  return { frames, voices: new Uint8Array(frames.length).fill(1) };
}

/** Four taps a beat apart, each just after a note start. */
const TAP_POSITIONS = [49, 73, 97, 121];

class FakeBeatGridStore implements BeatGridStore {
  stored: TuneBeatGrids | null = null;
  loadError: Error | null = null;
  saveError: Error | null = null;
  readonly saves: TuneBeatGrids[] = [];
  /** Held back until released, to model a slow load. */
  gate: Promise<void> | null = null;

  async load(sidHash: string): Promise<TuneBeatGrids | null> {
    if (this.gate !== null) {
      await this.gate;
    }
    if (this.loadError !== null) {
      throw this.loadError;
    }
    return this.stored?.sidHash === sidHash ? this.stored : null;
  }

  async save(grids: TuneBeatGrids): Promise<void> {
    if (this.saveError !== null) {
      throw this.saveError;
    }
    this.saves.push(grids);
    this.stored = grids;
  }
}

describe('DeckGrid', () => {
  let grid: DeckGrid;
  let store: InstanceType<typeof DjStore>;
  let beatGrids: FakeBeatGridStore;
  let position: number;
  let starts: NoteStarts | null;

  const gridOf = (slot: Slot) => store.decks()[slot].beatGrid;

  function playing(slot: Slot): void {
    store.setDeckStatus({ slot, status: 'playing' });
  }

  function tapAt(slot: Slot, frame: number): void {
    position = frame;
    grid.tap(slot);
  }

  function tapFour(slot: Slot): void {
    for (const frame of TAP_POSITIONS) {
      tapAt(slot, frame);
      vi.advanceTimersByTime(500);
    }
  }

  async function settle(): Promise<void> {
    await vi.advanceTimersByTimeAsync(0);
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(logWarn).mockClear();
    vi.mocked(logError).mockClear();
    position = 0;
    starts = noteStartsEvery24();
    beatGrids = new FakeBeatGridStore();
    const runtime = {
      position: () => position,
      noteStarts: () => starts,
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: DeckRuntime, useValue: runtime },
        { provide: BEAT_GRID_STORE, useValue: beatGrids },
      ],
    });
    grid = TestBed.inject(DeckGrid);
    store = TestBed.inject(DjStore);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('attach', () => {
    it("puts the scan's grid on the deck at once", () => {
      grid.attach('A', IDENTITY, SCAN);

      expect(gridOf('A')).toEqual({ ...SCAN, source: 'scan' });
    });

    it('leaves a tune the scan found no grid for without one', () => {
      grid.attach('A', IDENTITY, null);

      expect(gridOf('A')).toBeNull();
    });

    it("replaces the scan's grid with the stored correction for the subtune", async () => {
      beatGrids.stored = {
        sidHash: 'h1',
        updated: 'then',
        subtunes: [
          { subtune: 1, beatFrames: 99, beatOneFrame: 1 },
          { subtune: 2, beatFrames: 24, beatOneFrame: 12 },
        ],
      };

      grid.attach('A', IDENTITY, SCAN);
      await settle();

      expect(gridOf('A')).toEqual({
        beatFrames: 24,
        beatOneFrame: 12,
        startFrame: 0,
        endFrame: null,
        source: 'tap',
      });
    });

    it("keeps the scan's grid when the tune has no correction for the subtune", async () => {
      beatGrids.stored = {
        sidHash: 'h1',
        updated: 'then',
        subtunes: [{ subtune: 1, beatFrames: 99, beatOneFrame: 1 }],
      };

      grid.attach('A', IDENTITY, SCAN);
      await settle();

      expect(gridOf('A')?.source).toBe('scan');
    });

    it("keeps the scan's grid when the stored grids fail to load", async () => {
      beatGrids.loadError = new Error('offline');

      grid.attach('A', IDENTITY, SCAN);
      await settle();

      expect(gridOf('A')?.source).toBe('scan');
      expect(logWarn).toHaveBeenCalled();
    });

    it('drops a slow load that a newer attach has overtaken', async () => {
      let release!: () => void;
      beatGrids.gate = new Promise<void>((resolve) => (release = resolve));
      beatGrids.stored = {
        sidHash: 'h1',
        updated: 'then',
        subtunes: [{ subtune: 2, beatFrames: 24, beatOneFrame: 12 }],
      };

      grid.attach('A', IDENTITY, SCAN);
      beatGrids.gate = null;
      grid.attach('A', { sidHash: 'other', subtune: 1 }, null);
      beatGrids.stored = null;
      release();
      await settle();

      expect(gridOf('A')).toBeNull();
    });

    it('drops a slow load that a detach has overtaken', async () => {
      let release!: () => void;
      beatGrids.gate = new Promise<void>((resolve) => (release = resolve));
      beatGrids.stored = {
        sidHash: 'h1',
        updated: 'then',
        subtunes: [{ subtune: 2, beatFrames: 24, beatOneFrame: 12 }],
      };

      grid.attach('A', IDENTITY, SCAN);
      grid.detach('A');
      release();
      await settle();

      expect(gridOf('A')).toBeNull();
    });
  });

  describe('detach', () => {
    it('clears the grid and the tapping, and forgets the taps', async () => {
      grid.attach('A', IDENTITY, SCAN);
      playing('A');
      tapAt('A', 49);
      expect(store.decks().A.tapping).toBe(true);

      grid.detach('A');
      await vi.advanceTimersByTimeAsync(TAP_IDLE_MS * 2);

      expect(gridOf('A')).toBeNull();
      expect(store.decks().A.tapping).toBe(false);
      expect(beatGrids.saves).toEqual([]);
    });
  });

  describe('tap', () => {
    beforeEach(async () => {
      grid.attach('A', IDENTITY, SCAN);
      await settle();
      playing('A');
    });

    it('starts tapping with the first tap and changes no grid before the fourth', () => {
      tapAt('A', 49);
      tapAt('A', 73);
      tapAt('A', 97);

      expect(store.decks().A.tapping).toBe(true);
      expect(gridOf('A')?.source).toBe('scan');
    });

    it('fits a grid from the fourth tap on and refits with each tap after it', () => {
      tapFour('A');

      expect(gridOf('A')).toMatchObject({
        beatFrames: 24,
        startFrame: 0,
        endFrame: null,
        source: 'tap',
      });
      expect((gridOf('A')?.beatOneFrame ?? 1) % 24).toBe(0);

      tapAt('A', 145);
      expect(gridOf('A')?.beatFrames).toBe(24);
    });

    it('stops tapping and saves the grid once the taps go quiet', async () => {
      tapFour('A');
      expect(beatGrids.saves).toEqual([]);

      await vi.advanceTimersByTimeAsync(TAP_IDLE_MS);

      expect(store.decks().A.tapping).toBe(false);
      expect(beatGrids.saves).toHaveLength(1);
      expect(beatGrids.saves[0].sidHash).toBe('h1');
      expect(beatGrids.saves[0].subtunes).toEqual([
        { subtune: 2, beatFrames: 24, beatOneFrame: gridOf('A')?.beatOneFrame },
      ]);
    });

    it('saves nothing when the sequence fitted no grid', async () => {
      tapAt('A', 49);
      tapAt('A', 73);
      await vi.advanceTimersByTimeAsync(TAP_IDLE_MS);

      expect(store.decks().A.tapping).toBe(false);
      expect(gridOf('A')?.source).toBe('scan');
      expect(beatGrids.saves).toEqual([]);
    });

    it('starts a new sequence after a gap, so old taps do not count', async () => {
      tapAt('A', 49);
      tapAt('A', 73);
      tapAt('A', 97);
      await vi.advanceTimersByTimeAsync(TAP_IDLE_MS);
      expect(store.decks().A.tapping).toBe(false);

      tapAt('A', 121);
      expect(store.decks().A.tapping).toBe(true);
      expect(gridOf('A')?.source).toBe('scan');
    });

    it('treats a tap a full idle gap after the last as a new sequence even if the timer never ran', () => {
      tapAt('A', 49);
      tapAt('A', 73);
      tapAt('A', 97);
      vi.setSystemTime(Date.now() + TAP_IDLE_MS);

      tapAt('A', 121);

      expect(gridOf('A')?.source).toBe('scan');
    });

    it('does nothing on a deck that is not playing', () => {
      store.setDeckStatus({ slot: 'A', status: 'paused' });

      tapFour('A');

      expect(store.decks().A.tapping).toBe(false);
      expect(gridOf('A')?.source).toBe('scan');
    });

    it('does nothing until the tune has note starts', () => {
      starts = null;

      tapFour('A');

      expect(store.decks().A.tapping).toBe(false);
      expect(gridOf('A')?.source).toBe('scan');
    });

    it('logs a failed save and keeps the grid', async () => {
      beatGrids.saveError = new Error('offline');

      tapFour('A');
      await vi.advanceTimersByTimeAsync(TAP_IDLE_MS);

      expect(logError).toHaveBeenCalled();
      expect(gridOf('A')?.source).toBe('tap');
    });

    it("merges into the tune's saved document, replacing only this subtune", async () => {
      beatGrids.stored = {
        sidHash: 'h1',
        updated: 'then',
        subtunes: [
          { subtune: 1, beatFrames: 99, beatOneFrame: 1 },
          { subtune: 2, beatFrames: 77, beatOneFrame: 2 },
        ],
      };

      tapFour('A');
      await vi.advanceTimersByTimeAsync(TAP_IDLE_MS);

      const [saved] = beatGrids.saves;
      expect(saved.subtunes).toHaveLength(2);
      expect(saved.subtunes).toContainEqual({ subtune: 1, beatFrames: 99, beatOneFrame: 1 });
      expect(saved.subtunes.find((entry) => entry.subtune === 2)?.beatFrames).toBe(24);
      expect(saved.updated).not.toBe('then');
    });

    it('gives the grid to the other deck when it holds the same tune and subtune', async () => {
      grid.attach('B', IDENTITY, null);
      await settle();

      tapFour('A');
      await vi.advanceTimersByTimeAsync(TAP_IDLE_MS);

      expect(gridOf('B')).toEqual(gridOf('A'));
    });

    it('leaves the other deck alone when it holds another subtune or tune', async () => {
      grid.attach('B', { sidHash: 'h1', subtune: 1 }, null);
      await settle();

      tapFour('A');
      await vi.advanceTimersByTimeAsync(TAP_IDLE_MS);
      expect(gridOf('B')).toBeNull();

      grid.attach('B', { sidHash: 'h2', subtune: 2 }, null);
      await settle();
      tapFour('A');
      await vi.advanceTimersByTimeAsync(TAP_IDLE_MS);
      expect(gridOf('B')).toBeNull();
    });
  });

  describe('beatPosition', () => {
    beforeEach(() => {
      store.setDeckTiming({ slot: 'A', playCallIntervalUs: 20_000 });
      grid.attach('A', IDENTITY, { beatFrames: 25, beatOneFrame: 10, startFrame: 100, endFrame: 500 });
    });

    it("reads the beat, phase and tempo from the engine's position", () => {
      position = 160;

      const beat = grid.beatPosition('A');

      expect(beat?.beat).toBe(6);
      expect(beat?.phase).toBeCloseTo(0);
      expect(beat?.bpm).toBeCloseTo(120);
    });

    it('scales the tempo by the deck speed', () => {
      position = 160;
      store.setDeckEngineControls({
        slot: 'A',
        speed: 1.5,
        faderSpeed: 1.5,
        nudging: false,
        nudgeHeld: { up: false, down: false },
        varispeed: false,
        voices: store.decks().A.voices,
      });

      expect(grid.beatPosition('A')?.bpm).toBeCloseTo(180);
    });

    it('is null outside the grid span, with no grid, and with no interval', () => {
      position = 99;
      expect(grid.beatPosition('A')).toBeNull();

      position = 500;
      expect(grid.beatPosition('A')).toBeNull();

      position = 160;
      grid.detach('A');
      expect(grid.beatPosition('A')).toBeNull();

      grid.attach('B', IDENTITY, SCAN);
      expect(grid.beatPosition('B')).toBeNull();
    });
  });
});
