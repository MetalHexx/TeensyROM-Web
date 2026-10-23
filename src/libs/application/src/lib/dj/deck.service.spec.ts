import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import { of, throwError } from 'rxjs';
import { FakeClock, frames, replayToFrame } from '@sidablist/core';
import type { ReplayRequest, ReplayResponse, ReplayRunner } from '@sidablist/core';
import type { MidiOutputPort } from '@sidablist/asid';
import type { Playable, TuneIdentity, TuneReference } from '@sidablist/tunes';
import type { TuneIndexRecord } from '@sidablist/analysis';
import {
  FILE_CONTENT_SERVICE,
  StorageType,
  type FileContent,
  type IFileContentService,
} from '@teensyrom-nx/domain';
import { DeckService } from './deck.service';
import { DeckRuntime } from './deck-runtime';
import { DeckBindings } from './deck-bindings';
import { MixerApplier } from './mixer-applier';
import { MixerService } from './mixer.service';
import { SidPanelPainter } from './sid-panel-painter';
import { TuneLoader } from './tune-loader';
import { DjStore, HOME_DECK_PANEL } from './dj-store';
import { FRAME_CLOCK_FACTORY, REPLAY_RUNNER_FACTORY, MIDI_ACCESS, TUNE_INSERTER, TUNE_RESOLVER } from './ports';
import type { IMidiAccess, MidiAccessState, MidiPermission, MidiPortOption } from './ports/midi-access';
import type { LoadSource } from './load-source';
import { logWarn } from '@teensyrom-nx/utils';

vi.mock('@teensyrom-nx/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@teensyrom-nx/utils')>();
  return { ...actual, logWarn: vi.fn(actual.logWarn), logError: vi.fn(actual.logError) };
});

/** Answers every replay request against the real `replayToFrame` — the same pattern core's own
 *  `create-sid-player.spec.ts` uses `FakeReplayRunner` for — so `seek` and a subtune switch have a
 *  working jump to land, without a worker thread. */
