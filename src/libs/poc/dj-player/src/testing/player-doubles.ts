import { signal, type WritableSignal } from '@angular/core';
import { vi } from 'vitest';
import {
  cycles,
  DEFAULT_TIMING_MODE,
  frames,
  microseconds,
  milliseconds,
  PAL_FRAME_INTERVAL_US,
} from '@sidablist/core';
import type { Frames, PlayerSnapshot, PlayerStats, SidFile, SidPlayer } from '@sidablist/core';
import type { AsidSink } from '@sidablist/asid';
import type { DeckPlayerView } from '../lib/deck/deck-player';
import type { DeckHandle } from '../lib/deck/deck-registry';
import type { DeckDescriptor } from '../lib/deck/deck.config';

/** The player's read side as a stopped deck with nothing loaded reports it. Every field a consumer
 *  reads is present, so a spec overrides only the group it is actually about. */
export function emptyPlayerSnapshot(): PlayerSnapshot {
  return {
    transport: 'stopped',
    tune: null,
    tempo: {
      multiplier: 1,
      effectiveIntervalUs: microseconds(0),
      nominalIntervalUs: microseconds(PAL_FRAME_INTERVAL_US),
      callsPerFrame: 1,
      rate: {
        callsPerFrame: 1,
        exactCallsPerFrame: 1,
        roundedCallsPerFrame: 1,
        mode: DEFAULT_TIMING_MODE,
      },
      timingMode: DEFAULT_TIMING_MODE,
    },
    loop: null,
    voices: [
      { muted: false, held: false },
      { muted: false, held: false },
      { muted: false, held: false },
    ],
    basis: {
      positionBasisFrames: frames(0),
      ceilingFrames: frames(0),
      trackEndFrame: null,
    },
    repeatTrack: false,
    error: null,
  };
}

/** Every counter at rest — see `emptyPlayerSnapshot` for the same reasoning. */
export function emptyPlayerStats(): PlayerStats {
  return {
    framesRendered: frames(0),
    clock: {
      framesEmitted: 0,
      measuredMeanIntervalUs: microseconds(0),
      nominalIntervalUs: microseconds(0),
      driftMs: milliseconds(0),
      jitterMs: milliseconds(0),
      worstGapMs: milliseconds(0),
      lateCallbacks: 0,
    },
    effectiveIntervalUs: microseconds(0),
    delivery: {
      scheduledFrames: 0,
      lateFrames: 0,
      meanLagMs: milliseconds(0),
      worstLagMs: milliseconds(0),
      reorderedFrames: 0,
      clampedFrames: 0,
    },
    sink: {
      farEnd: { kind: 'unknown', inFlight: 0 },
      capabilities: {
        perWriteOffsets: false,
        cancellation: false,
        scheduleAheadMs: milliseconds(0),
        preservesWriteOrder: false,
      },
    },
    suppressedWrites: 0,
    illegalOpcodeCount: 0,
    cpu: { cyclesUsed: cycles(0), headroom: 1 },
    voices: [
      { gate: false, waveform: 0, frequency: 0, envelope: 0 },
      { gate: false, waveform: 0, frequency: 0, envelope: 0 },
      { gate: false, waveform: 0, frequency: 0, envelope: 0 },
    ],
    emitted: { written: new Uint8Array(25), sent: new Uint8Array(25) },
    resync: { inFlightDepth: 0 },
    rate: { exactCallsPerFrame: 1, roundedCallsPerFrame: 1 },
  };
}

/** A minimal PSID a spec can hand to a loader or a scanner. */
export function fakeSidFile(overrides: Partial<SidFile> = {}): SidFile {
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

/** A player double plus the signals a spec drives it through — the read side is writable here,
 *  where in production it is `DeckPlayerView`'s subscription and polling. */
export interface FakeDeckPlayer {
  readonly player: SidPlayer;
  readonly view: DeckPlayerView;
  readonly snapshot: WritableSignal<PlayerSnapshot>;
  readonly stats: WritableSignal<PlayerStats>;
  readonly position: WritableSignal<Frames>;
}

export function createFakeDeckPlayer(): FakeDeckPlayer {
  const snapshot = signal<PlayerSnapshot>(emptyPlayerSnapshot());
  const stats = signal<PlayerStats>(emptyPlayerStats());
  const position = signal<Frames>(frames(0));

  const player = {
    subscribe: vi.fn(() => () => undefined),
    getSnapshot: () => snapshot(),
    getPosition: () => position(),
    getStats: () => stats(),
    loadTune: vi.fn(),
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    stop: vi.fn(),
    seek: vi.fn().mockResolvedValue(undefined),
    selectSubtune: vi.fn(),
    nextSubtune: vi.fn(),
    previousSubtune: vi.fn(),
    setActiveLoop: vi.fn(),
    setTrackStructure: vi.fn(),
    setRepeatTrack: vi.fn(),
    setTempo: vi.fn(),
    setNominalIntervalUs: vi.fn(),
    setTimingMode: vi.fn(),
    setVoiceMuted: vi.fn(),
    setVoiceHeld: vi.fn(),
    clearVoiceMutes: vi.fn(),
    setOutputGain: vi.fn(),
    setFilterMode: vi.fn(),
    setRegisterScale: vi.fn(),
    setTargetClock: vi.fn(),
    setVoicePitch: vi.fn(),
    dispose: vi.fn(),
  } satisfies SidPlayer;

  return {
    player,
    view: { snapshot: snapshot.asReadonly(), stats: stats.asReadonly(), position: position.asReadonly() },
    snapshot,
    stats,
    position,
  };
}

/** The sink contract with its two getters made settable, so a spec can state what the far end is
 *  reporting rather than drive a real one to report it. */
export type FakeAsidSink = { -readonly [K in keyof AsidSink]: AsidSink[K] };

/** An ASID sink double: the whole contract, with the counters and capabilities a diagnostics
 *  readout pulls left settable. */
export function createFakeAsidSink(): FakeAsidSink {
  return {
    capabilities: {
      perWriteOffsets: false,
      cancellation: false,
      scheduleAheadMs: milliseconds(0),
      preservesWriteOrder: false,
    },
    stats: {
      packetsSent: 0,
      bytesSent: 0,
      cancelSupported: false,
      lastCancelLatencyMs: -1,
      inFlight: 0,
    },
    begin: vi.fn(),
    end: vi.fn(),
    deliver: vi.fn(),
    deliverNow: vi.fn(),
    retime: vi.fn(),
    reset: vi.fn(),
    readAt: vi.fn(() => ({ kind: 'unknown' as const, inFlight: 0 })),
    showText: vi.fn(),
    setScheduleAhead: vi.fn(),
  };
}

/** A registry handle whose fields a spec fills in only as far as the surface under test reads
 *  them — `DeckRegistry` itself reads nothing but the descriptor. */
export function fakeDeckHandle(
  descriptor: DeckDescriptor,
  overrides: Partial<DeckHandle> = {}
): DeckHandle {
  const fake = createFakeDeckPlayer();
  return {
    descriptor,
    player: fake.player,
    sink: createFakeAsidSink(),
    view: fake.view,
    markers: {} as DeckHandle['markers'],
    binding: {} as DeckHandle['binding'],
    tuneIndex: {} as DeckHandle['tuneIndex'],
    tuneLoader: {} as DeckHandle['tuneLoader'],
    ...overrides,
  };
}
