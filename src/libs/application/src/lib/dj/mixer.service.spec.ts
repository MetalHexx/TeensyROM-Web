import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { TuneReference } from '@sidablist/tunes';
import { logWarn } from '@teensyrom-nx/utils';
import { MixerService } from './mixer.service';
import { DjStore } from './dj-store';
import type { Slot } from './slot';

vi.mock('@teensyrom-nx/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@teensyrom-nx/utils')>();
  return { ...actual, logWarn: vi.fn(actual.logWarn) };
});

const tune: TuneReference = {
  identity: { sidHash: 'hash-1', subtune: 1 },
  title: 'Test Tune',
  author: 'Test Author',
  released: '2024 Test',
  subtuneCount: 1,
  byteLength: 1234,
};

describe('MixerService', () => {
  let service: MixerService;
  let store: InstanceType<typeof DjStore>;

  /** Puts a tune on the slot at a settled status, which is what makes its controls live. */
  function makeShapeable(slot: Slot): void {
    store.setDeckLoaded({ slot, reference: tune });
    store.setDeckStatus({ slot, status: 'paused' });
  }

  beforeEach(() => {
    vi.mocked(logWarn).mockClear();
    service = TestBed.inject(MixerService);
    store = TestBed.inject(DjStore);
  });

  describe('always-accepted controls', () => {
    it('clamps the level to 0…1 on an empty deck', () => {
      service.setLevel('A', 1.7);
      expect(store.deckMix('A')().level).toBe(1);

      service.setLevel('A', -0.3);
      expect(store.deckMix('A')().level).toBe(0);

      service.setLevel('A', 0.4);
      expect(store.deckMix('A')().level).toBe(0.4);
    });

    it('clamps the crossfader to −1…+1', () => {
      service.setCrossfader(3);
      expect(store.crossfader()).toBe(1);

      service.setCrossfader(-3);
      expect(store.crossfader()).toBe(-1);

      service.setCrossfader(0.25);
      expect(store.crossfader()).toBe(0.25);
    });

    it('accepts the key display format', () => {
      service.setKeyDisplayFormat('note');
      expect(store.keyDisplayFormat()).toBe('note');
    });

    it('ignores non-finite numbers', () => {
      service.setLevel('A', 0.5);
      service.setCrossfader(0.5);

      service.setLevel('A', Number.NaN);
      service.setLevel('A', Number.POSITIVE_INFINITY);
      service.setCrossfader(Number.NaN);
      service.setCrossfader(Number.NEGATIVE_INFINITY);

      expect(store.deckMix('A')().level).toBe(0.5);
      expect(store.crossfader()).toBe(0.5);
    });
  });

  describe('tune shaping on a shapeable deck', () => {
    beforeEach(() => makeShapeable('A'));

    it.each(['cutoff', 'resonance', 'pulseWidth'] as const)('clamps the %s knob to −1…+1', (knob) => {
      service.setKnob('A', knob, 2);
      expect(store.deckMix('A')()[knob]).toBe(1);

      service.setKnob('A', knob, -2);
      expect(store.deckMix('A')()[knob]).toBe(-1);

      service.setKnob('A', knob, -0.37);
      expect(store.deckMix('A')()[knob]).toBe(-0.37);
    });

    it('a knob write leaves the other controls and the other deck alone', () => {
      service.setKnob('A', 'cutoff', 0.5);

      expect(store.deckMix('A')()).toEqual({
        level: 1,
        cutoff: 0.5,
        resonance: 0,
        pulseWidth: 0,
        keySemitones: 0,
        filterMode: null,
      });
      expect(store.deckMix('B')().cutoff).toBe(0);
    });

    it('rounds the key offset to a whole semitone and clamps it to ±12', () => {
      service.setKeySemitones('A', 3.6);
      expect(store.deckMix('A')().keySemitones).toBe(4);

      service.setKeySemitones('A', 40);
      expect(store.deckMix('A')().keySemitones).toBe(12);

      service.setKeySemitones('A', -40);
      expect(store.deckMix('A')().keySemitones).toBe(-12);
    });

    it('sets and clears the filter mode', () => {
      service.setFilterMode('A', 'bandPass');
      expect(store.deckMix('A')().filterMode).toBe('bandPass');

      service.setFilterMode('A', null);
      expect(store.deckMix('A')().filterMode).toBeNull();
    });

    it('ignores non-finite numbers', () => {
      service.setKnob('A', 'cutoff', 0.5);
      service.setKeySemitones('A', 5);

      service.setKnob('A', 'cutoff', Number.NaN);
      service.setKeySemitones('A', Number.POSITIVE_INFINITY);

      expect(store.deckMix('A')().cutoff).toBe(0.5);
      expect(store.deckMix('A')().keySemitones).toBe(5);
      expect(logWarn).not.toHaveBeenCalled();
    });
  });

  describe('tune shaping on a deck with nothing shapeable', () => {
    it('refuses every shaping control with a warning naming the slot, and writes nothing', () => {
      const before = store.deckMix('B')();

      service.setKnob('B', 'cutoff', 0.5);
      service.setKnob('B', 'resonance', 0.5);
      service.setKnob('B', 'pulseWidth', 0.5);
      service.setKeySemitones('B', 3);
      service.setFilterMode('B', 'lowPass');

      expect(store.deckMix('B')()).toEqual(before);
      expect(logWarn).toHaveBeenCalledTimes(5);
      for (const [message] of vi.mocked(logWarn).mock.calls) {
        expect(message).toContain('deck B');
      }
    });

    it('refuses while a switch is in flight, then accepts once it clears', () => {
      makeShapeable('A');
      store.setDeckSwitching({ slot: 'A', switching: true });

      service.setKnob('A', 'cutoff', 0.5);
      expect(store.deckMix('A')().cutoff).toBe(0);

      store.setDeckSwitching({ slot: 'A', switching: false });
      service.setKnob('A', 'cutoff', 0.5);
      expect(store.deckMix('A')().cutoff).toBe(0.5);
    });

    it('still accepts level on the refusing deck', () => {
      service.setLevel('B', 0.2);
      expect(store.deckMix('B')().level).toBe(0.2);
    });
  });
});
