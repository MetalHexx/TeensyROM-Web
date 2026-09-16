import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { FakeClock, replayToFrame } from '@sidablist/core';
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
import { TuneLoader } from './tune-loader';
import { DjStore } from './dj-store';
import { FRAME_CLOCK_FACTORY, REPLAY_RUNNER_FACTORY, MIDI_ACCESS, TUNE_INSERTER, TUNE_RESOLVER } from './ports';
import type { IMidiAccess, MidiAccessState, MidiPortOption } from './ports/midi-access';
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
    bindPort: ReturnType<typeof vi.fn>;
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
    // spec's own coverage of `hydrate`/`bindPort`/`enableMidi`/`identify` is exactly that
    // delegation, never the reconcile behaviour `deck-bindings.spec.ts` owns.
    fakeBindings = {
      hydrate: vi.fn().mockResolvedValue(undefined),
      bindPort: vi.fn().mockResolvedValue(undefined),
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

  describe('binding delegation', () => {
    it('hydrate delegates to DeckBindings', async () => {
      await service.hydrate();
      expect(fakeBindings.hydrate).toHaveBeenCalledTimes(1);
    });

    it('bindPort delegates the slot and port id', async () => {
      await service.bindPort('A', 'port-1');
      expect(fakeBindings.bindPort).toHaveBeenCalledWith('A', 'port-1');
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
