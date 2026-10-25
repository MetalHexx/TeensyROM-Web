import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import type { TuneReference } from '@sidablist/tunes';
import { DjStore, EMPTY_DECK_LOOPS, type DeckLoopMarker, type DeckStatus } from '../dj-store';

/** 50 play calls a second. */
const INTERVAL_US = 20_000;

const TUNE: TuneReference = {
  identity: { sidHash: 'tune', subtune: 1 },
  title: 'Test Tune',
  author: 'Test Author',
  released: '2024 Test',
  subtuneCount: 1,
  byteLength: 100,
};

function marker(
  id: string,
  start: number,
  end: number | null = null,
  extra: Partial<DeckLoopMarker> = {}
): DeckLoopMarker {
  return {
    id,
    start: { frame: start, offsetFrames: 0 },
    end: end === null ? null : { frame: end, offsetFrames: 0 },
    voices: [0, 1, 2],
    ready: false,
    ...extra,
  };
}

describe('loopsSummary', () => {
  let store: InstanceType<typeof DjStore>;

  beforeEach(() => {
    store = TestBed.inject(DjStore);
  });

  function loadTune(status: DeckStatus = 'playing', lengthFrames = 1_000): void {
    store.setDeckLoaded({ slot: 'A', reference: TUNE });
    store.setDeckStatus({ slot: 'A', status });
    store.setDeckTiming({ slot: 'A', playCallIntervalUs: INTERVAL_US });
    store.setDeckStructure({
      slot: 'A',
      structure: { loopStartFrame: null, loopPeriodFrames: null, endedAtFrame: null },
      lengthFrames,
    });
  }

  function setLoops(
    markers: readonly DeckLoopMarker[],
    patch: Partial<typeof EMPTY_DECK_LOOPS> = {}
  ): void {
    store.setDeckLoops({
      slot: 'A',
      loops: { ...EMPTY_DECK_LOOPS, markers, selectedId: markers[0]?.id ?? null, ...patch },
    });
  }

  it('is empty and inert for a deck with nothing loaded', () => {
    expect(store.loopsSummary('A')()).toEqual({
      hasTune: false,
      canAdd: false,
      canStop: false,
      items: [],
      selected: null,
    });
  });

  it.each([
    { status: 'playing', switching: false, canAdd: true },
    { status: 'paused', switching: false, canAdd: true },
    { status: 'stopped', switching: false, canAdd: true },
    { status: 'loading', switching: false, canAdd: false },
    { status: 'failed', switching: false, canAdd: false },
    { status: 'playing', switching: true, canAdd: false },
  ] as const)(
    'adds with $status and switching $switching: $canAdd',
    ({ status, switching, canAdd }) => {
      loadTune(status);
      store.setDeckSwitching({ slot: 'A', switching });

      expect(store.loopsSummary('A')().canAdd).toBe(canAdd);
      expect(store.loopsSummary('A')().hasTune).toBe(true);
    }
  );

  it('can stop while a loop runs or a jump is queued', () => {
    loadTune();
    setLoops([marker('a', 100, 300), marker('b', 400)]);
    expect(store.loopsSummary('A')().canStop).toBe(false);

    store.setLoopActivity({
      slot: 'A',
      runningId: 'a',
      queuedId: null,
      selectionMovedWhileQueued: false,
    });
    expect(store.loopsSummary('A')().canStop).toBe(true);

    store.setLoopActivity({
      slot: 'A',
      runningId: null,
      queuedId: 'b',
      selectionMovedWhileQueued: false,
    });
    expect(store.loopsSummary('A')().canStop).toBe(true);
  });

  describe('items', () => {
    beforeEach(() => loadTune());

    it('names items by position and tells loops from cues, with lengths in seconds', () => {
      setLoops([marker('a', 100), marker('b', 200, 590)]);

      const { items } = store.loopsSummary('A')();

      expect(items.map((item) => [item.name, item.kind, item.lengthText])).toEqual([
        ['Item 1', 'cue', 'CUE'],
        ['Item 2', 'loop', '7.8s'],
      ]);
    });

    it('places each item on the strip as a share of the tune, clamped, with no end for a cue', () => {
      setLoops([marker('cue', 100), marker('loop', 200, 590), marker('past', 900, 1_400)]);

      const { items } = store.loopsSummary('A')();

      expect(items.map((item) => [item.startPercent, item.endPercent])).toEqual([
        [10, null],
        [20, 59],
        [90, 100],
      ]);
    });

    it('reads an end that is not after the start as a cue', () => {
      setLoops([marker('odd', 300, 300)]);

      expect(store.loopsSummary('A')().items[0]).toMatchObject({
        kind: 'cue',
        lengthText: 'CUE',
        endPercent: null,
      });
    });

    it('puts nothing on the strip while the tune length is unknown', () => {
      store.setDeckStructure({
        slot: 'A',
        structure: { loopStartFrame: null, loopPeriodFrames: null, endedAtFrame: null },
        lengthFrames: null,
      });
      setLoops([marker('a', 100, 200)]);

      expect(store.loopsSummary('A')().items[0]).toMatchObject({ startPercent: 0, endPercent: 0 });
    });

    it('marks what is running, queued, selected and ready', () => {
      setLoops([marker('a', 100, 200, { ready: true }), marker('b', 300), marker('c', 400)], {
        selectedId: 'b',
        runningId: 'a',
        queuedId: 'c',
      });

      const { items } = store.loopsSummary('A')();

      expect(items.map((item) => [item.activity, item.selected, item.ready])).toEqual([
        ['running', false, true],
        ['idle', true, false],
        ['queued', false, false],
      ]);
    });
  });

  describe('the selected marker', () => {
    beforeEach(() => loadTune());

    it('shows where a loop runs from and to, and where a cue sits', () => {
      setLoops([marker('loop', 200, 590), marker('cue', 100)]);
      expect(store.loopsSummary('A')().selected).toMatchObject({
        id: 'loop',
        name: 'Item 1',
        kind: 'loop',
        spanText: '00:04.0–00:11.8',
      });

      store.setLoopSelection({ slot: 'A', selectedId: 'cue', selectionMovedWhileQueued: false });
      expect(store.loopsSummary('A')().selected).toMatchObject({
        id: 'cue',
        name: 'Item 2',
        kind: 'cue',
        spanText: '00:02.0',
        end: null,
      });
    });

    it('is null when the selection names no marker', () => {
      setLoops([marker('a', 100)], { selectedId: 'gone' });

      expect(store.loopsSummary('A')().selected).toBeNull();
    });

    it("lays the reachable moments on each boundary's one-second track and says which way it can snap", () => {
      setLoops([marker('a', 100)], { detectedMoments: [90, 100, 130, 500] });

      const start = store.loopsSummary('A')().selected?.start;

      expect(start).toEqual({
        offsetFrames: 0,
        rangeFrames: 50,
        tickPercents: [40, 50, 80],
        canSnapPrevious: true,
        canSnapNext: true,
      });
    });

    it('cannot snap past the last moment in reach', () => {
      setLoops([{ ...marker('a', 100), start: { frame: 100, offsetFrames: 30 } }], {
        detectedMoments: [90, 130],
      });

      const start = store.loopsSummary('A')().selected?.start;

      expect(start).toMatchObject({ offsetFrames: 30, canSnapPrevious: true, canSnapNext: false });
    });

    it('gives a loop an end boundary too, and has no ticks while the interval is unknown', () => {
      setLoops([marker('a', 100, 300)], { detectedMoments: [100, 310] });
      expect(store.loopsSummary('A')().selected?.end).toMatchObject({
        rangeFrames: 50,
        tickPercents: [60],
      });

      store.setDeckTiming({ slot: 'A', playCallIntervalUs: null });
      expect(store.loopsSummary('A')().selected?.start).toMatchObject({
        rangeFrames: 0,
        tickPercents: [],
        canSnapPrevious: false,
        canSnapNext: false,
      });
    });
  });

  it('does not rebuild on a frame tick, but does when the list changes', () => {
    loadTune();
    setLoops([marker('a', 100, 300)]);
    const summary = store.loopsSummary('A');
    const before = summary();

    store.samplePosition({ slot: 'A', positionFrames: 150 });
    store.samplePosition({ slot: 'A', positionFrames: 151 });
    expect(summary()).toBe(before);

    store.setLoopMarkers({ slot: 'A', markers: [marker('a', 100, 300, { ready: true })] });
    expect(summary()).not.toBe(before);
    expect(summary().items[0].ready).toBe(true);
  });
});
