import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { createRow, createSet, type LoopMarker, type SetRow, type TuneSet } from '@sidablist/tunes';
import { StorageType } from '@teensyrom-nx/domain';
import { DjStore, type DeckHolding, type PendingRow } from '../dj-store';
import { encodeRowHost } from '../sets/row-host';

const NOW = '2026-01-01T00:00:00.000Z';

function marker(id: string, end: number | null): LoopMarker {
  return {
    id,
    start: { frame: 1, offsetFrames: 0 },
    end: end === null ? null : { frame: end, offsetFrames: 0 },
    voices: [0, 1, 2],
  };
}

function row(name: string, extra: { lengths?: string[]; playLength?: string; subtuneCount?: number } = {}): SetRow {
  return createRow({
    id: `row-${name}`,
    tune: {
      sidHash: `hash-${name}`,
      title: `Title ${name}`,
      author: `Author ${name}`,
      released: '',
      subtuneCount: extra.subtuneCount ?? 1,
      byteLength: 1,
    },
    host: encodeRowHost({
      source: {
        deviceId: 'd',
        storageType: StorageType.Sd,
        path: `/${name}.sid`,
        fileName: `${name}.sid`,
      },
      lengths: extra.lengths ?? [],
      playLength: extra.playLength ?? '',
    }),
    memory: null,
    startSubtune: 1,
  });
}

function setOf(rows: SetRow[], id = 'set-1', name = 'Friday', updated = NOW): TuneSet {
  return { ...createSet({ id, placeholder: 'Set 1', now: updated }), name, rows };
}

function holding(name: string, setId = 'set-1'): DeckHolding {
  return { setId, rowId: `row-${name}`, sidHash: `hash-${name}`, subtune: 1 };
}

function pendingRow(key: string, index: number, setId = 'set-1'): PendingRow {
  return { key, setId, index, title: `Fetching ${key}`, author: '' };
}

