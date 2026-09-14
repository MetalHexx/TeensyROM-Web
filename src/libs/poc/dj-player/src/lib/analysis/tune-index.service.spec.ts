import { TestBed } from '@angular/core/testing';
import { createEnvironmentInjector, EnvironmentInjector } from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// The ladder and detectors are the package's own — `index-tune.spec.ts` in `@sidablist/analysis`
// proves those. This suite mocks `indexTune` itself so it stays about the service's own wiring: the
// cache, the generation guard, `publish`, `setTimingMode` and settle behaviour.
const indexTuneMock = vi.hoisted(() => vi.fn());
vi.mock('@sidablist/analysis', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@sidablist/analysis')>()),
  indexTune: indexTuneMock,
}));

import { TuneIndexService } from './tune-index.service';
import { SharedTuneIndex } from './shared-tune-index';
import { DECK_PLAYER_VIEW, SID_PLAYER } from '../deck/deck-player';
import { ANALYSIS_SCANNER } from './scan-runner';
import { TUNE_INDEX_STORAGE } from './tune-index-storage';
import type { ITuneIndexStorage } from './tune-index-storage';
import { TUNE_INDEX_FORMAT_VERSION } from '@sidablist/analysis';
import type { TuneIndexRecord } from '@sidablist/analysis';
import { frames, microseconds } from '@sidablist/core';
import type { SidFile } from '@sidablist/core';
import { createFakeDeckPlayer } from '../../testing/player-doubles';
import type { FakeDeckPlayer } from '../../testing/player-doubles';

/** What `publish` hands the player for a record — the shape the service converts a stored record's
 *  plain frame numbers into. */
function trackStructureOf(record: TuneIndexRecord | null) {
  return record === null
    ? null
    : {
        loopStartFrame: record.loopStartFrame === null ? null : frames(record.loopStartFrame),
        loopPeriodFrames: record.loopPeriodFrames === null ? null : frames(record.loopPeriodFrames),
        endedAtFrame: record.endedAtFrame === null ? null : frames(record.endedAtFrame),
      };
}

/** Moves the player's snapshot to `subtune` — the one narrowed read the refresh effect fires on. */
function setSubtune(player: FakeDeckPlayer, subtune: number): void {
  player.snapshot.update((snapshot) => ({
    ...snapshot,
    tune: { subtune, subtuneCount: 4, lengthFrames: null },
  }));
}

interface StubScanner {
  scan: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
}

interface StubStorage {
  load: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
}

function makePlayer(): FakeDeckPlayer {
  const fake = createFakeDeckPlayer();
  fake.snapshot.update((snapshot) => ({
    ...snapshot,
    tune: { subtune: 1, subtuneCount: 4, lengthFrames: null },
    tempo: {
      ...snapshot.tempo,
      nominalIntervalUs: microseconds(19_950),
      callsPerFrame: 2,
      rate: {
        callsPerFrame: 2.4,
        exactCallsPerFrame: 2.4,
        roundedCallsPerFrame: 2,
        mode: 'exact',
      },
      timingMode: 'exact',
    },
  }));
  return fake;
}

function makeScanner(): StubScanner {
  return { scan: vi.fn(), dispose: vi.fn() };
}

function makeStorage(): StubStorage {
  return { load: vi.fn(() => null), save: vi.fn() };
}

function fakeSidFile(overrides: Partial<SidFile> = {}): SidFile {
  return {
    format: 'PSID',
    version: 2,
    loadAddress: 0x1000,
    initAddress: 0x1000,
    playAddress: 0x1003,
    songs: 1,
    startSong: 1,
    speedFlags: 0,
    name: 'Test Tune',
    author: 'Test Author',
    released: '2026',
    clock: 'pal',
    model: 'mos6581',
    secondSidAddress: null,
    thirdSidAddress: null,
    data: new Uint8Array([0]),
    ...overrides,
  };
}

/** Drains the microtask queue several turns deep — a resolved production now crosses more than one
 *  `await` before it reaches `record()`: `produceRecord`, `SharedTuneIndex.produceOnce` and finally
 *  `refreshIndex`'s own await all sit between them. A single `await Promise.resolve()` settles only
 *  the innermost of those. */
async function settleTicks(times = 6): Promise<void> {
  for (let i = 0; i < times; i++) {
    await Promise.resolve();
  }
}

function buildStoredRecord(overrides: Partial<TuneIndexRecord> = {}): TuneIndexRecord {
  return {
    sidHash: 'still-time-hash',
    subtune: 1,
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
    formatVersion: TUNE_INDEX_FORMAT_VERSION,
    computedAt: '2026-08-29T00:00:00.000Z',
    ...overrides,
  };
}

