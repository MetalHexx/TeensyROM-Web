import { describe, it, expect, beforeEach, vi } from 'vitest';
import { computed, signal } from '@angular/core';
import type { SidFile, SidClock } from '../sid/sid-file.model';
import { C64Machine } from '../cpu/c64-machine';
import type { RegisterFrame } from '../asid/register-frame';
import type { ReplayRequest, ReplayResponse, ReplayRunner } from '../replay/replay-runner';
import { replayToFrame } from '../replay/replay-to-frame';
import { JUMP_CEILING_SECONDS, TuneSession } from './tune-session';
import type { TuneSessionHost } from './tune-session';
import type { PlayRate } from './play-rate';

/**
 * Answers every request against the real `replayToFrame`, immediately — enough for the landing
 * tests. `manual` mode holds requests until `resolveAll()`, for the supersede/discard tests.
 */
class FakeReplayRunner implements ReplayRunner {
  readonly requests: ReplayRequest[] = [];
  disposed = false;
  manual = false;
  private readonly held: ((response: ReplayResponse) => void)[] = [];
  private readonly heldRequests: ReplayRequest[] = [];

  run(request: ReplayRequest): Promise<ReplayResponse> {
    this.requests.push(request);
    if (this.manual) {
      return new Promise<ReplayResponse>((resolve) => {
        this.held.push(resolve);
        this.heldRequests.push(request);
      });
    }
    return Promise.resolve(answer(request));
  }

  dispose(): void {
    this.disposed = true;
  }

  resolveAll(): void {
    const resolvers = this.held.splice(0);
    const requests = this.heldRequests.splice(0);
    resolvers.forEach((resolve, i) => resolve(answer(requests[i])));
  }
}

