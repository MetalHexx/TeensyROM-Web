import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { describe, it, expect, beforeEach, vi, type MockInstance } from 'vitest';
import { FakeClock, VOICE_CONTROL_REGISTERS } from '@sidablist/core';
import type { ReplayRunner } from '@sidablist/core';
import type { TuneReference } from '@sidablist/tunes';
import { logInfo, logWarn } from '@teensyrom-nx/utils';
import { MixerService } from './mixer.service';
import { DeckRuntime } from './deck-runtime';
import { DjStore, HOME_DECK_PANEL, type DeckDetectedKey } from './dj-store';
import { FRAME_CLOCK_FACTORY, REPLAY_RUNNER_FACTORY, MIDI_ACCESS } from './ports';
import type {
  IMidiAccess,
  MidiAccessState,
  MidiPermission,
  MidiPortOption,
} from './ports/midi-access';
import { DECK_SLOTS, type Slot } from './slot';

vi.mock('@teensyrom-nx/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@teensyrom-nx/utils')>();
  return { ...actual, logInfo: vi.fn(), logWarn: vi.fn() };
});

const tune: TuneReference = {
  identity: { sidHash: 'hash-1', subtune: 1 },
  title: 'Test Tune',
  author: 'Test Author',
  released: '2024 Test',
  subtuneCount: 1,
  byteLength: 1234,
};

const detectedKey: DeckDetectedKey = { tonic: 9, mode: 'minor', camelot: '8A' };

const RING_BIT = 0x04;
const SYNC_BIT = 0x02;
/** $D417: the filter routing, one bit per voice. */
const FILTER_ROUTING_REGISTER = 23;

class FakeReplayRunner implements ReplayRunner {
  run = vi.fn();
  dispose(): void {
    /* nothing to release */
  }
}

function fakeMidiAccess(): IMidiAccess {
  return {
    accessState: signal<MidiAccessState>('granted'),
    ports: signal<readonly MidiPortOption[]>([]),
    lastError: signal<string | null>(null),
    queryPermission: (): Promise<MidiPermission> => Promise.resolve('granted'),
    requestAccess: (): Promise<void> => Promise.resolve(),
    holderOf: (): string | null => null,
    claim: (): boolean => true,
    release: (): void => undefined,
    outputPortFor: () => null,
  };
}

