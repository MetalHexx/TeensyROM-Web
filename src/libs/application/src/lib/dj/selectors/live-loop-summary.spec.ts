import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { DjStore, EMPTY_DECK_LOOPS, type DeckBeatGrid } from '../dj-store';

/** 24 play calls a beat from frame 0: the ladder runs 1/12 beat up to 128 beats. */
const GRID: DeckBeatGrid = {
  beatFrames: 24,
  beatOneFrame: 0,
  startFrame: 0,
  endFrame: null,
  source: 'scan',
};

describe('liveLoopSummary', () => {
  let store: InstanceType<typeof DjStore>;

  beforeEach(() => {
    store = TestBed.inject(DjStore);
  });

  const summary = () => store.liveLoopSummary('A')();

  function withGrid(grid: DeckBeatGrid | null = GRID, lengthFrames = 2_400): void {
    store.setDeckBeatGrid({ slot: 'A', beatGrid: grid });
    store.setDeckStructure({
      slot: 'A',
      structure: { loopStartFrame: null, loopPeriodFrames: null, endedAtFrame: null },
      lengthFrames,
    });
  }

  it('is unavailable without a grid, offering no sizes', () => {
    const result = summary();

    expect(result.available).toBe(false);
    expect(result.running).toBe(false);
    expect(result.sizeOptions).toEqual([]);
    expect(result.canHalve).toBe(false);
    expect(result.canDouble).toBe(false);
    expect(result.mark).toBeNull();
  });

  it('is unavailable on a grid whose ladder is empty', () => {
    withGrid({ ...GRID, beatFrames: 0.3 });

    expect(summary().available).toBe(false);
    expect(summary().sizeOptions).toEqual([]);
  });

  it('offers the ladder of the grid with the kept size selected', () => {
    withGrid();
    store.setDeckSettings({ slot: 'A', liveLoopBeats: 0.5 });

    const result = summary();

    expect(result.available).toBe(true);
    expect(result.sizeText).toBe('½ BEAT');
    expect(result.sizeOptions[0]).toEqual({ beats: 2 / 24, label: '1/12 BEAT', selected: false });
    expect(result.sizeOptions.filter((option) => option.selected)).toEqual([
      { beats: 0.5, label: '½ BEAT', selected: true },
    ]);
    expect(result.sizeOptions.at(-1)?.label).toBe('128 BEATS');
  });

  it('shows the nearest rung for a kept size the ladder lacks', () => {
    withGrid();
    store.setDeckSettings({ slot: 'A', liveLoopBeats: 3.1 });

    expect(summary().sizeText).toBe('4 BEATS');
    expect(summary().sizeOptions.find((option) => option.selected)?.beats).toBe(4);
  });

  it('can halve and double except at the ends of the ladder', () => {
    withGrid();

    store.setDeckSettings({ slot: 'A', liveLoopBeats: 4 });
    expect(summary()).toMatchObject({ canHalve: true, canDouble: true });

    store.setDeckSettings({ slot: 'A', liveLoopBeats: 1 / 12 });
    expect(summary()).toMatchObject({ canHalve: false, canDouble: true });

    store.setDeckSettings({ slot: 'A', liveLoopBeats: 128 });
    expect(summary()).toMatchObject({ canHalve: true, canDouble: false });
  });

  it('follows the deck\'s slip', () => {
    expect(summary().slip).toBe(false);

    store.setDeckSettings({ slot: 'A', slip: true });

    expect(summary().slip).toBe(true);
  });

  it('marks a running live loop for the strip, as shares of the tune\'s length', () => {
    withGrid(GRID, 2_400);
    store.setDeckLoops({
      slot: 'A',
      loops: {
        ...EMPTY_DECK_LOOPS,
        live: { startFrame: 240, endFrame: 480, pendingEndFrame: null },
      },
    });

    expect(summary().running).toBe(true);
    expect(summary().mark).toEqual({ startPercent: 10, endPercent: 20 });
  });

  it('never lists the live loop among the markers\' tiles', () => {
    withGrid();
    store.setDeckLoops({
      slot: 'A',
      loops: {
        ...EMPTY_DECK_LOOPS,
        live: { startFrame: 240, endFrame: 480, pendingEndFrame: null },
      },
    });

    expect(store.loopsSummary('A')().items).toEqual([]);
    expect(store.loopsSummary('A')().canStop).toBe(true);
  });
});
