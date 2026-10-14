import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FakeClock } from '@sidablist/core';
import type { FrameClock, PlayerStats, ReplayRunner, SidPlayer } from '@sidablist/core';
import type { MidiOutputPort } from '@sidablist/asid';
import { DeckRuntime } from './deck-runtime';
import { FRAME_CLOCK_FACTORY, REPLAY_RUNNER_FACTORY, MIDI_ACCESS } from './ports';
import type { IMidiAccess, MidiAccessState, MidiPermission, MidiPortOption } from './ports/midi-access';

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

describe('DeckRuntime', () => {
  let runtime: DeckRuntime;
  let clockFactory: ReturnType<typeof vi.fn>;
  let replayFactory: ReturnType<typeof vi.fn>;
  let replayRunners: FakeReplayRunner[];
  let outputPortFor: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    createdPlayers.length = 0;
    replayRunners = [];
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
        { provide: MIDI_ACCESS, useValue: fakeMidiAccess((id) => outputPortFor(id) as MidiOutputPort | null) },
      ],
    });
    runtime = TestBed.inject(DeckRuntime);
  });

  it('builds a slot once: a second build call does not rebuild its clock or replay thread', () => {
    runtime.build('A');
    runtime.build('A');

    expect(clockFactory).toHaveBeenCalledTimes(1);
    expect(replayFactory).toHaveBeenCalledTimes(1);
  });

  it('builds each slot its own clock and replay thread', () => {
    runtime.build('A');
    runtime.build('B');

    expect(clockFactory).toHaveBeenCalledTimes(2);
    expect(replayFactory).toHaveBeenCalledTimes(2);
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

  it('disposes the built player, releasing its replay thread', () => {
    runtime.build('A');

    runtime.dispose('A');

    expect(replayRunners[0].disposed).toBe(true);
  });

  it("disposing one slot leaves the other slot's player untouched", () => {
    runtime.build('A');
    runtime.build('B');

    runtime.dispose('A');

    expect(replayRunners[0].disposed).toBe(true);
    expect(replayRunners[1].disposed).toBe(false);
  });

  describe('engine controls', () => {
    function playerFor(index: number): SidPlayer {
      return createdPlayers[index] as SidPlayer;
    }

    beforeEach(() => {
      runtime.build('A');
      runtime.build('B');
    });

    it('setOutputGain reaches only the named slot player, with the gain', () => {
      const a = vi.spyOn(playerFor(0), 'setOutputGain');
      const b = vi.spyOn(playerFor(1), 'setOutputGain');

      runtime.setOutputGain('A', 0.4);

      expect(a).toHaveBeenCalledExactlyOnceWith(0.4);
      expect(b).not.toHaveBeenCalled();
    });

    it('setRegisterScale forwards the group and coefficient', () => {
      const spy = vi.spyOn(playerFor(1), 'setRegisterScale');

      runtime.setRegisterScale('B', 'pulseWidth', 4);
      runtime.setRegisterScale('B', 'cutoff', 0.25);

      expect(spy).toHaveBeenNthCalledWith(1, 'pulseWidth', 4);
      expect(spy).toHaveBeenNthCalledWith(2, 'cutoff', 0.25);
    });

    it('setKeyCoefficient sets the pitch coefficient on voices 0, 1 and 2', () => {
      const spy = vi.spyOn(playerFor(0), 'setVoicePitch');

      runtime.setKeyCoefficient('A', 2);

      expect(spy.mock.calls).toEqual([
        [0, 2],
        [1, 2],
        [2, 2],
      ]);
    });

    it('setFilterMode forwards a mode and null', () => {
      const spy = vi.spyOn(playerFor(0), 'setFilterMode');

      runtime.setFilterMode('A', 'lowPass');
      runtime.setFilterMode('A', null);

      expect(spy).toHaveBeenNthCalledWith(1, 'lowPass');
      expect(spy).toHaveBeenNthCalledWith(2, null);
    });

    it('holdField and releaseField reach only the named slot player, with the field, value and amount', () => {
      const heldOnA = vi.spyOn(playerFor(0), 'holdField');
      const releasedOnA = vi.spyOn(playerFor(0), 'releaseField');
      const heldOnB = vi.spyOn(playerFor(1), 'holdField');
      const releasedOnB = vi.spyOn(playerFor(1), 'releaseField');

      runtime.holdField('A', { name: 'filtered', voice: 1 }, 1, 0.5);
      runtime.releaseField('A', { name: 'cutoff' });

      expect(heldOnA).toHaveBeenCalledExactlyOnceWith({ name: 'filtered', voice: 1 }, 1, 0.5);
      expect(releasedOnA).toHaveBeenCalledExactlyOnceWith({ name: 'cutoff' });
      expect(heldOnB).not.toHaveBeenCalled();
      expect(releasedOnB).not.toHaveBeenCalled();
    });

    it("tuneRegisters returns the registers the slot's player reports as written", () => {
      const written = Uint8Array.from({ length: 25 }, (_, index) => index);
      vi.spyOn(playerFor(0), 'getStats').mockReturnValue({
        emitted: { written, sent: new Uint8Array(25) },
      } as PlayerStats);

      expect(runtime.tuneRegisters('A')).toBe(written);
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

    it('throws for a slot that has not been built', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          DeckRuntime,
          { provide: FRAME_CLOCK_FACTORY, useValue: clockFactory },
          { provide: REPLAY_RUNNER_FACTORY, useValue: replayFactory },
          { provide: MIDI_ACCESS, useValue: fakeMidiAccess(() => null) },
        ],
      });
      const unbuilt = TestBed.inject(DeckRuntime);

      expect(() => unbuilt.setTempo('A', 1)).toThrow(/has not been built/);
    });
  });
});
