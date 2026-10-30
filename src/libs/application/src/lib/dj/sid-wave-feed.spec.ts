import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SID_REGISTER_COUNT } from '@sidablist/core';
import type { DeliveryBatch } from '@sidablist/core';
import { logWarn } from '@teensyrom-nx/utils';
import { DeckRuntime } from './deck-runtime';
import { DjStore } from './dj-store';
import { SidWaveFeed } from './sid-wave-feed';
import type { Slot } from './slot';
import { WAVE_HISTORY_CAPACITY } from './wave-feed-targets';
import type { DeckWaveTarget, WaveDeckState, WaveFeedWriter, WaveVoiceFields } from './wave-feed-targets';

vi.mock('@teensyrom-nx/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@teensyrom-nx/utils')>();
  return { ...actual, logWarn: vi.fn() };
});

const GATE_OPEN = 0x41;
const GATE_CLOSED = 0x40;

/** One entry of a scripted drain: its time, the 25 registers (control registers by voice) and the
 *  control bytes the entry carries per voice. */
interface ScriptedEntry {
  timeMs: number;
  registers?: Partial<Record<number, number>>;
  control?: readonly [readonly number[], readonly number[], readonly number[]];
}

interface ScriptedDrain {
  entries: readonly ScriptedEntry[];
  restarted?: boolean;
  dropped?: number;
}

function controlRegister(voice: number): number {
  return voice * 7 + 4;
}

type RecordedCall =
  | { kind: 'begin'; timeMs: number }
  | { kind: 'voice'; voice: number; fields: WaveVoiceFields }
  | { kind: 'finish'; restarted: boolean; dropped: number };