describe('MixerService', () => {
  let service: MixerService;
  let store: InstanceType<typeof DjStore>;
  let readRegisters: MockInstance<DeckRuntime['readRegisters']>;

  /** Puts a tune on the slot at a settled status, which is what makes its controls live. */
  function makeShapeable(slot: Slot): void {
    store.setDeckLoaded({ slot, reference: tune });
    store.setDeckStatus({ slot, status: 'paused' });
  }

  /** Makes the engine report a tune that has `ring` and `sync` on for voice 0 and the filter
   *  routing for voice 1. */
  function tuneWrites(on: { ring?: boolean; sync?: boolean; filter?: boolean }): void {
    readRegisters.mockImplementation((_slot, written) => {
      written.fill(0);
      written[VOICE_CONTROL_REGISTERS[0]] = (on.ring ? RING_BIT : 0) | (on.sync ? SYNC_BIT : 0);
      written[FILTER_ROUTING_REGISTER] = on.filter ? 0b001 : 0;
    });
  }

  beforeEach(() => {
    vi.mocked(logInfo).mockClear();
    vi.mocked(logWarn).mockClear();
    TestBed.configureTestingModule({
      providers: [
        { provide: FRAME_CLOCK_FACTORY, useValue: (): FakeClock => new FakeClock() },
        { provide: REPLAY_RUNNER_FACTORY, useValue: (): ReplayRunner => new FakeReplayRunner() },
        { provide: MIDI_ACCESS, useValue: fakeMidiAccess() },
      ],
    });
    service = TestBed.inject(MixerService);
    store = TestBed.inject(DjStore);
    const runtime = TestBed.inject(DeckRuntime);
    for (const slot of DECK_SLOTS) {
      runtime.build(slot);
    }
    readRegisters = vi.spyOn(runtime, 'readRegisters');
  });

  describe('always-accepted controls', () => {
    it('accepts the key display format', () => {
      service.setKeyDisplayFormat('note');
      expect(store.keyDisplayFormat()).toBe('note');
    });

    it('panic resets the panel on a deck with nothing loaded', () => {
      store.setVoiceStrip({ slot: 'A', voice: 0, patch: { coarse: 5 } });

      service.panic('A');

      expect(store.deckPanel('A')()).toEqual(HOME_DECK_PANEL);
      expect(logWarn).not.toHaveBeenCalled();
    });
  });

  describe('knobs on a shapeable deck', () => {
    beforeEach(() => makeShapeable('A'));

    it("clamps each voice knob to the field's range", () => {
      service.setVoiceKnob('A', 0, 'coarse', 200);
      service.setVoiceKnob('A', 0, 'fine', -70);
      service.setVoiceKnob('A', 0, 'pulseWidth', -9999);
      service.setVoiceKnob('A', 0, 'attack', 99);
      service.setVoiceKnob('A', 0, 'release', -99);

      expect(store.deckPanel('A')().voices[0]).toMatchObject({
        coarse: 96,
        fine: -50,
        pulseWidth: -4095,
        attack: 15,
        release: -15,
      });
    });

    it('snaps a stepped knob to a whole number and keeps Fine at full resolution', () => {
      service.setVoiceKnob('A', 1, 'coarse', 3.6);
      service.setVoiceKnob('A', 1, 'decay', -2.4);
      service.setVoiceKnob('A', 1, 'sustain', -0.4);
      service.setVoiceKnob('A', 1, 'fine', 12.345);

      const strip = store.deckPanel('A')().voices[1];
      expect(strip.coarse).toBe(4);
      expect(strip.decay).toBe(-2);
      expect(strip.sustain).toBe(0);
      expect(strip.fine).toBe(12.345);
    });

    it('writes only the named voice and leaves the rest of the panel and the other deck alone', () => {
      service.setVoiceKnob('A', 2, 'sustain', 9);

      const panel = store.deckPanel('A')();
      expect(panel.voices[2].sustain).toBe(9);
      expect(panel.voices[0]).toEqual(HOME_DECK_PANEL.voices[0]);
      expect(panel.voices[1]).toEqual(HOME_DECK_PANEL.voices[1]);
      expect({ ...panel, voices: HOME_DECK_PANEL.voices }).toEqual(HOME_DECK_PANEL);
      expect(store.deckPanel('B')()).toEqual(HOME_DECK_PANEL);
    });

    it('clamps and snaps the cutoff and resonance knobs', () => {
      service.setFilterKnob('A', 'cutoff', 5000);
      service.setFilterKnob('A', 'resonance', -3.7);

      expect(store.deckPanel('A')()).toMatchObject({ cutoff: 2047, resonance: -4 });
    });

    it('rounds the key offset to a whole semitone and clamps it to ±12', () => {
      service.setKeySemitones('A', 4.6);
      expect(store.deckPanel('A')().keySemitones).toBe(5);

      service.setKeySemitones('A', 40);
      expect(store.deckPanel('A')().keySemitones).toBe(12);

      service.setKeySemitones('A', -40);
      expect(store.deckPanel('A')().keySemitones).toBe(-12);
    });

    it('silently ignores non-finite values and a voice that is not 0…2', () => {
      service.setVoiceKnob('A', 0, 'coarse', 4);
      service.setFilterKnob('A', 'cutoff', 10);
      service.setKeySemitones('A', 3);
      const before = store.deckPanel('A')();

      service.setVoiceKnob('A', 0, 'coarse', Number.NaN);
      service.setVoiceKnob('A', 0, 'fine', Number.POSITIVE_INFINITY);
      service.setFilterKnob('A', 'cutoff', Number.NEGATIVE_INFINITY);
      service.setKeySemitones('A', Number.NaN);
      service.setVoiceKnob('A', 3, 'coarse', 1);
      service.setVoiceKnob('A', -1, 'coarse', 1);
      service.setVoiceKnob('A', 0.5, 'coarse', 1);
      service.pressWaveform('A', 3, 'pulse');
      service.pressSwitch('A', 1.5, 'ring');

      expect(store.deckPanel('A')()).toEqual(before);
      expect(logWarn).not.toHaveBeenCalled();
    });
  });

  describe('waveform and filter-mode locks', () => {
    beforeEach(() => makeShapeable('A'));

    it('locks on a press, moves the lock on another press and hands it back on the locked one', () => {
      service.pressWaveform('A', 0, 'pulse');
      expect(store.deckPanel('A')().voices[0].waveformLock).toBe('pulse');

      service.pressWaveform('A', 0, 'noise');
      expect(store.deckPanel('A')().voices[0].waveformLock).toBe('noise');

      service.pressWaveform('A', 0, 'noise');
      expect(store.deckPanel('A')().voices[0].waveformLock).toBeNull();
    });

    it("keeps each voice's lock to itself", () => {
      service.pressWaveform('A', 1, 'sawtooth');

      expect(
        store
          .deckPanel('A')()
          .voices.map((voice) => voice.waveformLock)
      ).toEqual([null, 'sawtooth', null]);
    });

    it('setWaveformLocked locks to the waveform, and unlocking releases only that waveform', () => {
      service.setWaveformLocked('A', 2, 'triangle', true);
      expect(store.deckPanel('A')().voices[2].waveformLock).toBe('triangle');

      service.setWaveformLocked('A', 2, 'noise', false);
      expect(store.deckPanel('A')().voices[2].waveformLock).toBe('triangle');

      service.setWaveformLocked('A', 2, 'triangle', false);
      expect(store.deckPanel('A')().voices[2].waveformLock).toBeNull();
    });

    it('applies the same rules to the filter mode', () => {
      service.pressFilterMode('A', 'low-pass');
      expect(store.deckPanel('A')().filterModeLock).toBe('low-pass');

      service.pressFilterMode('A', 'high-pass');
      expect(store.deckPanel('A')().filterModeLock).toBe('high-pass');

      service.setFilterModeLocked('A', 'low-pass', false);
      expect(store.deckPanel('A')().filterModeLock).toBe('high-pass');

      service.setFilterModeLocked('A', 'band-pass', true);
      expect(store.deckPanel('A')().filterModeLock).toBe('band-pass');

      service.pressFilterMode('A', 'band-pass');
      expect(store.deckPanel('A')().filterModeLock).toBeNull();
    });
  });

  describe('Ring, Sync and Filt locks', () => {
    beforeEach(() => makeShapeable('A'));

    it('a press locks to the opposite of the tune, then hands back', () => {
      tuneWrites({ ring: true });
      service.pressSwitch('A', 0, 'ring');
      expect(store.deckPanel('A')().voices[0].ringLock).toBe(false);

      service.pressSwitch('A', 0, 'ring');
      expect(store.deckPanel('A')().voices[0].ringLock).toBeNull();

      tuneWrites({ ring: false });
      service.pressSwitch('A', 0, 'ring');
      expect(store.deckPanel('A')().voices[0].ringLock).toBe(true);
    });

    it('flips from the tune, not from the last lock, for each switch on its own field', () => {
      tuneWrites({ ring: true, sync: false, filter: true });

      service.pressSwitch('A', 0, 'ring');
      service.pressSwitch('A', 0, 'sync');
      service.pressSwitch('A', 0, 'filter');

      expect(store.deckPanel('A')().voices[0]).toMatchObject({
        ringLock: false,
        syncLock: true,
        filterLock: false,
      });
    });

    it('setSwitchLocked locks to the opposite only if not already locked, and false hands back', () => {
      tuneWrites({ sync: true });
      service.setSwitchLocked('A', 0, 'sync', true);
      expect(store.deckPanel('A')().voices[0].syncLock).toBe(false);

      tuneWrites({ sync: false });
      service.setSwitchLocked('A', 0, 'sync', true);
      expect(store.deckPanel('A')().voices[0].syncLock).toBe(false);

      service.setSwitchLocked('A', 0, 'sync', false);
      expect(store.deckPanel('A')().voices[0].syncLock).toBeNull();
    });
  });

  describe('panic', () => {
    it('resets the whole panel and only the panel, logging once', () => {
      makeShapeable('A');
      makeShapeable('B');
      service.setKeySemitones('A', 5);
      service.setVoiceKnob('A', 0, 'coarse', 12);
      service.pressWaveform('A', 1, 'pulse');
      service.pressFilterMode('A', 'band-pass');
      service.setFilterKnob('A', 'cutoff', 300);
      service.setKeySemitones('B', 2);
      store.setDeckDetectedKey({ slot: 'A', detectedKey });
      store.setDeckEngineControls({
        slot: 'A',
        speed: 1.25,
        voices: [
          { muted: true, held: false },
          { muted: false, held: true },
          { muted: false, held: false },
        ],
      });
      vi.mocked(logInfo).mockClear();

      service.panic('A');

      expect(store.deckPanel('A')()).toEqual(HOME_DECK_PANEL);
      expect(store.deckPanel('B')().keySemitones).toBe(2);
      const deck = store.deck('A')();
      expect(deck.detectedKey).toEqual(detectedKey);
      expect(deck.speed).toBe(1.25);
      expect(deck.voices.map((voice) => voice.muted)).toEqual([true, false, false]);
      expect(deck.voices.map((voice) => voice.held)).toEqual([false, true, false]);
      expect(logInfo).toHaveBeenCalledTimes(1);
      expect(vi.mocked(logInfo).mock.calls[0][1]).toBe('Deck A panel reset (panic)');
    });
  });

  describe('a deck with nothing shapeable', () => {
    it('refuses every panel control with a warning naming the slot, and writes nothing', () => {
      const before = store.deckPanel('B')();

      service.setVoiceKnob('B', 0, 'coarse', 3);
      service.setFilterKnob('B', 'resonance', 3);
      service.setKeySemitones('B', 3);
      service.pressWaveform('B', 0, 'pulse');
      service.setWaveformLocked('B', 0, 'pulse', true);
      service.pressFilterMode('B', 'low-pass');
      service.setFilterModeLocked('B', 'low-pass', true);
      service.pressSwitch('B', 0, 'ring');
      service.setSwitchLocked('B', 0, 'sync', true);

      expect(store.deckPanel('B')()).toBe(before);
      expect(logWarn).toHaveBeenCalledTimes(9);
      for (const [message] of vi.mocked(logWarn).mock.calls) {
        expect(message).toContain('deck B');
      }
    });

    it('does not read the tune for a refused switch press', () => {
      service.pressSwitch('A', 0, 'ring');

      expect(readRegisters).not.toHaveBeenCalled();
    });

    it('refuses while a switch is in flight, then accepts once it clears', () => {
      makeShapeable('A');
      store.setDeckSwitching({ slot: 'A', switching: true });

      service.setFilterKnob('A', 'cutoff', 50);
      expect(store.deckPanel('A')().cutoff).toBe(0);

      store.setDeckSwitching({ slot: 'A', switching: false });
      service.setFilterKnob('A', 'cutoff', 50);
      expect(store.deckPanel('A')().cutoff).toBe(50);
    });
  });
});
