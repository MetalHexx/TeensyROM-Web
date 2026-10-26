import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { describe, it, expect, beforeEach, vi, type MockInstance } from 'vitest';
import { FakeClock, VOICE_CONTROL_REGISTERS } from '@sidablist/core';
import type { ReplayRunner, SidField } from '@sidablist/core';
import type { TuneReference } from '@sidablist/tunes';
import { logError, logWarn } from '@teensyrom-nx/utils';
import { MixerApplier } from './mixer-applier';
import { MixerService } from './mixer.service';
import { engineSettingsOf } from './mixer/engine-settings';
import { DeckLoops } from './deck-loops';
import { DeckRuntime } from './deck-runtime';
import { DjStore, type DeckDetectedKey } from './dj-store';
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
  return { ...actual, logWarn: vi.fn(), logError: vi.fn() };
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

/** $D417: the filter routing, one bit per voice. */
const FILTER_ROUTING_REGISTER = 23;
const RING_BIT = 0x04;
const SYNC_BIT = 0x02;
const VOICES = [0, 1, 2] as const;
const VOICE_OFFSET_NAMES = ['pulseWidth', 'attack', 'decay', 'sustain', 'release'] as const;

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

describe('MixerApplier', () => {
  let applier: MixerApplier;
  let service: MixerService;
  let runtime: DeckRuntime;
  let store: InstanceType<typeof DjStore>;

  let setVoicePitch: MockInstance<DeckRuntime['setVoicePitch']>;
  let setFieldOffset: MockInstance<DeckRuntime['setFieldOffset']>;
  let holdField: MockInstance<DeckRuntime['holdField']>;
  let releaseField: MockInstance<DeckRuntime['releaseField']>;
  let readRegisters: MockInstance<DeckRuntime['readRegisters']>;

  function provide(): void {
    TestBed.configureTestingModule({
      providers: [
        { provide: FRAME_CLOCK_FACTORY, useValue: (): FakeClock => new FakeClock() },
        { provide: REPLAY_RUNNER_FACTORY, useValue: (): ReplayRunner => new FakeReplayRunner() },
        { provide: MIDI_ACCESS, useValue: fakeMidiAccess() },
        { provide: DeckLoops, useValue: { saveSettingsInPlay: vi.fn() } },
      ],
    });
  }

  function start(options: { buildSlots: boolean }): void {
    applier = TestBed.inject(MixerApplier);
    service = TestBed.inject(MixerService);
    runtime = TestBed.inject(DeckRuntime);
    store = TestBed.inject(DjStore);

    if (options.buildSlots) {
      for (const slot of DECK_SLOTS) {
        runtime.build(slot);
      }
    }

    setVoicePitch = vi.spyOn(runtime, 'setVoicePitch');
    setFieldOffset = vi.spyOn(runtime, 'setFieldOffset');
    holdField = vi.spyOn(runtime, 'holdField');
    releaseField = vi.spyOn(runtime, 'releaseField');
    readRegisters = vi.spyOn(runtime, 'readRegisters');
  }

  function clearSpies(): void {
    for (const spy of [setVoicePitch, setFieldOffset, holdField, releaseField, readRegisters]) {
      spy.mockClear();
    }
  }

  function makeShapeable(slot: Slot): void {
    store.setDeckLoaded({ slot, reference: tune });
    store.setDeckStatus({ slot, status: 'paused' });
  }

  function matches(field: SidField, name: string, voice?: number): boolean {
    return (
      field.name === name && (voice === undefined || ('voice' in field && field.voice === voice))
    );
  }

  function pitchOf(slot: Slot, voice: number): number | undefined {
    return setVoicePitch.mock.calls
      .filter(([calledSlot, calledVoice]) => calledSlot === slot && calledVoice === voice)
      .pop()?.[2];
  }

  function offsetOf(slot: Slot, name: string, voice?: number): number | undefined {
    return setFieldOffset.mock.calls
      .filter(([calledSlot, field]) => calledSlot === slot && matches(field, name, voice))
      .pop()?.[2];
  }

  function heldAt(slot: Slot, name: string, voice?: number): number | undefined {
    return holdField.mock.calls
      .filter(([calledSlot, field]) => calledSlot === slot && matches(field, name, voice))
      .pop()?.[2];
  }

  function wasReleased(slot: Slot, name: string, voice?: number): boolean {
    return releaseField.mock.calls.some(
      ([calledSlot, field]) => calledSlot === slot && matches(field, name, voice)
    );
  }

  /** Makes the engine report a tune whose voice control registers hold `controlBits` (by voice). */
  function tuneWrites(controlBits: Partial<Record<number, number>>): void {
    readRegisters.mockImplementation((_slot, written) => {
      written.fill(0);
      for (const [voice, bits] of Object.entries(controlBits)) {
        written[VOICE_CONTROL_REGISTERS[Number(voice)]] = bits ?? 0;
      }
    });
  }

  beforeEach(() => {
    vi.mocked(logWarn).mockClear();
    vi.mocked(logError).mockClear();
    provide();
    start({ buildSlots: true });
  });

  describe('applyDeck', () => {
    it('pushes a home panel as unit pitch, cleared offsets and nothing held', () => {
      applier.applyDeck('A');

      for (const voice of VOICES) {
        expect(pitchOf('A', voice)).toBe(1);
        for (const name of VOICE_OFFSET_NAMES) {
          expect(offsetOf('A', name, voice)).toBe(0);
        }
        for (const name of ['waveform', 'ringMod', 'sync', 'filtered']) {
          expect(wasReleased('A', name, voice)).toBe(true);
        }
      }
      expect(offsetOf('A', 'cutoff')).toBe(0);
      expect(offsetOf('A', 'resonance')).toBe(0);
      expect(wasReleased('A', 'filterType')).toBe(true);
      expect(holdField).not.toHaveBeenCalled();
    });

    it('composes Key, Coarse and Fine into one multiplier per voice', () => {
      makeShapeable('A');
      service.setKeySemitones('A', 7);
      service.setVoiceKnob('A', 1, 'coarse', -12);
      service.setVoiceKnob('A', 1, 'fine', 25);
      service.setVoiceKnob('A', 2, 'coarse', 5);
      clearSpies();

      applier.applyDeck('A');

      expect(pitchOf('A', 0)).toBeCloseTo(2 ** (7 / 12), 12);
      expect(pitchOf('A', 1)).toBeCloseTo(2 ** ((7 - 12 + 0.25) / 12), 12);
      expect(pitchOf('A', 2)).toBeCloseTo(2 ** (12 / 12), 12);
    });

    it("sends each voice's pulse-width and envelope offsets to that voice only", () => {
      makeShapeable('A');
      service.setVoiceKnob('A', 1, 'pulseWidth', 1200);
      service.setVoiceKnob('A', 1, 'attack', 3);
      service.setVoiceKnob('A', 1, 'decay', -2);
      service.setVoiceKnob('A', 1, 'sustain', 4);
      service.setVoiceKnob('A', 1, 'release', -15);
      clearSpies();

      applier.applyDeck('A');

      expect(offsetOf('A', 'pulseWidth', 1)).toBe(1200);
      expect(offsetOf('A', 'attack', 1)).toBe(3);
      expect(offsetOf('A', 'decay', 1)).toBe(-2);
      expect(offsetOf('A', 'sustain', 1)).toBe(4);
      expect(offsetOf('A', 'release', 1)).toBe(-15);
      for (const voice of [0, 2]) {
        for (const name of VOICE_OFFSET_NAMES) {
          expect(offsetOf('A', name, voice)).toBe(0);
        }
      }
    });

    it('clears an offset that has returned to zero', () => {
      makeShapeable('A');
      service.setVoiceKnob('A', 0, 'attack', 6);
      applier.applyDeck('A');
      expect(offsetOf('A', 'attack', 0)).toBe(6);

      service.setVoiceKnob('A', 0, 'attack', 0);
      applier.applyDeck('A');

      expect(offsetOf('A', 'attack', 0)).toBe(0);
    });

    it('sends the cutoff and resonance offsets deck-wide', () => {
      makeShapeable('B');
      service.setFilterKnob('B', 'cutoff', -900);
      service.setFilterKnob('B', 'resonance', 7);

      applier.applyDeck('B');

      expect(offsetOf('B', 'cutoff')).toBe(-900);
      expect(offsetOf('B', 'resonance')).toBe(7);
    });

    it("holds a locked waveform at its register bit and hands an unlocked voice's back", () => {
      makeShapeable('A');
      service.pressWaveform('A', 0, 'triangle');
      service.pressWaveform('A', 1, 'sawtooth');
      service.pressWaveform('A', 2, 'pulse');
      applier.applyDeck('A');
      expect([0, 1, 2].map((voice) => heldAt('A', 'waveform', voice))).toEqual([1, 2, 4]);

      service.pressWaveform('A', 1, 'noise');
      service.pressWaveform('A', 2, 'pulse');
      clearSpies();
      applier.applyDeck('A');

      expect(heldAt('A', 'waveform', 1)).toBe(8);
      expect(heldAt('A', 'waveform', 2)).toBeUndefined();
      expect(wasReleased('A', 'waveform', 2)).toBe(true);
    });

    it('holds a locked switch on or off and hands an unlocked one back', () => {
      store.setVoiceStrip({ slot: 'A', voice: 0, patch: { ringLock: true, syncLock: false } });
      store.setVoiceStrip({ slot: 'A', voice: 2, patch: { filterLock: true } });

      applier.applyDeck('A');

      expect(heldAt('A', 'ringMod', 0)).toBe(1);
      expect(heldAt('A', 'sync', 0)).toBe(0);
      expect(heldAt('A', 'filtered', 2)).toBe(1);
      expect(wasReleased('A', 'filtered', 0)).toBe(true);
      expect(wasReleased('A', 'ringMod', 1)).toBe(true);
    });

    it('holds a locked filter mode at its register bit', () => {
      makeShapeable('A');
      service.pressFilterMode('A', 'band-pass');
      applier.applyDeck('A');
      expect(heldAt('A', 'filterType')).toBe(2);

      service.pressFilterMode('A', 'high-pass');
      applier.applyDeck('A');
      expect(heldAt('A', 'filterType')).toBe(4);

      service.pressFilterMode('A', 'high-pass');
      clearSpies();
      applier.applyDeck('A');
      expect(wasReleased('A', 'filterType')).toBe(true);
    });

    it('pushes exactly what engineSettingsOf lists for the panel', () => {
      makeShapeable('A');
      service.setKeySemitones('A', -3);
      service.setVoiceKnob('A', 2, 'fine', -17.5);
      service.setVoiceKnob('A', 0, 'release', 9);
      service.setFilterKnob('A', 'cutoff', 120);
      service.pressWaveform('A', 1, 'noise');
      service.pressFilterMode('A', 'high-pass');
      store.setVoiceStrip({ slot: 'A', voice: 1, patch: { ringLock: false, syncLock: true } });
      const expected = engineSettingsOf(store.deckPanel('A')());
      clearSpies();

      applier.applyDeck('A');

      expect(setVoicePitch.mock.calls).toEqual(
        (expected.voicePitch ?? []).map((multiplier, voice) => ['A', voice, multiplier])
      );
      expect(setFieldOffset.mock.calls).toEqual(
        (expected.fieldOffsets ?? []).map(({ field, amount }) => ['A', field, amount])
      );
      const holds = (expected.fieldHolds ?? []).filter(({ value }) => value !== null);
      expect(holdField.mock.calls).toEqual(holds.map(({ field, value }) => ['A', field, value]));
      expect(releaseField).toHaveBeenCalledTimes((expected.fieldHolds ?? []).length - holds.length);
    });

    it('never touches the other slot', () => {
      makeShapeable('A');
      service.setKeySemitones('A', 3);
      service.pressWaveform('A', 0, 'noise');
      clearSpies();

      applier.applyDeck('A');

      for (const spy of [setVoicePitch, setFieldOffset, holdField, releaseField]) {
        expect(spy.mock.calls.some(([slot]) => slot === 'B')).toBe(false);
      }
    });

    it('warns once about an unbuilt slot and never throws', () => {
      TestBed.resetTestingModule();
      provide();
      start({ buildSlots: false });

      expect(() => applier.applyDeck('A')).not.toThrow();
      expect(() => applier.applyDeck('A')).not.toThrow();

      expect(logWarn).toHaveBeenCalledTimes(1);
      expect(logError).not.toHaveBeenCalled();
    });
  });

  describe('install', () => {
    beforeEach(() => {
      applier.install();
      TestBed.flushEffects();
      clearSpies();
    });

    it('re-applies only the deck whose panel changed', () => {
      makeShapeable('A');
      TestBed.flushEffects();
      clearSpies();

      service.setFilterKnob('A', 'cutoff', 500);
      TestBed.flushEffects();

      expect(offsetOf('A', 'cutoff')).toBe(500);
      for (const spy of [setVoicePitch, setFieldOffset, holdField, releaseField]) {
        expect(spy.mock.calls.some(([slot]) => slot === 'B')).toBe(false);
      }
    });

    it('is idempotent: a second install adds no second set of effects', () => {
      makeShapeable('A');
      applier.install();
      TestBed.flushEffects();
      clearSpies();

      service.setKeySemitones('A', 2);
      TestBed.flushEffects();

      expect(setVoicePitch).toHaveBeenCalledTimes(3);
    });

    it('does not re-apply when the store changes something the panel does not cover', () => {
      store.setDeckStatus({ slot: 'A', status: 'playing' });
      TestBed.flushEffects();

      expect(setVoicePitch).not.toHaveBeenCalled();
      expect(setFieldOffset).not.toHaveBeenCalled();
    });

    it('skips a panel a landing has recorded as in the engine, and applies the next edit as usual', () => {
      makeShapeable('A');
      TestBed.flushEffects();
      service.setKeySemitones('A', 3);
      applier.markInEngine('A', store.deckPanel('A')());
      clearSpies();

      TestBed.flushEffects();
      expect(setVoicePitch).not.toHaveBeenCalled();

      service.setKeySemitones('A', 4);
      TestBed.flushEffects();
      expect(setVoicePitch).toHaveBeenCalledTimes(3);
    });

    it('treats the panel applyDeck last pushed as already in the engine', () => {
      makeShapeable('A');
      TestBed.flushEffects();
      service.setKeySemitones('A', 3);
      applier.applyDeck('A');
      clearSpies();

      TestBed.flushEffects();

      expect(setVoicePitch).not.toHaveBeenCalled();
    });

    it('applies a panel written under a record for another one', () => {
      makeShapeable('A');
      TestBed.flushEffects();
      applier.markInEngine('A', store.deckPanel('B')());
      clearSpies();

      service.setKeySemitones('A', 5);
      TestBed.flushEffects();

      expect(setVoicePitch).toHaveBeenCalledTimes(3);
    });

    it('confines a throw in one slot to that slot and logs it with the slot', () => {
      makeShapeable('A');
      makeShapeable('B');
      TestBed.flushEffects();
      setVoicePitch.mockImplementation((slot: Slot) => {
        if (slot === 'A') {
          throw new Error('engine fault');
        }
      });
      clearSpies();

      service.setKeySemitones('A', 4);
      TestBed.flushEffects();
      service.setFilterKnob('B', 'cutoff', 100);
      TestBed.flushEffects();

      expect(logError).toHaveBeenCalledTimes(1);
      expect(vi.mocked(logError).mock.calls[0][0]).toContain('deck A');
      expect(offsetOf('B', 'cutoff')).toBe(100);
    });
  });

  describe('resetPanel', () => {
    it('returns the engine to a home panel before returning, without waiting on an effect', () => {
      makeShapeable('A');
      service.setKeySemitones('A', 7);
      service.setVoiceKnob('A', 0, 'coarse', 12);
      service.setVoiceKnob('A', 1, 'pulseWidth', 900);
      service.setFilterKnob('A', 'cutoff', 400);
      service.pressWaveform('A', 2, 'pulse');
      service.pressFilterMode('A', 'low-pass');
      applier.applyDeck('A');
      expect(heldAt('A', 'waveform', 2)).toBe(4);
      clearSpies();

      applier.resetPanel('A');

      expect(pitchOf('A', 0)).toBe(1);
      expect(offsetOf('A', 'pulseWidth', 1)).toBe(0);
      expect(offsetOf('A', 'cutoff')).toBe(0);
      expect(wasReleased('A', 'waveform', 2)).toBe(true);
      expect(wasReleased('A', 'filterType')).toBe(true);
      expect(holdField).not.toHaveBeenCalled();
    });

    it('clears the detected key along with the panel', () => {
      store.setDeckDetectedKey({ slot: 'A', detectedKey });
      store.setDeckDetectedKey({ slot: 'B', detectedKey });

      applier.resetPanel('A');

      expect(store.deck('A')().detectedKey).toBeNull();
      expect(store.deck('B')().detectedKey).toEqual(detectedKey);
    });
  });

  describe('tuneSwitchOn', () => {
    it("reports the tune's own state for one voice's switch", () => {
      tuneWrites({ 0: RING_BIT, 2: SYNC_BIT });

      expect(applier.tuneSwitchOn('A', 0, 'ring')).toBe(true);
      expect(applier.tuneSwitchOn('A', 0, 'sync')).toBe(false);
      expect(applier.tuneSwitchOn('A', 1, 'ring')).toBe(false);
      expect(applier.tuneSwitchOn('A', 2, 'sync')).toBe(true);
    });

    it('reads the filter routing of the voice asked about', () => {
      readRegisters.mockImplementation((_slot, written) => {
        written.fill(0);
        written[FILTER_ROUTING_REGISTER] = 0b010;
      });

      expect(applier.tuneSwitchOn('A', 1, 'filter')).toBe(true);
      expect(applier.tuneSwitchOn('A', 0, 'filter')).toBe(false);
      expect(applier.tuneSwitchOn('A', 2, 'filter')).toBe(false);
    });

    it('answers false and warns once for an unbuilt slot', () => {
      TestBed.resetTestingModule();
      provide();
      start({ buildSlots: false });

      expect(applier.tuneSwitchOn('A', 0, 'ring')).toBe(false);
      expect(applier.tuneSwitchOn('A', 0, 'ring')).toBe(false);

      expect(logWarn).toHaveBeenCalledTimes(1);
      expect(logError).not.toHaveBeenCalled();
    });

    it('answers false and logs a failed read with the slot', () => {
      readRegisters.mockImplementation(() => {
        throw new Error('engine fault');
      });

      expect(applier.tuneSwitchOn('B', 0, 'ring')).toBe(false);

      expect(vi.mocked(logError).mock.calls[0][0]).toContain('deck B');
    });
  });
});