describe('SidWaveFeed', () => {
  let feed: SidWaveFeed;
  let store: InstanceType<typeof DjStore>;
  let drains: ScriptedDrain[];
  let keepDeliveries: ReturnType<typeof vi.fn>;
  let drainDeliveries: ReturnType<typeof vi.fn>;

  let calls: RecordedCall[];
  let states: WaveDeckState[];
  let submit: ReturnType<typeof vi.fn>;
  let discard: ReturnType<typeof vi.fn>;
  let acquirable: boolean;
  let failed: boolean;
  let target: DeckWaveTarget;

  function recordingTarget(): DeckWaveTarget {
    const writer: WaveFeedWriter = {
      beginEntry: (timeMs) => calls.push({ kind: 'begin', timeMs }),
      // The feed reuses one fields object, so a recording copies what it was handed.
      setVoice: (voice, fields) => calls.push({ kind: 'voice', voice, fields: { ...fields } }),
      finish: (restarted, dropped) => calls.push({ kind: 'finish', restarted, dropped }),
    };
    return {
      acquire: () => (acquirable ? writer : null),
      submit,
      discard,
      setState: (state) => states.push(state),
      isFailed: () => failed,
      setSuppressed: vi.fn(),
      readStats: () => Promise.resolve({}),
    };
  }

  function drain(...scripted: ScriptedDrain[]): void {
    drains.push(...scripted);
  }

  function voicesOf(entryIndex: number): WaveVoiceFields[] {
    return calls
      .filter((call): call is Extract<RecordedCall, { kind: 'voice' }> => call.kind === 'voice')
      .slice(entryIndex * 3, entryIndex * 3 + 3)
      .map((call) => call.fields);
  }

  beforeEach(() => {
    drains = [];
    calls = [];
    states = [];
    acquirable = true;
    failed = false;
    submit = vi.fn();
    discard = vi.fn();
    keepDeliveries = vi.fn();
    drainDeliveries = vi.fn((_slot: Slot, into: DeliveryBatch) => {
      const scripted = drains.shift() ?? { entries: [] };
      scripted.entries.forEach((entry, index) => {
        const registers = new Uint8Array(SID_REGISTER_COUNT);
        for (const [register, value] of Object.entries(entry.registers ?? {})) {
          registers[Number(register)] = value ?? 0;
        }
        into.registers.set(registers, index * SID_REGISTER_COUNT);
        into.timesMs[index] = entry.timeMs;
        for (let voice = 0; voice < 3; voice++) {
          const bytes = entry.control?.[voice] ?? [];
          into.controlCounts[index * 3 + voice] = bytes.length;
          bytes.forEach((byte, step) => (into.controlBytes[(index * 3 + voice) * 2 + step] = byte));
        }
      });
      into.count = scripted.entries.length;
      into.dropped = scripted.dropped ?? 0;
      into.restarted = scripted.restarted ?? false;
    });
    vi.mocked(logWarn).mockClear();

    TestBed.configureTestingModule({
      providers: [{ provide: DeckRuntime, useValue: { keepDeliveries, drainDeliveries } }],
    });
    feed = TestBed.inject(SidWaveFeed);
    store = TestBed.inject(DjStore);
    TestBed.flushEffects();
    target = recordingTarget();
  });

  describe('attaching', () => {
    it('asks for the history, sends the current state and detaches by turning the history off', () => {
      const detach = feed.attach('A', target);

      expect(keepDeliveries).toHaveBeenCalledWith('A', WAVE_HISTORY_CAPACITY);
      expect(states).toEqual(['flat']);

      detach();
      expect(keepDeliveries).toHaveBeenLastCalledWith('A', 0);
    });

    it('lets a replaced target\'s detach do nothing', () => {
      const detachFirst = feed.attach('A', target);
      feed.attach('A', recordingTarget());
      keepDeliveries.mockClear();

      detachFirst();

      expect(keepDeliveries).not.toHaveBeenCalled();
    });

    it('warns once and does not throw for a slot the runtime has not built', () => {
      keepDeliveries.mockImplementation(() => {
        throw new Error('DeckRuntime: slot A has not been built');
      });

      expect(() => feed.attach('A', target)).not.toThrow();
      feed.attach('A', target);

      expect(vi.mocked(logWarn).mock.calls.filter(([m]) => m.startsWith('SidWaveFeed'))).toHaveLength(1);
    });

    it('never touches the runtime when a paint finds nothing attached', () => {
      feed.paint('A');

      expect(keepDeliveries).not.toHaveBeenCalled();
      expect(drainDeliveries).not.toHaveBeenCalled();
    });
  });

  describe('a paint', () => {
    beforeEach(() => {
      feed.attach('A', target);
    });

    it('hands every entry over in order, decoded from its registers, and submits once', () => {
      drain({
        entries: [
          {
            timeMs: 10,
            registers: {
              0: 0x34,
              1: 0x12,
              2: 0xcd,
              3: 0x0a,
              [controlRegister(0)]: 0x15 | 0x04 | 0x02,
              5: 0x9a,
              6: 0x7c,
            },
          },
          { timeMs: 30 },
        ],
      });

      feed.paint('A');

      expect(calls.filter((call) => call.kind === 'begin')).toEqual([
        { kind: 'begin', timeMs: 10 },
        { kind: 'begin', timeMs: 30 },
      ]);
      expect(calls.at(-1)).toEqual({ kind: 'finish', restarted: false, dropped: 0 });
      const [first] = voicesOf(0);
      expect(first).toMatchObject({
        frequency: 0x1234,
        pulseWidth: 0xacd,
        waveform: 0x1,
        ring: 1,
        sync: 1,
        attack: 0x9,
        decay: 0xa,
        sustain: 0x7,
        release: 0xc,
        gate: 1,
      });
      expect(voicesOf(1)[0]?.frequency).toBe(0);
      expect(submit).toHaveBeenCalledTimes(1);
      expect(discard).not.toHaveBeenCalled();
    });

    it('opens a hit on a closed-to-open write, and takes the gate from the registers as the entry ends', () => {
      drain({
        entries: [
          { timeMs: 1, registers: { [controlRegister(0)]: GATE_OPEN }, control: [[GATE_OPEN], [], []] },
          { timeMs: 2, registers: { [controlRegister(0)]: GATE_OPEN } },
          { timeMs: 3, registers: { [controlRegister(0)]: GATE_CLOSED }, control: [[GATE_CLOSED], [], []] },
        ],
      });

      feed.paint('A');

      expect(voicesOf(0)[0]).toMatchObject({ hit: 1, gate: 1 });
      expect(voicesOf(1)[0]).toMatchObject({ hit: 0, gate: 1 });
      expect(voicesOf(2)[0]).toMatchObject({ hit: 0, gate: 0 });
    });

    it('reads a doubled control write in order, from the gate the voice had before', () => {
      drain({
        entries: [
          { timeMs: 1, registers: { [controlRegister(0)]: GATE_CLOSED }, control: [[GATE_OPEN, GATE_CLOSED], [], []] },
          { timeMs: 2, registers: { [controlRegister(0)]: GATE_OPEN }, control: [[GATE_CLOSED, GATE_OPEN], [], []] },
        ],
      });

      feed.paint('A');

      // Closed before: open then closed is a hit that ends closed.
      expect(voicesOf(0)[0]).toMatchObject({ hit: 1, gate: 0 });
      // Closed before again: closed then open is a hit that ends open.
      expect(voicesOf(1)[0]).toMatchObject({ hit: 1, gate: 1 });
    });

    it('carries the previous gate between paints, so an open gate rewritten open is not a hit', () => {
      drain({ entries: [{ timeMs: 1, registers: { [controlRegister(1)]: GATE_OPEN }, control: [[], [GATE_OPEN], []] }] });
      feed.paint('A');
      calls.length = 0;
      drain({ entries: [{ timeMs: 2, registers: { [controlRegister(1)]: GATE_OPEN }, control: [[], [GATE_OPEN], []] }] });

      feed.paint('A');

      expect(voicesOf(0)[1]).toMatchObject({ hit: 0, gate: 1 });
    });

    it('reads no control bytes with an open control register as an open gate and no hit', () => {
      drain({ entries: [{ timeMs: 1, registers: { [controlRegister(2)]: GATE_OPEN } }] });

      feed.paint('A');

      expect(voicesOf(0)[2]).toMatchObject({ hit: 0, gate: 1 });
    });

    it('passes a restart or a drop through finish and forgets the previous gates', () => {
      drain({ entries: [{ timeMs: 1, registers: { [controlRegister(0)]: GATE_OPEN } }] });
      feed.paint('A');
      calls.length = 0;
      drain({
        entries: [{ timeMs: 2, registers: { [controlRegister(0)]: GATE_OPEN }, control: [[GATE_OPEN], [], []] }],
        restarted: true,
        dropped: 3,
      });

      feed.paint('A');

      expect(calls.at(-1)).toEqual({ kind: 'finish', restarted: true, dropped: 3 });
      // Had the gate stayed open from before, this rewrite would not be a hit.
      expect(voicesOf(0)[0]).toMatchObject({ hit: 1, gate: 1 });
    });

    it('hands over a restart with no entries', () => {
      drain({ entries: [], restarted: true });

      feed.paint('A');

      expect(calls).toEqual([{ kind: 'finish', restarted: true, dropped: 0 }]);
      expect(submit).toHaveBeenCalledTimes(1);
    });

    it('discards the writer and submits nothing for an empty drain', () => {
      drain({ entries: [] });

      feed.paint('A');

      expect(calls).toEqual([]);
      expect(discard).toHaveBeenCalledTimes(1);
      expect(submit).not.toHaveBeenCalled();
    });

    it('does not drain while every buffer is in flight, so the history keeps the entries', () => {
      acquirable = false;
      drain({ entries: [{ timeMs: 1 }] });

      feed.paint('A');

      expect(drainDeliveries).not.toHaveBeenCalled();
      expect(feed.stats()['poolMisses']).toBe(1);

      acquirable = true;
      feed.paint('A');
      expect(calls.filter((call) => call.kind === 'begin')).toHaveLength(1);
    });

    it('turns the history off once when the renderer has failed for good, and drains nothing', () => {
      failed = true;
      keepDeliveries.mockClear();

      feed.paint('A');
      feed.paint('A');

      expect(keepDeliveries).toHaveBeenCalledTimes(1);
      expect(keepDeliveries).toHaveBeenCalledWith('A', 0);
      expect(drainDeliveries).not.toHaveBeenCalled();
    });

    it('discards a checked-out writer, warns once and carries on when a fault interrupts the paint', () => {
      drainDeliveries.mockImplementationOnce(() => {
        throw new Error('boom');
      });
      drainDeliveries.mockImplementationOnce(() => {
        throw new Error('boom');
      });

      feed.paint('A');
      feed.paint('A');

      expect(discard).toHaveBeenCalledTimes(2);
      expect(vi.mocked(logWarn).mock.calls.filter(([m]) => m.startsWith('SidWaveFeed'))).toHaveLength(1);

      drain({ entries: [{ timeMs: 1 }] });
      feed.paint('A');
      expect(submit).toHaveBeenCalledTimes(1);
    });

    it('does nothing while suppressed and turns the history back on when released', () => {
      keepDeliveries.mockClear();
      feed.setSuppressed(true);
      expect(keepDeliveries).toHaveBeenLastCalledWith('A', 0);
      expect(target.setSuppressed).toHaveBeenCalledWith(true);

      drain({ entries: [{ timeMs: 1 }] });
      feed.paint('A');
      expect(drainDeliveries).not.toHaveBeenCalled();

      feed.setSuppressed(false);
      expect(keepDeliveries).toHaveBeenLastCalledWith('A', WAVE_HISTORY_CAPACITY);
      feed.paint('A');
      expect(submit).toHaveBeenCalledTimes(1);
    });

    it('keeps the slots apart', () => {
      drain({ entries: [{ timeMs: 1 }] });

      feed.paint('B');

      expect(drainDeliveries).not.toHaveBeenCalled();
    });
  });

  describe('the deck state', () => {
    function setStatus(status: Parameters<typeof store.setDeckStatus>[0]['status']): void {
      store.setDeckStatus({ slot: 'A', status });
      TestBed.flushEffects();
    }

    function setVarispeed(varispeed: boolean): void {
      store.setDeckEngineControls({
        slot: 'A',
        speed: 1,
        faderSpeed: 1,
        nudging: false,
        varispeed,
        voices: store.decks().A.voices,
      });
      TestBed.flushEffects();
    }

    beforeEach(() => {
      feed.attach('A', target);
      states.length = 0;
    });

    it('maps the status to playing, held or flat, and drains once on each change', () => {
      const expected: [Parameters<typeof setStatus>[0], WaveDeckState][] = [
        ['playing', 'playing'],
        ['paused', 'held'],
        ['stopped', 'flat'],
        ['loading', 'flat'],
        ['failed', 'flat'],
        ['empty', 'flat'],
      ];
      for (const [status, state] of expected) {
        states.length = 0;
        drainDeliveries.mockClear();
        setStatus(status);
        expect(states).toEqual([state]);
        expect(drainDeliveries).toHaveBeenCalledTimes(1);
      }
    });

    it('reads a deck under a hand as playing, and falls back to its status when the hand lets go', () => {
      setStatus('paused');
      states.length = 0;

      setVarispeed(true);
      expect(states).toEqual(['playing']);

      setVarispeed(false);
      expect(states).toEqual(['playing', 'held']);
    });

    it('delivers the entries a pause leaves behind', () => {
      setStatus('playing');
      calls.length = 0;
      drain({ entries: [{ timeMs: 5, registers: { [controlRegister(0)]: GATE_CLOSED }, control: [[GATE_CLOSED], [], []] }] });

      setStatus('paused');

      expect(calls.filter((call) => call.kind === 'begin')).toEqual([{ kind: 'begin', timeMs: 5 }]);
      expect(submit).toHaveBeenCalled();
    });
  });
});
