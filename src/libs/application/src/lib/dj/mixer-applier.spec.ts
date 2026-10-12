import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { describe, it, expect, beforeEach, vi, type MockInstance } from 'vitest';
import { FakeClock } from '@sidablist/core';
import type { ReplayRunner } from '@sidablist/core';
import type { TuneReference } from '@sidablist/tunes';
import { logError, logWarn } from '@teensyrom-nx/utils';
import { MixerApplier } from './mixer-applier';
import { MixerService } from './mixer.service';
import { DeckRuntime } from './deck-runtime';
import { DjStore } from './dj-store';
import { FRAME_CLOCK_FACTORY, REPLAY_RUNNER_FACTORY, MIDI_ACCESS } from './ports';
import type { IMidiAccess, MidiAccessState, MidiPermission, MidiPortOption } from './ports/midi-access';
import { DECK_SLOTS, type Slot } from './slot';
import { scaleCoefficientFor } from './mixer/scale-taper';

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

  let setOutputGain: MockInstance<DeckRuntime['setOutputGain']>;
  let setRegisterScale: MockInstance<DeckRuntime['setRegisterScale']>;
  let setKeyCoefficient: MockInstance<DeckRuntime['setKeyCoefficient']>;
  let setFilterMode: MockInstance<DeckRuntime['setFilterMode']>;

  function provide(): void {
    TestBed.configureTestingModule({
      providers: [
        { provide: FRAME_CLOCK_FACTORY, useValue: (): FakeClock => new FakeClock() },
        { provide: REPLAY_RUNNER_FACTORY, useValue: (): ReplayRunner => new FakeReplayRunner() },
        { provide: MIDI_ACCESS, useValue: fakeMidiAccess() },
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

    setOutputGain = vi.spyOn(runtime, 'setOutputGain');
    setRegisterScale = vi.spyOn(runtime, 'setRegisterScale');
    setKeyCoefficient = vi.spyOn(runtime, 'setKeyCoefficient');
    setFilterMode = vi.spyOn(runtime, 'setFilterMode');
  }

  function clearSpies(): void {
    for (const spy of [setOutputGain, setRegisterScale, setKeyCoefficient, setFilterMode]) {
      spy.mockClear();
    }
  }

  function makeShapeable(slot: Slot): void {
    store.setDeckLoaded({ slot, reference: tune });
    store.setDeckStatus({ slot, status: 'paused' });
  }

  function gainFor(slot: Slot): number | undefined {
    return setOutputGain.mock.calls.filter(([calledSlot]) => calledSlot === slot).pop()?.[1];
  }

  beforeEach(() => {
    vi.mocked(logWarn).mockClear();
    vi.mocked(logError).mockClear();
    provide();
    start({ buildSlots: true });
  });

  describe('applyDeck', () => {
    it('composes level with the crossfader: hard B silences deck A and leaves deck B at its level', () => {
      store.setDeckMix({ slot: 'A', patch: { level: 0.5 } });
      store.setDeckMix({ slot: 'B', patch: { level: 0.5 } });
      service.setCrossfader(1);

      applier.applyDeck('A');
      applier.applyDeck('B');

      expect(gainFor('A')).toBe(0);
      expect(gainFor('B')).toBe(0.5);
    });

    it('leaves both decks at full level with the crossfader at centre', () => {
      applier.applyDeck('A');
      applier.applyDeck('B');

      expect(gainFor('A')).toBe(1);
      expect(gainFor('B')).toBe(1);
    });

    it('pushes each knob to its own register group, the key coefficient and the filter mode', () => {
      makeShapeable('A');
      service.setKnob('A', 'cutoff', 0.25);
      service.setKnob('A', 'resonance', -0.5);
      service.setKnob('A', 'pulseWidth', 1);
      service.setKeySemitones('A', 12);
      service.setFilterMode('A', 'highPass');

      applier.applyDeck('A');

      expect(setRegisterScale).toHaveBeenCalledWith('A', 'cutoff', scaleCoefficientFor(0.25));
      expect(setRegisterScale).toHaveBeenCalledWith('A', 'resonance', scaleCoefficientFor(-0.5));
      expect(setRegisterScale).toHaveBeenCalledWith('A', 'pulseWidth', scaleCoefficientFor(1));
      expect(setKeyCoefficient).toHaveBeenCalledWith('A', 2);
      expect(setFilterMode).toHaveBeenCalledWith('A', 'highPass');
    });

    it('never touches the other slot', () => {
      applier.applyDeck('A');

      expect(setOutputGain.mock.calls.every(([slot]) => slot === 'A')).toBe(true);
      expect(setRegisterScale.mock.calls.every(([slot]) => slot === 'A')).toBe(true);
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

    it('re-applies only the deck whose mix changed', () => {
      makeShapeable('A');
      TestBed.flushEffects();
      clearSpies();

      service.setKnob('A', 'cutoff', 0.5);
      TestBed.flushEffects();

      expect(setRegisterScale).toHaveBeenCalledWith('A', 'cutoff', scaleCoefficientFor(0.5));
      expect(setRegisterScale.mock.calls.some(([slot]) => slot === 'B')).toBe(false);
      expect(setOutputGain.mock.calls.some(([slot]) => slot === 'B')).toBe(false);
    });

    it('re-applies both decks when the crossfader moves', () => {
      service.setCrossfader(1);
      TestBed.flushEffects();

      expect(gainFor('A')).toBe(0);
      expect(gainFor('B')).toBe(1);
    });

    it('is idempotent: a second install adds no second set of effects', () => {
      applier.install();
      TestBed.flushEffects();
      clearSpies();

      service.setCrossfader(-1);
      TestBed.flushEffects();

      expect(setOutputGain).toHaveBeenCalledTimes(2);
    });

    it('does not re-apply when the store changes something the mixer does not read', () => {
      store.setDeckStatus({ slot: 'A', status: 'playing' });
      TestBed.flushEffects();

      expect(setOutputGain).not.toHaveBeenCalled();
    });

    it('confines a throw in one slot to that slot and logs it with the slot', () => {
      setOutputGain.mockImplementation((slot: Slot) => {
        if (slot === 'A') {
          throw new Error('engine fault');
        }
      });

      service.setCrossfader(0.5);
      TestBed.flushEffects();

      expect(logError).toHaveBeenCalledTimes(1);
      expect(vi.mocked(logError).mock.calls[0][0]).toContain('deck A');
      expect(setRegisterScale).toHaveBeenCalledWith('B', 'cutoff', 1);
      expect(setFilterMode).toHaveBeenCalledWith('B', null);
    });
  });

  describe('resetTuneShaping', () => {
    it('returns the engine to home tune shaping before returning, without waiting on an effect', () => {
      makeShapeable('A');
      service.setLevel('A', 0.5);
      service.setCrossfader(-0.5);
      service.setKnob('A', 'cutoff', 0.75);
      service.setKnob('A', 'resonance', -0.75);
      service.setKnob('A', 'pulseWidth', 0.5);
      service.setKeySemitones('A', 7);
      service.setFilterMode('A', 'lowPass');
      applier.applyDeck('A');
      clearSpies();

      applier.resetTuneShaping('A');

      expect(store.deckMix('A')()).toMatchObject({
        cutoff: 0,
        resonance: 0,
        pulseWidth: 0,
        keySemitones: 0,
        filterMode: null,
      });
      expect(setRegisterScale).toHaveBeenCalledWith('A', 'cutoff', 1);
      expect(setRegisterScale).toHaveBeenCalledWith('A', 'resonance', 1);
      expect(setRegisterScale).toHaveBeenCalledWith('A', 'pulseWidth', 1);
      expect(setKeyCoefficient).toHaveBeenCalledWith('A', 1);
      expect(setFilterMode).toHaveBeenCalledWith('A', null);
    });

    it('keeps level and the crossfader applied', () => {
      service.setLevel('A', 0.5);
      service.setCrossfader(0.5);
      clearSpies();

      applier.resetTuneShaping('A');

      expect(gainFor('A')).toBe(0.25);
    });
  });
});
