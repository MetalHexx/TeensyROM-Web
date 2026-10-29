import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FakeClock } from '@sidablist/core';
import type { FrameClock, RegisterRecord, ReplayRunner, SidPlayer } from '@sidablist/core';
import type { MidiOutputPort } from '@sidablist/asid';
import type { Playable } from '@sidablist/tunes';
import { DeckRuntime } from './deck-runtime';
import {
  FRAME_CLOCK_FACTORY,
  REPLAY_RUNNER_FACTORY,
  REGISTER_RECORDER_FACTORY,
  MIDI_ACCESS,
} from './ports';
import type { IMidiAccess, MidiAccessState, MidiPermission, MidiPortOption } from './ports/midi-access';
import type { RegisterRecorder } from './ports';

const createdPlayers = vi.hoisted((): unknown[] => []);

// The runtime keeps its players private, so the real `createSidPlayer` is wrapped to hand each
// built player to the specs.
vi.mock('@sidablist/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@sidablist/core')>();
  return {
    ...actual,
    createSidPlayer: (...args: Parameters<typeof actual.createSidPlayer>) => {
      const player = actual.createSidPlayer(...args);
      createdPlayers.push(player);
      return player;
    },
  };
});

/** Only `dispose()` is exercised here, so `run` is never expected to be called. */
class FakeReplayRunner implements ReplayRunner {
  disposed = false;
  run = vi.fn();
  dispose(): void {
    this.disposed = true;
  }
}

/** A recorder whose scans the spec settles by hand. */
class FakeRegisterRecorder implements RegisterRecorder {
  disposed = false;
  readonly requests: {
    readonly bytes: Uint8Array;
    readonly subtune: number;
    readonly frames: number;
  }[] = [];
  private readonly settlers: {
    resolve: (record: RegisterRecord | null) => void;
    reject: (error: unknown) => void;
  }[] = [];

  record(bytes: Uint8Array, subtune: number, frames: number): Promise<RegisterRecord | null> {
    this.requests.push({ bytes, subtune, frames });
    return new Promise((resolve, reject) => this.settlers.push({ resolve, reject }));
  }

  dispose(): void {
    this.disposed = true;
  }

  /** Answers the `index`th request. */
  answer(index: number, record: RegisterRecord | null): void {
    this.settlers[index].resolve(record);
  }

  fail(index: number, error: unknown): void {
    this.settlers[index].reject(error);
  }
}

function recordOf(frames: number): RegisterRecord {
  return {
    frames,
    values: new Uint8Array(frames * 25),
    retriggerEntries: new Uint32Array(0),
    retriggerRegisters: new Uint8Array(0),
    retriggerValues: new Uint8Array(0),
  };
}

