import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { of, Subject, throwError, type Observable } from 'rxjs';
import {
  InMemorySetStore,
  InMemoryTuneMemoryStore,
  createRow,
  createSet,
  type LoopMarker,
  type Playable,
  type TuneIdentity,
  type TuneReference,
  type TuneSet,
} from '@sidablist/tunes';
import type { TuneIndexRecord } from '@sidablist/analysis';
import {
  ALERT_SERVICE,
  FILE_CONTENT_SERVICE,
  StorageType,
  type Device,
  type FileContent,
} from '@teensyrom-nx/domain';
import { DeviceStore } from '../../device/device-store';
import { DjStore, type DeckHolding } from '../dj-store';
import type { LoadSource } from '../load-source';
import {
  DJ_LIBRARY_STATE_REPOSITORY,
  SET_STORE,
  TUNE_INSERTER,
  TUNE_MEMORY_STORE,
  TUNE_RESOLVER,
} from '../ports';
import {
  DjSets,
  MAX_ROWS_PER_SET,
  MAX_SETS,
  SET_NAME_MAX_LENGTH,
  sanitizeName,
} from './dj-sets';
import { decodeRowHost } from './row-host';

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const MARKER: LoopMarker = {
  id: 'marker-1',
  start: { frame: 10, offsetFrames: 0 },
  end: null,
  voices: [0, 1, 2],
};

