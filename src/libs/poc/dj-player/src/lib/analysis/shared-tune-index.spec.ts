import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SharedTuneIndex } from './shared-tune-index';
import { TUNE_INDEX_STORAGE } from './tune-index-storage';
import type { ITuneIndexStorage } from './tune-index-storage';
import { TUNE_INDEX_FORMAT_VERSION } from './tune-index.model';
import type { TuneIndexRecord } from './tune-index.model';

interface StubStorage {
  load: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
}

function makeStorage(): StubStorage {
  return { load: vi.fn(() => null), save: vi.fn() };
}

function buildRecord(overrides: Partial<TuneIndexRecord> = {}): TuneIndexRecord {
  return {
    filename: 'Still_Time.sid',
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

describe('SharedTuneIndex', () => {
  let shared: SharedTuneIndex;
  let storage: StubStorage;

  beforeEach(() => {
    storage = makeStorage();
    TestBed.configureTestingModule({
      providers: [
        SharedTuneIndex,
        { provide: TUNE_INDEX_STORAGE, useValue: storage as unknown as ITuneIndexStorage },
      ],
    });
    shared = TestBed.inject(SharedTuneIndex);
  });

  describe('load / save', () => {
    it('reads straight through to the injected storage', () => {
      const hit = buildRecord({ filename: 'Cached.sid' });
      storage.load.mockReturnValue(hit);

      expect(shared.load('Cached.sid', 1)).toBe(hit);
      expect(storage.load).toHaveBeenCalledWith('Cached.sid', 1);
    });

    it('writes straight through to the injected storage', () => {
      const record = buildRecord({ filename: 'New.sid' });

      shared.save(record);

      expect(storage.save).toHaveBeenCalledWith(record);
    });
  });

  describe('produceOnce', () => {
    it('hands a second caller for the same (filename, subtune) the first run in flight, never invoking its own', async () => {
      let resolveFirst!: (record: TuneIndexRecord | null) => void;
      const firstRun = vi.fn(
        () => new Promise<TuneIndexRecord | null>((resolve) => (resolveFirst = resolve))
      );
      const secondRun = vi.fn(() => Promise.resolve<TuneIndexRecord | null>(null));

      const firstPromise = shared.produceOnce('Track.sid', 1, firstRun);
      const secondPromise = shared.produceOnce('Track.sid', 1, secondRun);

      expect(firstRun).toHaveBeenCalledTimes(1);
      expect(secondRun).not.toHaveBeenCalled();
      expect(secondPromise).toBe(firstPromise);

      const record = buildRecord({ filename: 'Track.sid' });
      resolveFirst(record);

      await expect(firstPromise).resolves.toBe(record);
      await expect(secondPromise).resolves.toBe(record);
    });

    it('runs independent productions for different (filename, subtune) keys', () => {
      const runForA = vi.fn(() => new Promise<TuneIndexRecord | null>(() => undefined));
      const runForB = vi.fn(() => new Promise<TuneIndexRecord | null>(() => undefined));

      shared.produceOnce('A.sid', 1, runForA);
      shared.produceOnce('B.sid', 1, runForB);
      shared.produceOnce('A.sid', 2, runForA); // same filename, different subtune — still independent

      expect(runForA).toHaveBeenCalledTimes(2);
      expect(runForB).toHaveBeenCalledTimes(1);
    });

    it('clears the in-flight entry once a run resolves, so the next load for that tune runs again', async () => {
      let resolveFirst!: (record: TuneIndexRecord | null) => void;
      const firstRun = vi.fn(
        () => new Promise<TuneIndexRecord | null>((resolve) => (resolveFirst = resolve))
      );

      const firstPromise = shared.produceOnce('Track.sid', 1, firstRun);
      resolveFirst(buildRecord({ filename: 'Track.sid' }));
      await firstPromise;

      const secondRun = vi.fn(() => Promise.resolve<TuneIndexRecord | null>(null));
      shared.produceOnce('Track.sid', 1, secondRun);

      expect(secondRun).toHaveBeenCalledTimes(1);
    });

    it('clears the in-flight entry once a run produces null, so a failed attempt is retried by the next load', async () => {
      let resolveFirst!: (record: TuneIndexRecord | null) => void;
      const firstRun = vi.fn(
        () => new Promise<TuneIndexRecord | null>((resolve) => (resolveFirst = resolve))
      );

      const firstPromise = shared.produceOnce('Failing.sid', 1, firstRun);
      resolveFirst(null);
      await firstPromise;

      const secondRun = vi.fn(() => Promise.resolve<TuneIndexRecord | null>(null));
      shared.produceOnce('Failing.sid', 1, secondRun);

      expect(secondRun).toHaveBeenCalledTimes(1);
    });
  });
});