class FakeReplayRunner implements ReplayRunner {
  disposed = false;
  run(request: ReplayRequest): Promise<ReplayResponse> {
    try {
      return Promise.resolve({
        id: request.id,
        ok: true,
        result: replayToFrame(request.file, request.subtune, request.targetFrame, request.mutes),
      });
    } catch (error) {
      return Promise.resolve({
        id: request.id,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  dispose(): void {
    this.disposed = true;
  }
}

/** A well-formed PSID v2 byte array — lifted in shape from core's own `sid-file.parser.spec.ts`
 *  fixture builder, trimmed to the fields these specs vary. */
function buildSidFileBytes(options: { name: string; songs?: number; startSong?: number }): Uint8Array {
  const headerSize = 0x7c;
  const payload = [0xa9, 0x00, 0x60]; // LDA #0; RTS
  const buffer = new Uint8Array(headerSize + payload.length);
  const view = new DataView(buffer.buffer);
  writeAscii(buffer, 0x00, 'PSID');
  view.setUint16(0x04, 2, false);
  view.setUint16(0x06, headerSize, false);
  view.setUint16(0x08, 0x1000, false);
  view.setUint16(0x0a, 0x1000, false);
  view.setUint16(0x0c, 0x1003, false);
  view.setUint16(0x0e, options.songs ?? 1, false);
  view.setUint16(0x10, options.startSong ?? 1, false);
  view.setUint32(0x12, 0, false);
  writeAscii(buffer, 0x16, options.name);
  writeAscii(buffer, 0x36, 'Test Author');
  writeAscii(buffer, 0x56, '2024 Test');
  buffer.set(payload, headerSize);
  return buffer;
}

function writeAscii(buffer: Uint8Array, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) {
    buffer[offset + i] = text.charCodeAt(i);
  }
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

interface TuneFixture {
  readonly source: LoadSource;
  readonly bytes: Uint8Array;
  readonly reference: TuneReference;
}

let fixtureId = 0;

function makeFixture(overrides: { subtuneCount?: number; invalidBytes?: boolean } = {}): TuneFixture {
  const id = `tune-${++fixtureId}`;
  const subtuneCount = overrides.subtuneCount ?? 1;
  const bytes = overrides.invalidBytes
    ? new Uint8Array([0, 0, 0, 0])
    : buildSidFileBytes({ name: id, songs: subtuneCount });
  return {
    source: { deviceId: 'device-1', storageType: StorageType.Sd, path: `/${id}.sid`, fileName: `${id}.sid` },
    bytes,
    reference: {
      identity: { sidHash: id, subtune: 1 },
      title: id,
      author: 'Test Author',
      released: '2024 Test',
      subtuneCount,
      byteLength: bytes.byteLength,
    },
  };
}

describe('DeckService', () => {
  let service: DeckService;
  let runtime: DeckRuntime;
  let store: InstanceType<typeof DjStore>;
  let fakeBindings: {
    hydrate: ReturnType<typeof vi.fn>;
    bindDevice: ReturnType<typeof vi.fn>;
    enableMidi: ReturnType<typeof vi.fn>;
    identify: ReturnType<typeof vi.fn>;
  };
  let fileContentMock: ReturnType<typeof vi.fn>;
  let insertMock: ReturnType<typeof vi.fn>;
  let resolveMock: ReturnType<typeof vi.fn>;
  let outputPortForMock: ReturnType<typeof vi.fn>;
  let byPath: Map<string, TuneFixture>;
  let bySidHash: Map<string, TuneFixture>;

  function register(fixture: TuneFixture): TuneFixture {
    byPath.set(fixture.source.path, fixture);
    bySidHash.set(fixture.reference.identity.sidHash, fixture);
    return fixture;
  }

  function fileContentOf(fixture: TuneFixture): FileContent {
    return { bytes: fixture.bytes.buffer, byteLength: fixture.bytes.byteLength, fileName: fixture.source.fileName };
  }

  function playableOf(fixture: TuneFixture, subtune = 1): Playable {
    const identity: TuneIdentity = { sidHash: fixture.reference.identity.sidHash, subtune };
    return {
      reference: { ...fixture.reference, identity },
      bytes: fixture.bytes,
      index: indexRecord(identity),
    };
  }

  function fakeMidiAccess(outputPortFor: (id: string) => MidiOutputPort | null): IMidiAccess {
    return {
      accessState: signal<MidiAccessState>('granted'),
      ports: signal<readonly MidiPortOption[]>([]),
      lastError: signal<string | null>(null),
      queryPermission: (): Promise<MidiPermission> => Promise.resolve('granted'),
      requestAccess: (): Promise<void> => Promise.resolve(),
      holderOf: (): string | null => null,
      claim: (): boolean => true,
      release: (): void => undefined,
      outputPortFor,
    };
  }

  beforeEach(() => {
    vi.mocked(logWarn).mockClear();
    fixtureId = 0;
    byPath = new Map();
    bySidHash = new Map();

    fileContentMock = vi.fn((deviceId: string, storageType: StorageType, path: string) => {
      const fixture = byPath.get(path);
      if (fixture === undefined) {
        return throwError(() => new Error(`no fixture registered for ${path}`));
      }
      return of(fileContentOf(fixture));
    });
    insertMock = vi.fn(async (bytes: Uint8Array) => {
      for (const fixture of byPath.values()) {
        if (fixture.bytes.length === bytes.length && fixture.bytes.every((b, i) => b === bytes[i])) {
          return fixture.reference;
        }
      }
      throw new Error('no fixture matches the inserted bytes');
    });
    resolveMock = vi.fn(async (identity: TuneIdentity) => {
      const fixture = bySidHash.get(identity.sidHash);
      if (fixture === undefined) {
        return null;
      }
      return playableOf(fixture, identity.subtune);
    });
    outputPortForMock = vi.fn((): MidiOutputPort | null => null);

    const fileContentService: IFileContentService = { getFileContent: fileContentMock };

    // `DeckBindings` is faked wholesale here: `DeckService` only ever delegates to it, and this
    // spec's own coverage of `hydrate`/`bindDevice`/`enableMidi`/`identify` is exactly that
    // delegation, never the reconcile behaviour `deck-bindings.spec.ts` owns.
    fakeBindings = {
      hydrate: vi.fn().mockResolvedValue(undefined),
      bindDevice: vi.fn(),
      enableMidi: vi.fn().mockResolvedValue(undefined),
      identify: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        DeckService,
        DeckRuntime,
        TuneLoader,
        DjStore,
        { provide: DeckBindings, useValue: fakeBindings },
        { provide: FRAME_CLOCK_FACTORY, useValue: (): FakeClock => new FakeClock() },
        { provide: REPLAY_RUNNER_FACTORY, useValue: (): ReplayRunner => new FakeReplayRunner() },
        { provide: MIDI_ACCESS, useValue: fakeMidiAccess((id) => outputPortForMock(id) as MidiOutputPort | null) },
        { provide: FILE_CONTENT_SERVICE, useValue: fileContentService },
        { provide: TUNE_INSERTER, useValue: { insert: insertMock } },
        { provide: TUNE_RESOLVER, useValue: { resolve: resolveMock } },
      ],
    });

    // requestAnimationFrame is stubbed inert: these specs drive `sample()` directly rather than a
    // real animation frame, per the handoff's own testing note.
    vi.stubGlobal('requestAnimationFrame', (): number => 0);
    vi.stubGlobal('cancelAnimationFrame', (): void => undefined);

    TestBed.runInInjectionContext(() => {
      service = TestBed.inject(DeckService);
    });
    runtime = TestBed.inject(DeckRuntime);
    store = TestBed.inject(DjStore);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function loadAndWait(slot: 'A' | 'B', fixture: TuneFixture): Promise<void> {
    await service.load(slot, fixture.source);
  }

  it('writes loading → indexing → playing in order when the resolver scans, busy throughout', async () => {
    const fixture = register(makeFixture());
    let releaseResolve!: (playable: Playable | null) => void;
    resolveMock.mockImplementationOnce(
      (_identity: TuneIdentity, options?: { onScanStart?: () => void }) =>
        new Promise<Playable | null>((resolve) => {
          options?.onScanStart?.();
          releaseResolve = resolve;
        })
    );
    const playSpy = vi.spyOn(runtime, 'play');

    const load = service.load('A', fixture.source);
    expect(store.deck('A')().busy).toBe(true);
    await vi.waitFor(() => expect(store.deck('A')().status).toBe('loading'));

    await vi.waitFor(() => expect(resolveMock).toHaveBeenCalled());
    expect(store.deck('A')().status).toBe('indexing');
    expect(store.deck('A')().busy).toBe(true);
    expect(playSpy).not.toHaveBeenCalled();

    releaseResolve(playableOf(fixture));
    await load;

    expect(playSpy).toHaveBeenCalledTimes(1);
    expect(store.deck('A')().status).toBe('playing');
    expect(store.deck('A')().busy).toBe(false);
  });

  it('a cache-hit load whose resolver never scans records no loading or indexing write and lands playing directly', async () => {
    const fixture = register(makeFixture());
    await loadAndWait('A', fixture);
    expect(store.deck('A')().status).toBe('playing');

    const statusSpy = vi.spyOn(store, 'setDeckStatus');
    statusSpy.mockClear();

    await loadAndWait('A', fixture);

    const statusesWritten = statusSpy.mock.calls.map((call) => call[0].status);
    expect(statusesWritten).not.toContain('loading');
    expect(statusesWritten).not.toContain('indexing');
    expect(store.deck('A')().status).toBe('playing');
    expect(store.deck('A')().busy).toBe(false);
  });

  it('busy is true across a failed load and cleared once it settles', async () => {
    const fixture = register(makeFixture({ invalidBytes: true }));

    const load = service.load('A', fixture.source);
    expect(store.deck('A')().busy).toBe(true);

    await load;

    expect(store.deck('A')().status).toBe('failed');
    expect(store.deck('A')().busy).toBe(false);
  });

  it('the four gated commands no-op while busy, with a cache-hit load held in flight — not through a status write', async () => {
    const fixture = register(makeFixture({ subtuneCount: 2 }));
    await loadAndWait('A', fixture);
    expect(store.deck('A')().status).toBe('playing');

    let releaseResolve!: (playable: Playable | null) => void;
    resolveMock.mockImplementationOnce(
      () =>
        new Promise<Playable | null>((resolve) => {
          releaseResolve = resolve;
        })
    );

    const secondLoad = service.load('A', fixture.source);
    await vi.waitFor(() => expect(resolveMock).toHaveBeenCalledTimes(2));

    // The seam: nothing honest has happened yet, so the status is exactly what it was before the
    // drop — busy is what actually gates the transport here.
    expect(store.deck('A')().busy).toBe(true);
    expect(store.deck('A')().status).toBe('playing');

    const playSpy = vi.spyOn(runtime, 'play');
    const pauseSpy = vi.spyOn(runtime, 'pause');
    const stopSpy = vi.spyOn(runtime, 'stop');
    const seekSpy = vi.spyOn(runtime, 'seekToPercent');
    const resolveSubtuneSpy = vi.spyOn(TuneLoader.prototype, 'resolveSubtune');

    await service.togglePlayPause('A');
    service.stop('A');
    await service.seek('A', 50);
    await service.selectSubtune('A', 2);

    expect(playSpy).not.toHaveBeenCalled();
    expect(pauseSpy).not.toHaveBeenCalled();
    expect(stopSpy).not.toHaveBeenCalled();
    expect(seekSpy).not.toHaveBeenCalled();
    expect(resolveSubtuneSpy).not.toHaveBeenCalled();

    releaseResolve(playableOf(fixture));
    await secondLoad;

    expect(store.deck('A')().busy).toBe(false);
  });

  it('a drop on a playing slot stops it first', async () => {
    const fixtureA = register(makeFixture());
    await loadAndWait('A', fixtureA);
    expect(store.deck('A')().status).toBe('playing');

    const stopSpy = vi.spyOn(runtime, 'stop');
    const fixtureB = register(makeFixture());
    await loadAndWait('A', fixtureB);

    expect(stopSpy).toHaveBeenCalledWith('A');
    expect(store.deck('A')().loaded).toEqual(expect.objectContaining({ title: fixtureB.reference.title }));
  });

  it('never re-fetches a key already seen', async () => {
    const fixture = register(makeFixture());
    await loadAndWait('A', fixture);
    expect(fileContentMock).toHaveBeenCalledTimes(1);

    await loadAndWait('A', fixture);

    expect(fileContentMock).toHaveBeenCalledTimes(1);
  });

  it('a drop during a pending resolve discards the older playable — the runtime is loaded once, with the newer one', async () => {
    const fixtureA = register(makeFixture());
    const fixtureB = register(makeFixture());
    let releaseFirstResolve!: (playable: Playable | null) => void;
    resolveMock.mockImplementationOnce(
      () =>
        new Promise<Playable | null>((resolve) => {
          releaseFirstResolve = resolve;
        })
    );
    const runtimeLoadSpy = vi.spyOn(runtime, 'load');

    const first = service.load('A', fixtureA.source);
    await vi.waitFor(() => expect(resolveMock).toHaveBeenCalledTimes(1));

    const second = service.load('A', fixtureB.source);
    releaseFirstResolve(playableOf(fixtureA));

    await Promise.all([first, second]);

    expect(runtimeLoadSpy).toHaveBeenCalledTimes(1);
    expect(runtimeLoadSpy.mock.calls[0][1].reference.identity.sidHash).toBe(fixtureB.reference.identity.sidHash);
    expect(store.deck('A')().status).toBe('playing');
  });

  it('a parse error lands failed with the reason, leaving the other slot untouched', async () => {
    const fixture = register(makeFixture({ invalidBytes: true }));
    const bPlaySpy = vi.spyOn(runtime, 'play');

    await service.load('A', fixture.source);

    expect(store.deck('A')().status).toBe('failed');
    expect(store.deck('A')().error).not.toBeNull();
    expect(store.deck('B')().status).toBe('empty');
    expect(store.deck('B')().loaded).toBeNull();
    expect(bPlaySpy).not.toHaveBeenCalledWith('B');
  });

  it('a fetch error lands failed with the reason, leaving the other slot untouched', async () => {
    const source: LoadSource = {
      deviceId: 'device-1',
      storageType: StorageType.Sd,
      path: '/missing.sid',
      fileName: 'missing.sid',
    };
    fileContentMock.mockReturnValueOnce(throwError(() => new Error('device offline')));

    await service.load('A', source);

    expect(store.deck('A')().status).toBe('failed');
    expect(store.deck('A')().error).toBe('device offline');
    expect(store.deck('B')().status).toBe('empty');
  });

  it('a resolver rejection lands failed with the reason, leaving the other slot untouched', async () => {
    const fixture = register(makeFixture());
    resolveMock.mockRejectedValueOnce(new Error('scan crashed'));

    await service.load('A', fixture.source);

    expect(store.deck('A')().status).toBe('failed');
    expect(store.deck('A')().error).toBe('scan crashed');
    expect(store.deck('B')().status).toBe('empty');
    expect(store.deck('B')().loaded).toBeNull();
  });

  describe('play-call timing', () => {
    it('is unknown on an empty deck, lands from the engine on a load, and refreshes on a subtune switch', async () => {
      expect(store.deck('A')().playCallIntervalUs).toBeNull();

      await loadAndWait('A', register(makeFixture({ subtuneCount: 2 })));
      const interval = runtime.playCallIntervalUs('A');
      expect(interval).toBeGreaterThan(0);
      expect(store.deck('A')().playCallIntervalUs).toBe(interval);
      expect(store.deck('B')().playCallIntervalUs).toBeNull();

      store.setDeckTiming({ slot: 'A', playCallIntervalUs: null });
      await service.selectSubtune('A', 2);
      expect(store.deck('A')().playCallIntervalUs).toBe(runtime.playCallIntervalUs('A'));
    });
  });

  describe('togglePlayPause', () => {
    it('pauses a playing deck', async () => {
      const fixture = register(makeFixture());
      await loadAndWait('A', fixture);
      const pauseSpy = vi.spyOn(runtime, 'pause');

      await service.togglePlayPause('A');

      expect(pauseSpy).toHaveBeenCalledWith('A');
      expect(store.deck('A')().status).toBe('paused');
    });

    it('resumes a paused deck', async () => {
      const fixture = register(makeFixture());
      await loadAndWait('A', fixture);
      await service.togglePlayPause('A');
      expect(store.deck('A')().status).toBe('paused');
      const playSpy = vi.spyOn(runtime, 'play');

      await service.togglePlayPause('A');

      expect(playSpy).toHaveBeenCalledWith('A');
      expect(store.deck('A')().status).toBe('playing');
    });

    it('plays a stopped deck', async () => {
      const fixture = register(makeFixture());
      await loadAndWait('A', fixture);
      service.stop('A');
      expect(store.deck('A')().status).toBe('stopped');
      const playSpy = vi.spyOn(runtime, 'play');

      await service.togglePlayPause('A');

      expect(playSpy).toHaveBeenCalledWith('A');
      expect(store.deck('A')().status).toBe('playing');
    });

    it.each(['empty', 'loading', 'indexing', 'failed'] as const)('is a no-op while %s', async (status) => {
      store.setDeckStatus({ slot: 'A', status });
      const playSpy = vi.spyOn(runtime, 'play');
      const pauseSpy = vi.spyOn(runtime, 'pause');

      await service.togglePlayPause('A');

      expect(playSpy).not.toHaveBeenCalled();
      expect(pauseSpy).not.toHaveBeenCalled();
    });

    it('holds the deck busy across a pending resume so a racing stop() cannot supersede it', async () => {
      const fixture = register(makeFixture());
      await loadAndWait('A', fixture);
      await service.togglePlayPause('A'); // pause
      expect(store.deck('A')().status).toBe('paused');

      const realPlay = DeckRuntime.prototype.play.bind(runtime);
      let releasePlay!: () => void;
      const playSpy = vi.spyOn(runtime, 'play').mockImplementation(
        (slot) =>
          new Promise<void>((resolve) => {
            releasePlay = () => resolve(realPlay(slot));
          })
      );
      const stopSpy = vi.spyOn(runtime, 'stop');

      const toggle = service.togglePlayPause('A'); // resume
      await vi.waitFor(() => expect(playSpy).toHaveBeenCalledTimes(1));

      // Before the fix, `status` stayed 'paused' and `busy` stayed false through this whole await,
      // so `canStop` read true and a Stop click reached the runtime — superseding the still-pending
      // play and leaving the store reporting `playing` for a deck that never actually resumed.
      expect(store.deck('A')().busy).toBe(true);
      expect(store.transportSummary('A')().canStop).toBe(false);

      service.stop('A');
      expect(stopSpy).not.toHaveBeenCalled();
      expect(store.deck('A')().status).toBe('paused');

      releasePlay();
      await toggle;

      expect(store.deck('A')().busy).toBe(false);
      expect(store.deck('A')().status).toBe('playing');
    });
  });

  it('stop samples the position once and is a no-op unless playing or paused', async () => {
    const fixture = register(makeFixture());
    await loadAndWait('A', fixture);
    const sampleSpy = vi.spyOn(store, 'samplePosition');

    service.stop('A');

    expect(store.deck('A')().status).toBe('stopped');
    expect(sampleSpy).toHaveBeenCalledTimes(1);

    sampleSpy.mockClear();
    service.stop('A');
    expect(sampleSpy).not.toHaveBeenCalled();
  });

  it('seek maps percent through the basis and samples the position once it lands', async () => {
    const fixture = register(makeFixture());
    await loadAndWait('A', fixture);
    const seekSpy = vi.spyOn(runtime, 'seekToPercent');
    const sampleSpy = vi.spyOn(store, 'samplePosition');

    await service.seek('A', 50);

    expect(seekSpy).toHaveBeenCalledWith('A', 50);
    expect(sampleSpy).toHaveBeenCalledTimes(1);
  });

  it('seek and selectSubtune are no-ops while loading or indexing', async () => {
    store.setDeckStatus({ slot: 'A', status: 'indexing' });
    const seekSpy = vi.spyOn(runtime, 'seekToPercent');
    const resolveSubtuneSpy = vi.spyOn(TuneLoader.prototype, 'resolveSubtune');

    await service.seek('A', 50);
    await service.selectSubtune('A', 2);

    expect(seekSpy).not.toHaveBeenCalled();
    expect(resolveSubtuneSpy).not.toHaveBeenCalled();
  });

  describe('selectSubtune', () => {
    it('clamps to the tune range, resolves the new identity, and resumes playing when it started playing', async () => {
      const fixture = register(makeFixture({ subtuneCount: 3 }));
      await loadAndWait('A', fixture);
      expect(store.deck('A')().status).toBe('playing');

      await service.selectSubtune('A', 99);

      expect(store.deck('A')().subtune).toBe(3);
      expect(store.deck('A')().status).toBe('playing');
    });

    it('previousSubtune and nextSubtune step one subtune and stop at either end', async () => {
      const fixture = register(makeFixture({ subtuneCount: 3 }));
      await loadAndWait('A', fixture);
      expect(store.deck('A')().subtune).toBe(1);

      await service.previousSubtune('A');
      expect(store.deck('A')().subtune).toBe(1);

      await service.nextSubtune('A');
      await service.nextSubtune('A');
      expect(store.deck('A')().subtune).toBe(3);

      await service.nextSubtune('A');
      expect(store.deck('A')().subtune).toBe(3);

      await service.previousSubtune('A');
      expect(store.deck('A')().subtune).toBe(2);
    });

    it('previousSubtune and nextSubtune do nothing on an empty deck', async () => {
      const resolveSubtuneSpy = vi.spyOn(TuneLoader.prototype, 'resolveSubtune');

      await service.previousSubtune('A');
      await service.nextSubtune('A');

      expect(resolveSubtuneSpy).not.toHaveBeenCalled();
    });

    it('holds the new subtune paused when it started paused', async () => {
      const fixture = register(makeFixture({ subtuneCount: 3 }));
      await loadAndWait('A', fixture);
      await service.togglePlayPause('A');
      expect(store.deck('A')().status).toBe('paused');

      await service.selectSubtune('A', 2);

      expect(store.deck('A')().subtune).toBe(2);
      expect(store.deck('A')().status).toBe('paused');
    });

    it('stays stopped when it started stopped', async () => {
      const fixture = register(makeFixture({ subtuneCount: 3 }));
      await loadAndWait('A', fixture);
      service.stop('A');
      expect(store.deck('A')().status).toBe('stopped');

      await service.selectSubtune('A', 2);

      expect(store.deck('A')().subtune).toBe(2);
      expect(store.deck('A')().status).toBe('stopped');
    });

    it('a drop during a subtune resolve wins over the older subtune switch', async () => {
      const fixtureA = register(makeFixture({ subtuneCount: 3 }));
      const fixtureB = register(makeFixture());
      await loadAndWait('A', fixtureA);

      let releaseSubtuneResolve!: (playable: Playable | null) => void;
      resolveMock.mockImplementationOnce(
        () =>
          new Promise<Playable | null>((resolve) => {
            releaseSubtuneResolve = resolve;
          })
      );

      const subtuneSwitch = service.selectSubtune('A', 2);
      await vi.waitFor(() => expect(resolveMock).toHaveBeenCalledTimes(2));

      const drop = service.load('A', fixtureB.source);
      releaseSubtuneResolve(playableOf(fixtureA, 2));

      await Promise.all([subtuneSwitch, drop]);

      expect(store.deck('A')().loaded?.identity.sidHash).toBe(fixtureB.reference.identity.sidHash);
      expect(store.deck('A')().status).toBe('playing');
    });
  });

  it('setRepeat reaches the player and the store', () => {
    const setRepeatSpy = vi.spyOn(runtime, 'setRepeat');

    service.setRepeat('A', false);

    expect(setRepeatSpy).toHaveBeenCalledWith('A', false);
    expect(store.deck('A')().repeat).toBe(false);
  });

  it('a drop while an older load is awaiting play writes nothing once its play finally resolves', async () => {
    const fixtureA = register(makeFixture());
    const fixtureB = register(makeFixture());

    const realPlay = DeckRuntime.prototype.play.bind(runtime);
    let releaseFirstPlay!: () => void;
    const firstPlayGate = new Promise<void>((resolve) => {
      releaseFirstPlay = resolve;
    });
    const playSpy = vi.spyOn(runtime, 'play').mockImplementation((slot) => {
      if (playSpy.mock.calls.length === 1) {
        return firstPlayGate;
      }
      return realPlay(slot);
    });
    const statusSpy = vi.spyOn(store, 'setDeckStatus');

    const first = service.load('A', fixtureA.source);
    await vi.waitFor(() => expect(playSpy).toHaveBeenCalledTimes(1));

    const second = service.load('A', fixtureB.source);
    await second;

    expect(store.deck('A')().status).toBe('playing');
    expect(store.deck('A')().loaded?.identity.sidHash).toBe(fixtureB.reference.identity.sidHash);
    // The second command already ran its own finally and cleared busy for itself.
    expect(store.deck('A')().busy).toBe(false);

    const callsBeforeFirstSettles = statusSpy.mock.calls.length;
    releaseFirstPlay();
    await first;

    // The first command's own finally still runs, but its `sequence` guard must stop it from
    // clearing a flag the newer command already owns and cleared.
    expect(statusSpy.mock.calls.length).toBe(callsBeforeFirstSettles);
    expect(store.deck('A')().status).toBe('playing');
    expect(store.deck('A')().loaded?.identity.sidHash).toBe(fixtureB.reference.identity.sidHash);
    expect(store.deck('A')().busy).toBe(false);
  });

  it('a superseded load does not clear busy while the newer load is still in flight', async () => {
    const fixtureA = register(makeFixture());
    const fixtureB = register(makeFixture());

    const realPlay = DeckRuntime.prototype.play.bind(runtime);
    let releaseFirstPlay!: () => void;
    const playSpy = vi.spyOn(runtime, 'play').mockImplementation((slot) => {
      if (playSpy.mock.calls.length === 1) {
        return new Promise<void>((resolve) => {
          releaseFirstPlay = resolve;
        });
      }
      return realPlay(slot);
    });

    const first = service.load('A', fixtureA.source);
    await vi.waitFor(() => expect(playSpy).toHaveBeenCalledTimes(1));
    expect(store.deck('A')().busy).toBe(true);

    let releaseSecondResolve!: (playable: Playable | null) => void;
    resolveMock.mockImplementationOnce(
      () =>
        new Promise<Playable | null>((resolve) => {
          releaseSecondResolve = resolve;
        })
    );
    const second = service.load('A', fixtureB.source);
    await vi.waitFor(() => expect(resolveMock).toHaveBeenCalledTimes(2));

    // The superseded first command's play() now resolves and its own finally runs, but the
    // second command still owns the slot and is still mid-resolve — busy must stay true.
    releaseFirstPlay();
    await first;
    expect(store.deck('A')().busy).toBe(true);

    releaseSecondResolve(playableOf(fixtureB));
    await second;

    expect(store.deck('A')().busy).toBe(false);
    expect(store.deck('A')().status).toBe('playing');
    expect(store.deck('A')().loaded?.identity.sidHash).toBe(fixtureB.reference.identity.sidHash);
  });

  it('the façade warns once per unbound stretch, not per send', async () => {
    const fixture = register(makeFixture());

    await loadAndWait('A', fixture);
    await service.togglePlayPause('A'); // pause
    await service.togglePlayPause('A'); // resume — begin() sends again while still unbound

    expect(outputPortForMock).not.toHaveBeenCalled();
    expect(vi.mocked(logWarn)).toHaveBeenCalledTimes(1);
  });

  describe('speed, voices and the new-tune reset', () => {
    let mixer: MixerService;

    const HOME_VOICES = [
      { muted: false, held: false },
      { muted: false, held: false },
      { muted: false, held: false },
    ];

    function withKey(playable: Playable): Playable {
      return { ...playable, index: { ...playable.index, tonic: 9, mode: 'minor', camelot: '8A' } };
    }

    /** Every resolve answers with a keyed playable, so a loaded tune has a detected key to reset. */
    function resolveKeyed(): void {
      resolveMock.mockImplementation(async (identity: TuneIdentity) => {
        const fixture = bySidHash.get(identity.sidHash);
        return fixture === undefined ? null : withKey(playableOf(fixture, identity.subtune));
      });
    }

    function resolveUnkeyed(): void {
      resolveMock.mockImplementation(async (identity: TuneIdentity) => {
        const fixture = bySidHash.get(identity.sidHash);
        return fixture === undefined ? null : playableOf(fixture, identity.subtune);
      });
    }

    /** Pushes every panel control, speed and voice state of `slot` off home. */
    function shapeAway(slot: 'A' | 'B'): void {
      mixer.setFilterKnob(slot, 'cutoff', 600);
      mixer.setFilterKnob(slot, 'resonance', 4);
      mixer.setVoiceKnob(slot, 0, 'pulseWidth', 800);
      mixer.setVoiceKnob(slot, 1, 'coarse', 7);
      mixer.pressWaveform(slot, 2, 'pulse');
      mixer.setKeySemitones(slot, 3);
      mixer.pressFilterMode(slot, 'low-pass');
      service.setSpeed(slot, 1.3);
      service.setVoiceMuted(slot, 1, true);
      service.setVoiceHeld(slot, 2, true);
    }

    function expectHome(slot: 'A' | 'B'): void {
      const deck = store.deck(slot)();
      expect(deck.speed).toBe(1);
      expect(deck.voices).toEqual(HOME_VOICES);
      expect(runtime.snapshot(slot).tempo.multiplier).toBe(1);
      expect(runtime.snapshot(slot).voices).toEqual(HOME_VOICES);
      expect(store.deckPanel(slot)()).toEqual(HOME_DECK_PANEL);
    }

    beforeEach(() => {
      mixer = TestBed.inject(MixerService);
    });

    describe('speed and voice commands', () => {
      it('the speed fader sets the tempo within 0.5x-1.5x and the store follows', async () => {
        await loadAndWait('A', register(makeFixture()));

        service.setSpeed('A', 1.25);
        expect(runtime.snapshot('A').tempo.multiplier).toBe(1.25);
        expect(store.deck('A')().speed).toBe(1.25);

        service.setSpeed('A', 9);
        expect(store.deck('A')().speed).toBe(1.5);
        service.setSpeed('A', -3);
        expect(store.deck('A')().speed).toBe(0.5);
      });

      it('jumps follow the excursion rules out to 0.3x-1.7x, and Home with none open returns to 1.0x', async () => {
        await loadAndWait('A', register(makeFixture()));

        service.setSpeed('A', 1.5);
        service.jumpSpeed('A', 'up');
        expect(store.deck('A')().speed).toBeCloseTo(1.7);

        service.jumpSpeed('A', 'home');
        expect(store.deck('A')().speed).toBe(1.5);

        service.setSpeed('A', 1.4);
        service.jumpSpeed('A', 'home');
        expect(store.deck('A')().speed).toBe(1);
      });

      describe('nudge', () => {
        it('adds the amount over the fader value while held and releases onto it exactly', async () => {
          await loadAndWait('A', register(makeFixture()));
          service.setSpeed('A', 1.012);

          service.setNudge('A', 'up', true);
          expect(store.deck('A')().speed).toBeCloseTo(1.062, 10);
          expect(store.deck('A')().faderSpeed).toBe(1.012);
          expect(store.deck('A')().nudging).toBe(true);
          expect(runtime.snapshot('A').tempo.multiplier).toBe(store.deck('A')().speed);

          service.setNudge('A', 'up', false);
          expect(store.deck('A')().speed).toBe(1.012);
          expect(store.deck('A')().faderSpeed).toBe(1.012);
          expect(store.deck('A')().nudging).toBe(false);
        });

        it('follows the fader while held, and releases onto the moved fader', async () => {
          await loadAndWait('A', register(makeFixture()));
          service.setNudge('A', 'up', true);

          service.setSpeed('A', 1.1);
          expect(store.deck('A')().speed).toBeCloseTo(1.15, 10);
          expect(store.deck('A')().faderSpeed).toBe(1.1);

          service.setNudge('A', 'up', false);
          expect(store.deck('A')().speed).toBe(1.1);
        });

        it('plays the fader value with both pads held, and releasing down leaves the up amount applied', async () => {
          await loadAndWait('A', register(makeFixture()));
          service.setSpeed('A', 0.9);

          service.setNudge('A', 'up', true);
          service.setNudge('A', 'down', true);
          expect(store.deck('A')().speed).toBe(0.9);
          expect(store.deck('A')().nudging).toBe(true);

          service.setNudge('A', 'down', false);
          expect(store.deck('A')().speed).toBeCloseTo(0.95, 10);
          expect(store.deck('A')().nudging).toBe(true);

          service.setNudge('A', 'up', false);
          expect(store.deck('A')().speed).toBe(0.9);
          expect(store.deck('A')().nudging).toBe(false);
        });

        it('uses the given amount, and the default for a non-finite or non-positive one', async () => {
          await loadAndWait('A', register(makeFixture()));

          service.setNudge('A', 'up', true, 0.1);
          expect(store.deck('A')().speed).toBeCloseTo(1.1, 10);
          service.setNudge('A', 'up', false);

          for (const amount of [Number.NaN, Number.POSITIVE_INFINITY, 0, -0.2]) {
            service.setNudge('A', 'up', true, amount);
            expect(store.deck('A')().speed).toBeCloseTo(1.05, 10);
            service.setNudge('A', 'up', false);
          }
          expect(store.deck('A')().speed).toBe(1);
        });

        it('holds at the top of an excursion to 1.7 and releases exactly onto it', async () => {
          await loadAndWait('A', register(makeFixture()));
          service.setSpeed('A', 1.5);
          service.jumpSpeed('A', 'up');
          const limit = store.deck('A')().speed;
          expect(limit).toBeCloseTo(1.7);

          service.setNudge('A', 'up', true);
          expect(store.deck('A')().speed).toBe(limit);

          service.setNudge('A', 'up', false);
          expect(store.deck('A')().speed).toBe(limit);
          expect(store.deck('A')().nudging).toBe(false);
        });

        it('opens a jump from the fader value, not the nudged tempo, and closes onto it with the nudge still applied', async () => {
          await loadAndWait('A', register(makeFixture()));
          service.setSpeed('A', 1.2);
          service.setNudge('A', 'up', true);

          service.jumpSpeed('A', 'down');
          expect(store.deck('A')().speed).toBeCloseTo(0.75, 10);
          expect(store.deck('A')().faderSpeed).toBeCloseTo(0.7, 10);
          expect(store.deck('A')().nudging).toBe(true);

          service.jumpSpeed('A', 'home');
          expect(store.deck('A')().faderSpeed).toBe(1.2);
          expect(store.deck('A')().speed).toBeCloseTo(1.25, 10);

          service.setNudge('A', 'up', false);
          expect(store.deck('A')().speed).toBe(1.2);
        });

        it('keeps each deck its own nudges', async () => {
          await loadAndWait('A', register(makeFixture()));
          await loadAndWait('B', register(makeFixture()));

          service.setNudge('A', 'up', true);

          expect(store.deck('B')().speed).toBe(1);
          expect(store.deck('B')().nudging).toBe(false);
          expect(runtime.snapshot('B').tempo.multiplier).toBe(1);
        });

        it('a release is honoured on a deck that has stopped being shapeable, while a press is refused', async () => {
          await loadAndWait('A', register(makeFixture()));
          service.setNudge('A', 'up', true);
          store.setDeckSwitching({ slot: 'A', switching: true });
          vi.mocked(logWarn).mockClear();

          service.setNudge('A', 'down', true);
          expect(store.deck('A')().speed).toBeCloseTo(1.05, 10);
          expect(vi.mocked(logWarn)).toHaveBeenCalledTimes(1);

          service.setNudge('A', 'up', false);
          expect(store.deck('A')().speed).toBe(1);
          expect(store.deck('A')().nudging).toBe(false);
          expect(vi.mocked(logWarn)).toHaveBeenCalledTimes(1);
        });
      });

      it('mute and hold reach the engine and are reflected in the store', async () => {
        await loadAndWait('A', register(makeFixture()));

        service.setVoiceMuted('A', 0, true);
        service.setVoiceMuted('A', 1, true);
        service.setVoiceHeld('A', 2, true);
        expect(runtime.snapshot('A').voices).toEqual([
          { muted: true, held: false },
          { muted: true, held: false },
          { muted: false, held: true },
        ]);
        expect(store.deck('A')().voices).toEqual(runtime.snapshot('A').voices);

        service.setVoiceMuted('A', 0, false);
        service.setVoiceMuted('A', 1, false);
        expect(store.deck('A')().voices).toEqual([
          { muted: false, held: false },
          { muted: false, held: false },
          { muted: false, held: true },
        ]);

        service.setVoiceHeld('A', 2, false);
        expect(store.deck('A')().voices).toEqual(HOME_VOICES);
      });

      it('never touches the other deck', async () => {
        await loadAndWait('A', register(makeFixture()));
        await loadAndWait('B', register(makeFixture()));
        service.setSpeed('B', 1.2);
        service.setVoiceMuted('B', 0, true);
        const bBefore = store.deck('B')();

        service.setSpeed('A', 0.7);
        service.jumpSpeed('A', 'down');
        service.setVoiceMuted('A', 2, true);
        service.setVoiceHeld('A', 1, true);

        expect(store.deck('B')().speed).toBe(bBefore.speed);
        expect(store.deck('B')().voices).toEqual(bBefore.voices);
        expect(runtime.snapshot('B').tempo.multiplier).toBe(1.2);
      });

      it('a speed or hold change does not re-run the status, subtune or structure writes, but a transport change still does', async () => {
        await loadAndWait('A', register(makeFixture()));
        const statusSpy = vi.spyOn(store, 'setDeckStatus');
        const subtuneSpy = vi.spyOn(store, 'setDeckSubtune');
        const structureSpy = vi.spyOn(store, 'setDeckStructure');
        const controlsSpy = vi.spyOn(store, 'setDeckEngineControls');

        service.setSpeed('A', 1.1);
        service.setSpeed('A', 1.2);
        service.jumpSpeed('A', 'up');
        service.setVoiceHeld('A', 0, true);
        service.setVoiceHeld('A', 0, false);

        expect(statusSpy).not.toHaveBeenCalled();
        expect(subtuneSpy).not.toHaveBeenCalled();
        expect(structureSpy).not.toHaveBeenCalled();
        expect(controlsSpy).toHaveBeenCalledTimes(5);

        controlsSpy.mockClear();
        service.setSpeed('A', 1.2);
        service.setSpeed('A', 1.2);
        expect(controlsSpy).toHaveBeenCalledTimes(1);

        await service.togglePlayPause('A');
        expect(statusSpy).toHaveBeenCalledWith(expect.objectContaining({ slot: 'A', status: 'paused' }));
      });

      it('logs nothing on an accepted command', async () => {
        await loadAndWait('A', register(makeFixture()));
        vi.mocked(logWarn).mockClear();

        service.setSpeed('A', 1.2);
        service.jumpSpeed('A', 'up');
        service.setVoiceMuted('A', 0, true);
        service.setVoiceHeld('A', 1, true);
        service.setVoiceHeld('A', 1, false);

        expect(vi.mocked(logWarn)).not.toHaveBeenCalled();
      });
    });

    describe('command gating', () => {
      const commands: readonly [string, (target: DeckService) => void][] = [
        ['setSpeed', (target) => target.setSpeed('A', 1.3)],
        ['jumpSpeed', (target) => target.jumpSpeed('A', 'up')],
        ['setNudge', (target) => target.setNudge('A', 'up', true)],
        ['setVoiceMuted', (target) => target.setVoiceMuted('A', 0, true)],
        ['setVoiceHeld', (target) => target.setVoiceHeld('A', 0, true)],
      ];

      it.each(commands)('%s is refused on an empty deck with one warning naming the slot and command', (name, run) => {
        const tempoSpy = vi.spyOn(runtime, 'setTempo');
        const mutedSpy = vi.spyOn(runtime, 'setVoiceMuted');
        const heldSpy = vi.spyOn(runtime, 'setVoiceHeld');
        const clearSpy = vi.spyOn(runtime, 'clearVoiceMutes');
        vi.mocked(logWarn).mockClear();

        run(service);

        expect(tempoSpy).not.toHaveBeenCalled();
        expect(mutedSpy).not.toHaveBeenCalled();
        expect(heldSpy).not.toHaveBeenCalled();
        expect(clearSpy).not.toHaveBeenCalled();
        expect(vi.mocked(logWarn)).toHaveBeenCalledTimes(1);
        expect(vi.mocked(logWarn).mock.calls[0][0]).toMatch(new RegExp(`deck A.*${name}`));
      });

      it('every command is refused while a load is switching, and a hold release still passes', async () => {
        const fixture = register(makeFixture());
        await loadAndWait('A', fixture);
        service.setVoiceHeld('A', 0, true);

        let releaseResolve!: (playable: Playable | null) => void;
        resolveMock.mockImplementationOnce(
          () =>
            new Promise<Playable | null>((resolve) => {
              releaseResolve = resolve;
            })
        );
        const load = service.load('A', fixture.source);
        await vi.waitFor(() => expect(resolveMock).toHaveBeenCalledTimes(2));
        expect(store.deck('A')().switching).toBe(true);
        expect(store.canShape('A')()).toBe(false);

        const tempoSpy = vi.spyOn(runtime, 'setTempo');
        const mutedSpy = vi.spyOn(runtime, 'setVoiceMuted');
        const heldSpy = vi.spyOn(runtime, 'setVoiceHeld');
        const clearSpy = vi.spyOn(runtime, 'clearVoiceMutes');
        vi.mocked(logWarn).mockClear();

        for (const [, run] of commands) {
          run(service);
        }
        expect(vi.mocked(logWarn)).toHaveBeenCalledTimes(commands.length);
        expect(tempoSpy).not.toHaveBeenCalled();
        expect(mutedSpy).not.toHaveBeenCalled();
        expect(clearSpy).not.toHaveBeenCalled();
        expect(heldSpy).not.toHaveBeenCalled();

        vi.mocked(logWarn).mockClear();
        service.setVoiceHeld('A', 0, false);
        expect(heldSpy).toHaveBeenCalledWith('A', 0, false);
        expect(vi.mocked(logWarn)).not.toHaveBeenCalled();

        releaseResolve(playableOf(fixture));
        await load;
        expect(store.deck('A')().switching).toBe(false);
        service.setSpeed('A', 1.2);
        expect(store.deck('A')().speed).toBe(1.2);
      });

      it('commands are accepted while a Play press holds the deck busy', async () => {
        await loadAndWait('A', register(makeFixture()));
        await service.togglePlayPause('A'); // pause
        expect(store.deck('A')().status).toBe('paused');

        let releasePlay!: () => void;
        const playSpy = vi.spyOn(runtime, 'play').mockImplementation(
          () =>
            new Promise<void>((resolve) => {
              releasePlay = resolve;
            })
        );
        const toggle = service.togglePlayPause('A');
        await vi.waitFor(() => expect(playSpy).toHaveBeenCalledTimes(1));
        expect(store.deck('A')().busy).toBe(true);
        expect(store.deck('A')().switching).toBe(false);
        vi.mocked(logWarn).mockClear();

        service.setSpeed('A', 1.25);
        service.setVoiceMuted('A', 1, true);

        expect(store.deck('A')().speed).toBe(1.25);
        expect(store.deck('A')().voices[1].muted).toBe(true);
        expect(vi.mocked(logWarn)).not.toHaveBeenCalled();

        releasePlay();
        await toggle;
      });
    });

    describe('switching flag', () => {
      it('is set for the whole of a load and a subtune switch, and cleared when each settles', async () => {
        const fixture = register(makeFixture({ subtuneCount: 2 }));
        const switchingSpy = vi.spyOn(store, 'setDeckSwitching');

        const load = service.load('A', fixture.source);
        expect(store.deck('A')().switching).toBe(true);
        await load;
        expect(store.deck('A')().switching).toBe(false);

        const select = service.selectSubtune('A', 2);
        expect(store.deck('A')().switching).toBe(true);
        await select;
        expect(store.deck('A')().switching).toBe(false);

        expect(switchingSpy.mock.calls.map(([arg]) => arg.switching)).toEqual([true, false, true, false]);
      });

      it('is cleared when a load fails', async () => {
        await service.load('A', register(makeFixture({ invalidBytes: true })).source);

        expect(store.deck('A')().status).toBe('failed');
        expect(store.deck('A')().switching).toBe(false);
      });

      it('is left alone by a Play press', async () => {
        await loadAndWait('A', register(makeFixture()));
        const switchingSpy = vi.spyOn(store, 'setDeckSwitching');

        await service.togglePlayPause('A');
        await service.togglePlayPause('A');

        expect(switchingSpy).not.toHaveBeenCalled();
      });
    });

    describe('detected key', () => {
      it('lands the new tune key on a load, and clears when the index has none', async () => {
        resolveKeyed();
        await loadAndWait('A', register(makeFixture()));
        expect(store.deck('A')().detectedKey).toEqual({ tonic: 9, mode: 'minor', camelot: '8A' });

        resolveUnkeyed();
        await loadAndWait('A', register(makeFixture()));
        expect(store.deck('A')().detectedKey).toBeNull();
      });

      it('lands the new subtune key on a subtune switch', async () => {
        await loadAndWait('A', register(makeFixture({ subtuneCount: 2 })));
        expect(store.deck('A')().detectedKey).toBeNull();
        resolveKeyed();

        await service.selectSubtune('A', 2);

        expect(store.deck('A')().detectedKey).toEqual({ tonic: 9, mode: 'minor', camelot: '8A' });
      });

      it('is null when the index knows only part of the key', async () => {
        const fixture = register(makeFixture());
        resolveMock.mockImplementation(async (identity: TuneIdentity) => {
          const playable = playableOf(fixture, identity.subtune);
          return { ...playable, index: { ...playable.index, tonic: 9, mode: 'minor' as const, camelot: null } };
        });

        await loadAndWait('A', fixture);

        expect(store.deck('A')().detectedKey).toBeNull();
      });
    });

    describe('new-tune reset', () => {
      it('a drop returns speed, voices, the panel and the detected key to home on store and engine', async () => {
        resolveKeyed();
        await loadAndWait('A', register(makeFixture()));
        shapeAway('A');
        TestBed.inject(MixerApplier).applyDeck('A');
        expect(store.deck('A')().speed).toBe(1.3);
        expect(store.deck('A')().voices[1].muted).toBe(true);
        expect(store.deck('A')().detectedKey).not.toBeNull();

        const pitchSpy = vi.spyOn(runtime, 'setVoicePitch');
        const offsetSpy = vi.spyOn(runtime, 'setFieldOffset');
        const releaseSpy = vi.spyOn(runtime, 'releaseField');
        const holdSpy = vi.spyOn(runtime, 'holdField');
        const playSpy = vi.spyOn(runtime, 'play');
        resolveUnkeyed();

        await loadAndWait('A', register(makeFixture()));

        expectHome('A');
        expect(store.deck('A')().detectedKey).toBeNull();
        for (const voice of [0, 1, 2]) {
          expect(pitchSpy).toHaveBeenCalledWith('A', voice, 1);
        }
        expect(offsetSpy).toHaveBeenCalledWith('A', { name: 'cutoff' }, 0);
        expect(offsetSpy).toHaveBeenCalledWith('A', { name: 'pulseWidth', voice: 0 }, 0);
        const released = releaseSpy.mock.calls.filter(([slot]) => slot === 'A').map(([, field]) => field);
        expect(released).toEqual(
          expect.arrayContaining([{ name: 'waveform', voice: 2 }, { name: 'filterType' }])
        );
        expect(releaseSpy.mock.calls.every(([slot]) => slot === 'A')).toBe(true);
        expect(holdSpy).not.toHaveBeenCalled();
        expect(Math.max(...releaseSpy.mock.invocationCallOrder)).toBeLessThan(playSpy.mock.invocationCallOrder[0]);
      });

      it('a drop releases both nudges', async () => {
        const fixture = register(makeFixture());
        await loadAndWait('A', fixture);
        service.setSpeed('A', 1.2);
        service.setNudge('A', 'up', true);
        service.setNudge('A', 'down', true, 0.1);

        await loadAndWait('A', fixture);

        expect(store.deck('A')().nudging).toBe(false);
        expect(store.deck('A')().faderSpeed).toBe(1);
        expect(store.deck('A')().speed).toBe(1);

        service.setNudge('A', 'up', false);
        expect(store.deck('A')().speed).toBe(1);
      });

      it('a subtune switch releases both nudges', async () => {
        await loadAndWait('A', register(makeFixture({ subtuneCount: 3 })));
        service.setNudge('A', 'up', true);
        service.setNudge('A', 'down', true, 0.1);

        await service.selectSubtune('A', 2);

        expect(store.deck('A')().nudging).toBe(false);
        expect(store.deck('A')().speed).toBe(1);
        expect(runtime.snapshot('A').tempo.multiplier).toBe(1);
      });

      it('a subtune switch returns the same controls to home', async () => {
        resolveKeyed();
        await loadAndWait('A', register(makeFixture({ subtuneCount: 3 })));
        shapeAway('A');
        service.jumpSpeed('A', 'up');

        await service.selectSubtune('A', 2);

        expectHome('A');
        expect(store.deck('A')().subtune).toBe(2);

        // The excursion the jump opened is gone with the reset: a fresh Home press is a plain 1.0x.
        service.setSpeed('A', 1.2);
        service.jumpSpeed('A', 'home');
        expect(store.deck('A')().speed).toBe(1);
      });

      it('applies the reset before the loader awaits anything and before the tune is loaded or played', async () => {
        const fixture = register(makeFixture());
        await loadAndWait('A', fixture);
        shapeAway('A');

        const stopSpy = vi.spyOn(runtime, 'stop');
        const tempoSpy = vi.spyOn(runtime, 'setTempo');
        const clearSpy = vi.spyOn(runtime, 'clearVoiceMutes');
        const heldSpy = vi.spyOn(runtime, 'setVoiceHeld');
        const pitchSpy = vi.spyOn(runtime, 'setVoicePitch');
        const loadSpy = vi.spyOn(runtime, 'load');
        const playSpy = vi.spyOn(runtime, 'play');
        resolveMock.mockClear();

        await loadAndWait('A', fixture);

        const first = (spy: { mock: { invocationCallOrder: number[] } }): number => spy.mock.invocationCallOrder[0];
        const resolveOrder = resolveMock.mock.invocationCallOrder[0];
        expect(first(stopSpy)).toBeLessThan(first(tempoSpy));
        for (const reset of [tempoSpy, clearSpy, heldSpy, pitchSpy]) {
          expect(first(reset)).toBeLessThan(resolveOrder);
        }
        expect(resolveOrder).toBeLessThan(first(loadSpy));
        expect(first(loadSpy)).toBeLessThan(first(playSpy));
      });

      it('a failed load still ends at home', async () => {
        await loadAndWait('A', register(makeFixture()));
        shapeAway('A');

        await service.load('A', register(makeFixture({ invalidBytes: true })).source);

        expect(store.deck('A')().status).toBe('failed');
        expectHome('A');
      });

      it('a superseded load never resets the newer one once it has started', async () => {
        const fixtureA = register(makeFixture());
        const fixtureB = register(makeFixture());
        const realPlay = DeckRuntime.prototype.play.bind(runtime);
        let releaseFirstPlay!: () => void;
        const firstPlayGate = new Promise<void>((resolve) => {
          releaseFirstPlay = resolve;
        });
        const playSpy = vi.spyOn(runtime, 'play').mockImplementation((slot) => {
          if (playSpy.mock.calls.length === 1) {
            return firstPlayGate;
          }
          return realPlay(slot);
        });
        const resetSpy = vi.spyOn(TestBed.inject(MixerApplier), 'resetPanel');

        const first = service.load('A', fixtureA.source);
        await vi.waitFor(() => expect(playSpy).toHaveBeenCalledTimes(1));
        await service.load('A', fixtureB.source);
        expect(resetSpy).toHaveBeenCalledTimes(2);

        service.setSpeed('A', 1.3);
        service.setVoiceMuted('A', 1, true);

        releaseFirstPlay();
        await first;

        expect(resetSpy).toHaveBeenCalledTimes(2);
        expect(store.deck('A')().speed).toBe(1.3);
        expect(store.deck('A')().voices[1].muted).toBe(true);
        expect(store.deck('A')().loaded?.identity.sidHash).toBe(fixtureB.reference.identity.sidHash);
      });

      it('leaves the other deck untouched', async () => {
        await loadAndWait('A', register(makeFixture()));
        await loadAndWait('B', register(makeFixture()));
        shapeAway('B');
        const bDeck = store.deck('B')();
        const bPanel = store.deckPanel('B')();
        const tempoSpy = vi.spyOn(runtime, 'setTempo');

        await loadAndWait('A', register(makeFixture()));
        await service.selectSubtune('A', 1);

        expect(store.deck('B')().speed).toBe(bDeck.speed);
        expect(store.deck('B')().voices).toEqual(bDeck.voices);
        expect(store.deckPanel('B')()).toEqual(bPanel);
        expect(runtime.snapshot('B').tempo.multiplier).toBe(1.3);
        expect(tempoSpy.mock.calls.every(([slot]) => slot === 'A')).toBe(true);
      });
    });
  });

  describe('animation-frame loop', () => {
    let pending: Map<number, FrameRequestCallback>;
    let nextFrameId: number;
    let paintSpy: MockInstance<SidPanelPainter['paint']>;
    let positionSpy: MockInstance<DeckRuntime['position']>;
    let hidden = false;

    /** Paints for the A deck only: B's idle still-paint also runs through the frame queue. */
    function paintsOfA(): number {
      return paintSpy.mock.calls.filter(([slot]) => slot === 'A').length;
    }

    function setPosition(position: number): void {
      positionSpy.mockReturnValue(frames(position));
    }

    /** Runs the callbacks that are due now; any a callback schedules wait for the next call. */
    function runFrame(): void {
      const due = [...pending.values()];
      pending.clear();
      for (const callback of due) {
        callback(0);
      }
    }

    function setHidden(value: boolean): void {
      hidden = value;
      document.dispatchEvent(new Event('visibilitychange'));
    }

    beforeEach(async () => {
      pending = new Map();
      nextFrameId = 1;
      hidden = false;
      vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback): number => {
        pending.set(nextFrameId, callback);
        return nextFrameId++;
      });
      vi.stubGlobal('cancelAnimationFrame', (id: number): void => {
        pending.delete(id);
      });
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });

      paintSpy = vi.spyOn(TestBed.inject(SidPanelPainter), 'paint');
      positionSpy = vi.spyOn(runtime, 'position');
      await loadAndWait('A', register(makeFixture()));
      TestBed.flushEffects();
      paintSpy.mockClear();
      setPosition(5);
    });

    afterEach(() => {
      delete (document as { hidden?: boolean }).hidden;
    });

    it('paints only when the position moved, and always reschedules', () => {
      runFrame();
      expect(paintsOfA()).toBe(1);
      expect(pending.size).toBe(1);

      runFrame();
      expect(paintsOfA()).toBe(1);
      expect(pending.size).toBe(1);

      setPosition(6);
      runFrame();
      expect(paintsOfA()).toBe(2);
    });

    it('does not paint while paused', async () => {
      await service.togglePlayPause('A');
      TestBed.flushEffects();
      expect(store.deck('A')().status).toBe('paused');
      // The painter's own one-shot paint for the status change runs here; the loop's must not.
      runFrame();
      paintSpy.mockClear();

      setPosition(9);
      runFrame();

      expect(paintsOfA()).toBe(0);
      expect(pending.size).toBe(0);
    });

    it('does not paint while the document is hidden, and resumes when it is shown', () => {
      setHidden(true);
      setPosition(9);
      runFrame();
      expect(paintsOfA()).toBe(0);
      expect(pending.size).toBe(0);

      setHidden(false);
      runFrame();
      expect(paintsOfA()).toBe(1);
    });

    describe('a fault while painting', () => {
      function attachNoopTargets(): void {
        const level = { setLiveLevel: vi.fn() };
        const light = { setLiveLight: vi.fn() };
        const strip = {
          waveforms: [light, light, light, light],
          coarse: level,
          fine: level,
          pulseWidth: level,
          attack: level,
          decay: level,
          sustain: level,
          release: level,
          ring: light,
          sync: light,
          filter: light,
        };
        TestBed.inject(SidPanelPainter).attach('A', {
          voices: [strip, strip, strip],
          cutoff: level,
          resonance: level,
          filterModes: [light, light, light],
        });
      }

      it('a failing register read keeps the loop running and warns once', () => {
        vi.spyOn(runtime, 'readRegisters').mockImplementation(() => {
          throw new Error('DeckRuntime: slot A has not been built');
        });
        paintSpy.mockRestore();
        vi.mocked(logWarn).mockClear();
        attachNoopTargets();

        for (const position of [5, 6, 7]) {
          setPosition(position);
          runFrame();
          expect(pending.size).toBe(1);
        }

        const warnings = vi.mocked(logWarn).mock.calls.filter(([message]) => message.startsWith('SidPanelPainter'));
        expect(warnings).toHaveLength(1);
      });

      it('a paint that throws still leaves the next frame scheduled', () => {
        paintSpy.mockImplementation((slot) => {
          if (slot === 'A') {
            throw new Error('boom');
          }
        });

        expect(() => runFrame()).toThrow('boom');

        expect(pending.size).toBe(1);
      });
    });
  });

  describe('binding delegation', () => {
    it('hydrate delegates to DeckBindings', async () => {
      await service.hydrate();
      expect(fakeBindings.hydrate).toHaveBeenCalledTimes(1);
    });

    it('bindDevice delegates the slot and device id', () => {
      service.bindDevice('A', '19277260');
      expect(fakeBindings.bindDevice).toHaveBeenCalledWith('A', '19277260');
    });

    it('enableMidi delegates', async () => {
      await service.enableMidi();
      expect(fakeBindings.enableMidi).toHaveBeenCalledTimes(1);
    });

    it('identify delegates the slot', () => {
      service.identify('A');
      expect(fakeBindings.identify).toHaveBeenCalledWith('A');
    });
  });
});
