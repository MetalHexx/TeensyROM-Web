import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FakeClock } from '@sidablist/core';
import type { FrameClock, ReplayRunner } from '@sidablist/core';
import type { MidiOutputPort } from '@sidablist/asid';
import { DeckRuntime } from './deck-runtime';
import { FRAME_CLOCK_FACTORY, REPLAY_RUNNER_FACTORY, MIDI_ACCESS } from './ports';
import type { IMidiAccess, MidiAccessState, MidiPortOption } from './ports/midi-access';

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
});
