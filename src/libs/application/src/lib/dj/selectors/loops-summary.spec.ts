import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import type { TuneReference } from '@sidablist/tunes';
import {
  DjStore,
  EMPTY_DECK_LOOPS,
  HOME_DECK_PANEL,
  type DeckBeatGrid,
  type DeckLoopMarker,
  type DeckStatus,
} from '../dj-store';

/** 50 play calls a second. */
const INTERVAL_US = 20_000;

/** 24 play calls a beat from frame 0, so beats sit on multiples of 24. */
const GRID: DeckBeatGrid = {
  beatFrames: 24,
  beatOneFrame: 0,
  startFrame: 0,
  endFrame: null,
  source: 'scan',
};

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
    name: null,
    start: { frame: start, offsetFrames: 0 },
    end: end === null ? null : { frame: end, offsetFrames: 0 },
    voices: [0, 1, 2],
    settings: null,
    ownSettings: false,
    wraps: false,
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
      canDuplicate: false,
      canStop: false,
      moveStepText: '1 BEAT',
      moveStepOptions: [
        { beats: 'frame', label: '1 FRAME', selected: false },
        { beats: 1, label: '1 BEAT', selected: true },
        { beats: 2, label: '2 BEATS', selected: false },
        { beats: 4, label: '4 BEATS', selected: false },
        { beats: 8, label: '8 BEATS', selected: false },
        { beats: 16, label: '16 BEATS', selected: false },
      ],
      items: [],
      selected: null,
    });
  });

  it("reads the deck's Move step, which exists with nothing selected", () => {
    store.setDeckMoveStep({ slot: 'A', moveStepBeats: 8 });

    const summary = store.loopsSummary('A')();

    expect(summary.moveStepText).toBe('8 BEATS');
    expect(summary.moveStepOptions.filter((option) => option.selected)).toEqual([
      { beats: 8, label: '8 BEATS', selected: true },
    ]);
    expect(summary.selected).toBeNull();

    store.setDeckMoveStep({ slot: 'A', moveStepBeats: 'frame' });
    expect(store.loopsSummary('A')().moveStepText).toBe('1 FRAME');
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

  it.each([
    { status: 'playing', switching: false, selected: true, canDuplicate: true },
    { status: 'stopped', switching: false, selected: true, canDuplicate: true },
    { status: 'playing', switching: false, selected: false, canDuplicate: false },
    { status: 'loading', switching: false, selected: true, canDuplicate: false },
    { status: 'playing', switching: true, selected: true, canDuplicate: false },
  ] as const)(
    'duplicates with $status, switching $switching and a marker selected $selected: $canDuplicate',
    ({ status, switching, selected, canDuplicate }) => {
      loadTune(status);
      store.setDeckSwitching({ slot: 'A', switching });
      setLoops([marker('a', 100)], selected ? {} : { selectedId: null });

      expect(store.loopsSummary('A')().canDuplicate).toBe(canDuplicate);
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

  it("can stop while a marker's own settings are in play, even with nothing running or queued", () => {
    loadTune();
    setLoops([marker('a', 100)]);
    expect(store.loopsSummary('A')().canStop).toBe(false);

    setLoops([marker('a', 100)], {
      settingsInPlayId: 'a',
      mainSettings: { panel: HOME_DECK_PANEL, mutes: [false, false, false] },
    });

    expect(store.loopsSummary('A')().canStop).toBe(true);
  });

  describe('WRAP', () => {
    beforeEach(() => loadTune());

    it('reports the selected marker WRAP', () => {
      setLoops([marker('a', 100, 200, { wraps: true }), marker('b', 300, 400)]);
      expect(store.loopsSummary('A')().selected?.wraps).toBe(true);

      store.setLoopSelection({ slot: 'A', selectedId: 'b', selectionMovedWhileQueued: false });
      expect(store.loopsSummary('A')().selected?.wraps).toBe(false);
    });
  });

  describe('GBL', () => {
    beforeEach(() => loadTune());

    it('marks an item with its own settings and a selection without them as sharing', () => {
      const own = { panel: HOME_DECK_PANEL, mutes: [false, false, false] } as const;
      setLoops([marker('a', 100, null, { settings: own, ownSettings: true }), marker('b', 200)]);

      expect(
        store
          .loopsSummary('A')()
          .items.map((item) => item.ownSettings)
      ).toEqual([true, false]);
      expect(store.loopsSummary('A')().selected?.sharesGlobal).toBe(false);

      store.setLoopSelection({ slot: 'A', selectedId: 'b', selectionMovedWhileQueued: false });
      expect(store.loopsSummary('A')().selected?.sharesGlobal).toBe(true);
    });

    it('treats a latched marker that keeps a copy as sharing', () => {
      const kept = { panel: HOME_DECK_PANEL, mutes: [true, false, false] } as const;
      setLoops([marker('a', 100, null, { settings: kept, ownSettings: false })]);

      expect(store.loopsSummary('A')().items[0].ownSettings).toBe(false);
      expect(store.loopsSummary('A')().selected?.sharesGlobal).toBe(true);
    });
  });

  describe('items', () => {
    beforeEach(() => loadTune());

    it('labels items by kind and tells loops from cues, with lengths in seconds', () => {
      setLoops([marker('a', 100), marker('b', 200, 590)]);

      const { items } = store.loopsSummary('A')();

      expect(items.map((item) => [item.name, item.kind, item.lengthText])).toEqual([
        ['Cue 1', 'cue', 'CUE'],
        ['Loop 1', 'loop', '7.8s'],
      ]);
    });

    it('shows the name a marker was given in place of its label, which still counts for its kind', () => {
      setLoops([marker('a', 100, null, { name: 'Drop' }), marker('b', 200)], { selectedId: 'a' });

      const summary = store.loopsSummary('A')();

      expect(summary.items.map((item) => item.name)).toEqual(['Drop', 'Cue 2']);
      expect(summary.selected?.name).toBe('Drop');
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
        name: 'Loop 1',
        kind: 'loop',
        spanText: '00:04.0–00:11.8',
      });

      store.setLoopSelection({ slot: 'A', selectedId: 'cue', selectionMovedWhileQueued: false });
      expect(store.loopsSummary('A')().selected).toMatchObject({
        id: 'cue',
        name: 'Cue 1',
        kind: 'cue',
        spanText: '00:02.0',
      });
    });

    it('is null when the selection names no marker', () => {
      setLoops([marker('a', 100)], { selectedId: 'gone' });

      expect(store.loopsSummary('A')().selected).toBeNull();
    });
  });

  describe('lengths in beats', () => {
    beforeEach(() => {
      loadTune();
      store.setDeckBeatGrid({ slot: 'A', beatGrid: GRID });
    });

    const lengthTexts = () =>
      store
        .loopsSummary('A')()
        .items.map((item) => item.lengthText);

    it('writes a whole number of beats from a start on a beat', () => {
      setLoops([
        marker('one', 240, 264),
        marker('five', 240, 360),
        marker('sixteen', 240, 240 + 384),
        marker('forty-eight', 0, 1_152),
      ]);

      expect(lengthTexts()).toEqual(['1 BEAT', '5 BEATS', '16 BEATS', '48 BEATS']);
    });

    it('writes a ladder fraction of a beat', () => {
      setLoops([marker('half', 240, 252), marker('eighth', 240, 243), marker('quarter', 240, 246)]);

      expect(lengthTexts()).toEqual(['1/2 BEAT', '1/8 BEAT', '1/4 BEAT']);
    });

    it('falls back to seconds off the beats, between ladder sizes, off the grid and outside its span', () => {
      setLoops([marker('off', 241, 265), marker('between', 240, 270), marker('cue', 240)]);
      expect(lengthTexts()).toEqual(['0.4s', '0.6s', 'CUE']);

      store.setDeckBeatGrid({ slot: 'A', beatGrid: { ...GRID, endFrame: 100 } });
      setLoops([marker('outside', 240, 264)]);
      expect(lengthTexts()).toEqual(['0.4s']);

      store.setDeckBeatGrid({ slot: 'A', beatGrid: null });
      expect(lengthTexts()).toEqual(['0.4s']);
    });

    it("counts a start's nudge when judging whether it is on a beat", () => {
      setLoops([{ ...marker('nudged', 240, 264), start: { frame: 240, offsetFrames: 5 } }]);

      expect(lengthTexts()).toEqual(['0.3s']);
    });

    it('says NO END for a cue and offers the ladder with the loop length selected', () => {
      setLoops([marker('cue', 240), marker('loop', 240, 336)], { selectedId: 'cue' });
      expect(store.loopsSummary('A')().selected?.lengthText).toBe('NO END');
      expect(
        store
          .loopsSummary('A')()
          .selected?.lengthOptions.some((option) => option.selected)
      ).toBe(false);

      store.setLoopSelection({ slot: 'A', selectedId: 'loop', selectionMovedWhileQueued: false });
      const selected = store.loopsSummary('A')().selected;

      expect(selected?.lengthText).toBe('4 BEATS');
      // 1/16 of a 24-frame beat is 1.5 frames, under the 2 a size needs: 1/8 is the shortest.
      expect(selected?.lengthOptions.map((option) => option.label)).toEqual([
        '1/8 BEAT',
        '1/4 BEAT',
        '1/2 BEAT',
        '1 BEAT',
        '2 BEATS',
        '4 BEATS',
        '8 BEATS',
        '16 BEATS',
        '32 BEATS',
        '64 BEATS',
        '128 BEATS',
      ]);
      expect(selected?.lengthOptions.filter((option) => option.selected)).toEqual([
        { beats: 4, label: '4 BEATS', selected: true },
      ]);
    });

    it('writes and selects a ladder size whose end falls between two frames', () => {
      // 28 frames a beat: 1/8 is 3.5 frames, 1/4 is 7.
      store.setDeckBeatGrid({ slot: 'A', beatGrid: { ...GRID, beatFrames: 28 } });
      setLoops([marker('eighth', 252, 255.5), marker('quarter', 252, 259)]);

      expect(lengthTexts()).toEqual(['1/8 BEAT', '1/4 BEAT']);
      const options = store.loopsSummary('A')().selected?.lengthOptions;
      expect(options?.[0]).toEqual({ beats: 1 / 8, label: '1/8 BEAT', selected: true });
      expect(options?.filter((option) => option.selected)).toHaveLength(1);
    });

    it('offers no lengths with no grid, and keeps seconds', () => {
      store.setDeckBeatGrid({ slot: 'A', beatGrid: null });
      setLoops([marker('loop', 240, 336)]);

      const selected = store.loopsSummary('A')().selected;

      expect(selected?.lengthOptions).toEqual([]);
      expect(selected?.lengthText).toBe('1.9s');
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
