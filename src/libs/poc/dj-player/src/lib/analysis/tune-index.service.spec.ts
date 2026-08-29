import { TestBed } from '@angular/core/testing';
import { signal, WritableSignal } from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TuneIndexService } from './tune-index.service';
import { DjPlayerEngine } from '../engine/dj-player-engine';
import { ANALYSIS_SCANNER } from './scan-runner';
import type { ScanResult } from './scan-runner';
import type { ScanOutput } from './scan-tune';
import { TUNE_INDEX_STORAGE } from './tune-index-storage';
import type { ITuneIndexStorage } from './tune-index-storage';
import { TUNE_INDEX_FORMAT_VERSION } from './tune-index.model';
import type { TuneIndexRecord } from './tune-index.model';
import { ASID_SLOT_COUNT } from '../asid/asid-constants';
import type { SidFile } from '../sid/sid-file.model';

interface StubEngine {
  currentSubtune: WritableSignal<number>;
  nominalIntervalUs: WritableSignal<number>;
  ceilingFrames: WritableSignal<number>;
  setTuneIndex: ReturnType<typeof vi.fn>;
}

interface StubScanner {
  scan: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
}

interface StubStorage {
  load: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
}

function makeEngine(): StubEngine {
  return {
    currentSubtune: signal(1),
    nominalIntervalUs: signal(19_950),
    ceilingFrames: signal(10_000),
    setTuneIndex: vi.fn(),
  };
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

/** A silent, all-zero scan — the detectors all handle it gracefully (no candidates, no notes, no
 *  loop), so only the wiring — not the detector math — is under test here. */
function makeScan(frames: number, callsPerFrame: number): ScanOutput {
  return {
    slotValues: new Uint8Array(frames * ASID_SLOT_COUNT),
    writeCounts: new Uint8Array(frames),
    frames,
    callsPerFrame,
  };
}

function buildStoredRecord(overrides: Partial<TuneIndexRecord> = {}): TuneIndexRecord {
  return {
    filename: 'Still_Time.sid',
    subtune: 1,
    nativeLengthSeconds: null,
    loopFrame: null,
    structureConfidence: 'none',
    sectionBoundaries: [],
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
    formatVersion: TUNE_INDEX_FORMAT_VERSION,
    computedAt: '2026-08-29T00:00:00.000Z',
    ...overrides,
  };
}

describe('TuneIndexService', () => {
  let service: TuneIndexService;
  let engine: StubEngine;
  let scanner: StubScanner;
  let storage: StubStorage;

  function setup(): void {
    engine = makeEngine();
    scanner = makeScanner();
    storage = makeStorage();

    TestBed.configureTestingModule({
      providers: [
        TuneIndexService,
        { provide: DjPlayerEngine, useValue: engine as unknown as DjPlayerEngine },
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
    setup();
  });

  it('starts exactly one scan on a cache miss, and publishes the record it produces on completion', async () => {
    const file = fakeSidFile();
    let resolveScan!: (result: ScanResult) => void;
    scanner.scan.mockImplementation(
      () => new Promise<ScanResult>((resolve) => (resolveScan = resolve))
    );

    service.setTune(file, 'Still_Time.sid');
    TestBed.flushEffects();

    expect(scanner.scan).toHaveBeenCalledTimes(1);
    const [request] = scanner.scan.mock.calls[0];
    expect(request.file).toBe(file);
    expect(request.subtune).toBe(1);
    expect(request.maxFrames).toBe(10_000);
    expect(service.pending()).toBe(true);
    expect(service.record()).toBeNull();

    const scan = makeScan(40, 2);
    resolveScan({ id: request.id, kind: 'done', output: scan });
    await Promise.resolve();
    await Promise.resolve();

    expect(service.pending()).toBe(false);
    expect(service.record()).not.toBeNull();
    // The seam that bites: callsPerFrame comes off the ScanOutput, not the engine.
    expect(service.record()?.callsPerFrame).toBe(2);
    expect(service.record()?.filename).toBe('Still_Time.sid');
    expect(storage.save).toHaveBeenCalledTimes(1);
    expect(storage.save).toHaveBeenCalledWith(service.record());
    expect(engine.setTuneIndex).toHaveBeenLastCalledWith(service.record());
  });

  it('publishes a stored record immediately and starts no scan on a cache hit', () => {
    const hit = buildStoredRecord({ filename: 'Cached.sid', callsPerFrame: 3 });
    storage.load.mockReturnValue(hit);

    service.setTune(fakeSidFile(), 'Cached.sid');
    TestBed.flushEffects();

    expect(scanner.scan).not.toHaveBeenCalled();
    expect(service.pending()).toBe(false);
    expect(service.record()).toEqual(hit);
    expect(engine.setTuneIndex).toHaveBeenLastCalledWith(hit);
  });

  it('triggers neither a lookup nor a scan while play, pause and stop leave the loaded tune untouched', () => {
    const hit = buildStoredRecord({ filename: 'Loaded.sid' });
    storage.load.mockReturnValue(hit);
    service.setTune(fakeSidFile(), 'Loaded.sid');
    TestBed.flushEffects();
    storage.load.mockClear();
    scanner.scan.mockClear();
    engine.setTuneIndex.mockClear();

    // Play, pause and stop touch neither the identity signal nor currentSubtune, so a further flush
    // with nothing written must re-run nothing.
    TestBed.flushEffects();

    expect(storage.load).not.toHaveBeenCalled();
    expect(scanner.scan).not.toHaveBeenCalled();
    expect(engine.setTuneIndex).not.toHaveBeenCalled();
  });

  it('triggers neither a lookup nor a scan when the nominal interval changes', () => {
    const hit = buildStoredRecord({ filename: 'Loaded.sid' });
    storage.load.mockReturnValue(hit);
    service.setTune(fakeSidFile(), 'Loaded.sid');
    TestBed.flushEffects();
    storage.load.mockClear();
    scanner.scan.mockClear();

    engine.nominalIntervalUs.set(20_000);
    TestBed.flushEffects();

    expect(storage.load).not.toHaveBeenCalled();
    expect(scanner.scan).not.toHaveBeenCalled();
  });

  it('triggers a fresh lookup when the subtune steps', () => {
    storage.load.mockReturnValueOnce(buildStoredRecord({ filename: 'Multi.sid', subtune: 1 }));
    service.setTune(fakeSidFile(), 'Multi.sid');
    TestBed.flushEffects();
    storage.load.mockClear();

    const hit2 = buildStoredRecord({ filename: 'Multi.sid', subtune: 2 });
    storage.load.mockReturnValue(hit2);
    engine.currentSubtune.set(2);
    TestBed.flushEffects();

    expect(storage.load).toHaveBeenCalledWith('Multi.sid', 2);
    expect(service.record()).toEqual(hit2);
  });

  it('discards a scan that resolves after the tune changed while it was in flight', async () => {
    const resolvers: ((result: ScanResult) => void)[] = [];
    scanner.scan.mockImplementation(
      () => new Promise<ScanResult>((resolve) => resolvers.push(resolve))
    );

    service.setTune(fakeSidFile({ name: 'A' }), 'A.sid');
    TestBed.flushEffects();
    expect(scanner.scan).toHaveBeenCalledTimes(1);

    service.setTune(fakeSidFile({ name: 'B' }), 'B.sid');
    TestBed.flushEffects();
    expect(scanner.scan).toHaveBeenCalledTimes(2);

    // The stale scan for the outgoing tune resolves only after B has already taken over.
    resolvers[0]({ id: 1, kind: 'done', output: makeScan(20, 1) });
    await Promise.resolve();
    await Promise.resolve();

    expect(service.record()).toBeNull();
    expect(service.pending()).toBe(true); // B's own scan is still in flight
    expect(storage.save).not.toHaveBeenCalled();

    resolvers[1]({ id: 2, kind: 'done', output: makeScan(20, 4) });
    await Promise.resolve();
    await Promise.resolve();

    expect(service.record()?.filename).toBe('B.sid');
    expect(service.record()?.callsPerFrame).toBe(4);
  });

  it('stores nothing and clears pending on a failed scan, so the next load retries', async () => {
    let resolveScan!: (result: ScanResult) => void;
    scanner.scan.mockImplementation(
      () => new Promise<ScanResult>((resolve) => (resolveScan = resolve))
    );

    service.setTune(fakeSidFile(), 'Failing.sid');
    TestBed.flushEffects();
    expect(service.pending()).toBe(true);

    resolveScan({ id: 1, kind: 'failed', error: 'the analysis scan worker stopped responding' });
    await Promise.resolve();
    await Promise.resolve();

    expect(service.pending()).toBe(false);
    expect(service.record()).toBeNull();
    expect(storage.save).not.toHaveBeenCalled();
    expect(engine.setTuneIndex.mock.calls.every(([record]) => record === null)).toBe(true);
  });
});
