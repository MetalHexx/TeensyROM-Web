import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TUNE_INSERTER, TUNE_RESOLVER } from '@teensyrom-nx/application';
import { ALERT_SERVICE, IAlertService } from '@teensyrom-nx/domain';
import { DjDatabase, DJ_DATABASE_NAME } from './database/dj-database';
import { WorkerTuneIndexer } from './analysis/worker-tune-indexer';
import { DJ_ENGINE_PROVIDERS } from './providers';

const PSID_HEADER_SIZE = 0x7c;

/** A minimal well-formed PSID v2 file — enough for `@sidablist/core`'s `parseSidFile` to accept
 *  without throwing, and for one subtune to resolve. */
function validSidBytes(): Uint8Array {
  const payload = [0xa9, 0x00, 0x60];
  const buffer = new Uint8Array(PSID_HEADER_SIZE + payload.length);
  const view = new DataView(buffer.buffer);
  buffer.set([0x50, 0x53, 0x49, 0x44], 0x00); // 'PSID'
  view.setUint16(0x04, 2, false);
  view.setUint16(0x06, PSID_HEADER_SIZE, false);
  view.setUint16(0x08, 0x1000, false);
  view.setUint16(0x0a, 0x1000, false);
  view.setUint16(0x0c, 0x1003, false);
  view.setUint16(0x0e, 1, false);
  view.setUint16(0x10, 1, false);
  view.setUint32(0x12, 0, false);
  buffer.set(payload, PSID_HEADER_SIZE);
  return buffer;
}

describe('DJ_ENGINE_PROVIDERS composition', () => {
  let mockAlertService: Partial<IAlertService>;
  let currentDb: IDBDatabase | null = null;

  beforeEach(() => {
    mockAlertService = { warning: vi.fn() };
    currentDb = null;

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        ...DJ_ENGINE_PROVIDERS,
        DjDatabase,
        { provide: ALERT_SERVICE, useValue: mockAlertService },
        // Stubbed so this spec proves the composition's wiring rather than exercising a real scan
        // (and the browser Worker it would start, which jsdom does not implement).
        {
          provide: WorkerTuneIndexer,
          useValue: {
            index: vi.fn(async (_bytes: Uint8Array, identity: { sidHash: string; subtune: number }) => ({
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
              callsPerFrame: 50,
              exactCallsPerFrame: 50,
              timingMode: 'exact',
              formatVersion: 5,
              computedAt: '2026-01-01T00:00:00.000Z',
            })),
          },
        },
      ],
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

  it('resolves bytes inserted through TUNE_INSERTER to a playable through TUNE_RESOLVER', async () => {
    const inserter = TestBed.inject(TUNE_INSERTER);
    const resolver = TestBed.inject(TUNE_RESOLVER);
    const indexer = TestBed.inject(WorkerTuneIndexer);
    const database = TestBed.inject(DjDatabase);

    const bytes = validSidBytes();
    const reference = await inserter.insert(bytes);
    const playable = await resolver.resolve(reference.identity);
    currentDb = await database.open();

    expect(playable).not.toBeNull();
    expect(playable?.bytes).toEqual(bytes);
    expect(playable?.reference.identity).toEqual(reference.identity);
    expect(indexer.index).toHaveBeenCalledTimes(1);
  });
});