function answer(request: ReplayRequest): ReplayResponse {
  try {
    return {
      id: request.id,
      ok: true,
      result: replayToFrame(request.file, request.subtune, request.targetFrame, request.mutes),
    };
  } catch (error) {
    return { id: request.id, ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

interface CodeBlock {
  readonly at: number;
  readonly bytes: readonly number[];
}

function tune(options: {
  songs?: number;
  clock?: SidClock;
  playAddress?: number;
  blocks: readonly CodeBlock[];
}): SidFile {
  const loadAddress = 0x1000;
  const codeEnd = options.blocks.reduce(
    (end, block) => Math.max(end, block.at + block.bytes.length),
    loadAddress
  );
  const data = new Uint8Array(codeEnd - loadAddress);
  for (const block of options.blocks) {
    data.set(block.bytes, block.at - loadAddress);
  }
  return {
    format: 'PSID',
    version: 2,
    loadAddress,
    initAddress: loadAddress,
    playAddress: options.playAddress ?? 0x1010,
    songs: options.songs ?? 1,
    startSong: 1,
    speedFlags: 0,
    name: '',
    author: '',
    released: '',
    clock: options.clock ?? 'pal',
    model: 'unknown',
    secondSidAddress: null,
    thirdSidAddress: null,
    data,
  };
}

const RTS = 0x60;

/** init and play both return at once and touch no register. */
function silentTune(songs = 1): SidFile {
  return tune({
    songs,
    blocks: [
      { at: 0x1000, bytes: [RTS] },
      { at: 0x1010, bytes: [RTS] },
    ],
  });
}

/** init increments a zero-page counter and stores it into $D400 every play call, so the frame
 *  a replay landed on can be read back off the packet. */
function counterTune(songs = 1): SidFile {
  return tune({
    songs,
    blocks: [
      { at: 0x1000, bytes: [RTS] },
      {
        at: 0x1010,
        bytes: [0xe6, 0xfb, 0xa5, 0xfb, 0x8d, 0x00, 0xd4, RTS], // INC $FB; LDA $FB; STA $D400; RTS
      },
    ],
  });
}

/** init programs CIA 1 timer A for exactly two play calls per frame; play still writes nothing. */
function doubleSpeedTune(): SidFile {
  // LDA #$63 / STA $DC04 / LDA #$26 / STA $DC05 / RTS — a latch of 9827, half a PAL frame.
  return tune({
    blocks: [
      { at: 0x1000, bytes: [0xa9, 0x63, 0x8d, 0x04, 0xdc, 0xa9, 0x26, 0x8d, 0x05, 0xdc, RTS] },
      { at: 0x1010, bytes: [RTS] },
    ],
  });
}

/** init returns at once, but the play routine never does — a replay to any frame past 0 burns its
 *  whole cycle budget on the first frame it steps. */
function runawayTune(): SidFile {
  return tune({
    blocks: [
      { at: 0x1000, bytes: [RTS] },
      { at: 0x1010, bytes: [0x4c, 0x10, 0x10] }, // JMP $1010
    ],
  });
}

/** `playAddress: 0` with an init that installs no interrupt vector — `C64Machine.initSubtune`
 *  resolves no play routine at all and throws, rather than merely running out of cycles. */
function unplayableTune(): SidFile {
  return tune({
    playAddress: 0,
    blocks: [{ at: 0x1000, bytes: [RTS] }],
  });
}

/** A `TuneSessionHost` that records every call, so a test can assert on what the session asked of
 *  its coordinator without standing up the coordinator itself.
 *
 * `playRate`/`syncPlayRate` default to a real signal-backed pair, mirroring how `DjPlayerEngine`
 * wires them — a `computed` `playRate()` over a `machineRates` signal `syncPlayRate` writes to —
 * rather than a static stub, so a test can assert on `ceilingFrames` staying reactive across a
 * subtune init with no override needed. */
function fakeHost(overrides: Partial<TuneSessionHost> = {}): TuneSessionHost & {
  readonly failures: string[];
  readonly resyncCount: { count: number };
} {
  const failures: string[] = [];
  const resyncCount = { count: 0 };
  const machineRates = signal<{ exact: number; rounded: number }>({ exact: 1, rounded: 1 });
  const playRate = computed<PlayRate>(() => {
    const { exact, rounded } = machineRates();
    return { callsPerFrame: exact, exactCallsPerFrame: exact, roundedCallsPerFrame: rounded, mode: 'exact' };
  });
  return {
    nominalIntervalUs: () => 20_000,
    playRate: () => playRate(),
    syncPlayRate: (machine) => {
      machineRates.set({ exact: machine?.exactCallsPerFrame ?? 1, rounded: machine?.callsPerFrame ?? 1 });
    },
    effectiveMutes: () => [false, false, false],
    clearError: () => undefined,
    fail: (reason: string) => failures.push(reason),
    queueResync: () => {
      resyncCount.count++;
    },
    resetAnchors: () => undefined,
    recordAnchor: () => undefined,
    applyIntervalChange: () => undefined,
    ...overrides,
    failures,
    resyncCount,
  };
}

describe('TuneSession', () => {
  let replay: FakeReplayRunner;

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  describe('load and subtune init', () => {
    it('builds a machine and frame, and clamps the subtune count to at least 1', () => {
      const session = new TuneSession(new FakeReplayRunner(), fakeHost());

      session.load(tune({ songs: 0, blocks: [{ at: 0x1000, bytes: [RTS] }] }));

      expect(session.machine).toBeInstanceOf(C64Machine);
      expect(session.subtuneCount()).toBe(1);
    });

    it('resets the position counter, records a fresh anchor, adopts the subtune and clears the error on success', () => {
      const host = fakeHost();
      const session = new TuneSession(new FakeReplayRunner(), host);
      session.load(silentTune(2));
      session.framesRendered = 40;
      let recordedFrames = -1;
      host.recordAnchor = (_machine, _frame, framesRendered) => {
        recordedFrames = framesRendered;
      };

      const ok = session.initSubtune(2);

      expect(ok).toBe(true);
      expect(session.currentSubtune()).toBe(2);
      expect(session.framesRendered).toBe(0);
      expect(recordedFrames).toBe(0);
    });

    it('clamps the requested subtune to the tune range', () => {
      const session = new TuneSession(new FakeReplayRunner(), fakeHost());
      session.load(silentTune(2));

      session.initSubtune(99);

      expect(session.currentSubtune()).toBe(2);
    });

    it('fails the host and returns false when a subtune cannot be initialised', () => {
      const host = fakeHost();
      const session = new TuneSession(new FakeReplayRunner(), host);
      session.load(unplayableTune());

      const ok = session.initSubtune(1);

      expect(ok).toBe(false);
      expect(host.failures).toHaveLength(1);
    });
  });

  describe('subtune stepping', () => {
    it('steps forward and back, clamped to the tune range', () => {
      const session = new TuneSession(new FakeReplayRunner(), fakeHost());
      session.load(silentTune(2));
      session.initSubtune(1);

      session.nextSubtune();
      expect(session.currentSubtune()).toBe(2);

      session.nextSubtune(); // already at the top
      expect(session.currentSubtune()).toBe(2);

      session.previousSubtune();
      expect(session.currentSubtune()).toBe(1);
    });

    it('re-resolves the clock interval only when the subtune actually changed', () => {
      const applyIntervalChange = vi.fn();
      const session = new TuneSession(new FakeReplayRunner(), fakeHost({ applyIntervalChange }));
      session.load(silentTune(2));
      session.initSubtune(1);

      session.nextSubtune();
      expect(applyIntervalChange).toHaveBeenCalledTimes(1);

      session.previousSubtune();
      session.previousSubtune(); // already at the bottom — no-op, no re-resolve
      expect(applyIntervalChange).toHaveBeenCalledTimes(2);
    });
  });

  describe('positionBasisFrames', () => {
    it('keeps the fixed ceiling as the basis when no indexed length has been set', () => {
      const session = new TuneSession(new FakeReplayRunner(), fakeHost());
      session.load(silentTune());

      expect(session.positionBasisFrames()).toBe(session.ceilingFrames());
    });

    it('keeps the fixed ceiling when a length is set back to null', () => {
      const session = new TuneSession(new FakeReplayRunner(), fakeHost());
      session.load(silentTune());
      session.setIndexedLengthFrames(2_500);

      session.setIndexedLengthFrames(null);

      expect(session.positionBasisFrames()).toBe(session.ceilingFrames());
    });

    it('adopts a usable indexed length as the basis', () => {
      const session = new TuneSession(new FakeReplayRunner(), fakeHost());
      session.load(silentTune());

      session.setIndexedLengthFrames(2_500);

      expect(session.positionBasisFrames()).toBe(2_500);
    });

    it('rejects a zero or negative length, falling back to the ceiling', () => {
      const session = new TuneSession(new FakeReplayRunner(), fakeHost());
      session.load(silentTune());

      session.setIndexedLengthFrames(0);
      expect(session.positionBasisFrames()).toBe(session.ceilingFrames());

      session.setIndexedLengthFrames(-100);
      expect(session.positionBasisFrames()).toBe(session.ceilingFrames());
    });
  });

  describe('ceilingFrames and the play rate', () => {
    it('doubles for a callsPerFrame 2 tune versus a callsPerFrame 1 tune at the same nominal interval', () => {
      const host1x = fakeHost();
      const session1x = new TuneSession(new FakeReplayRunner(), host1x);
      session1x.load(silentTune());
      session1x.initSubtune(1);

      const host2x = fakeHost();
      const session2x = new TuneSession(new FakeReplayRunner(), host2x);
      session2x.load(doubleSpeedTune());
      session2x.initSubtune(1);

      expect(session2x.ceilingFrames()).toBe(session1x.ceilingFrames() * 2);
    });

    it('stays reactive to a subtune init that changes the rate without the nominal interval changing — the stale-computed trap', () => {
      const host = fakeHost();
      const session = new TuneSession(new FakeReplayRunner(), host);
      session.load(silentTune());
      session.initSubtune(1);
      const before = session.ceilingFrames();

      session.load(doubleSpeedTune());
      session.initSubtune(1);

      // Same nominal interval throughout — only the rate mirrored off the freshly-initialised
      // machine changed. A `ceilingFrames` that read `machine.exactCallsPerFrame` directly inside
      // its `computed` would still report the stale, pre-init value here.
      expect(session.ceilingFrames()).toBe(before * 2);
    });
  });

  describe('scrubTo', () => {
    it('lands on the requested percentage of the jump ceiling and queues a resync', async () => {
      const host = fakeHost();
      replay = new FakeReplayRunner();
      const session = new TuneSession(replay, host);
      session.load(counterTune());
      session.initSubtune(1);

      await session.scrubTo(50);

      const expectedCeiling = Math.round((JUMP_CEILING_SECONDS * 1_000_000) / host.nominalIntervalUs());
      expect(session.framesRendered).toBe(Math.round(expectedCeiling * 0.5));
      expect(host.resyncCount.count).toBe(1);
    });

    it('lands on the requested percentage of an indexed basis rather than the ceiling', async () => {
      const host = fakeHost();
      replay = new FakeReplayRunner();
      const session = new TuneSession(replay, host);
      session.load(counterTune());
      session.initSubtune(1);
      session.setIndexedLengthFrames(2_500);

      await session.scrubTo(50);

      expect(session.framesRendered).toBe(1_250);
    });

    it('resolves without a request when no machine is loaded', async () => {
      replay = new FakeReplayRunner();
      const session = new TuneSession(replay, fakeHost());

      await session.scrubTo(50);

      expect(replay.requests).toHaveLength(0);
    });

    it('applies only the newest of two scrubs issued before either resolves', async () => {
      const host = fakeHost();
      replay = new FakeReplayRunner();
      replay.manual = true;
      const session = new TuneSession(replay, host);
      session.load(counterTune());
      session.initSubtune(1);

      const first = session.scrubTo(1);
      const second = session.scrubTo(4);
      replay.resolveAll();
      await Promise.all([first, second]);

      expect(replay.requests).toHaveLength(2);
      expect(host.resyncCount.count).toBe(1); // only the landing response queues a resync
    });

    it('discards a result that arrives after discardOutstandingJump()', async () => {
      const host = fakeHost();
      replay = new FakeReplayRunner();
      replay.manual = true;
      const session = new TuneSession(replay, host);
      session.load(counterTune());
      session.initSubtune(1);

      const pending = session.scrubTo(4);
      session.discardOutstandingJump();
      session.framesRendered = 0;
      replay.resolveAll();
      await pending;

      expect(session.framesRendered).toBe(0);
      expect(host.resyncCount.count).toBe(0);
    });

    it('fails the host rather than throwing when the replay cannot complete', async () => {
      const host = fakeHost();
      replay = new FakeReplayRunner();
      const session = new TuneSession(replay, host);
      session.load(runawayTune());
      session.initSubtune(1);

      await session.scrubTo(1);

      expect(host.failures.some((reason) => reason.includes('during replay'))).toBe(true);
    });
  });

  describe('restoreState', () => {
    it('adopts the frame number and queues a resync', () => {
      const host = fakeHost();
      const session = new TuneSession(new FakeReplayRunner(), host);
      session.load(silentTune());
      session.initSubtune(1);
      const snapshot = (session.machine as C64Machine).snapshot();
      const registers = (session.frame as RegisterFrame).snapshotValues();

      session.restoreState(snapshot, registers, 42);

      expect(session.framesRendered).toBe(42);
      expect(host.resyncCount.count).toBe(1);
    });
  });

  describe('dispose', () => {
    it('releases the replay runner', () => {
      const runner = new FakeReplayRunner();
      const session = new TuneSession(runner, fakeHost());

      session.dispose();

      expect(runner.disposed).toBe(true);
    });
  });
});
