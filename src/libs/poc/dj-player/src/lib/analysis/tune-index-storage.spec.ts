import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LocalStorageTuneIndexStorage } from './tune-index-storage';
import { TUNE_INDEX_FORMAT_VERSION } from './tune-index.model';
import type { TuneIndexRecord } from './tune-index.model';

function buildRecord(overrides: Partial<TuneIndexRecord> = {}): TuneIndexRecord {
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

describe('LocalStorageTuneIndexStorage', () => {
  let storage: LocalStorageTuneIndexStorage;

  beforeEach(() => {
    localStorage.clear();
    storage = new LocalStorageTuneIndexStorage();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads back a saved record field-for-field, including null detector outcomes', () => {
    const record = buildRecord();

    storage.save(record);
    const loaded = storage.load('Still_Time.sid', 1);

    expect(loaded).toEqual(record);
  });

  it('preserves non-null detector outcomes across a save/load round trip', () => {
    const record = buildRecord({
      loopStartFrame: 1200,
      loopPeriodFrames: 4567,
      endedAtFrame: null,
      sectionBoundaries: [0, 512, 1024],
      tonic: 9,
      mode: 'minor',
      camelot: '5A',
      tuningReferenceHz: 440.2,
      tuningCents: -3.1,
      keyConfidence: 'weak',
      scalePitchClasses: [0, 2, 3, 5, 7, 8, 10],
      dominantIntervalFrames: 20,
      pulseConfidence: 'strong',
      nativeTempo: 128,
      callsPerFrame: 2,
      exactCallsPerFrame: 2.4,
      timingMode: 'rounded',
    });

    storage.save(record);
    const loaded = storage.load(record.filename, record.subtune);

    expect(loaded).toEqual(record);
  });

  it('finds a saved record by the same (filename, subtune), but not under a different subtune', () => {
    const record = buildRecord({ filename: 'Multi_Tune.sid', subtune: 2 });

    storage.save(record);

    expect(storage.load('Multi_Tune.sid', 2)).toEqual(record);
    expect(storage.load('Multi_Tune.sid', 3)).toBeNull();
  });

  it('returns null for a key that was never written', () => {
    expect(storage.load('Never_Played.sid', 1)).toBeNull();
  });

  it('reads a record written under the previous format version as a cache miss, so it is re-scanned', () => {
    const record = buildRecord({ formatVersion: TUNE_INDEX_FORMAT_VERSION - 1 });
    localStorage.setItem(`teensyrom_dj_tune_index_${record.filename}:${record.subtune}`, JSON.stringify(record));

    expect(storage.load(record.filename, record.subtune)).toBeNull();
  });

  it('returns null and logs a warning for a malformed stored value', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    localStorage.setItem('teensyrom_dj_tune_index_Broken.sid:1', '{ not json');

    const result = storage.load('Broken.sid', 1);

    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
  });

  it('does not throw when the stored value is a non-object JSON value', () => {
    localStorage.setItem('teensyrom_dj_tune_index_Weird.sid:1', JSON.stringify('just a string'));

    expect(storage.load('Weird.sid', 1)).toBeNull();
  });

  it('swallows a setItem failure rather than letting it reach the caller', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    expect(() => storage.save(buildRecord())).not.toThrow();
    expect(warnSpy).toHaveBeenCalled();
  });

  it('returns null rather than throwing when localStorage itself throws on read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });

    expect(storage.load('Anything.sid', 1)).toBeNull();
  });
});
