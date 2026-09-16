import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ALERT_SERVICE, IAlertService } from '@teensyrom-nx/domain';
import { DjDatabase, DJ_DATABASE_NAME, TUNES_STORE, DECK_BINDINGS_STORE } from './dj-database';

describe('DjDatabase', () => {
  let mockAlertService: Partial<IAlertService>;
  let currentDb: IDBDatabase | null = null;

  beforeEach(() => {
    mockAlertService = { warning: vi.fn() };
    currentDb = null;

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [DjDatabase, { provide: ALERT_SERVICE, useValue: mockAlertService }],
    });
  });

  afterEach(async () => {
    currentDb?.close();
    currentDb = null;
    vi.restoreAllMocks();

    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase(DJ_DATABASE_NAME);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
      request.onblocked = () => resolve();
    });
  });

  it('creates the tunes and deck-bindings stores with the right key paths on upgrade', async () => {
    const database = TestBed.inject(DjDatabase);
    const db = await database.open();
    currentDb = db;

    expect(db).not.toBeNull();
    expect(db?.objectStoreNames.contains(TUNES_STORE)).toBe(true);
    expect(db?.objectStoreNames.contains(DECK_BINDINGS_STORE)).toBe(true);

    const tx = db?.transaction([TUNES_STORE, DECK_BINDINGS_STORE], 'readonly');
    expect(tx?.objectStore(TUNES_STORE).keyPath).toBe('sidHash');
    expect(tx?.objectStore(DECK_BINDINGS_STORE).keyPath).toBe('slot');
  });

  it('memoises the open across repeated calls', async () => {
    const database = TestBed.inject(DjDatabase);
    const first = await database.open();
    const second = await database.open();
    currentDb = first;

    expect(first).not.toBeNull();
    expect(first).toBe(second);
  });

  describe('the promise wrapper', () => {
    it('put then get round-trips a value by key', async () => {
      const database = TestBed.inject(DjDatabase);
      currentDb = await database.open();

      const binding = { slot: 'A', midiPortId: 'p1', midiPortName: 'Port 1' };
      await database.put(DECK_BINDINGS_STORE, binding);

      const result = await database.get<typeof binding>(DECK_BINDINGS_STORE, 'A');
      expect(result).toEqual(binding);
    });

    it('get resolves undefined for a missing key', async () => {
      const database = TestBed.inject(DjDatabase);
      currentDb = await database.open();

      const result = await database.get(DECK_BINDINGS_STORE, 'A');
      expect(result).toBeUndefined();
    });

    it('getAll returns every row in the store', async () => {
      const database = TestBed.inject(DjDatabase);
      currentDb = await database.open();

      await database.put(DECK_BINDINGS_STORE, { slot: 'A', midiPortId: null, midiPortName: null });
      await database.put(DECK_BINDINGS_STORE, { slot: 'B', midiPortId: null, midiPortName: null });

      const rows = await database.getAll<{ slot: string }>(DECK_BINDINGS_STORE);
      expect(rows.map((row) => row.slot).sort()).toEqual(['A', 'B']);
    });

    it('update performs a read-modify-write in one transaction', async () => {
      const database = TestBed.inject(DjDatabase);
      currentDb = await database.open();

      await database.put(TUNES_STORE, {
        sidHash: 'hash-1',
        bytes: new ArrayBuffer(1),
        byteLength: 1,
        indexes: {},
      });

      await database.update<{ sidHash: string; indexes: Record<string, unknown> }>(
        TUNES_STORE,
        'hash-1',
        (row) => {
          if (!row) throw new Error('expected an existing row');
          return { ...row, indexes: { ...row.indexes, '0': { ok: true } } };
        }
      );

      const result = await database.get<{ indexes: Record<string, unknown> }>(
        TUNES_STORE,
        'hash-1'
      );
      expect(result?.indexes).toEqual({ '0': { ok: true } });
    });

    it('update rejects when the mutate callback throws, leaving the row untouched', async () => {
      const database = TestBed.inject(DjDatabase);
      currentDb = await database.open();

      await expect(
        database.update(TUNES_STORE, 'missing-hash', () => {
          throw new Error('no row to mutate');
        })
      ).rejects.toThrow('no row to mutate');

      const result = await database.get(TUNES_STORE, 'missing-hash');
      expect(result).toBeUndefined();
    });
  });

  describe('when opening the database fails', () => {
    function stubFailingOpen(): void {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      vi.spyOn(indexedDB, 'open').mockImplementation(() => {
        const request = {} as IDBOpenDBRequest;
        queueMicrotask(() => {
          Object.defineProperty(request, 'error', { value: new Error('boom'), configurable: true });
          request.onerror?.(new Event('error'));
        });
        return request;
      });
    }

    it('resolves open() to null, logs once, and alerts exactly once across repeated calls', async () => {
      stubFailingOpen();
      const database = TestBed.inject(DjDatabase);

      const first = await database.open();
      const second = await database.open();

      expect(first).toBeNull();
      expect(second).toBeNull();
      expect(console.error).toHaveBeenCalledTimes(1);
      expect(mockAlertService.warning).toHaveBeenCalledTimes(1);
      expect(mockAlertService.warning).toHaveBeenCalledWith(expect.any(String));
    });

    it('every wrapper call resolves to its empty value once degraded', async () => {
      stubFailingOpen();
      const database = TestBed.inject(DjDatabase);

      await expect(database.get(DECK_BINDINGS_STORE, 'A')).resolves.toBeUndefined();
      await expect(database.getAll(DECK_BINDINGS_STORE)).resolves.toEqual([]);
      await expect(
        database.put(DECK_BINDINGS_STORE, { slot: 'A' })
      ).resolves.toBeUndefined();
      await expect(
        database.update(DECK_BINDINGS_STORE, 'A', (row) => row)
      ).resolves.toBeUndefined();
    });
  });
});