describe('set selectors', () => {
  let store: InstanceType<typeof DjStore>;

  beforeEach(() => {
    store = TestBed.inject(DjStore);
  });

  function open(set: TuneSet, selected?: string): void {
    store.setSetsLibrary({ summaries: [], current: set });
    store.putOpenSet({ set });
    if (selected !== undefined) {
      store.selectSetRow({ rowId: `row-${selected}`, turned: false });
    }
  }

  describe('setCardSummary', () => {
    it('is empty and not ready before the library is hydrated', () => {
      expect(store.setCardSummary()()).toMatchObject({
        ready: false,
        name: '',
        rowCount: 0,
        rows: [],
        positionText: '— / —',
        selectedIndex: null,
        selectedRowIndex: null,
        selectedTitle: null,
      });
    });

    it('shows an empty set with the empty position form', () => {
      open(setOf([]));

      expect(store.setCardSummary()()).toMatchObject({
        ready: true,
        name: 'Friday',
        placeholder: 'Set 1',
        rowCount: 0,
        realRowCount: 0,
        positionText: '— / —',
      });
    });

    it('counts loops and cues of the last subtune, and shows its listing length', () => {
      const withMemory = {
        ...row('a', { lengths: ['1:00', '3:43.500'], playLength: '1:00', subtuneCount: 2 }),
        lastSubtune: 2,
        subtunes: [
          { subtune: 1, markers: [marker('m0', null)] },
          { subtune: 2, markers: [marker('m1', 50), marker('m2', 80), marker('m3', null)] },
        ],
      };
      open(setOf([withMemory, row('b')]), 'a');

      const [a, b] = store.setCardSummary()().rows;

      expect(a).toMatchObject({ id: 'row-a', number: 1, loops: 2, cues: 1, lengthText: '03:43', selected: true });
      expect(b).toMatchObject({ number: 2, loops: 0, cues: 0, lengthText: '—', selected: false });
    });

    it('falls back to the tune length when the listing gave no subtune lengths', () => {
      open(setOf([row('a', { playLength: '2:05' })]));

      expect(store.setCardSummary()().rows[0].lengthText).toBe('02:05');
    });

    it('pads the position to two digits', () => {
      const rows = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((name) => row(name));
      open(setOf(rows), 'c');

      expect(store.setCardSummary()()).toMatchObject({
        positionText: '03/08',
        selectedIndex: 2,
        selectedRowIndex: 2,
        selectedTitle: 'Title c',
        selectedAuthor: 'Author c',
      });
    });

    it('reports the decks holding each row by their transport state', () => {
      open(setOf([row('a'), row('b')]));
      store.setDeckHolding({ slot: 'A', holding: holding('a') });
      store.setDeckHolding({ slot: 'B', holding: holding('a') });
      store.setDeckStatus({ slot: 'A', status: 'playing' });
      store.setDeckStatus({ slot: 'B', status: 'stopped' });

      const [a, b] = store.setCardSummary()().rows;

      expect(a.decks).toEqual([
        { slot: 'A', state: 'playing' },
        { slot: 'B', state: 'off' },
      ]);
      expect(b.decks).toEqual([]);

      store.setDeckStatus({ slot: 'B', status: 'paused' });

      expect(store.setCardSummary()().rows[0].decks[1]).toEqual({ slot: 'B', state: 'paused' });
    });

    it('ignores a deck that holds a row of another set', () => {
      open(setOf([row('a')]));
      store.setDeckHolding({ slot: 'A', holding: holding('a', 'set-2') });

      expect(store.setCardSummary()().rows[0].decks).toEqual([]);
    });

    it('interleaves pending entries at their gap, numbered in place and counted in the card', () => {
      open(setOf([row('a'), row('b'), row('c')]), 'b');
      store.setPendingRows({ rows: [pendingRow('p1', 1), pendingRow('p2', 1), pendingRow('other', 0, 'set-2')] });

      const card = store.setCardSummary()();

      expect(card.rows.map((r) => [r.id, r.number, r.pending])).toEqual([
        ['row-a', 1, false],
        ['p1', 2, true],
        ['p2', 3, true],
        ['row-b', 4, false],
        ['row-c', 5, false],
      ]);
      expect(card.rows[1]).toMatchObject({ title: 'Fetching p1', prep: { phase: 'fetching' }, selected: false });
      expect(card).toMatchObject({
        rowCount: 5,
        realRowCount: 3,
        positionText: '04/05',
        selectedIndex: 3,
        selectedRowIndex: 1,
      });
    });

    it('puts an entry past the end after the last row', () => {
      open(setOf([row('a')]));
      store.setPendingRows({ rows: [pendingRow('p1', 9)] });

      expect(store.setCardSummary()().rows.map((r) => r.id)).toEqual(['row-a', 'p1']);
    });

    it('carries a row\'s prep and the save lamp', () => {
      open(setOf([row('a')]));
      store.setRowPrep({ rowId: 'row-a', prep: { phase: 'unavailable', reason: 'gone' } });
      store.setSetsSaveStatus({ status: 'failed' });

      const card = store.setCardSummary()();

      expect(card.rows[0].prep).toEqual({ phase: 'unavailable', reason: 'gone' });
      expect(card.save).toBe('failed');
    });

    it('does not rebuild when a deck\'s playhead moves', () => {
      open(setOf([row('a')]));
      const summary = store.setCardSummary();
      const before = summary();

      store.samplePosition({ slot: 'A', positionFrames: 12 });

      expect(summary()).toBe(before);
    });
  });

  describe('setTreeSummary', () => {
    it('lists the sets newest first, marking the open ones loaded', () => {
      const current = setOf([], 'set-2', 'Second', '2026-03-01T00:00:00.000Z');
      store.setSetsLibrary({
        summaries: [
          { id: 'set-1', name: 'First', rowCount: 0, updated: '2026-01-01T00:00:00.000Z' },
          { id: 'set-3', name: 'Third', rowCount: 0, updated: '2026-04-01T00:00:00.4610000+00:00' },
          { id: 'set-2', name: 'Second', rowCount: 0, updated: '2026-03-01T00:00:00.000Z' },
        ],
        current,
      });

      expect(store.setTreeSummary()().sets).toEqual([
        { id: 'set-3', name: 'Third', loaded: false },
        { id: 'set-2', name: 'Second', loaded: true },
        { id: 'set-1', name: 'First', loaded: false },
      ]);
    });

    it('lights only the set in the card when a deck keeps another set open', () => {
      const current = setOf([], 'set-2', 'Second', '2026-03-01T00:00:00.000Z');
      store.setSetsLibrary({
        summaries: [
          { id: 'set-1', name: 'First', rowCount: 1, updated: '2026-01-01T00:00:00.000Z' },
          { id: 'set-2', name: 'Second', rowCount: 0, updated: '2026-03-01T00:00:00.000Z' },
        ],
        current,
      });
      store.putOpenSet({ set: setOf([row('a')], 'set-1', 'First', '2026-01-01T00:00:00.000Z') });

      const loaded = store
        .setTreeSummary()()
        .sets.filter((entry) => entry.loaded)
        .map((entry) => entry.id);

      expect(loaded).toEqual(['set-2']);
    });
  });

  describe('deckHolding', () => {
    it('fires only when the holding changes by value', () => {
      const deckHolding = store.deckHolding('A');
      expect(deckHolding()).toBeNull();

      store.setDeckHolding({ slot: 'A', holding: holding('a') });
      const first = deckHolding();
      store.setDeckHolding({ slot: 'A', holding: { ...holding('a') } });

      expect(first).toEqual(holding('a'));
      expect(deckHolding()).toBe(first);

      store.setDeckHolding({ slot: 'A', holding: { ...holding('a'), subtune: 2 } });

      expect(deckHolding()).toEqual({ ...holding('a'), subtune: 2 });
    });
  });

  describe('deckSetSummary', () => {
    beforeEach(() => {
      open(setOf([row('a'), row('b'), row('c')]));
    });

    it('is unavailable while the deck holds nothing', () => {
      expect(store.deckSetSummary('A')()).toEqual({
        available: false,
        positionText: '— / —',
        setName: '',
        canPrevious: false,
        canNext: false,
      });
    });

    it.each([
      ['a', '01/03', false, true],
      ['b', '02/03', true, true],
      ['c', '03/03', true, false],
    ])('places a deck on row %s', (name, positionText, canPrevious, canNext) => {
      store.setDeckHolding({ slot: 'A', holding: holding(name) });

      expect(store.deckSetSummary('A')()).toEqual({
        available: true,
        positionText,
        setName: 'Friday',
        canPrevious,
        canNext,
      });
    });

    it('counts real rows only, not the entries still fetching', () => {
      store.setPendingRows({ rows: [pendingRow('p1', 0)] });
      store.setDeckHolding({ slot: 'A', holding: holding('a') });

      expect(store.deckSetSummary('A')().positionText).toBe('01/03');
    });

    it('is unavailable for a deck holding a row of another set, or one removed from this one', () => {
      store.setDeckHolding({ slot: 'A', holding: holding('a', 'set-2') });
      store.setDeckHolding({ slot: 'B', holding: holding('gone') });

      expect(store.deckSetSummary('A')().available).toBe(false);
      expect(store.deckSetSummary('B')().available).toBe(false);
    });
  });
});
