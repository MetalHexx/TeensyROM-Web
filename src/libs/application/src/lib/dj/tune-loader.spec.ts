import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, Subject } from 'rxjs';
import type { Playable, TuneIdentity, TuneReference } from '@sidablist/tunes';
import type { TuneIndexRecord } from '@sidablist/analysis';
import {
  FILE_CONTENT_SERVICE,
  StorageType,
  type FileContent,
  type IFileContentService,
} from '@teensyrom-nx/domain';
import { TuneLoader, type LoadPhase } from './tune-loader';
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
  let phases: Array<[Parameters<LoadPhase>[0], Parameters<LoadPhase>[1]]>;
  const onPhase: LoadPhase = (phase, reference) => phases.push([phase, reference]);

  beforeEach(() => {
    phases = [];
    fileContentService = { getFileContent: vi.fn() };
    inserter = { insert: vi.fn() };
    resolver = { resolve: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        TuneLoader,
        DjStore,
        { provide: FILE_CONTENT_SERVICE, useValue: fileContentService as unknown as IFileContentService },
        { provide: TUNE_INSERTER, useValue: inserter },
        { provide: TUNE_RESOLVER, useValue: resolver },
      ],
    });

    loader = TestBed.inject(TuneLoader);
    store = TestBed.inject(DjStore);
  });

  it('fetches and inserts on first sight, reporting indexing when the resolver actually scans', async () => {
    const reference = tuneReference();
    fileContentService.getFileContent.mockReturnValue(of(fileContentFor('a.sid')));
    inserter.insert.mockResolvedValue(reference);
    resolver.resolve.mockImplementation(async (_identity: TuneIdentity, options?: { onScanStart?: () => void }) => {
      options?.onScanStart?.();
      return playableFor(reference);
    });

    const source = loadSource();
    const result = await loader.load('A', source, onPhase);

    expect(fileContentService.getFileContent).toHaveBeenCalledWith(
      source.deviceId,
      source.storageType,
      source.path
    );
    expect(inserter.insert).toHaveBeenCalledTimes(1);
    expect(inserter.insert.mock.calls[0][0]).toEqual(new Uint8Array([1, 2, 3]));
    expect(resolver.resolve).toHaveBeenCalledWith(reference.identity, { onScanStart: expect.any(Function) });
    expect(result?.reference).toEqual(reference);

    const key = DjFileKeyUtil.create(source.deviceId, source.storageType, source.path);
    expect(store.seen()[key]).toEqual(reference);
    expect(phases).toEqual([
      ['loading', null],
      ['indexing', reference],
    ]);
  });

  it('reports only loading, and no indexing, when a seen-miss resolve is a lookup hit', async () => {
    const reference = tuneReference();
    fileContentService.getFileContent.mockReturnValue(of(fileContentFor('a.sid')));
    inserter.insert.mockResolvedValue(reference);
    resolver.resolve.mockResolvedValue(playableFor(reference));

    const result = await loader.load('A', loadSource(), onPhase);

    expect(result?.reference).toEqual(reference);
    expect(phases).toEqual([['loading', null]]);
  });

  it('skips the fetch and insert once the key has been seen, reporting nothing when the resolver does not scan', async () => {
    const reference = tuneReference({ title: 'Already Seen' });
    const source = loadSource();
    const key = DjFileKeyUtil.create(source.deviceId, source.storageType, source.path);
    store.markSeen({ key, reference });
    resolver.resolve.mockResolvedValue(playableFor(reference));

    const result = await loader.load('A', source, onPhase);

    expect(fileContentService.getFileContent).not.toHaveBeenCalled();
    expect(inserter.insert).not.toHaveBeenCalled();
    expect(resolver.resolve).toHaveBeenCalledWith(reference.identity, { onScanStart: expect.any(Function) });
    expect(result?.reference).toEqual(reference);
    expect(phases).toEqual([]);
  });

  it('reports indexing with no reference on a seen hit whose resolver does scan', async () => {
    const reference = tuneReference({ title: 'Reindexed' });
    const source = loadSource();
    const key = DjFileKeyUtil.create(source.deviceId, source.storageType, source.path);
    store.markSeen({ key, reference });
    resolver.resolve.mockImplementation(async (_identity: TuneIdentity, options?: { onScanStart?: () => void }) => {
      options?.onScanStart?.();
      return playableFor(reference);
    });

    const result = await loader.load('A', source, onPhase);

    expect(result?.reference).toEqual(reference);
    expect(phases).toEqual([['indexing', reference]]);
  });

  it('throws when the resolver reports the bytes are gone', async () => {
    fileContentService.getFileContent.mockReturnValue(of(fileContentFor('a.sid')));
    const reference = tuneReference();
    inserter.insert.mockResolvedValue(reference);
    resolver.resolve.mockResolvedValue(null);

    await expect(loader.load('A', loadSource(), onPhase)).rejects.toThrow(
      'tune bytes are no longer available — drop it again'
    );
  });

  it('a second load on the same slot supersedes a fetch already in flight', async () => {
    const referenceA = tuneReference({ identity: { sidHash: 'hash-a', subtune: 1 } });
    const referenceB = tuneReference({ identity: { sidHash: 'hash-b', subtune: 1 } });
    const fetchA = new Subject<FileContent>();
    const fetchB = new Subject<FileContent>();
    fileContentService.getFileContent.mockImplementation((_deviceId: string, _storageType: StorageType, path: string) =>
      path === '/a.sid' ? fetchA.asObservable() : fetchB.asObservable()
    );
    // Keyed by the delivered bytes rather than call order, since which fetch settles first — and
    // so which `insert`/`resolve` call fires first — is exactly what this test is exercising.
    inserter.insert.mockImplementation(async (bytes: Uint8Array) =>
      bytes[0] === 0xa ? referenceA : referenceB
    );
    resolver.resolve.mockImplementation(async (identity: TuneIdentity) =>
      identity.sidHash === referenceA.identity.sidHash ? playableFor(referenceA) : playableFor(referenceB)
    );

    const first = loader.load('A', loadSource({ path: '/a.sid' }), onPhase);
    const second = loader.load('A', loadSource({ path: '/b.sid' }), onPhase);

    fetchB.next({ bytes: new Uint8Array([0xb]).buffer, byteLength: 1, fileName: 'b.sid' });
    fetchB.complete();
    fetchA.next({ bytes: new Uint8Array([0xa]).buffer, byteLength: 1, fileName: 'a.sid' });
    fetchA.complete();

    const [firstResult, secondResult] = await Promise.all([first, second]);

    expect(firstResult).toBeNull();
    expect(secondResult?.reference).toEqual(referenceB);
  });

  it('a second load on the same slot supersedes a resolve already in flight', async () => {
    const referenceA = tuneReference({ identity: { sidHash: 'hash-a', subtune: 1 } });
    const referenceB = tuneReference({ identity: { sidHash: 'hash-b', subtune: 1 } });
    fileContentService.getFileContent.mockReturnValue(of(fileContentFor('a.sid')));
    inserter.insert.mockResolvedValueOnce(referenceA);

    let resolveFirst!: (playable: Playable | null) => void;
    resolver.resolve.mockReturnValueOnce(
      new Promise<Playable | null>((resolve) => {
        resolveFirst = resolve;
      })
    );

    const first = loader.load('A', loadSource({ path: '/a.sid' }), onPhase);
    await vi.waitFor(() => expect(resolver.resolve).toHaveBeenCalledTimes(1));

    inserter.insert.mockResolvedValueOnce(referenceB);
    resolver.resolve.mockResolvedValueOnce(playableFor(referenceB));
    const second = loader.load('A', loadSource({ path: '/b.sid' }), onPhase);

    resolveFirst(playableFor(referenceA));

    const [firstResult, secondResult] = await Promise.all([first, second]);

    expect(firstResult).toBeNull();
    expect(secondResult?.reference).toEqual(referenceB);
  });

  it('resolveSubtune is superseded by a later load on the same slot', async () => {
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
    resolver.resolve.mockResolvedValueOnce(playableFor(referenceB));
    const load = loader.load('A', loadSource({ path: '/b.sid' }), onPhase);

    resolveSubtuneResolve(playableFor(tuneReference({ identity })));

    const [subtuneResult, loadResult] = await Promise.all([pendingSubtune, load]);

    expect(subtuneResult).toBeNull();
    expect(loadResult?.reference).toEqual(referenceB);
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
});