function recordingPort(portId: string): MidiOutputPort & { readonly sent: readonly Uint8Array[] } {
  const sent: Uint8Array[] = [];
  return {
    portId,
    supportsCancel: false,
    send: (bytes: Uint8Array): void => {
      sent.push(bytes);
    },
    cancelPending: (): boolean => false,
    sent,
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

const PSID_HEADER_SIZE = 0x7c;
const SID_MODEL_6581 = 0b01;
const SID_MODEL_8580 = 0b10;

/** A minimal well-formed PSID v2 file whose header names the given SID model. */
function sidBytes(model: number): Uint8Array {
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
  view.setUint16(0x76, model << 4, false);
  buffer.set(payload, PSID_HEADER_SIZE);
  return buffer;
}

function playableOf(model: number): Playable {
  return {
    bytes: sidBytes(model),
    reference: { identity: { sidHash: 'tune', subtune: 1 } },
    index: { loopStartFrame: null, loopPeriodFrames: null, endedAtFrame: null },
  } as unknown as Playable;
}

describe('DeckRuntime', () => {
  let runtime: DeckRuntime;
  let clockFactory: ReturnType<typeof vi.fn>;
  let replayFactory: ReturnType<typeof vi.fn>;
  let replayRunners: FakeReplayRunner[];
  let recorders: FakeRegisterRecorder[];
  let outputPortFor: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    createdPlayers.length = 0;
    replayRunners = [];
    recorders = [];
    clockFactory = vi.fn((): FrameClock => new FakeClock());
    replayFactory = vi.fn((): ReplayRunner => {
      const runner = new FakeReplayRunner();
      replayRunners.push(runner);
      return runner;
    });
    outputPortFor = vi.fn((): MidiOutputPort | null => null);

    TestBed.configureTestingModule({
      providers: [
        DeckRuntime,
        { provide: FRAME_CLOCK_FACTORY, useValue: clockFactory },
        { provide: REPLAY_RUNNER_FACTORY, useValue: replayFactory },
        {
          provide: REGISTER_RECORDER_FACTORY,
          useValue: (): RegisterRecorder => {
            const recorder = new FakeRegisterRecorder();
            recorders.push(recorder);
            return recorder;
          },
        },
        { provide: MIDI_ACCESS, useValue: fakeMidiAccess((id) => outputPortFor(id) as MidiOutputPort | null) },
      ],
    });
    runtime = TestBed.inject(DeckRuntime);
  });

  it('builds a slot once: a second build call does not rebuild its clock or replay threads', () => {
    runtime.build('A');
    runtime.build('A');

    expect(clockFactory).toHaveBeenCalledTimes(1);
    expect(replayFactory).toHaveBeenCalledTimes(2);
  });

  it('builds each slot its own clock and its own pair of replay threads, one for jumps and one for prepared builds', () => {
    runtime.build('A');
    runtime.build('B');

    expect(clockFactory).toHaveBeenCalledTimes(2);
    expect(replayFactory).toHaveBeenCalledTimes(4);
    expect(new Set(replayRunners).size).toBe(4);
  });

  it('drops bytes with nothing bound, never reaching the MIDI access port lookup', () => {
    runtime.build('A');

    runtime.identify('A', 'hello');

    expect(outputPortFor).not.toHaveBeenCalled();
  });

  it("re-resolves the façade's target on every send rather than caching it", () => {
    runtime.build('A');
    const port = recordingPort('port-1');
    outputPortFor.mockReturnValue(port);
    runtime.setPort('A', 'port-1');

    runtime.identify('A', 'one');
    runtime.identify('A', 'two');

    expect(outputPortFor).toHaveBeenCalledTimes(2);
    expect(outputPortFor).toHaveBeenCalledWith('port-1');
    expect(port.sent).toHaveLength(2);
  });

  it('drops bytes again once a previously bound port stops resolving', () => {
    runtime.build('A');
    const port = recordingPort('port-1');
    outputPortFor.mockReturnValue(port);
    runtime.setPort('A', 'port-1');
    runtime.identify('A', 'one');

    outputPortFor.mockReturnValue(null);
    runtime.identify('A', 'two');

    expect(port.sent).toHaveLength(1);
  });

  describe('resync', () => {
    /** The SID-type packet's chip flag, then the start packet — what `AsidSink.begin` sends. */
    function handshake(port: { readonly sent: readonly Uint8Array[] }) {
      return { count: port.sent.length, is8580: port.sent[0]?.[4] === 1, startLength: port.sent[1]?.length };
    }

    it("re-sends the loaded tune's SID type and the start packet through the slot's port", () => {
      runtime.build('A');
      const port = recordingPort('port-1');
      outputPortFor.mockReturnValue(port);
      runtime.setPort('A', 'port-1');
      runtime.load('A', playableOf(SID_MODEL_8580));

      runtime.resync('A');

      expect(handshake(port)).toEqual({ count: 2, is8580: true, startLength: 4 });
    });

    it('uses the chip model of the tune loaded last', () => {
      runtime.build('A');
      const port = recordingPort('port-1');
      outputPortFor.mockReturnValue(port);
      runtime.setPort('A', 'port-1');
      runtime.load('A', playableOf(SID_MODEL_8580));
      runtime.load('A', playableOf(SID_MODEL_6581));

      runtime.resync('A');

      expect(handshake(port).is8580).toBe(false);
    });

    it('does nothing when no tune is loaded', () => {
      runtime.build('A');
      const port = recordingPort('port-1');
      outputPortFor.mockReturnValue(port);
      runtime.setPort('A', 'port-1');

      runtime.resync('A');

      expect(port.sent).toHaveLength(0);
    });

    it("sends nothing to the other slot's port", () => {
      runtime.build('A');
      runtime.build('B');
      const portB = recordingPort('port-b');
      outputPortFor.mockImplementation((id: string) => (id === 'port-b' ? portB : null));
      runtime.setPort('B', 'port-b');
      runtime.load('A', playableOf(SID_MODEL_8580));

      runtime.resync('A');

      expect(portB.sent).toHaveLength(0);
    });
  });

  it('disposes the built player, releasing both of its replay threads', () => {
    runtime.build('A');

    runtime.dispose('A');

    expect(replayRunners.map((runner) => runner.disposed)).toEqual([true, true]);
  });

  it("disposing one slot leaves the other slot's player untouched", () => {
    runtime.build('A');
    runtime.build('B');

    runtime.dispose('A');

    expect(replayRunners.map((runner) => runner.disposed)).toEqual([true, true, false, false]);
  });

  it("disposes the recorder with the player, and only that slot's", () => {
    runtime.build('A');
    runtime.build('B');

    runtime.dispose('A');

    expect(recorders.map((recorder) => recorder.disposed)).toEqual([true, false]);
  });

  describe('the register record', () => {
    const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve));
    let setRecord: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      runtime.build('A');
      setRecord = vi
        .spyOn(createdPlayers[0] as SidPlayer, 'setRegisterRecord')
        .mockImplementation(() => undefined);
    });

    it('is requested for the loaded subtune, covering the position basis, the ceiling and five seconds more', () => {
      const playable = playableOf(SID_MODEL_6581);

      runtime.load('A', playable);

      const { basis } = runtime.snapshot('A');
      const margin = Math.round(5e6 / runtime.playCallIntervalUs('A'));
      expect(recorders[0].requests).toHaveLength(1);
      expect(recorders[0].requests[0].bytes).toBe(playable.bytes);
      expect(recorders[0].requests[0].subtune).toBe(1);
      expect(recorders[0].requests[0].frames).toBe(
        Math.max(basis.positionBasisFrames, basis.ceilingFrames) + margin
      );
    });

    it('is requested again for a reload, since a subtune switch loads through the same call', () => {
      runtime.load('A', playableOf(SID_MODEL_6581));
      runtime.load('A', playableOf(SID_MODEL_8580));

      expect(recorders[0].requests).toHaveLength(2);
    });

    it('goes to the player when it arrives', async () => {
      runtime.load('A', playableOf(SID_MODEL_6581));
      const record = recordOf(10);

      recorders[0].answer(0, record);
      await settle();

      expect(setRecord).toHaveBeenCalledExactlyOnceWith(record);
    });

    it('is not set once a newer load has been made, whichever answer comes first', async () => {
      runtime.load('A', playableOf(SID_MODEL_6581));
      runtime.load('A', playableOf(SID_MODEL_8580));
      const stale = recordOf(10);
      const current = recordOf(20);

      recorders[0].answer(1, current);
      recorders[0].answer(0, stale);
      await settle();

      expect(setRecord).toHaveBeenCalledExactlyOnceWith(current);
    });

    it('is simply not set when the scan fails, with a null answer or a rejection', async () => {
      runtime.load('A', playableOf(SID_MODEL_6581));
      runtime.load('A', playableOf(SID_MODEL_6581));

      recorders[0].answer(0, null);
      recorders[0].fail(1, new Error('worker gone'));
      await settle();

      expect(setRecord).not.toHaveBeenCalled();
    });

    it("asks the slot's own recorder", () => {
      runtime.build('B');

      runtime.load('B', playableOf(SID_MODEL_6581));

      expect(recorders[0].requests).toHaveLength(0);
      expect(recorders[1].requests).toHaveLength(1);
    });

    it("hands varispeed to the slot's player and takes it back", () => {
      const player = createdPlayers[0] as SidPlayer;
      const enter = vi.spyOn(player, 'enterVarispeed').mockReturnValue(true);
      const leave = vi.spyOn(player, 'leaveVarispeed').mockImplementation(() => undefined);
      const source = (): number => 0;

      expect(runtime.enterVarispeed('A', source)).toBe(true);
      runtime.leaveVarispeed('A');

      expect(enter).toHaveBeenCalledExactlyOnceWith(source);
      expect(leave).toHaveBeenCalledTimes(1);
    });
  });

  describe('engine controls', () => {
    function playerFor(index: number): SidPlayer {
      return createdPlayers[index] as SidPlayer;
    }

    beforeEach(() => {
      runtime.build('A');
      runtime.build('B');
    });

    it('setVoicePitch reaches only the named slot and voice, with the multiplier', () => {
      const a = vi.spyOn(playerFor(0), 'setVoicePitch');
      const b = vi.spyOn(playerFor(1), 'setVoicePitch');

      runtime.setVoicePitch('A', 2, 1.5);

      expect(a).toHaveBeenCalledExactlyOnceWith(2, 1.5);
      expect(b).not.toHaveBeenCalled();
    });

    it('setFieldOffset sets a non-zero offset and clears the field at 0', () => {
      const set = vi.spyOn(playerFor(0), 'setFieldOffset');
      const clear = vi.spyOn(playerFor(0), 'clearFieldOffset');
      const otherSet = vi.spyOn(playerFor(1), 'setFieldOffset');
      const otherClear = vi.spyOn(playerFor(1), 'clearFieldOffset');

      runtime.setFieldOffset('A', { name: 'attack', voice: 1 }, -3);
      runtime.setFieldOffset('A', { name: 'cutoff' }, 0);

      expect(set).toHaveBeenCalledExactlyOnceWith({ name: 'attack', voice: 1 }, -3);
      expect(clear).toHaveBeenCalledExactlyOnceWith({ name: 'cutoff' });
      expect(otherSet).not.toHaveBeenCalled();
      expect(otherClear).not.toHaveBeenCalled();
    });

    it('holdField and releaseField reach only the named slot player, with the field and value', () => {
      const heldOnA = vi.spyOn(playerFor(0), 'holdField');
      const releasedOnA = vi.spyOn(playerFor(0), 'releaseField');
      const heldOnB = vi.spyOn(playerFor(1), 'holdField');
      const releasedOnB = vi.spyOn(playerFor(1), 'releaseField');

      runtime.holdField('A', { name: 'filtered', voice: 1 }, 1);
      runtime.releaseField('A', { name: 'cutoff' });

      expect(heldOnA).toHaveBeenCalledExactlyOnceWith({ name: 'filtered', voice: 1 }, 1);
      expect(releasedOnA).toHaveBeenCalledExactlyOnceWith({ name: 'cutoff' });
      expect(heldOnB).not.toHaveBeenCalled();
      expect(releasedOnB).not.toHaveBeenCalled();
    });

    it("readRegisters fills the caller's buffers from the slot's player", () => {
      const spy = vi.spyOn(playerFor(0), 'readRegisters').mockImplementation((written, sent) => {
        written.fill(7);
        sent.fill(9);
      });
      const written = new Uint8Array(25);
      const sent = new Uint8Array(25);

      runtime.readRegisters('A', written, sent);

      expect(spy).toHaveBeenCalledExactlyOnceWith(written, sent);
      expect(written[24]).toBe(7);
      expect(sent[24]).toBe(9);
    });

    it('setTempo reaches the player and reads back through the snapshot', () => {
      const spy = vi.spyOn(playerFor(0), 'setTempo');

      runtime.setTempo('A', 1.25);

      expect(spy).toHaveBeenCalledExactlyOnceWith(1.25);
      expect(runtime.snapshot('A').tempo.multiplier).toBe(1.25);
      expect(runtime.snapshot('B').tempo.multiplier).toBe(1);
    });

    it('setVoiceMuted and setVoiceHeld forward the voice and flag, and read back through the snapshot', () => {
      const muted = vi.spyOn(playerFor(0), 'setVoiceMuted');
      const held = vi.spyOn(playerFor(0), 'setVoiceHeld');

      runtime.setVoiceMuted('A', 1, true);
      runtime.setVoiceHeld('A', 2, true);

      expect(muted).toHaveBeenCalledExactlyOnceWith(1, true);
      expect(held).toHaveBeenCalledExactlyOnceWith(2, true);
      expect(runtime.snapshot('A').voices).toEqual([
        { muted: false, held: false },
        { muted: true, held: false },
        { muted: false, held: true },
      ]);
    });

    it('clearVoiceMutes clears latched mutes and leaves holds', () => {
      const spy = vi.spyOn(playerFor(0), 'clearVoiceMutes');
      runtime.setVoiceMuted('A', 0, true);
      runtime.setVoiceHeld('A', 2, true);

      runtime.clearVoiceMutes('A');

      expect(spy).toHaveBeenCalledOnce();
      expect(runtime.snapshot('A').voices).toEqual([
        { muted: false, held: false },
        { muted: false, held: false },
        { muted: false, held: true },
      ]);
    });

    it('setJumpTargets declares the frames on the named slot only', () => {
      const a = vi.spyOn(playerFor(0), 'setJumpTargets');
      const b = vi.spyOn(playerFor(1), 'setJumpTargets');

      runtime.setJumpTargets('A', [10, 250]);

      expect(a).toHaveBeenCalledExactlyOnceWith([10, 250]);
      expect(b).not.toHaveBeenCalled();
    });

    it('capturePosition answers null with nothing loaded', () => {
      expect(runtime.capturePosition('A')).toBeNull();
    });

    it('capturePosition answers the frame the loaded tune is at', () => {
      runtime.load('A', playableOf(SID_MODEL_6581));

      expect(runtime.capturePosition('A')).toBe(0);
    });

    it('setActiveLoop and queueJump pass their frames to the named slot only, and null clears', () => {
      const loop = vi.spyOn(playerFor(0), 'setActiveLoop').mockImplementation(() => undefined);
      const queue = vi.spyOn(playerFor(0), 'queueJump').mockImplementation(() => undefined);
      const otherLoop = vi.spyOn(playerFor(1), 'setActiveLoop');

      runtime.setActiveLoop('A', { startFrame: 100, endFrame: 400 });
      runtime.setActiveLoop('A', null);
      runtime.queueJump('A', { startFrame: 20, endFrame: null });
      runtime.queueJump('A', null);

      expect(loop.mock.calls).toEqual([[{ startFrame: 100, endFrame: 400 }], [null]]);
      expect(queue.mock.calls).toEqual([[{ startFrame: 20, endFrame: null }], [null]]);
      expect(otherLoop).not.toHaveBeenCalled();
    });

    it('seekToFrame seeks the named slot to that frame', async () => {
      const seek = vi.spyOn(playerFor(0), 'seek').mockResolvedValue(undefined);

      await runtime.seekToFrame('A', 320);

      expect(seek).toHaveBeenCalledExactlyOnceWith(320);
    });

    it('seekToFrame hands the jump settings to the engine with the frame', async () => {
      const seek = vi.spyOn(playerFor(0), 'seek').mockResolvedValue(undefined);
      const settings = { voicePitch: [2, 1, 1], voiceMutes: [true, false, false] };

      await runtime.seekToFrame('A', 320, settings);

      expect(seek).toHaveBeenCalledExactlyOnceWith(320, settings);
    });

    it('queueJump hands the jump settings to the engine with the target', () => {
      const queue = vi.spyOn(playerFor(0), 'queueJump').mockImplementation(() => undefined);
      const settings = { voiceMutes: [false, true, false] };

      runtime.queueJump('A', { startFrame: 20, endFrame: 80, settings });

      expect(queue.mock.calls).toEqual([[{ startFrame: 20, endFrame: 80, settings }]]);
    });

    it('throws for a slot that has not been built', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          DeckRuntime,
          { provide: FRAME_CLOCK_FACTORY, useValue: clockFactory },
          { provide: REPLAY_RUNNER_FACTORY, useValue: replayFactory },
          {
            provide: REGISTER_RECORDER_FACTORY,
            useValue: () => ({ record: () => Promise.resolve(null), dispose: () => undefined }),
          },
          { provide: MIDI_ACCESS, useValue: fakeMidiAccess(() => null) },
        ],
      });
      const unbuilt = TestBed.inject(DeckRuntime);

      expect(() => unbuilt.setTempo('A', 1)).toThrow(/has not been built/);
    });
  });
});