describe('DjSets', () => {
  let store: InstanceType<typeof DjStore>;
  let sets: DjSets;
  let setStore: InMemorySetStore;
  let memoryStore: InMemoryTuneMemoryStore;
  let libraryState: {
    stored: string | null;
    load: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };
  let alerts: { warning: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let fileContent: { getFileContent: ReturnType<typeof vi.fn> };
  let inserter: { insert: ReturnType<typeof vi.fn> };
  let resolver: { resolve: ReturnType<typeof vi.fn> };

  /** The tunes the fake file system holds, by path. */
  let catalog: Map<string, TuneReference>;
  /** Fetches a test holds back, by path. */
  let held: Map<string, Observable<FileContent>>;

  function bytesOf(path: string): Uint8Array {
    return Uint8Array.from(path, (character) => character.charCodeAt(0));
  }

  function contentOf(path: string): FileContent {
    const bytes = bytesOf(path);
    return { bytes: bytes.buffer, byteLength: bytes.length, fileName: path };
  }

  function tune(name: string, subtuneCount = 1): TuneReference {
    const reference: TuneReference = {
      identity: { sidHash: `hash-${name}`, subtune: 1 },
      title: `Title ${name}`,
      author: `Author ${name}`,
      released: '2024',
      subtuneCount,
      byteLength: 3,
    };
    catalog.set(`/tunes/${name}.sid`, reference);
    return reference;
  }

  function source(name: string, extra: Partial<LoadSource> = {}): LoadSource {
    const path = `/tunes/${name}.sid`;
    if (!catalog.has(path)) {
      tune(name);
    }
    return {
      deviceId: 'device-1',
      storageType: StorageType.Sd,
      path,
      fileName: `${name}.sid`,
      ...extra,
    };
  }

  function holdFetch(name: string) {
    const path = `/tunes/${name}.sid`;
    const subject = new Subject<FileContent>();
    held.set(path, subject.asObservable());
    return {
      release: () => {
        subject.next(contentOf(path));
        subject.complete();
      },
      fail: (error: Error) => subject.error(error),
    };
  }

  function playableFor(identity: TuneIdentity): Playable | null {
    const reference = [...catalog.values()].find((r) => r.identity.sidHash === identity.sidHash);
    return reference === undefined
      ? null
      : {
          reference,
          bytes: new Uint8Array(),
          index: { sidHash: identity.sidHash, subtune: identity.subtune } as TuneIndexRecord,
        };
  }

  /** Lets every awaiting step run. */
  async function settle(): Promise<void> {
    await vi.advanceTimersByTimeAsync(0);
  }

  /** Runs the debounce and the flush it starts. */
  async function flushSaves(): Promise<void> {
    await vi.advanceTimersByTimeAsync(300);
  }

  function current(): TuneSet {
    const id = store.sets.currentSetId();
    if (id === null) {
      throw new Error('no current set');
    }
    return store.sets.open()[id];
  }

  function titles(): string[] {
    return current().rows.map((row) => row.tune.title);
  }

  async function saved(id: string): Promise<TuneSet | null> {
    return setStore.load(id);
  }

  async function add(name: string, index: number | null = null): Promise<void> {
    await sets.addFromListing(source(name), index);
  }

  async function hold(name: string, slot: 'A' | 'B' = 'A'): Promise<DeckHolding> {
    const holding = await sets.joinForDeck(tune(name), source(name));
    sets.hold(slot, holding);
    return holding;
  }

  beforeEach(() => {
    vi.useFakeTimers();
    catalog = new Map();
    held = new Map();
    setStore = new InMemorySetStore();
    memoryStore = new InMemoryTuneMemoryStore();
    libraryState = {
      stored: null,
      load: vi.fn(async () => libraryState.stored),
      save: vi.fn(async (id: string | null) => {
        libraryState.stored = id;
      }),
    };
    alerts = { warning: vi.fn(), error: vi.fn() };
    fileContent = {
      getFileContent: vi.fn(
        (_deviceId: string, _storage: StorageType, path: string) =>
          held.get(path) ?? of(contentOf(path))
      ),
    };
    inserter = {
      insert: vi.fn(async (bytes: Uint8Array) => {
        const path = String.fromCharCode(...bytes);
        const reference = catalog.get(path);
        if (reference === undefined) {
          throw new Error(`unknown tune ${path}`);
        }
        return reference;
      }),
    };
    resolver = { resolve: vi.fn(async (identity: TuneIdentity) => playableFor(identity)) };

    TestBed.configureTestingModule({
      providers: [
        { provide: SET_STORE, useValue: setStore },
        { provide: TUNE_MEMORY_STORE, useValue: memoryStore },
        { provide: DJ_LIBRARY_STATE_REPOSITORY, useValue: libraryState },
        { provide: ALERT_SERVICE, useValue: alerts },
        { provide: FILE_CONTENT_SERVICE, useValue: fileContent },
        { provide: TUNE_INSERTER, useValue: inserter },
        { provide: TUNE_RESOLVER, useValue: resolver },
        { provide: DeviceStore, useValue: { usableDevices: signal<Device[]>([]) } },
      ],
    });
    store = TestBed.inject(DjStore);
    sets = TestBed.inject(DjSets);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('hydrate', () => {
    it('starts a saved "Set 1" on a fresh library', async () => {
      await sets.hydrate();

      expect(store.sets.ready()).toBe(true);
      expect(current().name).toBe('Set 1');
      expect(store.sets.summaries()).toHaveLength(1);
      expect(store.sets.save()).toBe('saving');

      await flushSaves();

      expect(await saved(current().id)).toEqual(current());
      expect(libraryState.stored).toBe(current().id);
      expect(store.sets.save()).toBe('saved');
    });

    it('restores the current set a reload left, selecting its first row, and saves nothing', async () => {
      const row = createRow({
        id: 'row-1',
        tune: { sidHash: 'h', title: 'T', author: 'A', released: '', subtuneCount: 1, byteLength: 1 },
        memory: null,
        startSubtune: 1,
      });
      const set: TuneSet = {
        ...createSet({ id: 'set-saved', placeholder: 'Set 1', now: '2026-01-01T00:00:00.000Z' }),
        name: 'Friday',
        rows: [row],
      };
      await setStore.save(set);
      libraryState.stored = 'set-saved';
      const saveSpy = vi.spyOn(setStore, 'save');

      await sets.hydrate();
      await flushSaves();

      expect(current()).toEqual(set);
      expect(store.sets.selectedRowId()).toBe('row-1');
      expect(saveSpy).not.toHaveBeenCalled();
      expect(libraryState.save).not.toHaveBeenCalled();
    });

    it('starts the next placeholder when the current set is gone', async () => {
      await setStore.save(createSet({ id: 'other', placeholder: 'Set 1', now: '2026-01-01T00:00:00.000Z' }));
      libraryState.stored = 'vanished';

      await sets.hydrate();
      await flushSaves();

      expect(current().name).toBe('Set 2');
      expect(store.sets.summaries().map((summary) => summary.name)).toEqual(['Set 1', 'Set 2']);
      expect(libraryState.stored).toBe(current().id);
    });

    it('loads once however often it is asked', async () => {
      const listSpy = vi.spyOn(setStore, 'list');

      const first = sets.hydrate();
      const second = sets.hydrate();
      await Promise.all([first, second]);

      expect(first).toBe(second);
      expect(listSpy).toHaveBeenCalledTimes(1);
    });

    it('warns, starts an unsaved "Set 1" and saves nothing for the session when loading fails', async () => {
      vi.spyOn(setStore, 'list').mockRejectedValue(new Error('down'));
      const saveSpy = vi.spyOn(setStore, 'save');
      const deleteSpy = vi.spyOn(setStore, 'delete');

      await expect(sets.hydrate()).resolves.toBeUndefined();
      sets.renameCurrent('Edited');
      await add('a');
      await flushSaves();

      expect(alerts.warning).toHaveBeenCalledTimes(1);
      expect(store.sets.ready()).toBe(true);
      expect(current().name).toBe('Edited');
      expect(current().rows).toHaveLength(1);
      expect(saveSpy).not.toHaveBeenCalled();
      expect(libraryState.save).not.toHaveBeenCalled();
      expect(store.sets.save()).toBe('failed');

      await sets.deleteCurrent();

      expect(deleteSpy).not.toHaveBeenCalled();
      expect(alerts.warning).toHaveBeenCalledTimes(2);
    });
  });

  describe('saving', () => {
    beforeEach(async () => {
      await sets.hydrate();
      await flushSaves();
    });

    it('walks the lamp from saving to saved', async () => {
      sets.renameCurrent('Friday');

      expect(store.sets.save()).toBe('saving');

      await flushSaves();

      expect(store.sets.save()).toBe('saved');
      expect((await saved(current().id))?.name).toBe('Friday');
    });

    it('coalesces edits into one save per document', async () => {
      const saveSpy = vi.spyOn(setStore, 'save');
      const memorySpy = vi.spyOn(memoryStore, 'save');
      const holding = await hold('a');
      await flushSaves();
      saveSpy.mockClear();
      memorySpy.mockClear();

      for (const name of ['One', 'Two', 'Three']) {
        sets.renameCurrent(name);
        await vi.advanceTimersByTimeAsync(100);
        await sets.positionsFor(holding).save({ sidHash: 'hash-a', subtune: 1 }, [
          { ...MARKER, name },
        ]);
        await vi.advanceTimersByTimeAsync(100);
      }
      await flushSaves();

      expect(saveSpy).toHaveBeenCalledTimes(1);
      expect(saveSpy.mock.calls[0][0].name).toBe('Three');
      expect(memorySpy).toHaveBeenCalledTimes(1);
      expect(memorySpy.mock.calls[0][0].subtunes[0].markers[0].name).toBe('Three');
    });

    it('sends again once a flush settles when a change came in during it', async () => {
      const saveSpy = vi.spyOn(setStore, 'save');
      const gate = deferred();
      saveSpy.mockImplementationOnce(() => gate.promise);

      sets.renameCurrent('One');
      await flushSaves();
      sets.renameCurrent('Two');
      await flushSaves();

      expect(saveSpy).toHaveBeenCalledTimes(1);
      expect(store.sets.save()).toBe('saving');

      gate.resolve();
      await settle();

      expect(saveSpy).toHaveBeenCalledTimes(2);
      expect(saveSpy.mock.calls[1][0].name).toBe('Two');
      expect(store.sets.save()).toBe('saved');
    });

    it('goes failed with one alert, and retries on the next change but not on a timer', async () => {
      const saveSpy = vi.spyOn(setStore, 'save');
      saveSpy.mockRejectedValueOnce(new Error('500'));

      sets.renameCurrent('One');
      await flushSaves();

      expect(store.sets.save()).toBe('failed');
      expect(alerts.error).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(60_000);

      expect(saveSpy).toHaveBeenCalledTimes(1);

      sets.renameCurrent('Two');
      await flushSaves();

      expect(saveSpy).toHaveBeenCalledTimes(2);
      expect(saveSpy.mock.calls[1][0].name).toBe('Two');
      expect(store.sets.save()).toBe('saved');
      expect(alerts.error).toHaveBeenCalledTimes(1);
    });

    it('alerts once per failure streak', async () => {
      const saveSpy = vi.spyOn(setStore, 'save');
      saveSpy.mockRejectedValueOnce(new Error('500')).mockRejectedValueOnce(new Error('500'));

      sets.renameCurrent('One');
      await flushSaves();
      sets.renameCurrent('Two');
      await flushSaves();

      expect(alerts.error).toHaveBeenCalledTimes(1);

      sets.renameCurrent('Three');
      await flushSaves();
      saveSpy.mockRejectedValueOnce(new Error('500'));
      sets.renameCurrent('Four');
      await flushSaves();

      expect(alerts.error).toHaveBeenCalledTimes(2);
    });

    it('retries the document that failed with the next change', async () => {
      const memorySpy = vi.spyOn(memoryStore, 'save');
      const holding = await hold('a');
      await flushSaves();
      memorySpy.mockRejectedValueOnce(new Error('500'));
      const saveSpy = vi.spyOn(setStore, 'save');
      saveSpy.mockClear();

      sets.renameCurrent('Friday');
      await sets.positionsFor(holding).save({ sidHash: 'hash-a', subtune: 1 }, [MARKER]);
      await flushSaves();

      expect(store.sets.save()).toBe('failed');
      expect(saveSpy).toHaveBeenCalledTimes(1);

      saveSpy.mockClear();
      await sets.positionsFor(holding).save({ sidHash: 'hash-a', subtune: 1 }, [
        MARKER,
        { ...MARKER, id: 'marker-2' },
      ]);
      await flushSaves();

      expect(saveSpy).toHaveBeenCalledTimes(1);
      expect((await memoryStore.load('hash-a'))?.subtunes[0].markers).toHaveLength(2);
      expect(store.sets.save()).toBe('saved');
    });

    it('still saves a set that was closed before the flush', async () => {
      const first = current().id;
      await add('a');
      sets.newSet();
      const second = current().id;

      expect(Object.keys(store.sets.open())).toEqual([second]);

      await flushSaves();

      expect((await saved(first))?.rows).toHaveLength(1);
      expect(await saved(second)).not.toBeNull();
      expect(libraryState.stored).toBe(second);
    });

    it('saves the library state when a set is created and when one is opened', async () => {
      const first = current().id;
      libraryState.save.mockClear();

      sets.newSet();
      await flushSaves();
      await sets.openSet(first);
      await flushSaves();

      expect(libraryState.save).toHaveBeenCalledTimes(2);
      expect(libraryState.stored).toBe(first);
    });
  });

  describe('naming', () => {
    beforeEach(async () => {
      await sets.hydrate();
    });

    it('saves a rename without the control characters that were pasted into it', async () => {
      sets.renameCurrent('  Fri\tday\nNight\u0085 ');
      await flushSaves();

      expect(current().name).toBe('FridayNight');
      expect((await saved(current().id))?.name).toBe('FridayNight');
    });

    it('caps the name and falls back to the placeholder when it is empty', () => {
      sets.renameCurrent('x'.repeat(SET_NAME_MAX_LENGTH + 20));

      expect(current().name).toHaveLength(SET_NAME_MAX_LENGTH);

      sets.renameCurrent('\t \n');

      expect(current().name).toBe(current().placeholder);
    });

    it('never cuts a surrogate pair in half', () => {
      expect(sanitizeName(`${'x'.repeat(63)}😀`, SET_NAME_MAX_LENGTH)).toBe('x'.repeat(63));
    });
  });

  describe('adding from the listing', () => {
    beforeEach(async () => {
      await sets.hydrate();
    });

    it('shows a pending entry while it fetches, then an analyzing row, then a ready one', async () => {
      const fetch = holdFetch('a');
      const analysis = deferred();
      resolver.resolve.mockImplementationOnce(async (identity: TuneIdentity, options: { onScanStart(): void }) => {
        options.onScanStart();
        await analysis.promise;
        return playableFor(identity);
      });

      const adding = sets.addFromListing(
        source('a', { title: 'Listing title', author: 'Listing author', playLength: '3:43', subtuneLengths: ['3:43'] }),
        null
      );
      await settle();

      expect(store.sets.pending()).toMatchObject([
        { setId: current().id, index: 0, title: 'Listing title', author: 'Listing author' },
      ]);
      expect(current().rows).toHaveLength(0);

      fetch.release();
      await settle();

      const row = current().rows[0];
      expect(store.sets.pending()).toEqual([]);
      expect(row.tune).toMatchObject({ sidHash: 'hash-a', title: 'Title a' });
      expect(row.copiedFrom).toBeNull();
      expect(decodeRowHost(row.host)).toEqual({
        source: { deviceId: 'device-1', storageType: StorageType.Sd, path: '/tunes/a.sid', fileName: 'a.sid' },
        lengths: ['3:43'],
        playLength: '3:43',
      });
      expect(store.sets.prep()[row.id]).toEqual({ phase: 'analyzing' });

      analysis.resolve();
      await adding;

      expect(store.sets.prep()[row.id]).toBeUndefined();
    });

    it('marks a row whose analysis fails as unavailable, with the reason', async () => {
      resolver.resolve.mockRejectedValueOnce(new Error('scan broke'));

      await add('a');

      expect(store.sets.prep()[current().rows[0].id]).toEqual({
        phase: 'unavailable',
        reason: 'scan broke',
      });
    });

    it('selects the first row added to an empty set, and leaves the selection alone after', async () => {
      await add('a');
      const first = current().rows[0].id;

      expect(store.sets.selectedRowId()).toBe(first);

      await add('b');

      expect(store.sets.selectedRowId()).toBe(first);
    });

    it('selects and announces the existing row instead of adding a tune the set holds', async () => {
      await add('a');
      await add('b');
      sets.selectRow(current().rows[1].id);

      await add('a');

      expect(titles()).toEqual(['Title a', 'Title b']);
      expect(store.sets.selectedRowId()).toBe(current().rows[0].id);
      expect(store.sets.announcement()?.text).toBe('Title a is already in the set');
      expect(store.sets.pending()).toEqual([]);
    });

    it('adds nothing, and says so, when the fetch fails', async () => {
      held.set('/tunes/a.sid', throwError(() => new Error('offline')));

      await add('a');

      expect(current().rows).toHaveLength(0);
      expect(store.sets.pending()).toEqual([]);
      expect(alerts.warning).toHaveBeenCalledWith(expect.stringContaining('a.sid'));
      expect(store.sets.announcement()?.text).toContain('a.sid');
    });

    it('yields one row for two concurrent drops of one SID', async () => {
      await Promise.all([
        sets.addFromListing(source('a'), null),
        sets.addFromListing(source('a'), null),
      ]);

      expect(titles()).toEqual(['Title a']);
      expect(store.sets.pending()).toEqual([]);
    });

    it('lands at the gap among real rows, whatever pending entries sit above it', async () => {
      await add('a');
      await add('b');
      await add('c');
      const slow = holdFetch('d');

      const slowAdd = sets.addFromListing(source('d'), 1);
      await settle();
      await add('e', 2);

      expect(titles()).toEqual(['Title a', 'Title b', 'Title e', 'Title c']);

      slow.release();
      await slowAdd;

      expect(titles()).toEqual(['Title a', 'Title d', 'Title b', 'Title e', 'Title c']);
    });

    it('keeps entries still fetching behind a row that lands before them', async () => {
      const first = holdFetch('a');
      const second = holdFetch('b');

      const firstAdd = sets.addFromListing(source('a'), 0);
      const secondAdd = sets.addFromListing(source('b'), 0);
      await settle();
      first.release();
      await firstAdd;

      expect(store.sets.pending().map((entry) => entry.index)).toEqual([1]);

      second.release();
      await secondAdd;

      expect(titles()).toEqual(['Title a', 'Title b']);
    });

    it('adds to the set the drop was for when another set is opened meanwhile', async () => {
      const first = current().id;
      const fetch = holdFetch('a');
      const adding = sets.addFromListing(source('a'), null);
      await settle();
      sets.newSet();

      fetch.release();
      await adding;
      await flushSaves();

      expect((await saved(first))?.rows).toHaveLength(1);
      expect(current().rows).toHaveLength(0);
      expect(Object.keys(store.sets.open())).toEqual([current().id]);
    });
  });

  describe('rows and selection', () => {
    beforeEach(async () => {
      await sets.hydrate();
      await add('a');
      await add('b');
      await add('c');
    });

    it('moves a row to its final position among the real rows', () => {
      sets.moveRow(current().rows[0].id, 2);

      expect(titles()).toEqual(['Title b', 'Title c', 'Title a']);

      sets.moveRow(current().rows[2].id, 0);

      expect(titles()).toEqual(['Title a', 'Title b', 'Title c']);
    });

    it('stops the Select keys at the ends of the rows while counting every turn', () => {
      const [a, b, c] = current().rows.map((row) => row.id);

      sets.moveSelection(-1);
      expect(store.sets.selectedRowId()).toBe(a);
      expect(store.sets.selectTurns()).toBe(1);

      sets.moveSelection(1);
      expect(store.sets.selectedRowId()).toBe(b);

      sets.moveSelection(5);
      expect(store.sets.selectedRowId()).toBe(c);

      sets.moveSelection(1);
      expect(store.sets.selectedRowId()).toBe(c);
      expect(store.sets.selectTurns()).toBe(4);
    });

    it('does not count a turn for a click', () => {
      sets.selectRow(current().rows[2].id);

      expect(store.sets.selectedRowId()).toBe(current().rows[2].id);
      expect(store.sets.selectTurns()).toBe(0);
    });

    it('selects the mapped knob by real-row index, rounded and clamped, ignoring pending entries', async () => {
      const slow = holdFetch('d');
      const adding = sets.addFromListing(source('d'), 1);
      await settle();
      const [a, b, c] = current().rows.map((row) => row.id);

      sets.selectRowAt(1.4);
      expect(store.sets.selectedRowId()).toBe(b);

      sets.selectRowAt(99);
      expect(store.sets.selectedRowId()).toBe(c);

      sets.selectRowAt(-3);
      expect(store.sets.selectedRowId()).toBe(a);
      expect(store.sets.selectTurns()).toBe(3);

      slow.release();
      await adding;
    });

    it('moves the selection to the row that took the removed one', () => {
      const [a, b, c] = current().rows.map((row) => row.id);
      sets.selectRow(b);

      sets.removeRow(b);
      expect(store.sets.selectedRowId()).toBe(c);

      sets.removeRow(c);
      expect(store.sets.selectedRowId()).toBe(a);

      sets.removeRow(a);
      expect(store.sets.selectedRowId()).toBeNull();
    });

    it('leaves the selection where it was when another row is removed', () => {
      const [a, b] = current().rows.map((row) => row.id);
      sets.selectRow(a);

      sets.removeRow(b);

      expect(store.sets.selectedRowId()).toBe(a);
    });
  });

  describe('the deck side', () => {
    beforeEach(async () => {
      await sets.hydrate();
    });

    it('joins a deck to the SID\'s row, appended when it is new', async () => {
      await add('a');

      const holdingB = await sets.joinForDeck(tune('b'), source('b'));
      const holdingA = await sets.joinForDeck(tune('a'), source('a'));

      expect(titles()).toEqual(['Title a', 'Title b']);
      expect(holdingB).toEqual({
        setId: current().id,
        rowId: current().rows[1].id,
        sidHash: 'hash-b',
        subtune: 1,
      });
      expect(holdingA.rowId).toBe(current().rows[0].id);
    });

    it('yields one row for concurrent joins of one SID', async () => {
      const [first, second] = await Promise.all([
        sets.joinForDeck(tune('a'), source('a')),
        sets.joinForDeck(tune('a'), source('a')),
      ]);

      expect(current().rows).toHaveLength(1);
      expect(first).toEqual(second);
    });

    it.each(['card first', 'deck first'])(
      'yields one row when a deck drop races a card drop (%s)',
      async (order) => {
        const card = (): Promise<void> => sets.addFromListing(source('a'), null);
        const deck = (): Promise<DeckHolding> => sets.joinForDeck(tune('a'), source('a'));

        let holding: DeckHolding;
        if (order === 'card first') {
          const started = [card(), deck()] as const;
          holding = (await Promise.all(started))[1];
        } else {
          const started = [deck(), card()] as const;
          holding = (await Promise.all(started))[0];
        }

        expect(current().rows).toHaveLength(1);
        expect(holding.rowId).toBe(current().rows[0].id);
      }
    );

    it('joins the set that is current after its awaits, not the one that was when it began', async () => {
      const first = current().id;
      sets.newSet();
      const second = current().id;
      await sets.openSet(first);
      const gate = deferred<null>();
      vi.spyOn(memoryStore, 'load').mockImplementationOnce(() => gate.promise);

      const joining = sets.joinForDeck(tune('a'), source('a'));
      await settle();
      await sets.openSet(second);
      gate.resolve(null);
      const holding = await joining;
      await flushSaves();

      expect(holding.setId).toBe(second);
      expect(current().rows).toHaveLength(1);
      expect((await saved(first))?.rows).toHaveLength(0);
    });

    it('reports a row\'s holding at its last subtune, from the open set or the detached copy', async () => {
      const holding = await hold('a');
      const rowId = holding.rowId;

      expect(sets.holdingFor(current().id, rowId)).toEqual(holding);
      expect(sets.rowOf(holding)?.id).toBe(rowId);

      sets.removeRow(rowId);

      expect(sets.rowOf(holding)?.id).toBe(rowId);
      expect(sets.holdingFor(current().id, 'unknown')).toBeNull();
    });

    it('keeps markers, settings and the last subtune of a row, and copies them to the next set', async () => {
      const reference = tune('a', 3);
      const holding = await sets.joinForDeck(reference, source('a'));
      sets.hold('A', holding);
      const positions = sets.positionsFor(holding);

      await positions.save({ sidHash: 'hash-a', subtune: 1 }, [MARKER]);
      sets.saveSubtuneSettings(holding, { gain: 0.5 });
      const moved = sets.selectSubtune(holding, 2);
      await flushSaves();

      expect(moved).toEqual({ ...holding, subtune: 2 });
      expect(sets.subtuneSettingsOf(holding)).toEqual({ gain: 0.5 });
      const loaded = await positions.load({ sidHash: 'hash-a', subtune: 1 });
      expect(loaded).toEqual([MARKER]);
      expect(loaded).not.toBe(sets.rowOf(holding)?.subtunes[0].markers);
      expect(await positions.load({ sidHash: 'hash-a', subtune: 2 })).toEqual([]);
      expect((await saved(holding.setId))?.rows[0]).toMatchObject({ lastSubtune: 2 });
      expect(await memoryStore.load('hash-a')).toMatchObject({ lastSubtune: 2 });

      sets.newSet();
      await add('a');

      expect(current().rows[0].copiedFrom?.sidHash).toBe('hash-a');
      expect(current().rows[0].lastSubtune).toBe(2);
      expect(current().rows[0].subtunes[0].markers).toEqual([MARKER]);
    });

    it('keeps what a deck holds when its row is removed, saving the tune memory only', async () => {
      const saveSpy = vi.spyOn(setStore, 'save');
      const holding = await hold('a');
      sets.removeRow(holding.rowId);
      await flushSaves();
      saveSpy.mockClear();

      await sets.positionsFor(holding).save({ sidHash: 'hash-a', subtune: 1 }, [MARKER]);
      await flushSaves();

      expect(saveSpy).not.toHaveBeenCalled();
      expect((await memoryStore.load('hash-a'))?.subtunes[0].markers).toEqual([MARKER]);
      expect(sets.rowOf(holding)?.subtunes[0].markers).toEqual([MARKER]);
    });

    it('closes the open sets and detached copies nothing references once a deck lets go', async () => {
      const holding = await hold('a');
      const first = current().id;
      sets.newSet();

      expect(Object.keys(store.sets.open())).toContain(first);

      sets.hold('A', null);

      expect(Object.keys(store.sets.open())).not.toContain(first);
      expect(sets.rowOf(holding)).toBeNull();
    });

    it('marks a row unavailable and available again', async () => {
      await add('a');
      const rowId = current().rows[0].id;

      sets.markUnavailable(rowId, 'file missing');
      expect(store.sets.prep()[rowId]).toEqual({ phase: 'unavailable', reason: 'file missing' });

      sets.markAvailable(rowId);
      expect(store.sets.prep()[rowId]).toBeUndefined();
    });
  });

  describe('opening sets', () => {
    beforeEach(async () => {
      await sets.hydrate();
      await flushSaves();
    });

    it('loads a saved set from the server, selecting its first row', async () => {
      await add('a');
      const first = current().id;
      sets.newSet();
      await flushSaves();
      const loadSpy = vi.spyOn(setStore, 'load');

      await sets.openSet(first);

      expect(loadSpy).toHaveBeenCalledWith(first);
      expect(current().id).toBe(first);
      expect(store.sets.selectedRowId()).toBe(current().rows[0].id);
      expect(Object.keys(store.sets.open())).toEqual([first]);
    });

    it('warns and changes nothing when the set cannot be loaded', async () => {
      const before = store.sets.currentSetId();

      await sets.openSet('missing');

      expect(alerts.warning).toHaveBeenCalledWith('That set could not be loaded.');
      expect(store.sets.currentSetId()).toBe(before);
    });

    it('uses the open copy of a set a deck holds, rather than the server\'s older one', async () => {
      const holding = await hold('a');
      sets.newSet();
      const loadSpy = vi.spyOn(setStore, 'load');

      await sets.openSet(holding.setId);

      expect(loadSpy).not.toHaveBeenCalled();
      expect(current().rows).toHaveLength(1);
      expect(Object.keys(store.sets.open())).toEqual([holding.setId]);
    });

    it('re-opens a set closed moments ago from its pending copy, not the server\'s', async () => {
      await add('a');
      const first = current().id;
      sets.newSet();
      const loadSpy = vi.spyOn(setStore, 'load');

      await sets.openSet(first);

      expect(loadSpy).not.toHaveBeenCalled();
      expect(current().rows).toHaveLength(1);
    });

    it('waits for a flush in flight before it loads', async () => {
      const first = current().id;
      sets.newSet();
      await flushSaves();
      const gate = deferred();
      const saveSpy = vi.spyOn(setStore, 'save');
      saveSpy.mockImplementationOnce(async (set) => {
        await gate.promise;
        await InMemorySetStore.prototype.save.call(setStore, set);
      });
      sets.renameCurrent('Newer');
      await flushSaves();
      const loadSpy = vi.spyOn(setStore, 'load');

      const opening = sets.openSet(first);
      await settle();

      expect(loadSpy).not.toHaveBeenCalled();

      gate.resolve();
      await opening;

      expect(loadSpy).toHaveBeenCalledWith(first);
    });
  });

  describe('deleting', () => {
    beforeEach(async () => {
      await sets.hydrate();
      await flushSaves();
    });

    it('deletes on the server, detaches held rows and starts a fresh set', async () => {
      const holding = await hold('a');
      await flushSaves();
      const doomed = current();
      const deleteSpy = vi.spyOn(setStore, 'delete');
      const memorySpy = vi.spyOn(memoryStore, 'save');

      await sets.deleteCurrent();

      expect(deleteSpy).toHaveBeenCalledWith(doomed.id);
      expect(store.sets.summaries().map((summary) => summary.id)).not.toContain(doomed.id);
      expect(current().id).not.toBe(doomed.id);
      expect(current().name).toBe('Set 1');
      expect(store.sets.announcement()?.text).toBe(`Deleted ${doomed.name}`);
      expect(sets.rowOf(holding)?.id).toBe(holding.rowId);

      await sets.positionsFor(holding).save({ sidHash: 'hash-a', subtune: 1 }, [MARKER]);
      await flushSaves();

      expect(await saved(doomed.id)).toBeNull();
      expect(memorySpy).toHaveBeenCalledTimes(1);
      expect(libraryState.stored).toBe(current().id);
    });

    it('sends no PUT of the set after the DELETE when a flush is in flight', async () => {
      const id = current().id;
      const saveSpy = vi.spyOn(setStore, 'save');
      const deleteSpy = vi.spyOn(setStore, 'delete');
      const gate = deferred();
      saveSpy.mockImplementationOnce(() => gate.promise);
      sets.renameCurrent('One');
      await flushSaves();
      sets.renameCurrent('Two');

      const deleting = sets.deleteCurrent();
      await settle();

      expect(deleteSpy).not.toHaveBeenCalled();

      gate.resolve();
      await deleting;
      await flushSaves();

      const lastPut = Math.max(...saveSpy.mock.invocationCallOrder.filter((_, i) => saveSpy.mock.calls[i][0].id === id));
      expect(lastPut).toBeLessThan(deleteSpy.mock.invocationCallOrder[0]);
      expect(await saved(id)).toBeNull();
    });

    it('drops a queued copy so a deleted set cannot reappear', async () => {
      const id = current().id;
      const saveSpy = vi.spyOn(setStore, 'save');
      sets.renameCurrent('Never saved');

      await sets.deleteCurrent();
      await flushSaves();

      expect(saveSpy.mock.calls.map(([set]) => set.id)).not.toContain(id);
      expect(await saved(id)).toBeNull();
    });

    it('restores the set and re-queues its latest copy when the delete fails', async () => {
      const id = current().id;
      sets.renameCurrent('Edited');
      vi.spyOn(setStore, 'delete').mockRejectedValueOnce(new Error('500'));

      await sets.deleteCurrent();

      expect(alerts.error).toHaveBeenCalledTimes(1);
      expect(current().id).toBe(id);

      await flushSaves();

      expect((await saved(id))?.name).toBe('Edited');
    });

    describe('with a deck edit during the in-flight DELETE', () => {
      async function startDelete() {
        const holding = await hold('a');
        await flushSaves();
        const gate = deferred();
        vi.spyOn(setStore, 'delete').mockImplementationOnce(() => gate.promise);
        const saveSpy = vi.spyOn(setStore, 'save');
        saveSpy.mockClear();
        const setId = current().id;

        const deleting = sets.deleteCurrent();
        await settle();
        await sets.positionsFor(holding).save({ sidHash: 'hash-a', subtune: 1 }, [MARKER]);
        await flushSaves();

        return { holding, gate, deleting, saveSpy, setId };
      }

      it('queues only the memory, and carries the edit into the deck\'s copy on success', async () => {
        const { holding, gate, deleting, saveSpy, setId } = await startDelete();

        expect(saveSpy).not.toHaveBeenCalled();
        expect((await memoryStore.load('hash-a'))?.subtunes[0].markers).toEqual([MARKER]);

        gate.resolve();
        await deleting;
        await flushSaves();

        expect(sets.rowOf(holding)?.subtunes[0].markers).toEqual([MARKER]);
        expect(saveSpy.mock.calls.map(([set]) => set.id)).not.toContain(setId);
      });

      it('re-queues the set with the edit when the delete fails', async () => {
        const { gate, deleting, setId } = await startDelete();

        gate.reject(new Error('500'));
        await deleting;
        await flushSaves();

        expect((await saved(setId))?.rows[0].subtunes[0].markers).toEqual([MARKER]);
        expect(current().id).toBe(setId);
      });
    });
  });

  describe('limits', () => {
    beforeEach(async () => {
      await sets.hydrate();
    });

    it('refuses a new set at the sets limit', () => {
      const summaries = Array.from({ length: MAX_SETS }, (_, i) => ({
        id: `set-${i}`,
        name: `Set ${i + 1}`,
        rowCount: 0,
        updated: '2026-01-01T00:00:00.000Z',
      }));
      store.setSetsLibrary({ summaries, current: current() });
      const before = current().id;

      sets.newSet();

      expect(alerts.warning).toHaveBeenCalledWith(expect.stringContaining(String(MAX_SETS)));
      expect(store.sets.summaries()).toHaveLength(MAX_SETS);
      expect(current().id).toBe(before);
    });

    it('refuses a tune on a full set, from the card and from a deck', async () => {
      const rows = Array.from({ length: MAX_ROWS_PER_SET }, (_, i) =>
        createRow({
          id: `row-${i}`,
          tune: { sidHash: `full-${i}`, title: `T${i}`, author: '', released: '', subtuneCount: 1, byteLength: 1 },
          memory: null,
          startSubtune: 1,
        })
      );
      store.putOpenSet({ set: { ...current(), rows } });

      await add('a');

      expect(alerts.warning).toHaveBeenCalledWith(expect.stringContaining(String(MAX_ROWS_PER_SET)));
      expect(store.sets.pending()).toEqual([]);
      expect(current().rows).toHaveLength(MAX_ROWS_PER_SET);

      await expect(sets.joinForDeck(tune('a'), source('a'))).rejects.toThrow(
        String(MAX_ROWS_PER_SET)
      );
      expect(alerts.warning).toHaveBeenCalledTimes(2);
      expect(current().rows).toHaveLength(MAX_ROWS_PER_SET);
    });
  });
});
