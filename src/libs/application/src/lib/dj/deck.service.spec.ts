import { TestBed } from '@angular/core/testing';
import { signal, type WritableSignal } from '@angular/core';
import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import { of, throwError } from 'rxjs';
import { FakeClock, frames, milliseconds, replayToFrame } from '@sidablist/core';
import type { ReplayRequest, ReplayResponse, ReplayRunner } from '@sidablist/core';
import type { MidiOutputPort } from '@sidablist/asid';
import {
  InMemorySetStore,
  InMemoryTuneMemoryStore,
  createRow,
  createSet,
  subtuneMemoryOf,
  type LoopMarker,
  type PlainValue,
  type Playable,
  type TuneIdentity,
  type TuneMemory,
  type TuneReference,
  type TuneSet,
} from '@sidablist/tunes';
import type { TuneIndexRecord } from '@sidablist/analysis';
import {
  ALERT_SERVICE,
  FILE_CONTENT_SERVICE,
  StorageType,
  type Device,
  type FileContent,
  type IFileContentService,
} from '@teensyrom-nx/domain';
import { DeviceStore } from '../device/device-store';
import { DeckService } from './deck.service';
import { DeckLoops } from './deck-loops';
import { DeckMemoryKeeper } from './deck-memory-keeper';
import { DeckHand } from './deck-hand';
import { DeckRuntime } from './deck-runtime';
import { DeckBindings } from './deck-bindings';
import { MixerApplier } from './mixer-applier';
import { MixerService } from './mixer.service';
import { LIVE_PAINT_CLOCK } from './live-paint-clock';
import { PlayheadPainter } from './playhead-painter';
import { SidPanelPainter } from './sid-panel-painter';
import { TuneLoader } from './tune-loader';
import { DjStore, HOME_DECK_PANEL, type DeckHolding, type DeckMixerSettings } from './dj-store';
import { decodeMixerSettings, encodeMixerSettings } from './loops/marker-settings-codec';
import { decodeRowSettings, encodeRowSettings, type DeckRowSettings } from './loops/row-settings-codec';
import { DjSets } from './sets/dj-sets';
import { decodeRowHost } from './sets/row-host';
import {
  DJ_LIBRARY_STATE_REPOSITORY,
  FRAME_CLOCK_FACTORY,
  REGISTER_RECORDER_FACTORY,
  REPLAY_RUNNER_FACTORY,
  MIDI_ACCESS,
  SET_STORE,
  TUNE_INSERTER,
  TUNE_MEMORY_STORE,
  TUNE_RESOLVER,
} from './ports';
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
        result: replayToFrame(
          request.file,
          request.subtune,
          request.targetFrame,
          request.mutes,
          request.start
        ),
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
  const payload = [0xa9, 0x00, 0x60, 0x60]; // init: LDA #0; RTS — play: RTS
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
  let clocks: FakeClock[];
  let setStore: InMemorySetStore;
  let memoryStore: InMemoryTuneMemoryStore;
  let libraryState: { load: ReturnType<typeof vi.fn>; save: ReturnType<typeof vi.fn> };
  let alerts: { warning: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let usableDevices: WritableSignal<Device[]>;
  /** The animation-frame loop's clock: the specs that drive the loop keep it at the frame's time. */
  let loopNowMs: number;

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
    clocks = [];
    setStore = new InMemorySetStore();
    memoryStore = new InMemoryTuneMemoryStore();
    libraryState = { load: vi.fn().mockResolvedValue(null), save: vi.fn().mockResolvedValue(undefined) };
    alerts = { warning: vi.fn(), error: vi.fn() };
    usableDevices = signal<Device[]>([{ deviceId: 'device-1' } as Device]);
    loopNowMs = 0;

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
        {
          provide: FRAME_CLOCK_FACTORY,
          useValue: (): FakeClock => {
            const clock = new FakeClock();
            clocks.push(clock);
            return clock;
          },
        },
        { provide: REPLAY_RUNNER_FACTORY, useValue: (): ReplayRunner => new FakeReplayRunner() },
        {
          provide: REGISTER_RECORDER_FACTORY,
          useValue: () => ({ record: () => Promise.resolve(null), dispose: () => undefined }),
        },
        { provide: MIDI_ACCESS, useValue: fakeMidiAccess((id) => outputPortForMock(id) as MidiOutputPort | null) },
        { provide: FILE_CONTENT_SERVICE, useValue: fileContentService },
        { provide: TUNE_INSERTER, useValue: { insert: insertMock } },
        { provide: TUNE_RESOLVER, useValue: { resolve: resolveMock } },
        { provide: SET_STORE, useValue: setStore },
        { provide: TUNE_MEMORY_STORE, useValue: memoryStore },
        { provide: DJ_LIBRARY_STATE_REPOSITORY, useValue: libraryState },
        { provide: ALERT_SERVICE, useValue: alerts },
        { provide: DeviceStore, useValue: { usableDevices } },
        { provide: LIVE_PAINT_CLOCK, useValue: () => loopNowMs },
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

  /** Seeds the tune's latest memory — what a new row copies — with one subtune's kept state. */
  async function keepFor(
    identity: TuneIdentity,
    kept: { markers?: readonly LoopMarker[]; settings?: PlainValue }
  ): Promise<void> {
    const before = await memoryStore.load(identity.sidHash);
    const others = (before?.subtunes ?? []).filter((entry) => entry.subtune !== identity.subtune);
    const memory: TuneMemory = {
      sidHash: identity.sidHash,
      lastSubtune: before?.lastSubtune ?? 1,
      subtunes: [
        ...others,
        {
          subtune: identity.subtune,
          markers: kept.markers ?? [],
          ...(kept.settings === undefined ? {} : { settings: kept.settings }),
        },
      ].sort((a, b) => a.subtune - b.subtune),
      updated: '2026-01-01T00:00:00.000Z',
    };
    await memoryStore.save(memory);
  }

  function keepMarkers(identity: TuneIdentity, markers: readonly LoopMarker[]): Promise<void> {
    return keepFor(identity, { markers });
  }

  /** The markers the open sets keep for the tune's subtune. */
  function rowMarkers(identity: TuneIdentity): readonly LoopMarker[] {
    for (const set of Object.values(store.sets.open())) {
      const row = set.rows.find((candidate) => candidate.tune.sidHash === identity.sidHash);
      if (row !== undefined) {
        return subtuneMemoryOf(row, identity.subtune)?.markers ?? [];
      }
    }
    return [];
  }

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

  it('reads the playhead percent from the engine on demand, held to the length, writing nothing', () => {
    const positionSpy = vi.spyOn(runtime, 'position').mockReturnValue(frames(50));
    expect(service.playheadPercent('A')).toBe(0);

    store.setDeckStructure({
      slot: 'A',
      structure: { loopStartFrame: null, loopPeriodFrames: null, endedAtFrame: null },
      lengthFrames: 200,
    });
    const sampleSpy = vi.spyOn(store, 'samplePosition');

    expect(service.playheadPercent('A')).toBe(25);
    positionSpy.mockReturnValue(frames(500));
    expect(service.playheadPercent('A')).toBe(100);
    expect(sampleSpy).not.toHaveBeenCalled();
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
    let playheadSpy: MockInstance<PlayheadPainter['paint']>;
    let positionSpy: MockInstance<DeckRuntime['position']>;
    let hidden = false;

    /** Paints for the A deck only: B's idle still-paint also runs through the frame queue. */
    function paintsOfA(): number {
      return paintSpy.mock.calls.filter(([slot]) => slot === 'A').length;
    }

    /** The loop's playhead paints for the A deck. */
    function playheadPaintsOfA(): number {
      return playheadSpy.mock.calls.filter(([slot]) => slot === 'A').length;
    }

    function setPosition(position: number): void {
      positionSpy.mockReturnValue(frames(position));
    }

    /** The time of the `n`th frame of a 60 Hz display. */
    function frameAt(n: number): number {
      return 1000 + (n * 1000) / 60;
    }

    /** Runs the callbacks that are due now as the `n`th frame of a 60 Hz display, with the loop's
     *  clock at that frame's time; any a callback schedules wait for the next call. */
    function runFrame(n = 0): void {
      loopNowMs = frameAt(n);
      const due = [...pending.values()];
      pending.clear();
      for (const callback of due) {
        callback(frameAt(n));
      }
    }

    function setHidden(value: boolean): void {
      hidden = value;
      document.dispatchEvent(new Event('visibilitychange'));
    }

    /** Lets the loop's sleep between frames run out, so it asks for its next frame. */
    function wake(): void {
      vi.runOnlyPendingTimers();
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
      playheadSpy = vi.spyOn(TestBed.inject(PlayheadPainter), 'paint');
      positionSpy = vi.spyOn(runtime, 'position');
      await loadAndWait('A', register(makeFixture()));
      TestBed.flushEffects();
      paintSpy.mockClear();
      playheadSpy.mockClear();
      setPosition(5);
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    });

    afterEach(() => {
      vi.useRealTimers();
      delete (document as { hidden?: boolean }).hidden;
    });

    it('paints only when the position moved, and always comes back for another frame', () => {
      runFrame(0);
      expect(paintsOfA()).toBe(1);
      wake();
      expect(pending.size).toBe(1);

      runFrame(2);
      expect(paintsOfA()).toBe(1);
      wake();
      expect(pending.size).toBe(1);

      setPosition(6);
      runFrame(4);
      expect(paintsOfA()).toBe(2);
    });

    it('sleeps between the frames it paints on rather than asking for every display frame', () => {
      runFrame(0);

      expect(pending.size).toBe(0);
      expect(vi.getTimerCount()).toBe(1);

      wake();
      expect(pending.size).toBe(1);
    });

    it('asks for the very next frame when the one it woke to is too early to paint on, and paints that', () => {
      runFrame(0);
      wake();
      setPosition(6);

      // A frame before the paint interval is up is turned away.
      runFrame(1);
      expect(paintsOfA()).toBe(1);
      expect(pending.size).toBe(1);
      expect(vi.getTimerCount()).toBe(0);

      runFrame(2);
      expect(paintsOfA()).toBe(2);
      expect(playheadPaintsOfA()).toBe(2);
    });

    it('paints both decks in the same frame', async () => {
      await loadAndWait('B', register(makeFixture()));
      TestBed.flushEffects();
      runFrame(0);
      paintSpy.mockClear();
      playheadSpy.mockClear();

      setPosition(6);
      wake();
      runFrame(2);

      expect(paintSpy.mock.calls.map(([slot]) => slot)).toEqual(['A', 'B']);
      expect(playheadSpy.mock.calls.map(([slot]) => slot)).toEqual(['A', 'B']);
    });

    it('hands every frame that moved to the playhead painter, and never writes the playhead into the store', () => {
      const sampleSpy = vi.spyOn(store, 'samplePosition');
      const sampledBefore = store.positions.A();

      runFrame(0);
      setPosition(6);
      wake();
      runFrame(2);
      wake();
      runFrame(4);
      setPosition(7);
      wake();
      runFrame(6);

      expect(playheadPaintsOfA()).toBe(3);
      expect(paintsOfA()).toBe(3);
      expect(sampleSpy).not.toHaveBeenCalled();
      expect(store.positions.A()).toBe(sampledBefore);
    });

    it('does not paint while paused', async () => {
      await service.togglePlayPause('A');
      TestBed.flushEffects();
      expect(store.deck('A')().status).toBe('paused');
      // The painters' own one-shot paints for the status change run here; the loop's must not.
      runFrame(0);
      paintSpy.mockClear();
      playheadSpy.mockClear();

      setPosition(9);
      wake();
      runFrame(2);

      expect(paintsOfA()).toBe(0);
      expect(playheadPaintsOfA()).toBe(0);
      expect(pending.size).toBe(0);
    });

    it('polls a paused deck while the engine is in varispeed, and stops when it leaves', async () => {
      await service.togglePlayPause('A');
      TestBed.flushEffects();
      runFrame(0);
      expect(pending.size).toBe(0);
      const controls = (varispeed: boolean) =>
        store.setDeckEngineControls({
          slot: 'A',
          speed: 1,
          faderSpeed: 1,
          nudging: false,
          varispeed,
          voices: store.decks().A.voices,
        });

      controls(true);
      TestBed.flushEffects();
      // The loop's first frame, and the painters' one-shot paints for the hand landing.
      runFrame(2);
      paintSpy.mockClear();
      setPosition(9);
      wake();
      runFrame(4);
      expect(paintsOfA()).toBe(1);
      wake();
      expect(pending.size).toBe(1);

      controls(false);
      TestBed.flushEffects();
      // The loop's frame is cancelled; all that is left is each painter's one-shot repaint of where
      // the hand let go, which schedules nothing after it.
      setPosition(10);
      runFrame(6);
      expect(paintsOfA()).toBe(2);
      expect(pending.size).toBe(0);
    });

    it('does not paint while the document is hidden, and resumes when it is shown', () => {
      setHidden(true);
      setPosition(9);
      runFrame(0);
      expect(paintsOfA()).toBe(0);
      expect(pending.size).toBe(0);

      setHidden(false);
      runFrame(2);
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
          runFrame((position - 5) * 2);
          wake();
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

        wake();
        expect(pending.size).toBe(1);
      });
    });
  });

  describe('loop markers', () => {
    const markersOf = (slot: 'A' | 'B') => store.loops()[slot].markers;

    /** Moves the playhead of a loaded deck and marks it. */
    async function markAt(slot: 'A' | 'B', frame: number): Promise<void> {
      await runtime.seekToFrame(slot, frame);
      service.addMarker(slot);
    }

    it("brings a tune's markers back when it is loaded again after another", async () => {
      const first = register(makeFixture());
      const second = register(makeFixture());
      await loadAndWait('A', first);
      await markAt('A', 100);
      const saved = markersOf('A');
      expect(saved).toHaveLength(1);

      await loadAndWait('A', second);
      expect(markersOf('A')).toEqual([]);

      await loadAndWait('A', first);
      expect(markersOf('A').map((marker) => marker.id)).toEqual(saved.map((marker) => marker.id));
      expect(store.loops().A.selectedId).toBe(saved[0].id);
    });

    it("shows each subtune's own list when the subtune changes", async () => {
      const fixture = register(makeFixture({ subtuneCount: 2 }));
      await loadAndWait('A', fixture);
      await markAt('A', 100);

      await service.selectSubtune('A', 2);
      expect(markersOf('A')).toEqual([]);
      await markAt('A', 200);

      await service.selectSubtune('A', 1);
      expect(markersOf('A').map((marker) => marker.start.frame)).toEqual([100]);
      await service.selectSubtune('A', 2);
      expect(markersOf('A').map((marker) => marker.start.frame)).toEqual([200]);
    });

    it('shows an edit made on either deck on both when they hold the same tune', async () => {
      const fixture = register(makeFixture());
      await loadAndWait('A', fixture);
      await loadAndWait('B', fixture);

      await markAt('A', 100);
      expect(markersOf('B').map((marker) => marker.start.frame)).toEqual([100]);

      await markAt('B', 200);
      expect(markersOf('A').map((marker) => marker.start.frame)).toEqual([100, 200]);
    });

    it("turns a loaded tune's markers ready as the engine builds them", async () => {
      const fixture = register(makeFixture());
      await keepMarkers(fixture.reference.identity, [
        { id: 'saved', start: { frame: 60, offsetFrames: 0 }, end: null, voices: [0, 1, 2] },
      ]);

      await loadAndWait('A', fixture);

      await vi.waitFor(() => expect(markersOf('A').map((marker) => marker.ready)).toEqual([true]));
    });

    it('refuses every marker command while the deck has nothing shapeable loaded', async () => {
      service.addMarker('A');
      service.selectMarker('A', 'x');
      service.moveMarkerSelection('A', 1);
      service.selectMarkerAt('A', 0);
      service.setMarkerEnd('A');
      service.clearMarkerEnd('A');
      service.deleteMarker('A');
      await service.nudgeMarker('A', 'start', 5);
      await service.snapMarker('A', 'start', 'next');
      await service.toggleMarker('A');
      service.stopMarkerLoop('A');
      service.toggleMarkerGlobal('A');
      service.toggleMarkerWrap('A');

      const refusals = vi
        .mocked(logWarn)
        .mock.calls.filter(([message]) => message.startsWith('DeckService'));
      expect(refusals).toHaveLength(13);
      expect(markersOf('A')).toEqual([]);
    });

    it('edits through the commands once a tune is loaded', async () => {
      const fixture = register(makeFixture());
      await loadAndWait('A', fixture);
      await markAt('A', 100);
      await markAt('A', 300);

      service.selectMarkerAt('A', 0);
      await runtime.seekToFrame('A', 180);
      service.setMarkerEnd('A');
      await service.nudgeMarker('A', 'start', 7);
      service.moveMarkerSelection('A', 1);
      service.deleteMarker('A');

      expect(markersOf('A')).toHaveLength(1);
      expect(markersOf('A')[0]).toMatchObject({ end: { frame: 180 }, start: { offsetFrames: 7 } });
      expect(store.loops().A.selectedId).toBe(markersOf('A')[0].id);
    });
  });

  describe('performing markers', () => {
    const loopMarker = (id: string, start: number, end: number): LoopMarker => ({
      id,
      start: { frame: start, offsetFrames: 0 },
      end: { frame: end, offsetFrames: 0 },
      voices: [0, 1, 2],
    });
    const cueMarker = (id: string, frame: number): LoopMarker => ({
      id,
      start: { frame, offsetFrames: 0 },
      end: null,
      voices: [0, 1, 2],
    });
    const loopsOf = (slot: 'A' | 'B') => store.loops()[slot];
    const engineLoop = (slot: 'A' | 'B') => runtime.snapshot(slot).loop;
    const engineQueue = (slot: 'A' | 'B') => runtime.snapshot(slot).tune?.queuedJump ?? null;
    let tickCount = 0;

    /** Fires frames of the deck's clock, one at a time. */
    function tick(slot: 'A' | 'B', count = 1): void {
      for (let i = 0; i < count; i++) {
        clocks[slot === 'A' ? 0 : 1].tick(milliseconds(++tickCount));
      }
    }

    function tickUntil(slot: 'A' | 'B', done: () => boolean, limit = 800): void {
      for (let i = 0; i < limit && !done(); i++) {
        tick(slot);
      }
      expect(done()).toBe(true);
    }

    /** Loads a tune carrying a loop at 100–120, a loop at 300–320 and a cue at 500, all ready. */
    async function loadPlayable(slot: 'A' | 'B', detectedMoments: number[] = []): Promise<void> {
      const fixture = register(makeFixture());
      await keepMarkers(fixture.reference.identity, [
        loopMarker('a', 100, 120),
        loopMarker('b', 300, 320),
        cueMarker('c', 500),
      ]);
      if (detectedMoments.length > 0) {
        resolveMock.mockImplementation(async (identity: TuneIdentity) => {
          const playable = playableOf(fixture, identity.subtune);
          return {
            ...playable,
            index: {
              ...playable.index,
              detectedMoments: detectedMoments.map((frame) => ({ frame, strength: 1 })),
            },
          };
        });
      }
      await loadAndWait(slot, fixture);
      await vi.waitFor(() => expect(loopsOf(slot).markers.every((marker) => marker.ready)).toBe(true));
    }

    it('presses the selected marker when no id is given, and does nothing with none selected', async () => {
      const fixture = register(makeFixture());
      await loadAndWait('A', fixture);
      await service.toggleMarker('A');
      expect(loopsOf('A').runningId).toBeNull();

      await loadPlayable('A');
      await service.toggleMarker('A');

      expect(loopsOf('A').runningId).toBe('a');
      expect(engineLoop('A')).toEqual({ startFrame: 100, endFrame: 120, varispeedStart: 'stop' });
    });

    it('presses the marker it is given', async () => {
      await loadPlayable('A');

      await service.toggleMarker('A', 'b');

      expect(loopsOf('A').runningId).toBe('b');
      expect(loopsOf('A').selectedId).toBe('a');
    });

    it('queues behind a running loop, lands it at the end of the lap, and lets the loop go on Stop', async () => {
      await loadPlayable('A');
      await service.toggleMarker('A', 'a');
      await service.toggleMarker('A', 'b');
      expect(loopsOf('A').queuedId).toBe('b');

      tickUntil('A', () => loopsOf('A').runningId === 'b');
      expect(engineLoop('A')).toEqual({ startFrame: 300, endFrame: 320, varispeedStart: 'stop' });

      service.stopMarkerLoop('A');
      expect(loopsOf('A').runningId).toBeNull();
      expect(engineLoop('A')).toBeNull();
      expect(store.loopsSummary('A')().canStop).toBe(false);
    });

    it('starts playback first when the deck is paused, then engages', async () => {
      await loadPlayable('A');
      await service.togglePlayPause('A');
      expect(store.deck('A')().status).toBe('paused');

      await service.toggleMarker('A', 'a');

      expect(store.deck('A')().status).toBe('playing');
      expect(loopsOf('A').runningId).toBe('a');
    });

    it('starts playback from the top first when the deck is stopped, then engages', async () => {
      await loadPlayable('A');
      service.stop('A');
      expect(store.deck('A')().status).toBe('stopped');

      await service.toggleMarker('A', 'a');
      await vi.waitFor(() => expect(runtime.position('A')).toBeGreaterThanOrEqual(100));

      expect(store.deck('A')().status).toBe('playing');
      expect(loopsOf('A').runningId).toBe('a');
      expect(engineLoop('A')).toEqual({ startFrame: 100, endFrame: 120, varispeedStart: 'stop' });
    });

    it('plays the selected marker now when no id is given, and does nothing with none selected', async () => {
      const fixture = register(makeFixture());
      await loadAndWait('A', fixture);
      await service.playMarkerNow('A');
      expect(loopsOf('A').runningId).toBeNull();

      await loadPlayable('A');
      await service.playMarkerNow('A');

      expect(loopsOf('A').runningId).toBe('a');
      expect(engineLoop('A')).toEqual({ startFrame: 100, endFrame: 120, varispeedStart: 'stop' });
    });

    it('plays a marker now over a running loop, without queuing behind it', async () => {
      await loadPlayable('A');
      await service.toggleMarker('A', 'a');

      await service.playMarkerNow('A', 'b');

      expect(loopsOf('A').runningId).toBe('b');
      expect(loopsOf('A').queuedId).toBeNull();
      expect(runtime.position('A')).toBe(300);
    });

    it('starts playback first when the deck is paused, then plays the marker now', async () => {
      await loadPlayable('A');
      await service.togglePlayPause('A');
      expect(store.deck('A')().status).toBe('paused');

      await service.playMarkerNow('A', 'a');

      expect(store.deck('A')().status).toBe('playing');
      expect(loopsOf('A').runningId).toBe('a');
    });

    it('does not start playback to let a running marker go', async () => {
      await loadPlayable('A');
      await service.toggleMarker('A', 'a');
      await service.togglePlayPause('A');
      expect(store.deck('A')().status).toBe('paused');
      const play = vi.spyOn(runtime, 'play');

      await service.toggleMarker('A', 'a');

      expect(play).not.toHaveBeenCalled();
      expect(store.deck('A')().status).toBe('paused');
      expect(loopsOf('A').runningId).toBeNull();
    });

    it('clears the markers when the transport stops', async () => {
      await loadPlayable('A');
      await service.toggleMarker('A', 'a');
      await service.toggleMarker('A', 'b');

      service.stop('A');

      expect(loopsOf('A').runningId).toBeNull();
      expect(loopsOf('A').queuedId).toBeNull();
      expect(loopsOf('A').selectedId).toBe('a');
      expect(store.loopsSummary('A')().canStop).toBe(false);
    });

    it('drops a marker still waiting for its start to be ready when the transport stops', async () => {
      await loadPlayable('A');
      // The nudge moves the start to a frame the engine has yet to prepare, and its audition waits.
      await service.nudgeMarker('A', 'start', 5);
      expect(loopsOf('A').markers[0].ready).toBe(false);
      expect(loopsOf('A').queuedId).toBe('a');

      service.stop('A');
      const stoppedAt = runtime.position('A');
      await vi.waitFor(() => expect(loopsOf('A').markers.every((marker) => marker.ready)).toBe(true));

      expect(loopsOf('A').queuedId).toBeNull();
      expect(loopsOf('A').runningId).toBeNull();
      expect(engineLoop('A')).toBeNull();
      expect(runtime.position('A')).toBe(stoppedAt);
    });

    it('disengages the marker loop on a scrub and leaves repeat alone', async () => {
      await loadPlayable('A');
      await service.toggleMarker('A', 'a');
      await service.toggleMarker('A', 'b');
      expect(store.deck('A')().repeat).toBe(true);

      await service.seek('A', 50);

      expect(loopsOf('A').runningId).toBeNull();
      expect(loopsOf('A').queuedId).toBeNull();
      expect(engineLoop('A')).toBeNull();
      expect(engineQueue('A')).toBeNull();
      expect(store.deck('A')().repeat).toBe(true);
      expect(runtime.snapshot('A').repeatTrack).toBe(true);
    });

    it('leaves the loops alone on a scrub when nothing is running or queued', async () => {
      await loadPlayable('A');
      const disengage = vi.spyOn(TestBed.inject(DeckLoops), 'disengage');

      await service.seek('A', 50);

      expect(disengage).not.toHaveBeenCalled();
    });

    describe('marker settings', () => {
      const SETTINGS_A: DeckMixerSettings = {
        panel: { ...HOME_DECK_PANEL, keySemitones: 3, cutoff: 40 },
        mutes: [true, false, false],
      };
      const SETTINGS_E: DeckMixerSettings = {
        panel: { ...HOME_DECK_PANEL, keySemitones: -4 },
        mutes: [false, true, false],
      };
      const engineMutes = (slot: 'A' | 'B') =>
        runtime.snapshot(slot).voices.map((voice) => voice.muted);
      const markerOf = (slot: 'A' | 'B', id: string) =>
        loopsOf(slot).markers.find((marker) => marker.id === id);

      /** Loads a tune with a loop (a) and a cue (e) that keep their own settings, and a cue (c)
       *  that shares the main track's. */
      async function loadWithSettings(slot: 'A' | 'B'): Promise<TuneFixture> {
        const fixture = register(makeFixture());
        await keepMarkers(fixture.reference.identity, [
          {
            ...loopMarker('a', 100, 120),
            settings: encodeMixerSettings(SETTINGS_A),
            usesOwnSettings: true,
          },
          cueMarker('c', 500),
          {
            ...cueMarker('e', 700),
            settings: encodeMixerSettings(SETTINGS_E),
            usesOwnSettings: true,
          },
        ]);
        await loadAndWait(slot, fixture);
        await vi.waitFor(() =>
          expect(loopsOf(slot).markers.every((marker) => marker.ready)).toBe(true)
        );
        return fixture;
      }

      it('flips the selected marker GBL, and applies at once to the one running', async () => {
        await loadWithSettings('A');
        service.selectMarker('A', 'c');

        service.toggleMarkerGlobal('A');
        expect(markerOf('A', 'c')?.ownSettings).toBe(true);
        expect(loopsOf('A').settingsInPlayId).toBeNull();

        service.toggleMarkerGlobal('A');
        expect(markerOf('A', 'c')?.ownSettings).toBe(false);

        await service.toggleMarker('A', 'a');
        service.selectMarker('A', 'a');
        service.toggleMarkerGlobal('A');
        expect(loopsOf('A').settingsInPlayId).toBeNull();
        expect(engineMutes('A')).toEqual([false, false, false]);

        service.toggleMarkerGlobal('A');
        expect(loopsOf('A').settingsInPlayId).toBe('a');
        expect(engineMutes('A')).toEqual(SETTINGS_A.mutes);
        expect(store.panel().A).toEqual(SETTINGS_A.panel);
      });

      it('flips the selected loop WRAP without touching its settings', async () => {
        await loadWithSettings('A');
        service.selectMarker('A', 'a');
        const before = markerOf('A', 'a');

        service.toggleMarkerWrap('A');

        expect(markerOf('A', 'a')).toEqual({ ...before, wraps: true });
        service.toggleMarkerWrap('A');
        expect(markerOf('A', 'a')?.wraps).toBe(false);
      });

      it('keeps a performer mute in the marker whose own settings are in play', async () => {
        await loadWithSettings('A');
        await service.toggleMarker('A', 'a');

        service.setVoiceMuted('A', 2, true);

        expect(markerOf('A', 'a')?.settings?.mutes).toEqual([true, false, true]);
        expect(engineMutes('A')).toEqual([true, false, true]);
      });

      it('keeps a performer mute in the main track while it is in play, writing no marker', async () => {
        await loadWithSettings('A');
        const markers = loopsOf('A').markers;

        service.setVoiceMuted('A', 1, true);

        expect(loopsOf('A').markers).toBe(markers);
        expect(engineMutes('A')).toEqual([false, true, false]);
      });

      it('lets a cue own settings go on a scrub, though nothing runs or queues', async () => {
        await loadWithSettings('A');
        await service.toggleMarker('A', 'e');
        expect(loopsOf('A').runningId).toBeNull();
        expect(loopsOf('A').settingsInPlayId).toBe('e');
        expect(store.panel().A).toEqual(SETTINGS_E.panel);

        await service.seek('A', 50);

        expect(loopsOf('A').settingsInPlayId).toBeNull();
        expect(store.panel().A).toBe(HOME_DECK_PANEL);
        expect(engineMutes('A')).toEqual([false, false, false]);
      });

      it('lets a cue own settings go when the transport stops', async () => {
        await loadWithSettings('A');
        await service.toggleMarker('A', 'e');

        service.stop('A');

        expect(loopsOf('A').settingsInPlayId).toBeNull();
        expect(store.panel().A).toBe(HOME_DECK_PANEL);
        expect(engineMutes('A')).toEqual([false, false, false]);
      });

      it("never writes a tune change back into the marker that was in play", async () => {
        const first = await loadWithSettings('A');
        await service.toggleMarker('A', 'a');
        const save = vi.spyOn(TestBed.inject(DeckLoops), 'saveSettingsInPlay');
        const savedBefore = rowMarkers(first.reference.identity).find((marker) => marker.id === 'a');

        await loadAndWait('A', register(makeFixture()));

        expect(save).not.toHaveBeenCalled();
        expect(loopsOf('A').settingsInPlayId).toBeNull();
        expect(store.panel().A).toBe(HOME_DECK_PANEL);
        expect(engineMutes('A')).toEqual([false, false, false]);
        expect(rowMarkers(first.reference.identity).find((marker) => marker.id === 'a')).toEqual(
          savedBefore
        );
      });

      it('never writes a subtune change back into the marker that was in play', async () => {
        const fixture = register(makeFixture({ subtuneCount: 2 }));
        await keepMarkers(fixture.reference.identity, [
          {
            ...loopMarker('a', 100, 120),
            settings: encodeMixerSettings(SETTINGS_A),
            usesOwnSettings: true,
          },
        ]);
        await loadAndWait('A', fixture);
        await vi.waitFor(() => expect(loopsOf('A').markers.every((marker) => marker.ready)).toBe(true));
        await service.toggleMarker('A', 'a');
        const save = vi.spyOn(TestBed.inject(DeckLoops), 'saveSettingsInPlay');

        await service.selectSubtune('A', 2);

        expect(save).not.toHaveBeenCalled();
        expect(store.panel().A).toBe(HOME_DECK_PANEL);
        await service.selectSubtune('A', 1);
        expect(markerOf('A', 'a')?.settings).toEqual(SETTINGS_A);
      });
    });

    describe('auditioning an edit', () => {
      const refusalsFrom = (source: 'DeckLoops' | 'DeckService') =>
        vi.mocked(logWarn).mock.calls.filter(([message]) => message.startsWith(`${source}:`));

      it('engages the nudged start of an idle marker from its new position', async () => {
        await loadPlayable('A');
        service.selectMarker('A', 'b');

        await service.nudgeMarker('A', 'start', 5);

        await vi.waitFor(() => expect(loopsOf('A').runningId).toBe('b'));
        expect(engineLoop('A')).toEqual({ startFrame: 305, endFrame: 320, varispeedStart: 'stop' });
        await vi.waitFor(() => expect(runtime.position('A')).toBe(305));
      });

      it('arms a nudged end and lands before it', async () => {
        await loadPlayable('A');
        service.selectMarker('A', 'b');

        await service.nudgeMarker('A', 'end', 10);

        await vi.waitFor(() => expect(loopsOf('A').runningId).toBe('b'));
        expect(engineLoop('A')).toEqual({ startFrame: 300, endFrame: 330, varispeedStart: 'stop' });
      });

      it('seeks a running loop to its nudged end without arming it again', async () => {
        await loadPlayable('A');
        await service.toggleMarker('A', 'a');
        const seek = vi.spyOn(runtime, 'seekToFrame');
        const setActiveLoop = vi.spyOn(runtime, 'setActiveLoop');

        await service.nudgeMarker('A', 'end', 10);

        expect(engineLoop('A')).toEqual({ startFrame: 100, endFrame: 130, varispeedStart: 'stop' });
        expect(setActiveLoop).toHaveBeenCalledTimes(1);
        expect(seek).toHaveBeenCalledTimes(1);
        expect(seek).toHaveBeenCalledWith('A', 100);
      });

      it('seeks a running loop to its nudged start once that start is ready', async () => {
        await loadPlayable('A');
        await service.toggleMarker('A', 'a');
        const seek = vi.spyOn(runtime, 'seekToFrame');

        await service.nudgeMarker('A', 'start', 5);

        await vi.waitFor(() => expect(seek).toHaveBeenCalledWith('A', 105));
        expect(seek).toHaveBeenCalledTimes(1);
        expect(loopsOf('A').runningId).toBe('a');
        expect(loopsOf('A').queuedId).toBeNull();
        expect(engineLoop('A')).toEqual({ startFrame: 105, endFrame: 120, varispeedStart: 'stop' });
      });

      it('auditions a snap on an idle marker', async () => {
        await loadPlayable('A', [110]);

        await service.snapMarker('A', 'start', 'next');

        expect(loopsOf('A').markers[0].start.offsetFrames).toBe(10);
        await vi.waitFor(() => expect(loopsOf('A').runningId).toBe('a'));
        await vi.waitFor(() => expect(runtime.position('A')).toBe(110));
        expect(engineLoop('A')).toEqual({ startFrame: 110, endFrame: 120, varispeedStart: 'stop' });
      });

      it('auditions a snap that finds no moment in reach', async () => {
        await loadPlayable('A');
        const seek = vi.spyOn(runtime, 'seekToFrame');

        await service.snapMarker('A', 'start', 'next');

        expect(loopsOf('A').markers[0].start.offsetFrames).toBe(0);
        expect(loopsOf('A').runningId).toBe('a');
        expect(seek).toHaveBeenCalledWith('A', 100);
      });

      it('starts a paused deck first, then auditions', async () => {
        await loadPlayable('A');
        await service.togglePlayPause('A');
        expect(store.deck('A')().status).toBe('paused');

        await service.nudgeMarker('A', 'end', 10);

        expect(store.deck('A')().status).toBe('playing');
        expect(loopsOf('A').runningId).toBe('a');
        expect(engineLoop('A')).toEqual({ startFrame: 100, endFrame: 130, varispeedStart: 'stop' });
      });

      it('restarts a stopped deck from the top first, then auditions', async () => {
        await loadPlayable('A');
        service.stop('A');
        expect(store.deck('A')().status).toBe('stopped');

        await service.snapMarker('A', 'end', 'next');
        await vi.waitFor(() => expect(runtime.position('A')).toBeGreaterThanOrEqual(100));

        expect(store.deck('A')().status).toBe('playing');
        expect(loopsOf('A').runningId).toBe('a');
        expect(engineLoop('A')).toEqual({ startFrame: 100, endFrame: 120, varispeedStart: 'stop' });
      });

      it('skips the audition when the selection moves while playback starts', async () => {
        await loadPlayable('A');
        await service.togglePlayPause('A');
        const seek = vi.spyOn(runtime, 'seekToFrame');

        const edit = service.nudgeMarker('A', 'end', 10);
        expect(loopsOf('A').markers[0].end?.offsetFrames).toBe(10);
        service.selectMarker('A', 'b');
        await edit;

        expect(store.deck('A')().status).toBe('playing');
        expect(loopsOf('A').runningId).toBeNull();
        expect(engineLoop('A')).toBeNull();
        expect(seek).not.toHaveBeenCalled();
      });

      it('neither starts playback nor seeks for a refused edit on a paused deck', async () => {
        await loadPlayable('A');
        await service.togglePlayPause('A');
        service.selectMarker('A', 'c');
        const play = vi.spyOn(runtime, 'play');
        const seek = vi.spyOn(runtime, 'seekToFrame');
        vi.mocked(logWarn).mockClear();

        await service.nudgeMarker('A', 'end', 5);
        await service.snapMarker('A', 'end', 'next');

        expect(store.deck('A')().status).toBe('paused');
        expect(play).not.toHaveBeenCalled();
        expect(seek).not.toHaveBeenCalled();
        expect(refusalsFrom('DeckLoops')).toHaveLength(2);
        expect(refusalsFrom('DeckService')).toHaveLength(0);
      });

      it("never moves the other deck's playhead on a shared tune", async () => {
        const fixture = register(makeFixture());
        await keepMarkers(fixture.reference.identity, [
          loopMarker('a', 100, 120),
        ]);
        await loadAndWait('A', fixture);
        await loadAndWait('B', fixture);
        await vi.waitFor(() => expect(loopsOf('B').markers[0].ready).toBe(true));
        await service.toggleMarker('B', 'a');
        const seek = vi.spyOn(runtime, 'seekToFrame');

        await service.nudgeMarker('A', 'start', 5);
        await service.nudgeMarker('A', 'end', 10);

        await vi.waitFor(() => expect(seek).toHaveBeenCalledWith('A', 105));
        await vi.waitFor(() =>
          expect(engineLoop('B')).toEqual({
            startFrame: 105,
            endFrame: 130,
            varispeedStart: 'stop',
          })
        );
        expect(seek.mock.calls.every(([slot]) => slot === 'A')).toBe(true);
      });
    });

    it('leaves the speed alone through a toggle, a landing and a stop', async () => {
      await loadPlayable('A');
      service.setSpeed('A', 1.25);
      const speed = store.deck('A')().speed;
      expect(speed).toBe(1.25);

      await service.toggleMarker('A', 'a');
      await service.toggleMarker('A', 'b');
      tickUntil('A', () => loopsOf('A').runningId === 'b');
      service.stopMarkerLoop('A');

      expect(store.deck('A')().speed).toBe(speed);
      expect(runtime.snapshot('A').tempo.multiplier).toBe(speed);
    });

    it("follows an edit made on the other deck's list through the same tune", async () => {
      const fixture = register(makeFixture());
      await keepMarkers(fixture.reference.identity, [
        loopMarker('a', 100, 120),
      ]);
      await loadAndWait('A', fixture);
      await loadAndWait('B', fixture);
      await vi.waitFor(() => expect(loopsOf('B').markers[0].ready).toBe(true));
      await service.toggleMarker('B', 'a');

      await service.nudgeMarker('A', 'end', 10);
      expect(engineLoop('B')).toEqual({ startFrame: 100, endFrame: 130, varispeedStart: 'stop' });

      service.clearMarkerEnd('A');
      expect(loopsOf('B').runningId).toBeNull();
      expect(engineLoop('B')).toBeNull();
      expect(store.loopsSummary('B')().canStop).toBe(false);
    });
  });

  describe('rows and kept state', () => {
    const WRITE_DELAY_MS = 250;

    const SHAPED: DeckRowSettings = {
      mixer: {
        panel: { ...HOME_DECK_PANEL, cutoff: 200, keySemitones: 2 },
        mutes: [true, false, false],
      },
      speed: 1.25,
      repeat: false,
    };
    const OTHER: DeckRowSettings = {
      mixer: { panel: { ...HOME_DECK_PANEL, resonance: 5 }, mutes: [false, true, false] },
      speed: 0.8,
      repeat: true,
    };
    const HOME_VOICES = [false, false, false];

    let mixer: MixerService;
    let sets: DjSets;

    beforeEach(() => {
      vi.useFakeTimers();
      mixer = TestBed.inject(MixerService);
      sets = TestBed.inject(DjSets);
      TestBed.inject(DeckMemoryKeeper).install();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    /** Runs the pending effects, lets `ms` of fake time pass, and runs the effects that caused. */
    async function settle(ms = 0): Promise<void> {
      TestBed.flushEffects();
      await vi.advanceTimersByTimeAsync(ms);
      TestBed.flushEffects();
    }

    function keepSettings(identity: TuneIdentity, settings: DeckRowSettings): Promise<void> {
      return keepFor(identity, { settings: encodeRowSettings(settings) });
    }

    function holdingOf(slot: 'A' | 'B'): DeckHolding {
      const holding = store.sets.holdings()[slot];
      if (holding === null) {
        throw new Error(`deck ${slot} holds no row`);
      }
      return holding;
    }

    function currentSet(): TuneSet {
      const id = store.sets.currentSetId();
      if (id === null) {
        throw new Error('no current set');
      }
      return store.sets.open()[id];
    }

    const keptBy = (holding: DeckHolding): DeckRowSettings | null =>
      decodeRowSettings(sets.subtuneSettingsOf(holding));

    const engineMutes = (slot: 'A' | 'B') => runtime.snapshot(slot).voices.map((voice) => voice.muted);

    /** What a deck shows is `settings`, in the store and in the engine. */
    function expectRestored(slot: 'A' | 'B', settings: DeckRowSettings): void {
      const deck = store.deck(slot)();
      expect(store.panel()[slot]).toEqual(settings.mixer.panel);
      expect(engineMutes(slot)).toEqual(settings.mixer.mutes);
      expect(deck.voices.map((voice) => voice.muted)).toEqual(settings.mixer.mutes);
      expect(runtime.snapshot(slot).tempo.multiplier).toBe(settings.speed);
      expect(deck.faderSpeed).toBe(settings.speed);
      expect(deck.repeat).toBe(settings.repeat);
      expect(runtime.snapshot(slot).repeatTrack).toBe(settings.repeat);
    }

    function expectHome(slot: 'A' | 'B'): void {
      expect(store.panel()[slot]).toEqual(HOME_DECK_PANEL);
      expect(engineMutes(slot)).toEqual(HOME_VOICES);
      expect(runtime.snapshot(slot).tempo.multiplier).toBe(1);
      expect(store.deck(slot)().faderSpeed).toBe(1);
    }

    async function markAt(slot: 'A' | 'B', frame: number): Promise<void> {
      await runtime.seekToFrame(slot, frame);
      service.addMarker(slot);
    }

    describe('a drop', () => {
      it('appends a row to the current set and holds it', async () => {
        const fixture = register(makeFixture());

        await loadAndWait('A', fixture);

        const [row] = currentSet().rows;
        expect(currentSet().rows).toHaveLength(1);
        expect(row.tune.sidHash).toBe(fixture.reference.identity.sidHash);
        expect(decodeRowHost(row.host)?.source).toEqual(fixture.source);
        expect(holdingOf('A')).toEqual({
          setId: currentSet().id,
          rowId: row.id,
          sidHash: row.tune.sidHash,
          subtune: 1,
        });
        expect(store.deck('A')().status).toBe('playing');
      });

      it('reuses the row the SID already has, for either deck', async () => {
        const fixture = register(makeFixture());
        await loadAndWait('A', fixture);

        await loadAndWait('B', fixture);
        await loadAndWait('A', fixture);

        expect(currentSet().rows).toHaveLength(1);
        expect(holdingOf('B').rowId).toBe(holdingOf('A').rowId);
      });

      it('copies what the tune\'s latest version kept into the new row', async () => {
        const fixture = register(makeFixture());
        await keepSettings(fixture.reference.identity, SHAPED);

        await loadAndWait('A', fixture);

        expect(keptBy(holdingOf('A'))).toEqual(SHAPED);
      });
    });

    describe('loadRow', () => {
      it('loads any open set\'s row at the subtune it was last on, replacing what plays', async () => {
        const first = register(makeFixture({ subtuneCount: 3 }));
        const second = register(makeFixture());
        await keepSettings({ ...first.reference.identity, subtune: 2 }, OTHER);
        await loadAndWait('A', first);
        await service.selectSubtune('A', 2);
        const heldFirst = holdingOf('A');
        await loadAndWait('A', second);
        await settle();

        await service.loadRow('A', heldFirst.setId, heldFirst.rowId);

        expect(holdingOf('A')).toEqual(heldFirst);
        expect(store.deck('A')().loaded?.identity).toEqual({
          sidHash: first.reference.identity.sidHash,
          subtune: 2,
        });
        expect(store.deck('A')().status).toBe('playing');
        expectRestored('A', OTHER);
      });

      it('loads a row of a set that is not the current one', async () => {
        const fixture = register(makeFixture());
        await loadAndWait('A', fixture);
        const held = holdingOf('A');
        sets.newSet();
        await settle();
        expect(currentSet().id).not.toBe(held.setId);

        await service.loadRow('B', held.setId, held.rowId);

        expect(holdingOf('B')).toEqual(held);
        expect(store.deck('B')().status).toBe('playing');
      });

      it('refuses with a warning for a row that is not in an open set, leaving the deck as it was', async () => {
        vi.mocked(logWarn).mockClear();

        await service.loadRow('A', 'no-set', 'no-row');

        expect(vi.mocked(logWarn)).toHaveBeenCalledTimes(1);
        expect(store.deck('A')().status).toBe('empty');
        expect(store.deck('A')().busy).toBe(false);
        expect(store.sets.holdings().A).toBeNull();
      });
    });

    describe('loadSetRow without a current set', () => {
      it('does nothing and does not throw', async () => {
        expect(store.sets.currentSetId()).toBeNull();

        await expect(service.loadSetRow('A', 'any-row')).resolves.toBeUndefined();

        expect(store.sets.holdings().A).toBeNull();
        expect(store.deck('A')().status).toBe('empty');
      });
    });

    describe('the set commands', () => {
      /** Three tunes dropped onto deck A in turn, so the current set holds three rows and A the last. */
      async function threeRows(): Promise<string[]> {
        for (const fixture of [
          register(makeFixture()),
          register(makeFixture()),
          register(makeFixture()),
        ]) {
          await loadAndWait('A', fixture);
        }
        await settle();
        return currentSet().rows.map((row) => row.id);
      }

      it('loadSelected loads the selected row onto the deck, replacing what plays', async () => {
        const [first] = await threeRows();
        sets.selectRow(first);

        await service.loadSelected('B');

        expect(holdingOf('B').rowId).toBe(first);
        expect(store.deck('B')().status).toBe('playing');
        expect(holdingOf('A').rowId).not.toBe(first);
      });

      it('loadSelected does nothing when no row is selected', async () => {
        await threeRows();
        expect(store.sets.selectedRowId()).toBeNull();

        await service.loadSelected('B');

        expect(store.sets.holdings().B).toBeNull();
        expect(store.deck('B')().status).toBe('empty');
      });

      it('loadSetRow loads the named row onto the deck and leaves the selection alone', async () => {
        const [first, second] = await threeRows();
        sets.selectRow(first);

        await service.loadSetRow('B', second);

        expect(holdingOf('B').rowId).toBe(second);
        expect(store.deck('B')().status).toBe('playing');
        expect(store.sets.selectedRowId()).toBe(first);
      });

      it('loadSetRow does nothing for an unknown row', async () => {
        await threeRows();

        await expect(service.loadSetRow('B', 'no-such-row')).resolves.toBeUndefined();

        expect(store.sets.holdings().B).toBeNull();
        expect(store.deck('B')().status).toBe('empty');
      });

      it('previousRow and nextRow walk the current set and stop at its ends', async () => {
        const [first, second, third] = await threeRows();

        await service.previousRow('A');
        expect(holdingOf('A').rowId).toBe(second);
        await service.previousRow('A');
        expect(holdingOf('A').rowId).toBe(first);
        await service.previousRow('A');
        expect(holdingOf('A').rowId).toBe(first);

        await service.nextRow('A');
        await service.nextRow('A');
        expect(holdingOf('A').rowId).toBe(third);
        await service.nextRow('A');
        expect(holdingOf('A').rowId).toBe(third);
        expect(store.deck('A')().status).toBe('playing');
      });

      it('loads the neighbouring row even when the other deck holds it', async () => {
        const [first, second] = await threeRows();
        await service.loadRow('B', holdingOf('A').setId, first);
        await service.previousRow('A');
        expect(holdingOf('A').rowId).toBe(second);

        await service.previousRow('A');

        expect(holdingOf('A').rowId).toBe(first);
        expect(holdingOf('B').rowId).toBe(first);
      });

      it('refuses a deck that holds a row of another set, and a deck that holds none', async () => {
        await threeRows();
        const held = holdingOf('A');
        sets.newSet();
        await settle();
        expect(currentSet().id).not.toBe(held.setId);

        await service.previousRow('A');
        await service.nextRow('A');
        await service.nextRow('B');

        expect(holdingOf('A')).toEqual(held);
        expect(store.sets.holdings().B).toBeNull();
      });
    });

    describe('restoring', () => {
      it('lands the settings each subtune keeps, and home for one that keeps none', async () => {
        const fixture = register(makeFixture({ subtuneCount: 3 }));
        const { sidHash } = fixture.reference.identity;
        await keepSettings({ sidHash, subtune: 1 }, SHAPED);
        await keepSettings({ sidHash, subtune: 2 }, OTHER);

        await loadAndWait('A', fixture);
        expectRestored('A', SHAPED);

        await service.selectSubtune('A', 2);
        expectRestored('A', OTHER);

        await service.selectSubtune('A', 3);
        expectHome('A');
        expect(store.deck('A')().repeat).toBe(OTHER.repeat);
      });

      it('loads a voice latched muted as muted, and writes nothing back for it', async () => {
        const fixture = register(makeFixture({ subtuneCount: 2 }));
        const { sidHash } = fixture.reference.identity;
        await keepSettings({ sidHash, subtune: 1 }, SHAPED);
        await keepSettings({ sidHash, subtune: 2 }, OTHER);
        const save = vi.spyOn(sets, 'saveSubtuneSettings');

        await loadAndWait('A', fixture);
        await settle(WRITE_DELAY_MS * 2);
        expect(engineMutes('A')).toEqual([true, false, false]);
        expect(keptBy(holdingOf('A'))).toEqual(SHAPED);

        await service.selectSubtune('A', 2);
        await settle(WRITE_DELAY_MS * 2);
        expect(engineMutes('A')).toEqual([false, true, false]);
        expect(keptBy(holdingOf('A'))).toEqual(OTHER);
        expect(save).not.toHaveBeenCalled();
      });

      it('returns holds, nudges and an open excursion home, whatever the row keeps', async () => {
        const fixture = register(makeFixture());
        await keepSettings(fixture.reference.identity, SHAPED);
        await loadAndWait('A', fixture);
        service.setNudge('A', 'up', true);
        service.setVoiceHeld('A', 2, true);
        service.jumpSpeed('A', 'up');
        expect(store.deck('A')().nudging).toBe(true);

        await loadAndWait('A', fixture);

        expectRestored('A', SHAPED);
        expect(store.deck('A')().nudging).toBe(false);
        expect(runtime.snapshot('A').voices.map((voice) => voice.held)).toEqual(HOME_VOICES);
        service.jumpSpeed('A', 'down');
        expect(store.deck('A')().faderSpeed).toBeCloseTo(SHAPED.speed - 0.5);
      });

      it('writes nothing for a subtune that keeps no settings', async () => {
        const fixture = register(makeFixture({ subtuneCount: 3 }));
        await keepSettings(fixture.reference.identity, SHAPED);
        const save = vi.spyOn(sets, 'saveSubtuneSettings');

        await loadAndWait('A', fixture);
        await service.selectSubtune('A', 3);
        await settle(WRITE_DELAY_MS * 2);

        expect(save).not.toHaveBeenCalled();
        expect(sets.subtuneSettingsOf(holdingOf('A'))).toBeUndefined();
        expect(currentSet().rows[0].subtunes.map((entry) => entry.subtune)).toEqual([1]);
      });

      it('writes nothing into a row for a tune that is new to it', async () => {
        const save = vi.spyOn(sets, 'saveSubtuneSettings');

        await loadAndWait('A', register(makeFixture()));
        await settle(WRITE_DELAY_MS * 2);

        expect(save).not.toHaveBeenCalled();
        expect(currentSet().rows[0].subtunes).toEqual([]);
      });
    });

    describe('a superseded load', () => {
      it('never holds the row or restores its settings after the newer load', async () => {
        const older = register(makeFixture());
        const newer = register(makeFixture());
        await keepSettings(older.reference.identity, SHAPED);
        await keepSettings(newer.reference.identity, OTHER);
        let release!: (memory: TuneMemory | null) => void;
        const gate = new Promise<TuneMemory | null>((resolve) => {
          release = resolve;
        });
        const kept = await memoryStore.load(older.reference.identity.sidHash);
        const realLoad = memoryStore.load.bind(memoryStore);
        vi.spyOn(memoryStore, 'load').mockImplementation((hash) =>
          hash === older.reference.identity.sidHash ? gate : realLoad(hash)
        );

        const first = service.load('A', older.source);
        await vi.waitFor(() => expect(memoryStore.load).toHaveBeenCalledTimes(1));
        await service.load('A', newer.source);
        release(kept);
        await first;
        await settle(WRITE_DELAY_MS * 2);

        expect(holdingOf('A').sidHash).toBe(newer.reference.identity.sidHash);
        expect(store.deck('A')().loaded?.identity.sidHash).toBe(newer.reference.identity.sidHash);
        expectRestored('A', OTHER);
        expect(keptBy(holdingOf('A'))).toEqual(OTHER);
      });

      it('never holds a row for a load a newer one superseded while it fetched', async () => {
        const older = register(makeFixture());
        const newer = register(makeFixture());
        let release!: () => void;
        const realInsert = insertMock.getMockImplementation();
        insertMock.mockImplementationOnce(
          (bytes: Uint8Array) =>
            new Promise<TuneReference>((resolve) => {
              release = () => void realInsert?.(bytes).then(resolve);
            })
        );

        const first = service.load('A', older.source);
        await vi.waitFor(() => expect(insertMock).toHaveBeenCalledTimes(1));
        await service.load('A', newer.source);
        release();
        await first;

        expect(currentSet().rows.map((row) => row.tune.sidHash)).toEqual([
          newer.reference.identity.sidHash,
        ]);
        expect(holdingOf('A').sidHash).toBe(newer.reference.identity.sidHash);
      });
    });

    describe('a failed load', () => {
      it('leaves the row it held untouched, also after Repeat is pressed on the failed deck', async () => {
        const fixture = register(makeFixture());
        await keepSettings(fixture.reference.identity, SHAPED);
        await loadAndWait('A', fixture);
        await settle(WRITE_DELAY_MS * 2);
        const held = holdingOf('A');
        const before = sets.subtuneSettingsOf(held);
        expect(before).toEqual(encodeRowSettings(SHAPED));

        await service.load('A', makeFixture().source);
        expect(store.deck('A')().status).toBe('failed');
        service.setRepeat('A', !store.deck('A')().repeat);
        await settle(WRITE_DELAY_MS * 2);

        expect(holdingOf('A')).toEqual(held);
        expect(sets.subtuneSettingsOf(held)).toEqual(before);
        expect((await memoryStore.load(held.sidHash))?.subtunes[0].settings).toEqual(before);
      });

      it('leaves a row it took alone too, when the tune fails to scan', async () => {
        const fixture = register(makeFixture({ invalidBytes: true }));
        await keepSettings(fixture.reference.identity, SHAPED);
        resolveMock.mockRejectedValue(new Error('cannot scan'));

        await service.load('A', fixture.source);
        service.setRepeat('A', true);
        await settle(WRITE_DELAY_MS * 2);

        expect(store.deck('A')().status).toBe('failed');
        expect(keptBy(holdingOf('A'))).toEqual(SHAPED);
      });
    });

    describe('edits', () => {
      it('write the deck\'s controls into the held row and subtune, and the tune\'s latest version', async () => {
        const fixture = register(makeFixture({ subtuneCount: 2 }));
        await loadAndWait('A', fixture);
        await service.selectSubtune('A', 2);
        await settle();

        mixer.setFilterKnob('A', 'cutoff', 600);
        service.setVoiceMuted('A', 1, true);
        service.setSpeed('A', 1.3);
        service.setRepeat('A', false);
        await settle(WRITE_DELAY_MS);

        const held = holdingOf('A');
        expect(held.subtune).toBe(2);
        expect(keptBy(held)).toEqual({
          mixer: { panel: store.panel().A, mutes: [false, true, false] },
          speed: 1.3,
          repeat: false,
        });
        expect(store.panel().A.cutoff).toBe(600);
        expect(sets.subtuneSettingsOf({ ...held, subtune: 1 })).toBeUndefined();

        await settle(400);
        const memory = await memoryStore.load(held.sidHash);
        expect(memory?.lastSubtune).toBe(2);
        expect(memory?.subtunes.find((entry) => entry.subtune === 2)?.settings).toEqual(
          sets.subtuneSettingsOf(held)
        );
        const saved = await setStore.load(held.setId);
        expect(saved?.rows[0].subtunes.find((entry) => entry.subtune === 2)?.settings).toEqual(
          sets.subtuneSettingsOf(held)
        );
      });

      it('write marker edits into the held row too', async () => {
        const fixture = register(makeFixture());
        await loadAndWait('A', fixture);

        await markAt('A', 100);
        await settle(400);

        const held = holdingOf('A');
        expect(rowMarkers(fixture.reference.identity).map((marker) => marker.start.frame)).toEqual([100]);
        const memory = await memoryStore.load(held.sidHash);
        expect(memory?.subtunes[0].markers.map((marker) => marker.start.frame)).toEqual([100]);
      });

      it('keep the main track\'s settings while a marker\'s own are in play', async () => {
        const own: DeckMixerSettings = {
          panel: { ...HOME_DECK_PANEL, keySemitones: -4 },
          mutes: [false, true, false],
        };
        const fixture = register(makeFixture());
        await keepMarkers(fixture.reference.identity, [
          {
            id: 'a',
            start: { frame: 100, offsetFrames: 0 },
            end: null,
            voices: [0, 1, 2],
            settings: encodeMixerSettings(own),
            usesOwnSettings: true,
          },
        ]);
        await loadAndWait('A', fixture);
        await vi.waitFor(() =>
          expect(store.loops().A.markers.every((marker) => marker.ready)).toBe(true)
        );
        await settle();
        mixer.setFilterKnob('A', 'cutoff', 50);
        await settle(WRITE_DELAY_MS);
        const held = holdingOf('A');
        const main = sets.subtuneSettingsOf(held);
        expect(keptBy(held)?.mixer.panel.cutoff).toBe(50);

        await service.toggleMarker('A', 'a');
        expect(store.panel().A).toEqual(own.panel);
        service.setVoiceMuted('A', 0, true);
        await settle(WRITE_DELAY_MS * 2);

        expect(sets.subtuneSettingsOf(held)).toEqual(main);
        expect(
          decodeMixerSettings(rowMarkers(fixture.reference.identity)[0].settings)?.mutes
        ).toEqual([true, true, false]);

        service.stopMarkerLoop('A');
        await settle(WRITE_DELAY_MS * 2);

        expect(sets.subtuneSettingsOf(held)).toEqual(main);
        expect(store.panel().A.cutoff).toBe(50);
      });

      it('leave nudges and holds out, and keep an open excursion as the speed it remembered', async () => {
        const fixture = register(makeFixture());
        await loadAndWait('A', fixture);
        await settle();
        service.setSpeed('A', 1.2);
        await settle(WRITE_DELAY_MS);
        const save = vi.spyOn(sets, 'saveSubtuneSettings');

        service.setNudge('A', 'up', true);
        service.setVoiceHeld('A', 0, true);
        service.jumpSpeed('A', 'up');
        service.setSpeed('A', 0.9);
        await settle(WRITE_DELAY_MS * 2);
        expect(store.deck('A')().faderSpeed).toBe(0.9);
        service.jumpSpeed('A', 'home');
        await settle(WRITE_DELAY_MS * 2);

        expect(save).not.toHaveBeenCalled();
        expect(keptBy(holdingOf('A'))?.speed).toBe(1.2);
      });
    });

    describe('one row on both decks', () => {
      it('shares its markers, and the other deck\'s sound changes only at its next load', async () => {
        const fixture = register(makeFixture());
        await loadAndWait('A', fixture);
        await loadAndWait('B', fixture);
        await settle();

        await markAt('A', 100);
        service.setVoiceMuted('A', 0, true);
        await settle(WRITE_DELAY_MS);

        expect(store.loops().B.markers.map((marker) => marker.start.frame)).toEqual([100]);
        expect(engineMutes('B')).toEqual(HOME_VOICES);

        await loadAndWait('B', fixture);
        expect(engineMutes('B')).toEqual([true, false, false]);
      });

      it('writes a bounded number of times, the row keeping the deck that changed last', async () => {
        const fixture = register(makeFixture());
        await loadAndWait('A', fixture);
        await loadAndWait('B', fixture);
        await settle();
        const save = vi.spyOn(sets, 'saveSubtuneSettings');

        service.setVoiceMuted('A', 0, true);
        await settle(WRITE_DELAY_MS);
        service.setVoiceMuted('B', 2, true);
        await settle(WRITE_DELAY_MS);
        await settle(WRITE_DELAY_MS * 4);

        expect(save).toHaveBeenCalledTimes(2);
        expect(keptBy(holdingOf('A'))?.mixer.mutes).toEqual([false, false, true]);
        expect(engineMutes('A')).toEqual([true, false, false]);
        expect(engineMutes('B')).toEqual([false, false, true]);
      });
    });

    describe('two rows of one SID in two sets', () => {
      it('share nothing: each keeps its own markers and settings', async () => {
        const fixture = register(makeFixture());
        await loadAndWait('A', fixture);
        await settle();
        await markAt('A', 100);
        const firstSetId = currentSet().id;
        sets.newSet();
        await settle();

        await loadAndWait('B', fixture);
        await settle();
        expect(holdingOf('B').setId).not.toBe(firstSetId);
        expect(holdingOf('B').rowId).not.toBe(holdingOf('A').rowId);
        expect(store.loops().B.markers.map((marker) => marker.start.frame)).toEqual([100]);

        await markAt('A', 200);
        await markAt('B', 300);
        mixer.setFilterKnob('A', 'cutoff', 111);
        await settle(WRITE_DELAY_MS);
        mixer.setFilterKnob('B', 'cutoff', 222);
        await settle(WRITE_DELAY_MS);

        const frames = (slot: 'A' | 'B') =>
          store.loops()[slot].markers.map((marker) => marker.start.frame);
        expect(frames('A')).toEqual([100, 200]);
        expect(frames('B')).toEqual([100, 300]);
        expect(keptBy(holdingOf('A'))?.mixer.panel.cutoff).toBe(111);
        expect(keptBy(holdingOf('B'))?.mixer.panel.cutoff).toBe(222);

        await settle(400);
        const latest = await memoryStore.load(holdingOf('B').sidHash);
        expect(latest?.subtunes[0].markers.map((marker) => marker.start.frame)).toEqual([100, 300]);
      });
    });

    describe('a pending write', () => {
      it('lands in the row the deck held when loading another row closes its set', async () => {
        const first = register(makeFixture());
        const second = register(makeFixture());
        await loadAndWait('A', first);
        await settle();
        const held = holdingOf('A');
        sets.newSet();
        await sets.addFromListing(second.source, null);
        const target = currentSet().rows[0];

        mixer.setFilterKnob('A', 'cutoff', 600);
        TestBed.flushEffects();
        await service.loadRow('A', currentSet().id, target.id);
        await settle(400);

        expect(store.sets.open()[held.setId]).toBeUndefined();
        const memory = await memoryStore.load(held.sidHash);
        expect(
          decodeRowSettings(memory?.subtunes[0].settings)?.mixer.panel.cutoff
        ).toBe(600);
        const saved = await setStore.load(held.setId);
        expect(
          decodeRowSettings(saved?.rows[0].subtunes[0].settings)?.mixer.panel.cutoff
        ).toBe(600);
        expect(holdingOf('A').rowId).toBe(target.id);
      });
    });

    describe('a deck whose set was deleted', () => {
      it('keeps its row, and keeps writing its edits to the tune\'s memory only', async () => {
        const fixture = register(makeFixture());
        await loadAndWait('A', fixture);
        const held = holdingOf('A');

        await sets.deleteCurrent();
        await settle();
        expect(store.sets.open()[held.setId]).toBeUndefined();

        mixer.setFilterKnob('A', 'cutoff', 600);
        await markAt('A', 100);
        await settle(WRITE_DELAY_MS + 400);

        expect(keptBy(held)?.mixer.panel.cutoff).toBe(600);
        expect(rowMarkers(fixture.reference.identity)).toEqual([]);
        const memory = await memoryStore.load(held.sidHash);
        expect(decodeRowSettings(memory?.subtunes[0].settings)?.mixer.panel.cutoff).toBe(600);
        expect(memory?.subtunes[0].markers.map((marker) => marker.start.frame)).toEqual([100]);
        expect(await setStore.load(held.setId)).toBeNull();
      });
    });

    describe('naming markers', () => {
      const names = () => store.loops().A.markers.map((marker) => marker.name);

      async function loadWithMarkers(): Promise<TuneFixture> {
        const fixture = register(makeFixture());
        await keepMarkers(fixture.reference.identity, [
          { id: 'a', start: { frame: 100, offsetFrames: 0 }, end: null, voices: [0, 1, 2] },
          { id: 'b', start: { frame: 200, offsetFrames: 0 }, end: null, voices: [0, 1, 2] },
        ]);
        await loadAndWait('A', fixture);
        return fixture;
      }

      it('names a marker, shows the name in place of its position and keeps it in the row', async () => {
        const fixture = await loadWithMarkers();

        service.renameMarker('A', 'b', 'Drop');

        expect(names()).toEqual([null, 'Drop']);
        expect(store.loopsSummary('A')().items.map((item) => item.name)).toEqual(['Item 1', 'Drop']);
        expect(rowMarkers(fixture.reference.identity).map((marker) => marker.name)).toEqual([
          undefined,
          'Drop',
        ]);
        await loadAndWait('A', fixture);
        expect(names()).toEqual([null, 'Drop']);
      });

      it('returns a marker to its place in the list when the name is empty', async () => {
        await loadWithMarkers();
        service.renameMarker('A', 'a', 'Intro');

        service.renameMarker('A', 'a', '');

        expect(names()).toEqual([null, null]);
        expect(store.loopsSummary('A')().items[0].name).toBe('Item 1');
      });

      it('caps a name at 48 characters and drops a pasted tab', async () => {
        await loadWithMarkers();

        service.renameMarker('A', 'a', 'x'.repeat(49));
        service.renameMarker('A', 'b', 'Big\tDrop');

        expect(names()).toEqual(['x'.repeat(48), 'BigDrop']);
      });

      it('is refused while the deck has nothing shapeable loaded', () => {
        vi.mocked(logWarn).mockClear();

        service.renameMarker('A', 'a', 'Intro');

        expect(vi.mocked(logWarn)).toHaveBeenCalledTimes(1);
      });
    });

    describe('an unavailable row', () => {
      const CAUSES = {
        unknown: 'is not cached and where it was found is unknown',
        absent: 'is not cached and device-1 is not connected',
        unreadable: 'could not be fetched: offline',
        changed: 'on device-1 has changed since it was added',
      } as const;

      /** Resolves only what was inserted since, as a cache that lost the tune does. */
      let cached: Set<string>;

      beforeEach(() => {
        cached = new Set();
        const baseInsert = insertMock.getMockImplementation();
        insertMock.mockImplementation(async (bytes: Uint8Array) => {
          const reference = await baseInsert?.(bytes);
          cached.add(reference.identity.sidHash);
          return reference;
        });
        resolveMock.mockImplementation(async (identity: TuneIdentity) => {
          const fixture = bySidHash.get(identity.sidHash);
          return fixture === undefined || !cached.has(identity.sidHash)
            ? null
            : playableOf(fixture, identity.subtune);
        });
      });

      /** A row for the fixture in the current set, with its bytes gone from the cache. */
      async function rowWithoutBytes(fixture: TuneFixture): Promise<DeckHolding> {
        await loadAndWait('A', fixture);
        cached.clear();
        return holdingOf('A');
      }

      const prepOf = (rowId: string) => store.sets.prep()[rowId];

      it('fails with the reason when the row does not say where the file was found, and plays once the cache has it', async () => {
        const fixture = register(makeFixture());
        const row = createRow({
          id: 'row-1',
          tune: {
            sidHash: fixture.reference.identity.sidHash,
            title: 'Commando',
            author: 'Hubbard',
            released: '1985',
            subtuneCount: 1,
            byteLength: 3,
          },
          memory: null,
          startSubtune: 1,
        });
        store.putOpenSet({
          set: { ...createSet({ id: 'set-x', placeholder: 'Set X', now: '2026-01-01T00:00:00.000Z' }), rows: [row] },
        });

        await service.loadRow('B', 'set-x', 'row-1');

        expect(store.deck('B')().status).toBe('failed');
        expect(store.deck('B')().error).toBe(`Commando ${CAUSES.unknown}`);
        expect(prepOf('row-1')).toEqual({ phase: 'unavailable', reason: `Commando ${CAUSES.unknown}` });

        cached.add(fixture.reference.identity.sidHash);
        await service.loadRow('B', 'set-x', 'row-1');

        expect(store.deck('B')().status).toBe('playing');
        expect(prepOf('row-1')).toBeUndefined();
      });

      it('fails with the reason when the device is not connected, and plays once it is', async () => {
        const fixture = register(makeFixture());
        const held = await rowWithoutBytes(fixture);
        usableDevices.set([]);

        await service.loadRow('B', held.setId, held.rowId);

        expect(store.deck('B')().status).toBe('failed');
        expect(store.deck('B')().error).toBe(`${fixture.source.fileName} ${CAUSES.absent}`);
        expect(prepOf(held.rowId)).toEqual({
          phase: 'unavailable',
          reason: `${fixture.source.fileName} ${CAUSES.absent}`,
        });
        expect(fileContentMock).toHaveBeenCalledTimes(1);

        usableDevices.set([{ deviceId: 'device-1' } as Device]);
        await service.loadRow('B', held.setId, held.rowId);

        expect(store.deck('B')().status).toBe('playing');
        expect(prepOf(held.rowId)).toBeUndefined();
        expect(fileContentMock).toHaveBeenCalledTimes(2);
      });

      it('fails with the reason when the fetch fails, and plays once it succeeds', async () => {
        const fixture = register(makeFixture());
        const held = await rowWithoutBytes(fixture);
        fileContentMock.mockReturnValueOnce(throwError(() => new Error('offline')));

        await service.loadRow('B', held.setId, held.rowId);

        expect(store.deck('B')().status).toBe('failed');
        expect(store.deck('B')().error).toBe(`${fixture.source.fileName} ${CAUSES.unreadable}`);
        expect(prepOf(held.rowId)?.phase).toBe('unavailable');

        await service.loadRow('B', held.setId, held.rowId);

        expect(store.deck('B')().status).toBe('playing');
        expect(prepOf(held.rowId)).toBeUndefined();
      });

      it('fails with the reason when the file is no longer the row\'s tune, and plays once it is again', async () => {
        const fixture = register(makeFixture());
        const held = await rowWithoutBytes(fixture);
        const replacement = register(makeFixture());
        byPath.set(fixture.source.path, replacement);

        await service.loadRow('B', held.setId, held.rowId);

        expect(store.deck('B')().status).toBe('failed');
        expect(store.deck('B')().error).toBe(`${fixture.source.fileName} ${CAUSES.changed}`);
        expect(prepOf(held.rowId)?.phase).toBe('unavailable');

        byPath.set(fixture.source.path, fixture);
        await service.loadRow('B', held.setId, held.rowId);

        expect(store.deck('B')().status).toBe('playing');
        expect(prepOf(held.rowId)).toBeUndefined();
      });

      it('does not mark a row unavailable for any other failure', async () => {
        const fixture = register(makeFixture());
        const held = await rowWithoutBytes(fixture);
        insertMock.mockRejectedValue(new Error('not a SID file'));

        await service.loadRow('B', held.setId, held.rowId);

        expect(store.deck('B')().status).toBe('failed');
        expect(store.deck('B')().error).toBe('not a SID file');
        expect(prepOf(held.rowId)).toBeUndefined();
      });
    });

    describe('subtune switches', () => {
      it('refuse with a warning when the deck holds no row', async () => {
        store.setDeckLoaded({ slot: 'A', reference: makeFixture({ subtuneCount: 2 }).reference });
        store.setDeckStatus({ slot: 'A', status: 'paused' });
        vi.mocked(logWarn).mockClear();

        await service.selectSubtune('A', 2);

        expect(vi.mocked(logWarn)).toHaveBeenCalledTimes(1);
        expect(store.deck('A')().busy).toBe(false);
        expect(store.deck('A')().status).toBe('paused');
      });

      it('record the subtune as the row\'s last, in the set and the tune\'s memory', async () => {
        const fixture = register(makeFixture({ subtuneCount: 3 }));
        await loadAndWait('A', fixture);

        await service.selectSubtune('A', 3);
        await settle(400);

        const held = holdingOf('A');
        expect(held.subtune).toBe(3);
        expect(currentSet().rows[0].lastSubtune).toBe(3);
        expect((await memoryStore.load(held.sidHash))?.lastSubtune).toBe(3);
      });
    });
  });

  describe('letting go of the hand', () => {
    let drop: MockInstance<DeckHand['drop']>;

    beforeEach(() => {
      drop = vi.spyOn(TestBed.inject(DeckHand), 'drop');
    });

    it("drops the deck's hand on a load, a subtune switch and a stop, once each", async () => {
      await loadAndWait('A', register(makeFixture({ subtuneCount: 3 })));
      expect(drop.mock.calls).toEqual([['A']]);

      await service.selectSubtune('A', 2);
      expect(drop.mock.calls).toEqual([['A'], ['A']]);

      service.stop('A');
      expect(drop.mock.calls).toEqual([['A'], ['A'], ['A']]);
    });

    it('leaves the hand alone when a stop or a subtune switch is refused by its guards', async () => {
      await loadAndWait('A', register(makeFixture({ subtuneCount: 3 })));
      service.stop('A');
      drop.mockClear();

      service.stop('A');
      service.stop('B');
      await service.selectSubtune('B', 2);
      store.setDeckBusy({ slot: 'A', busy: true });
      service.stop('A');
      await service.selectSubtune('A', 2);

      expect(drop).not.toHaveBeenCalled();
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
