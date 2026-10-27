import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal, type WritableSignal } from '@angular/core';
import { of, Subject, throwError } from 'rxjs';
import { createRow, createSet } from '@sidablist/tunes';
import type { Playable, TuneIdentity, TuneReference } from '@sidablist/tunes';
import type { TuneIndexRecord } from '@sidablist/analysis';
import {
  FILE_CONTENT_SERVICE,
  StorageType,
  type Device,
  type FileContent,
  type IFileContentService,
} from '@teensyrom-nx/domain';
import { DeviceStore } from '../device/device-store';
import { RowUnavailableError, TuneLoader, type LoadPhase } from './tune-loader';
import { TUNE_INSERTER, TUNE_RESOLVER } from './ports';
import { DjStore } from './dj-store';
import { DjFileKeyUtil } from './dj-file-key.util';
import type { LoadSource } from './load-source';

function tuneReference(overrides: Partial<TuneReference> = {}): TuneReference {
  return {
    identity: { sidHash: 'hash-1', subtune: 1 },
    title: 'Test Tune',
    author: 'Test Author',
    released: '2024 Test',
    subtuneCount: 1,
    byteLength: 3,
    ...overrides,
  };
}

function indexRecord(identity: TuneIdentity): TuneIndexRecord {
  return {
    sidHash: identity.sidHash,
    subtune: identity.subtune,
    loopStartFrame: null,
    loopPeriodFrames: null,
    endedAtFrame: null,
    sectionBoundaries: [],
    detectedMoments: [],
    tonic: null,
    mode: null,
    camelot: null,
    tuningReferenceHz: null,
    tuningCents: null,
    keyConfidence: 'none',
    scalePitchClasses: [],
    dominantIntervalFrames: null,
    pulseConfidence: 'none',
    nativeTempo: null,
    callsPerFrame: 1,
    exactCallsPerFrame: 1,
    timingMode: 'exact',
    formatVersion: 5,
    computedAt: new Date(0).toISOString(),
  };
}

function playableFor(reference: TuneReference): Playable {
  return {
    reference,
    bytes: new Uint8Array([1, 2, 3]),
    index: indexRecord(reference.identity),
  };
}

function fileContentFor(fileName: string): FileContent {
  return { bytes: new Uint8Array([1, 2, 3]).buffer, byteLength: 3, fileName };
}

function loadSource(overrides: Partial<LoadSource> = {}): LoadSource {
  return {
    deviceId: 'device-1',
    storageType: StorageType.Sd,
    path: '/tunes/a.sid',
    fileName: 'a.sid',
    ...overrides,
  };
}