describe('TuneIndexService', () => {
  let service: TuneIndexService;
  let player: FakeDeckPlayer;
  let scanner: StubScanner;
  let storage: StubStorage;

  function setup(): void {
    player = makePlayer();
    scanner = makeScanner();
    storage = makeStorage();

    TestBed.configureTestingModule({
      providers: [
        TuneIndexService,
        SharedTuneIndex,
        { provide: SID_PLAYER, useValue: player.player },
        { provide: DECK_PLAYER_VIEW, useValue: player.view },
        { provide: ANALYSIS_SCANNER, useValue: scanner },
        { provide: TUNE_INDEX_STORAGE, useValue: storage as unknown as ITuneIndexStorage },
      ],
    });

    TestBed.runInInjectionContext(() => {
      service = TestBed.inject(TuneIndexService);
    });
    TestBed.flushEffects();
  }

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    indexTuneMock.mockReset();
    setup();
  });

  it('calls indexTune exactly once on a cache miss, and publishes the record it produces on completion', async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    let resolveIndex!: (record: TuneIndexRecord) => void;
    indexTuneMock.mockImplementation(
      () => new Promise<TuneIndexRecord>((resolve) => (resolveIndex = resolve))
    );

    service.setTune(bytes, fakeSidFile(), 'Still_Time.sid');
    TestBed.flushEffects();

    expect(indexTuneMock).toHaveBeenCalledTimes(1);
    const [calledScanner, calledBytes, identity] = indexTuneMock.mock.calls[0];
    expect(calledScanner).toBe(scanner);
    expect(calledBytes).toBe(bytes);
    expect(identity).toEqual({ sidHash: 'Still_Time.sid', subtune: 1 });
    expect(service.pending()).toBe(true);
    expect(service.record()).toBeNull();

    const record = buildStoredRecord({ sidHash: 'Still_Time.sid', callsPerFrame: 2 });
    resolveIndex(record);
    await settleTicks();

    expect(service.pending()).toBe(false);
    expect(service.record()).toEqual(record);
    expect(storage.save).toHaveBeenCalledTimes(1);
    expect(storage.save).toHaveBeenCalledWith(record);
    expect(player.player.setTrackStructure).toHaveBeenLastCalledWith(trackStructureOf(record));
  });

  it('publishes a stored record immediately and starts no production on a cache hit', () => {
    const hit = buildStoredRecord({ sidHash: 'Cached.sid', callsPerFrame: 3 });
    storage.load.mockReturnValue(hit);

    service.setTune(new Uint8Array([1]), fakeSidFile(), 'Cached.sid');
    TestBed.flushEffects();

    expect(indexTuneMock).not.toHaveBeenCalled();
    expect(service.pending()).toBe(false);
    expect(service.record()).toEqual(hit);
    expect(player.player.setTrackStructure).toHaveBeenLastCalledWith(trackStructureOf(hit));
  });

  it('triggers neither a lookup nor a production while play, pause and stop leave the loaded tune untouched', () => {
    const hit = buildStoredRecord({ sidHash: 'Loaded.sid' });
    storage.load.mockReturnValue(hit);
    service.setTune(new Uint8Array([1]), fakeSidFile(), 'Loaded.sid');
    TestBed.flushEffects();
    storage.load.mockClear();
    indexTuneMock.mockClear();
    vi.mocked(player.player.setTrackStructure).mockClear();

    // Play, pause and stop touch neither the identity signal nor the subtune, so a further flush
    // with nothing written must re-run nothing.
    TestBed.flushEffects();

    expect(storage.load).not.toHaveBeenCalled();
    expect(indexTuneMock).not.toHaveBeenCalled();
    expect(player.player.setTrackStructure).not.toHaveBeenCalled();
  });

  it('triggers neither a lookup nor a production when the nominal interval changes', () => {
    const hit = buildStoredRecord({ sidHash: 'Loaded.sid' });
    storage.load.mockReturnValue(hit);
    service.setTune(new Uint8Array([1]), fakeSidFile(), 'Loaded.sid');
    TestBed.flushEffects();
    storage.load.mockClear();
    indexTuneMock.mockClear();

    player.snapshot.update((snapshot) => ({
      ...snapshot,
      tempo: { ...snapshot.tempo, nominalIntervalUs: microseconds(20_000) },
    }));
    TestBed.flushEffects();

    expect(storage.load).not.toHaveBeenCalled();
    expect(indexTuneMock).not.toHaveBeenCalled();
  });

  it('triggers a fresh lookup when the subtune steps', () => {
    storage.load.mockReturnValueOnce(buildStoredRecord({ sidHash: 'Multi.sid', subtune: 1 }));
    service.setTune(new Uint8Array([1]), fakeSidFile(), 'Multi.sid');
    TestBed.flushEffects();
    storage.load.mockClear();

    const hit2 = buildStoredRecord({ sidHash: 'Multi.sid', subtune: 2 });
    storage.load.mockReturnValue(hit2);
    setSubtune(player, 2);
    TestBed.flushEffects();

    expect(storage.load).toHaveBeenCalledWith('Multi.sid', 2);
    expect(service.record()).toEqual(hit2);
  });

  it('discards a completed record for a tune this deck moved on from, but still persists what it produced', async () => {
    const resolvers: ((record: TuneIndexRecord) => void)[] = [];
    indexTuneMock.mockImplementation(
      () => new Promise<TuneIndexRecord>((resolve) => resolvers.push(resolve))
    );

    service.setTune(new Uint8Array([1]), fakeSidFile({ name: 'A' }), 'A.sid');
    TestBed.flushEffects();
    expect(indexTuneMock).toHaveBeenCalledTimes(1);

    service.setTune(new Uint8Array([2]), fakeSidFile({ name: 'B' }), 'B.sid');
    TestBed.flushEffects();
    expect(indexTuneMock).toHaveBeenCalledTimes(2);

    // The stale production for the outgoing tune resolves only after B has already taken over.
    resolvers[0](buildStoredRecord({ sidHash: 'A.sid' }));
    await settleTicks();

    // Discarded here — this deck's own generation moved on — but persisted for whichever deck (or
    // later load) asks for A.sid next.
    expect(service.record()).toBeNull();
    expect(service.pending()).toBe(true); // B's own production is still in flight
    expect(storage.save).toHaveBeenCalledTimes(1);
    expect(storage.save).toHaveBeenCalledWith(expect.objectContaining({ sidHash: 'A.sid' }));

    resolvers[1](buildStoredRecord({ sidHash: 'B.sid', callsPerFrame: 4 }));
    await settleTicks();

    expect(service.record()?.sidHash).toBe('B.sid');
    expect(service.record()?.callsPerFrame).toBe(4);
  });

  it('stores nothing and clears pending when indexTune rejects, so the next load retries', async () => {
    let rejectIndex!: (error: unknown) => void;
    indexTuneMock.mockImplementation(
      () => new Promise<TuneIndexRecord>((_resolve, reject) => (rejectIndex = reject))
    );

    service.setTune(new Uint8Array([1]), fakeSidFile(), 'Failing.sid');
    TestBed.flushEffects();
    expect(service.pending()).toBe(true);

    rejectIndex(new Error('the analysis scan worker stopped responding'));
    await settleTicks();

    expect(service.pending()).toBe(false);
    expect(service.record()).toBeNull();
    expect(storage.save).not.toHaveBeenCalled();
    expect(
      vi.mocked(player.player.setTrackStructure).mock.calls.every(([loop]) => loop === null)
    ).toBe(true);
  });

  describe('sharing across decks', () => {
    it('discards the produced record for the deck whose own generation moved on, but resolves it for another caller of the same run', async () => {
      const resolvers: ((record: TuneIndexRecord) => void)[] = [];
      indexTuneMock.mockImplementation(
        () => new Promise<TuneIndexRecord>((resolve) => resolvers.push(resolve))
      );

      service.setTune(new Uint8Array([1]), fakeSidFile({ name: 'A' }), 'A.sid');
      TestBed.flushEffects();
      expect(indexTuneMock).toHaveBeenCalledTimes(1);

      // A second caller for the exact same (sidHash, subtune) joins the run already in flight — the
      // shared collaborator hands it the same promise instead of starting a second production.
      const shared = TestBed.inject(SharedTuneIndex);
      const otherCallerRun = vi.fn(() => Promise.resolve(null));
      const otherCallerRecord = shared.produceOnce('A.sid', 1, otherCallerRun);
      expect(otherCallerRun).not.toHaveBeenCalled();

      // This deck's own tune moves on mid-production; the shared run is guard-free and keeps running.
      service.setTune(new Uint8Array([2]), fakeSidFile({ name: 'B' }), 'B.sid');
      TestBed.flushEffects();
      expect(indexTuneMock).toHaveBeenCalledTimes(2); // B's own production, independent of A's still-running one

      resolvers[0](buildStoredRecord({ sidHash: 'A.sid' }));
      await settleTicks();

      // The deck that moved on discarded the record for the tune it left behind.
      expect(service.record()).toBeNull();
      // The other caller of the same run — its own generation untouched — still receives it.
      const resolved = await otherCallerRecord;
      expect(resolved?.sidHash).toBe('A.sid');
    });

    it('produces one record for two decks loading the same unindexed tune, sharing a single indexTune call', async () => {
      // Deck A is `service`, already wired in `setup()`. Deck B gets its own player and scanner but
      // shares the same `SharedTuneIndex` and `TUNE_INDEX_STORAGE` from the parent injector — the DI
      // topology `DeckHostComponent` and `DjPocViewComponent` establish in production.
      const playerB = makePlayer();
      const scannerB = makeScanner();
      const parentInjector = TestBed.inject(EnvironmentInjector);
      const deckBInjector = createEnvironmentInjector(
        [
          TuneIndexService,
          { provide: SID_PLAYER, useValue: playerB.player },
          { provide: DECK_PLAYER_VIEW, useValue: playerB.view },
          { provide: ANALYSIS_SCANNER, useValue: scannerB },
        ],
        parentInjector
      );

      try {
        let resolveIndex!: (record: TuneIndexRecord) => void;
        indexTuneMock.mockImplementation(
          () => new Promise<TuneIndexRecord>((resolve) => (resolveIndex = resolve))
        );

        service.setTune(new Uint8Array([1]), fakeSidFile(), 'Shared.sid');
        TestBed.flushEffects();
        expect(indexTuneMock).toHaveBeenCalledTimes(1); // deck A produces

        const serviceB = deckBInjector.get(TuneIndexService);
        const settledB = serviceB.setTune(new Uint8Array([1]), fakeSidFile(), 'Shared.sid');
        TestBed.flushEffects();

        // Deck B rode deck A's in-flight production — indexTune was never invoked a second time.
        expect(indexTuneMock).toHaveBeenCalledTimes(1);

        resolveIndex(buildStoredRecord({ sidHash: 'Shared.sid', callsPerFrame: 3 }));
        await settledB;

        expect(service.record()?.sidHash).toBe('Shared.sid');
        expect(serviceB.record()?.sidHash).toBe('Shared.sid');
        expect(serviceB.record()?.callsPerFrame).toBe(3);
        expect(storage.save).toHaveBeenCalledTimes(1); // one production, one persisted record
        expect(indexTuneMock).toHaveBeenCalledTimes(1);
      } finally {
        deckBInjector.destroy();
      }
    });
  });

  describe("setTune's returned promise", () => {
    it('resolves once a cache hit publishes the record, without requesting a production', async () => {
      const hit = buildStoredRecord({ sidHash: 'Cached.sid' });
      storage.load.mockReturnValue(hit);

      const settled = service.setTune(new Uint8Array([1]), fakeSidFile(), 'Cached.sid');
      TestBed.flushEffects();
      await expect(settled).resolves.toBeUndefined();

      expect(indexTuneMock).not.toHaveBeenCalled();
      expect(service.record()).toEqual(hit);
    });

    it('stays unresolved while a genuinely new tune is produced, and resolves once it completes', async () => {
      let resolveIndex!: (record: TuneIndexRecord) => void;
      indexTuneMock.mockImplementation(
        () => new Promise<TuneIndexRecord>((resolve) => (resolveIndex = resolve))
      );
      let settledFlag = false;

      const settled = service
        .setTune(new Uint8Array([1]), fakeSidFile(), 'Still_Time.sid')
        .then(() => (settledFlag = true));
      TestBed.flushEffects();
      await Promise.resolve();
      expect(settledFlag).toBe(false);

      resolveIndex(buildStoredRecord({ sidHash: 'Still_Time.sid', callsPerFrame: 2 }));
      await settled;

      expect(settledFlag).toBe(true);
      expect(service.record()).not.toBeNull();
    });

    it('resolves — never rejects — when indexTune rejects', async () => {
      let rejectIndex!: (error: unknown) => void;
      indexTuneMock.mockImplementation(
        () => new Promise<TuneIndexRecord>((_resolve, reject) => (rejectIndex = reject))
      );

      const settled = service.setTune(new Uint8Array([1]), fakeSidFile(), 'Failing.sid');
      TestBed.flushEffects();

      rejectIndex(new Error('the analysis scan worker stopped responding'));
      await expect(settled).resolves.toBeUndefined();

      expect(service.record()).toBeNull();
    });

    it('resolves the superseded load once its own production concludes, without waiting on the newer one', async () => {
      const resolvers: ((record: TuneIndexRecord) => void)[] = [];
      indexTuneMock.mockImplementation(
        () => new Promise<TuneIndexRecord>((resolve) => resolvers.push(resolve))
      );

      const settledA = service.setTune(new Uint8Array([1]), fakeSidFile({ name: 'A' }), 'A.sid');
      TestBed.flushEffects();
      expect(indexTuneMock).toHaveBeenCalledTimes(1);

      const settledB = service.setTune(new Uint8Array([2]), fakeSidFile({ name: 'B' }), 'B.sid');
      TestBed.flushEffects();
      expect(indexTuneMock).toHaveBeenCalledTimes(2);

      // A's own production resolves only after B has already taken over — discarded by A's own
      // generation check, but still released, and still persisted.
      resolvers[0](buildStoredRecord({ sidHash: 'A.sid' }));
      await expect(settledA).resolves.toBeUndefined();
      expect(service.record()).toBeNull(); // B's own production is still in flight

      resolvers[1](buildStoredRecord({ sidHash: 'B.sid', callsPerFrame: 4 }));
      await expect(settledB).resolves.toBeUndefined();
      expect(service.record()?.sidHash).toBe('B.sid');
    });

    it('releases every caller when two loads coalesce into one effect run, on a cache hit', async () => {
      const hit = buildStoredRecord({ sidHash: 'B.sid' });
      storage.load.mockReturnValue(hit);
      const settled: string[] = [];

      // No flush between the two calls: Angular coalesces the two identity writes into a single
      // effect run that reads only B, so both callers ride on the one refresh it starts.
      void service
        .setTune(new Uint8Array([1]), fakeSidFile({ name: 'A' }), 'A.sid')
        .then(() => settled.push('A'));
      void service
        .setTune(new Uint8Array([2]), fakeSidFile({ name: 'B' }), 'B.sid')
        .then(() => settled.push('B'));
      TestBed.flushEffects();
      await Promise.resolve();
      await Promise.resolve();

      expect([...settled].sort()).toEqual(['A', 'B']);
      expect(indexTuneMock).not.toHaveBeenCalled();
      expect(service.record()).toEqual(hit);
    });

    it('releases every caller when two loads coalesce into one effect run, once the production settles', async () => {
      let resolveIndex!: (record: TuneIndexRecord) => void;
      indexTuneMock.mockImplementation(
        () => new Promise<TuneIndexRecord>((resolve) => (resolveIndex = resolve))
      );
      const settled: string[] = [];

      void service
        .setTune(new Uint8Array([1]), fakeSidFile({ name: 'A' }), 'A.sid')
        .then(() => settled.push('A'));
      void service
        .setTune(new Uint8Array([2]), fakeSidFile({ name: 'B' }), 'B.sid')
        .then(() => settled.push('B'));
      TestBed.flushEffects();
      await Promise.resolve();

      // A never reached a production of its own — it was superseded before the effect ever ran — so
      // the single production in flight is B's, and it holds both callers.
      expect(indexTuneMock).toHaveBeenCalledTimes(1);
      expect(settled).toEqual([]);

      resolveIndex(buildStoredRecord({ sidHash: 'B.sid', callsPerFrame: 2 }));
      await settleTicks();

      expect([...settled].sort()).toEqual(['A', 'B']);
      expect(service.record()?.sidHash).toBe('B.sid');
    });
  });

  describe('setTimingMode', () => {
    it('does nothing when no record has been indexed yet', () => {
      // The constructor's own initial refresh already published once.
      vi.mocked(player.player.setTrackStructure).mockClear();

      service.setTimingMode('rounded');

      expect(storage.save).not.toHaveBeenCalled();
      expect(player.player.setTrackStructure).not.toHaveBeenCalled();
      expect(service.record()).toBeNull();
    });

    it('rewrites and republishes the current record with the new mode, without touching the scanner', () => {
      const hit = buildStoredRecord({ sidHash: 'Cached.sid', timingMode: 'exact' });
      storage.load.mockReturnValue(hit);
      service.setTune(new Uint8Array([1]), fakeSidFile(), 'Cached.sid');
      TestBed.flushEffects();
      storage.save.mockClear();
      vi.mocked(player.player.setTimingMode).mockClear();

      service.setTimingMode('rounded');

      expect(indexTuneMock).not.toHaveBeenCalled();
      const record = service.record();
      expect(record?.timingMode).toBe('rounded');
      // The rest of the record rides along untouched — this is a rewrite, not a re-scan.
      expect(record?.sidHash).toBe('Cached.sid');
      expect(storage.save).toHaveBeenCalledTimes(1);
      expect(storage.save).toHaveBeenCalledWith(record);
      expect(player.player.setTimingMode).toHaveBeenCalledWith('rounded');
    });
  });
});
