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
import type { PlayRate, TimingMode } from '../engine/play-rate';
import type { SidFile } from '../sid/sid-file.model';

interface StubEngine {
  currentSubtune: WritableSignal<number>;
  nominalIntervalUs: WritableSignal<number>;
  ceilingFrames: WritableSignal<number>;
  playRate: WritableSignal<PlayRate>;
  timingMode: WritableSignal<TimingMode>;
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
    // A CIA-timer tune: the two rates differ, which is what makes "which rate did the record store"
    // and "which rate were the detector's thresholds converted through" separable questions.
    playRate: signal<PlayRate>({
      callsPerFrame: 2.4,
      exactCallsPerFrame: 2.4,
      roundedCallsPerFrame: 2,
      mode: 'exact',
    }),
    timingMode: signal<TimingMode>('exact'),
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

/** A scan whose register stream is unique for `introFrames` and then repeats on a `periodFrames` lap,
 *  long enough for the detector's tail guard to be satisfied at this spec's engine rate. */
function makeLoopingScan(
  frames: number,
  introFrames: number,
  periodFrames: number,
  callsPerFrame: number
): ScanOutput {
  const scan = makeScan(frames, callsPerFrame);
  for (let f = 0; f < frames; f++) {
    const seed = f < introFrames ? 1_000_000 + f : (f - introFrames) % periodFrames;
    const base = f * ASID_SLOT_COUNT;
    // Three bytes of the seed, so two frames a multiple of 256 apart are never byte-identical.
    scan.slotValues[base] = seed & 0xff;
    scan.slotValues[base + 1] = (seed >>> 8) & 0xff;
    scan.slotValues[base + 2] = (seed >>> 16) & 0xff;
    for (let slot = 3; slot < ASID_SLOT_COUNT; slot++) {
      scan.slotValues[base + slot] = (seed + slot * 13) & 0xff;
    }
  }
  return scan;
}

function buildStoredRecord(overrides: Partial<TuneIndexRecord> = {}): TuneIndexRecord {
  return {
    filename: 'Still_Time.sid',
    subtune: 1,
    loopStartFrame: null,
    loopPeriodFrames: null,
    endedAtFrame: null,
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
    exactCallsPerFrame: 1,
    timingMode: 'exact',
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
    expect(request.maxFrames).toBeGreaterThan(0);
    expect(service.pending()).toBe(true);
    expect(service.record()).toBeNull();

    // Long and silent enough to answer conclusively on the ladder's very first rung, so exactly one
    // scan is expected below.
    const scan = makeScan(2_000, 2);
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

  it('records the detected loop as a start and a period, alongside the rate it was scanned at', async () => {
    let resolveScan!: (result: ScanResult) => void;
    scanner.scan.mockImplementation(
      () => new Promise<ScanResult>((resolve) => (resolveScan = resolve))
    );

    service.setTune(fakeSidFile(), 'Looping.sid');
    TestBed.flushEffects();

    resolveScan({
      id: 1,
      kind: 'done',
      output: makeLoopingScan(2500, 100, 400, 2),
    });
    await Promise.resolve();
    await Promise.resolve();

    const record = service.record();
    expect(record?.loopStartFrame).toBe(100);
    expect(record?.loopPeriodFrames).toBe(400);
    expect(record?.endedAtFrame).toBeNull();
    // Both rates ride along: the rounded one off the scan, the exact one off the engine, so the
    // Timing toggle can flip this tune later without re-scanning it.
    expect(record?.callsPerFrame).toBe(2);
    expect(record?.exactCallsPerFrame).toBe(2.4);
    expect(record?.timingMode).toBe('exact');
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

    // The stale scan for the outgoing tune resolves only after B has already taken over. Its output
    // is discarded by the generation guard before detection ever runs, so its shape doesn't matter.
    resolvers[0]({ id: 1, kind: 'done', output: makeScan(20, 1) });
    await Promise.resolve();
    await Promise.resolve();

    expect(service.record()).toBeNull();
    expect(service.pending()).toBe(true); // B's own scan is still in flight
    expect(storage.save).not.toHaveBeenCalled();
    expect(scanner.scan).toHaveBeenCalledTimes(2); // A's abandoned ladder requested no further rung

    // Long and silent enough to answer conclusively on B's very first rung.
    resolvers[1]({ id: 2, kind: 'done', output: makeScan(2_000, 4) });
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

  describe('the scan ladder', () => {
    it('deepens the scan when a rung finds no loop, and stops at the first rung that answers', async () => {
      const resolvers: ((result: ScanResult) => void)[] = [];
      scanner.scan.mockImplementation(
        () => new Promise<ScanResult>((resolve) => resolvers.push(resolve))
      );

      service.setTune(fakeSidFile(), 'Deepens.sid');
      TestBed.flushEffects();
      expect(scanner.scan).toHaveBeenCalledTimes(1);

      // The shallowest rung finds nothing to work with — too short a tail to confirm a repeat.
      resolvers[0]({ id: 1, kind: 'done', output: makeScan(40, 2) });
      await Promise.resolve();
      await Promise.resolve();
      expect(scanner.scan).toHaveBeenCalledTimes(2);
      expect(service.pending()).toBe(true); // still deepening, not yet an answer

      // Neither does the second rung.
      resolvers[1]({ id: 2, kind: 'done', output: makeScan(40, 2) });
      await Promise.resolve();
      await Promise.resolve();
      expect(scanner.scan).toHaveBeenCalledTimes(3);
      // Each rung reaches further into the tune than the one before it.
      const [first, second, third] = scanner.scan.mock.calls.map(([request]) => request.maxFrames);
      expect(second).toBeGreaterThan(first);
      expect(third).toBeGreaterThan(second);

      // The third rung finally answers.
      resolvers[2]({ id: 3, kind: 'done', output: makeLoopingScan(2500, 100, 400, 2) });
      await Promise.resolve();
      await Promise.resolve();

      expect(scanner.scan).toHaveBeenCalledTimes(3); // the ladder stopped — no fourth rung
      expect(service.pending()).toBe(false);
      expect(service.record()?.loopStartFrame).toBe(100);
      expect(service.record()?.loopPeriodFrames).toBe(400);
    });

    it('scans all the way to the deepest rung and writes a null record when no rung finds a loop', async () => {
      scanner.scan.mockImplementation(() =>
        Promise.resolve<ScanResult>({ id: 0, kind: 'done', output: makeScan(40, 2) })
      );

      service.setTune(fakeSidFile(), 'NoLoop.sid');
      TestBed.flushEffects();

      // Enough microtask turns for every rung's await to settle in sequence.
      for (let i = 0; i < 20; i++) {
        await Promise.resolve();
      }

      expect(scanner.scan.mock.calls.length).toBeGreaterThan(1); // more than one rung was tried
      const callsOnceSettled = scanner.scan.mock.calls.length;
      for (let i = 0; i < 5; i++) {
        await Promise.resolve();
      }
      expect(scanner.scan.mock.calls.length).toBe(callsOnceSettled); // the ladder terminates

      expect(service.pending()).toBe(false);
      const record = service.record();
      expect(record).not.toBeNull();
      expect(record?.loopStartFrame).toBeNull();
      expect(record?.loopPeriodFrames).toBeNull();
      expect(record?.endedAtFrame).toBeNull();
      expect(storage.save).toHaveBeenCalledTimes(1);
    });

    it('stamps every rung of one ladder with a single session, and a new ladder with a different one', async () => {
      const resolvers: ((result: ScanResult) => void)[] = [];
      scanner.scan.mockImplementation(
        () => new Promise<ScanResult>((resolve) => resolvers.push(resolve))
      );

      service.setTune(fakeSidFile({ name: 'A' }), 'A.sid');
      TestBed.flushEffects();

      // Two rungs that find nothing, so the ladder deepens twice under the one session.
      for (const rung of [0, 1]) {
        resolvers[rung]({ id: rung + 1, kind: 'done', output: makeScan(40, 2) });
        await Promise.resolve();
        await Promise.resolve();
      }
      expect(scanner.scan).toHaveBeenCalledTimes(3);

      const sessions = scanner.scan.mock.calls.map(([request]) => request.session);
      expect(new Set(sessions).size).toBe(1);

      // Different music is a different ladder: reusing the session would let its first rung continue
      // the scan the outgoing tune left behind.
      service.setTune(fakeSidFile({ name: 'B' }), 'B.sid');
      TestBed.flushEffects();

      const [latest] = scanner.scan.mock.calls[scanner.scan.mock.calls.length - 1];
      expect(latest.session).not.toBe(sessions[0]);
    });

    it('abandons the whole ladder mid-flight when the tune changes, publishing nothing for the outgoing tune', async () => {
      const resolvers: ((result: ScanResult) => void)[] = [];
      scanner.scan.mockImplementation(
        () => new Promise<ScanResult>((resolve) => resolvers.push(resolve))
      );

      service.setTune(fakeSidFile({ name: 'A' }), 'A.sid');
      TestBed.flushEffects();
      expect(scanner.scan).toHaveBeenCalledTimes(1);

      // A's shallowest rung finds nothing, so the ladder deepens.
      resolvers[0]({ id: 1, kind: 'done', output: makeScan(40, 2) });
      await Promise.resolve();
      await Promise.resolve();
      expect(scanner.scan).toHaveBeenCalledTimes(2); // A's second rung now in flight

      // The tune changes before A's second rung resolves.
      service.setTune(fakeSidFile({ name: 'B' }), 'B.sid');
      TestBed.flushEffects();
      expect(scanner.scan).toHaveBeenCalledTimes(3); // B's own first rung

      // A's stale rung resolves after B has already taken over — even with a loop-shaped output, it
      // must not be believed.
      resolvers[1]({ id: 2, kind: 'done', output: makeLoopingScan(2500, 100, 400, 2) });
      await Promise.resolve();
      await Promise.resolve();

      expect(service.record()).toBeNull(); // B's own ladder is still running
      expect(storage.save).not.toHaveBeenCalled();
      expect(scanner.scan).toHaveBeenCalledTimes(3); // A's ladder did not continue to a third rung

      // B's first rung answers.
      resolvers[2]({ id: 3, kind: 'done', output: makeLoopingScan(2500, 60, 400, 4) });
      await Promise.resolve();
      await Promise.resolve();

      expect(service.record()?.filename).toBe('B.sid');
      expect(service.record()?.loopStartFrame).toBe(60);
    });
  });

  describe("setTune's returned promise", () => {
    it('resolves once a cache hit publishes the record, without requesting a scan', async () => {
      const hit = buildStoredRecord({ filename: 'Cached.sid' });
      storage.load.mockReturnValue(hit);

      const settled = service.setTune(fakeSidFile(), 'Cached.sid');
      TestBed.flushEffects();
      await expect(settled).resolves.toBeUndefined();

      expect(scanner.scan).not.toHaveBeenCalled();
      expect(service.record()).toEqual(hit);
    });

    it('stays unresolved while a genuinely new tune scans, and resolves once the scan completes', async () => {
      let resolveScan!: (result: ScanResult) => void;
      scanner.scan.mockImplementation(
        () => new Promise<ScanResult>((resolve) => (resolveScan = resolve))
      );
      let settledFlag = false;

      const settled = service
        .setTune(fakeSidFile(), 'Still_Time.sid')
        .then(() => (settledFlag = true));
      TestBed.flushEffects();
      await Promise.resolve();
      expect(settledFlag).toBe(false);

      resolveScan({ id: 1, kind: 'done', output: makeScan(2_000, 2) });
      await settled;

      expect(settledFlag).toBe(true);
      expect(service.record()).not.toBeNull();
    });

    it('resolves — never rejects — when the scan fails', async () => {
      let resolveScan!: (result: ScanResult) => void;
      scanner.scan.mockImplementation(
        () => new Promise<ScanResult>((resolve) => (resolveScan = resolve))
      );

      const settled = service.setTune(fakeSidFile(), 'Failing.sid');
      TestBed.flushEffects();

      resolveScan({ id: 1, kind: 'failed', error: 'the analysis scan worker stopped responding' });
      await expect(settled).resolves.toBeUndefined();

      expect(service.record()).toBeNull();
    });

    it('resolves the superseded load once its ladder is abandoned, without waiting on the newer one', async () => {
      const resolvers: ((result: ScanResult) => void)[] = [];
      scanner.scan.mockImplementation(
        () => new Promise<ScanResult>((resolve) => resolvers.push(resolve))
      );

      const settledA = service.setTune(fakeSidFile({ name: 'A' }), 'A.sid');
      TestBed.flushEffects();
      expect(scanner.scan).toHaveBeenCalledTimes(1);

      const settledB = service.setTune(fakeSidFile({ name: 'B' }), 'B.sid');
      TestBed.flushEffects();
      expect(scanner.scan).toHaveBeenCalledTimes(2);

      // A's own rung resolves only after B has already taken over — abandoned, but still released.
      resolvers[0]({ id: 1, kind: 'done', output: makeScan(20, 1) });
      await expect(settledA).resolves.toBeUndefined();
      expect(service.record()).toBeNull(); // B's own ladder is still running

      resolvers[1]({ id: 2, kind: 'done', output: makeScan(2_000, 4) });
      await expect(settledB).resolves.toBeUndefined();
      expect(service.record()?.filename).toBe('B.sid');
    });
  });

  describe('setTimingMode', () => {
    it('does nothing when no record has been indexed yet', () => {
      engine.setTuneIndex.mockClear(); // the constructor's own initial refresh already called it once

      service.setTimingMode('rounded');

      expect(storage.save).not.toHaveBeenCalled();
      expect(engine.setTuneIndex).not.toHaveBeenCalled();
      expect(service.record()).toBeNull();
    });

    it('rewrites and republishes the current record with the new mode, without touching the scanner', () => {
      const hit = buildStoredRecord({ filename: 'Cached.sid', timingMode: 'exact' });
      storage.load.mockReturnValue(hit);
      service.setTune(fakeSidFile(), 'Cached.sid');
      TestBed.flushEffects();
      storage.save.mockClear();
      engine.setTuneIndex.mockClear();

      service.setTimingMode('rounded');

      expect(scanner.scan).not.toHaveBeenCalled();
      const record = service.record();
      expect(record?.timingMode).toBe('rounded');
      // The rest of the record rides along untouched — this is a rewrite, not a re-scan.
      expect(record?.filename).toBe('Cached.sid');
      expect(storage.save).toHaveBeenCalledTimes(1);
      expect(storage.save).toHaveBeenCalledWith(record);
      expect(engine.setTuneIndex).toHaveBeenCalledWith(record);
    });
  });
});