describe('TuneLoader', () => {
  let loader: TuneLoader;
  let store: InstanceType<typeof DjStore>;
  let fileContentService: { getFileContent: ReturnType<typeof vi.fn> };
  let inserter: { insert: ReturnType<typeof vi.fn> };
  let resolver: { resolve: ReturnType<typeof vi.fn> };
  let usableDevices: WritableSignal<Device[]>;
  let phases: Array<[Parameters<LoadPhase>[0], Parameters<LoadPhase>[1]]>;
  const onPhase: LoadPhase = (phase, reference) => phases.push([phase, reference]);

  beforeEach(() => {
    phases = [];
    fileContentService = { getFileContent: vi.fn() };
    inserter = { insert: vi.fn() };
    resolver = { resolve: vi.fn() };
    usableDevices = signal<Device[]>([{ deviceId: 'device-1' } as Device]);

    TestBed.configureTestingModule({
      providers: [
        TuneLoader,
        DjStore,
        { provide: FILE_CONTENT_SERVICE, useValue: fileContentService as unknown as IFileContentService },
        { provide: TUNE_INSERTER, useValue: inserter },
        { provide: TUNE_RESOLVER, useValue: resolver },
        { provide: DeviceStore, useValue: { usableDevices } },
      ],
    });

    loader = TestBed.inject(TuneLoader);
    store = TestBed.inject(DjStore);
  });

  describe('reference', () => {
    it('fetches and inserts on first sight, marks the file seen and reports loading, never indexing', async () => {
      const reference = tuneReference();
      fileContentService.getFileContent.mockReturnValue(of(fileContentFor('a.sid')));
      inserter.insert.mockResolvedValue(reference);

      const source = loadSource();
      const result = await loader.reference('A', source, onPhase);

      expect(fileContentService.getFileContent).toHaveBeenCalledWith(
        source.deviceId,
        source.storageType,
        source.path
      );
      expect(inserter.insert).toHaveBeenCalledTimes(1);
      expect(inserter.insert.mock.calls[0][0]).toEqual(new Uint8Array([1, 2, 3]));
      expect(result).toEqual(reference);
      expect(store.seen()[DjFileKeyUtil.create(source.deviceId, source.storageType, source.path)]).toEqual(
        reference
      );
      expect(resolver.resolve).not.toHaveBeenCalled();
      expect(phases).toEqual([['loading', null]]);
    });

    it('returns a file seen this session without fetching it, reporting nothing', async () => {
      const reference = tuneReference({ title: 'Already Seen' });
      const source = loadSource();
      store.markSeen({
        key: DjFileKeyUtil.create(source.deviceId, source.storageType, source.path),
        reference,
      });

      const result = await loader.reference('A', source, onPhase);

      expect(result).toEqual(reference);
      expect(fileContentService.getFileContent).not.toHaveBeenCalled();
      expect(inserter.insert).not.toHaveBeenCalled();
      expect(phases).toEqual([]);
    });

    it('lets a failed fetch propagate', async () => {
      fileContentService.getFileContent.mockReturnValue(throwError(() => new Error('offline')));

      await expect(loader.reference('A', loadSource(), onPhase)).rejects.toThrow('offline');
    });

    it('is superseded by a later call on the same slot, whichever fetch settles first', async () => {
      const referenceA = tuneReference({ identity: { sidHash: 'hash-a', subtune: 1 } });
      const referenceB = tuneReference({ identity: { sidHash: 'hash-b', subtune: 1 } });
      const fetchA = new Subject<FileContent>();
      const fetchB = new Subject<FileContent>();
      fileContentService.getFileContent.mockImplementation(
        (_deviceId: string, _storageType: StorageType, path: string) =>
          path === '/a.sid' ? fetchA.asObservable() : fetchB.asObservable()
      );
      // Keyed by the delivered bytes rather than call order, since which fetch settles first is
      // exactly what this test is exercising.
      inserter.insert.mockImplementation(async (bytes: Uint8Array) =>
        bytes[0] === 0xa ? referenceA : referenceB
      );

      const first = loader.reference('A', loadSource({ path: '/a.sid' }), onPhase);
      const second = loader.reference('A', loadSource({ path: '/b.sid' }), onPhase);

      fetchB.next({ bytes: new Uint8Array([0xb]).buffer, byteLength: 1, fileName: 'b.sid' });
      fetchB.complete();
      fetchA.next({ bytes: new Uint8Array([0xa]).buffer, byteLength: 1, fileName: 'a.sid' });
      fetchA.complete();

      await expect(Promise.all([first, second])).resolves.toEqual([null, referenceB]);
    });

    it('resolves null, not an error, when a fetch that was superseded then fails', async () => {
      const failing = new Subject<FileContent>();
      fileContentService.getFileContent.mockImplementation(
        (_deviceId: string, _storageType: StorageType, path: string) =>
          path === '/a.sid' ? failing.asObservable() : of(fileContentFor('b.sid'))
      );
      inserter.insert.mockResolvedValue(tuneReference());

      const first = loader.reference('A', loadSource({ path: '/a.sid' }), onPhase);
      await loader.reference('A', loadSource({ path: '/b.sid' }), onPhase);
      failing.error(new Error('offline'));

      await expect(first).resolves.toBeNull();
    });
  });

  describe('resolveRow', () => {
    const identity: TuneIdentity = { sidHash: 'hash-1', subtune: 2 };

    it('resolves a cached tune without fetching it, reporting nothing when the resolver does not scan', async () => {
      resolver.resolve.mockResolvedValue(playableFor(tuneReference({ identity })));

      const result = await loader.resolveRow('A', identity, loadSource(), onPhase);

      expect(result?.reference.identity).toEqual(identity);
      expect(resolver.resolve).toHaveBeenCalledWith(identity, { onScanStart: expect.any(Function) });
      expect(fileContentService.getFileContent).not.toHaveBeenCalled();
      expect(phases).toEqual([]);
    });

    it('reports indexing with no reference when the resolver scans a cached tune', async () => {
      resolver.resolve.mockImplementation(
        async (_identity: TuneIdentity, options?: { onScanStart?: () => void }) => {
          options?.onScanStart?.();
          return playableFor(tuneReference({ identity }));
        }
      );

      await loader.resolveRow('A', identity, null, onPhase);

      expect(phases).toEqual([['indexing', null]]);
    });

    it('on a miss fetches from the source, inserts, marks the file seen and resolves it', async () => {
      const reference = tuneReference();
      const source = loadSource();
      fileContentService.getFileContent.mockReturnValue(of(fileContentFor('a.sid')));
      inserter.insert.mockResolvedValue(reference);
      resolver.resolve
        .mockResolvedValueOnce(null)
        .mockImplementationOnce(async (_identity: TuneIdentity, options?: { onScanStart?: () => void }) => {
          options?.onScanStart?.();
          return playableFor(tuneReference({ identity }));
        });

      const result = await loader.resolveRow('A', identity, source, onPhase);

      expect(result?.reference.identity).toEqual(identity);
      expect(fileContentService.getFileContent).toHaveBeenCalledWith(
        source.deviceId,
        source.storageType,
        source.path
      );
      expect(store.seen()[DjFileKeyUtil.create(source.deviceId, source.storageType, source.path)]).toEqual(
        reference
      );
      expect(phases).toEqual([
        ['loading', null],
        ['indexing', reference],
      ]);
    });

    describe('on a miss that cannot be fetched', () => {
      beforeEach(() => {
        resolver.resolve.mockResolvedValue(null);
      });

      it('names the title when the row does not say where the file was found', async () => {
        const row = createRow({
          id: 'row-1',
          tune: {
            sidHash: identity.sidHash,
            title: 'Commando',
            author: 'Hubbard',
            released: '1985',
            subtuneCount: 3,
            byteLength: 3,
          },
          memory: null,
          startSubtune: 1,
        });
        store.putOpenSet({
          set: { ...createSet({ id: 'set-1', placeholder: 'Set 1', now: '2026-01-01T00:00:00.000Z' }), rows: [row] },
        });

        const failure = await loader.resolveRow('A', identity, null, onPhase).catch((e: unknown) => e);

        expect(failure).toBeInstanceOf(RowUnavailableError);
        expect((failure as Error).message).toBe(
          'Commando is not cached and where it was found is unknown'
        );
        expect(fileContentService.getFileContent).not.toHaveBeenCalled();
      });

      it('names the file and the device when the device is not connected, and fetches nothing', async () => {
        usableDevices.set([{ deviceId: 'device-2' } as Device]);

        const failure = await loader
          .resolveRow('A', identity, loadSource({ fileName: 'a.sid' }), onPhase)
          .catch((e: unknown) => e);

        expect(failure).toBeInstanceOf(RowUnavailableError);
        expect((failure as Error).message).toBe('a.sid is not cached and device-1 is not connected');
        expect(fileContentService.getFileContent).not.toHaveBeenCalled();
        expect(phases).toEqual([]);
      });

      it('names the file and the reason when the fetch fails', async () => {
        fileContentService.getFileContent.mockReturnValue(throwError(() => new Error('offline')));

        const failure = await loader.resolveRow('A', identity, loadSource(), onPhase).catch((e: unknown) => e);

        expect(failure).toBeInstanceOf(RowUnavailableError);
        expect((failure as Error).message).toBe('a.sid could not be fetched: offline');
      });

      it('names the file and the device when the fetched file is not the row\'s tune', async () => {
        fileContentService.getFileContent.mockReturnValue(of(fileContentFor('a.sid')));
        inserter.insert.mockResolvedValue(tuneReference({ identity: { sidHash: 'hash-other', subtune: 1 } }));

        const failure = await loader.resolveRow('A', identity, loadSource(), onPhase).catch((e: unknown) => e);

        expect(failure).toBeInstanceOf(RowUnavailableError);
        expect((failure as Error).message).toBe('a.sid on device-1 has changed since it was added');
      });
    });

    it('lets a scan failure after the bytes are in hand through as an ordinary error', async () => {
      fileContentService.getFileContent.mockReturnValue(of(fileContentFor('a.sid')));
      inserter.insert.mockResolvedValue(tuneReference());
      resolver.resolve.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('scan failed'));

      const failure = await loader.resolveRow('A', identity, loadSource(), onPhase).catch((e: unknown) => e);

      expect(failure).toBeInstanceOf(Error);
      expect(failure).not.toBeInstanceOf(RowUnavailableError);
      expect((failure as Error).message).toBe('scan failed');
    });

    it('lets a failed insert through as an ordinary error', async () => {
      fileContentService.getFileContent.mockReturnValue(of(fileContentFor('a.sid')));
      inserter.insert.mockRejectedValue(new Error('not a SID file'));
      resolver.resolve.mockResolvedValue(null);

      const failure = await loader.resolveRow('A', identity, loadSource(), onPhase).catch((e: unknown) => e);

      expect(failure).not.toBeInstanceOf(RowUnavailableError);
      expect((failure as Error).message).toBe('not a SID file');
    });

    it('throws when the bytes are still gone after the fetch', async () => {
      fileContentService.getFileContent.mockReturnValue(of(fileContentFor('a.sid')));
      inserter.insert.mockResolvedValue(tuneReference());
      resolver.resolve.mockResolvedValue(null);

      await expect(loader.resolveRow('A', identity, loadSource(), onPhase)).rejects.toThrow(
        'tune bytes are no longer available — drop it again'
      );
    });

    it('is superseded by a later call on the same slot while it resolves', async () => {
      const referenceB = tuneReference({ identity: { sidHash: 'hash-b', subtune: 1 } });
      let resolveFirst!: (playable: Playable | null) => void;
      resolver.resolve.mockReturnValueOnce(
        new Promise<Playable | null>((resolve) => {
          resolveFirst = resolve;
        })
      );

      const first = loader.resolveRow('A', identity, loadSource(), onPhase);
      await vi.waitFor(() => expect(resolver.resolve).toHaveBeenCalledTimes(1));
      resolver.resolve.mockResolvedValueOnce(playableFor(referenceB));
      const second = loader.resolveRow('A', referenceB.identity, loadSource(), onPhase);
      resolveFirst(playableFor(tuneReference({ identity })));

      const [firstResult, secondResult] = await Promise.all([first, second]);

      expect(firstResult).toBeNull();
      expect(secondResult?.reference).toEqual(referenceB);
    });

    it('is superseded while it fetches, and then neither inserts nor throws', async () => {
      const fetching = new Subject<FileContent>();
      fileContentService.getFileContent.mockReturnValue(fetching.asObservable());
      resolver.resolve.mockResolvedValueOnce(null);

      const first = loader.resolveRow('A', identity, loadSource(), onPhase);
      await vi.waitFor(() => expect(fileContentService.getFileContent).toHaveBeenCalledTimes(1));
      resolver.resolve.mockResolvedValueOnce(playableFor(tuneReference({ identity })));
      await loader.resolveRow('A', identity, loadSource(), onPhase);
      fetching.next(fileContentFor('a.sid'));
      fetching.complete();

      await expect(first).resolves.toBeNull();
      expect(inserter.insert).not.toHaveBeenCalled();
    });
  });

  it('resolveSubtune is superseded by a later reference on the same slot', async () => {
    const identity: TuneIdentity = { sidHash: 'hash-a', subtune: 2 };
    let resolveSubtuneResolve!: (playable: Playable | null) => void;
    resolver.resolve.mockReturnValueOnce(
      new Promise<Playable | null>((resolve) => {
        resolveSubtuneResolve = resolve;
      })
    );

    const pendingSubtune = loader.resolveSubtune('A', identity, onPhase);
    await vi.waitFor(() => expect(resolver.resolve).toHaveBeenCalledTimes(1));

    const referenceB = tuneReference({ identity: { sidHash: 'hash-b', subtune: 1 } });
    fileContentService.getFileContent.mockReturnValue(of(fileContentFor('b.sid')));
    inserter.insert.mockResolvedValueOnce(referenceB);
    const reference = loader.reference('A', loadSource({ path: '/b.sid' }), onPhase);

    resolveSubtuneResolve(playableFor(tuneReference({ identity })));

    const [subtuneResult, referenceResult] = await Promise.all([pendingSubtune, reference]);

    expect(subtuneResult).toBeNull();
    expect(referenceResult).toEqual(referenceB);
  });

  it('resolveSubtune reports indexing with a null reference when the resolver scans', async () => {
    const identity: TuneIdentity = { sidHash: 'hash-a', subtune: 2 };
    resolver.resolve.mockImplementation(async (_identity: TuneIdentity, options?: { onScanStart?: () => void }) => {
      options?.onScanStart?.();
      return playableFor(tuneReference({ identity }));
    });

    const result = await loader.resolveSubtune('A', identity, onPhase);

    expect(resolver.resolve).toHaveBeenCalledWith(identity, { onScanStart: expect.any(Function) });
    expect(result?.reference.identity).toEqual(identity);
    expect(phases).toEqual([['indexing', null]]);
  });

  it('resolveSubtune reports nothing when the resolver does not scan', async () => {
    const identity: TuneIdentity = { sidHash: 'hash-a', subtune: 2 };
    resolver.resolve.mockResolvedValue(playableFor(tuneReference({ identity })));

    const result = await loader.resolveSubtune('A', identity, onPhase);

    expect(result?.reference.identity).toEqual(identity);
    expect(phases).toEqual([]);
  });
  describe('fetchReference', () => {
    it('fetches, inserts and marks the file seen, without touching a slot', async () => {
      const reference = tuneReference();
      fileContentService.getFileContent.mockReturnValue(of(fileContentFor('a.sid')));
      inserter.insert.mockResolvedValue(reference);

      const source = loadSource();
      const result = await loader.fetchReference(source);

      expect(result).toEqual(reference);
      expect(fileContentService.getFileContent).toHaveBeenCalledWith(
        source.deviceId,
        source.storageType,
        source.path
      );
      const key = DjFileKeyUtil.create(source.deviceId, source.storageType, source.path);
      expect(store.seen()[key]).toEqual(reference);
      expect(resolver.resolve).not.toHaveBeenCalled();
    });

    it('returns a file seen this session without fetching it again', async () => {
      const reference = tuneReference({ title: 'Already Seen' });
      const source = loadSource();
      store.markSeen({
        key: DjFileKeyUtil.create(source.deviceId, source.storageType, source.path),
        reference,
      });

      const result = await loader.fetchReference(source);

      expect(result).toEqual(reference);
      expect(fileContentService.getFileContent).not.toHaveBeenCalled();
      expect(inserter.insert).not.toHaveBeenCalled();
    });

    it('is not superseded by a load on a slot', async () => {
      const setReference = tuneReference({ identity: { sidHash: 'hash-set', subtune: 1 } });
      const deckReference = tuneReference({ identity: { sidHash: 'hash-deck', subtune: 1 } });
      const setFetch = new Subject<FileContent>();
      fileContentService.getFileContent.mockImplementation(
        (_deviceId: string, _storageType: StorageType, path: string) =>
          path === '/set.sid' ? setFetch.asObservable() : of(fileContentFor('deck.sid'))
      );
      inserter.insert.mockImplementation(async (bytes: Uint8Array) =>
        bytes[0] === 9 ? setReference : deckReference
      );
      resolver.resolve.mockResolvedValue(playableFor(deckReference));

      const pending = loader.fetchReference(loadSource({ path: '/set.sid' }));
      await loader.reference('A', loadSource({ path: '/deck.sid' }), onPhase);
      setFetch.next({ bytes: new Uint8Array([9]).buffer, byteLength: 1, fileName: 'set.sid' });
      setFetch.complete();

      await expect(pending).resolves.toEqual(setReference);
    });

    it('lets a failed fetch propagate', async () => {
      fileContentService.getFileContent.mockReturnValue(throwError(() => new Error('offline')));

      await expect(loader.fetchReference(loadSource())).rejects.toThrow('offline');
    });
  });

  describe('analyze', () => {
    it('resolves the identity, reporting a real scan through onScanStart', async () => {
      const identity: TuneIdentity = { sidHash: 'hash-a', subtune: 2 };
      const onScanStart = vi.fn();
      resolver.resolve.mockImplementation(async (_identity: TuneIdentity, options?: { onScanStart?: () => void }) => {
        options?.onScanStart?.();
        return playableFor(tuneReference({ identity }));
      });

      const result = await loader.analyze(identity, onScanStart);

      expect(result.reference.identity).toEqual(identity);
      expect(onScanStart).toHaveBeenCalledTimes(1);
    });

    it('does not report a scan for a lookup hit', async () => {
      const identity: TuneIdentity = { sidHash: 'hash-a', subtune: 1 };
      const onScanStart = vi.fn();
      resolver.resolve.mockResolvedValue(playableFor(tuneReference({ identity })));

      await loader.analyze(identity, onScanStart);

      expect(onScanStart).not.toHaveBeenCalled();
    });

    it('throws when the bytes are gone', async () => {
      resolver.resolve.mockResolvedValue(null);

      await expect(loader.analyze({ sidHash: 'hash-a', subtune: 1 }, vi.fn())).rejects.toThrow(
        'tune bytes are no longer available — drop it again'
      );
    });
  });
});
