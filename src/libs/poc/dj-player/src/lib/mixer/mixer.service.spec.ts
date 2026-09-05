import { describe, it, expect } from 'vitest';
import { MixerService } from './mixer.service';
import { DECKS } from '../deck/deck.config';

describe('MixerService', () => {
  it('rests the crossfader at centre, with both paired decks reading full gain', () => {
    const mixer = new MixerService();

    expect(mixer.crossfaderPosition()).toBe(0);
    expect(mixer.gainFor(DECKS[0].id)()).toBe(1);
    expect(mixer.gainFor(DECKS[1].id)()).toBe(1);
  });

  it('exposes the first two DECKS entries as the crossfader pair', () => {
    const mixer = new MixerService();

    expect(mixer.crossfaderPair).toEqual([DECKS[0].id, DECKS[1].id]);
  });

  it('takes the opposite deck to zero at a hard extreme while the near deck stays full', () => {
    const mixer = new MixerService();

    mixer.setCrossfaderPosition(1);
    expect(mixer.gainFor(DECKS[0].id)()).toBe(0);
    expect(mixer.gainFor(DECKS[1].id)()).toBe(1);

    mixer.setCrossfaderPosition(-1);
    expect(mixer.gainFor(DECKS[0].id)()).toBe(1);
    expect(mixer.gainFor(DECKS[1].id)()).toBe(0);
  });

  it("composes a deck's own fader multiplicatively with the crossfader contribution", () => {
    const mixer = new MixerService();
    mixer.setCrossfaderPosition(0);

    mixer.setDeckFader(DECKS[0].id, 0.5);

    expect(mixer.gainFor(DECKS[0].id)()).toBeCloseTo(0.5, 10);
  });

  it('clamps the composed gain to [0, 1] even when a deck fader is pushed past full', () => {
    const mixer = new MixerService();
    mixer.setCrossfaderPosition(0);

    mixer.setDeckFader(DECKS[0].id, 2);

    expect(mixer.gainFor(DECKS[0].id)()).toBe(1);
  });

  it('reads gain 1 for a deck id the model does not know, regardless of crossfader position', () => {
    const mixer = new MixerService();

    mixer.setCrossfaderPosition(1);

    expect(mixer.gainFor('unknown-deck')()).toBe(1);
  });

  it('returns the same signal instance for the same deck id across calls', () => {
    const mixer = new MixerService();

    expect(mixer.gainFor(DECKS[0].id)).toBe(mixer.gainFor(DECKS[0].id));
  });

  it('produces a continuous gain — a fractional position yields a gain off the sixteen-step register grid', () => {
    const mixer = new MixerService();

    mixer.setCrossfaderPosition(0.137);

    const gain = mixer.gainFor(DECKS[0].id)();
    expect(Number.isInteger(gain * 15)).toBe(false);
  });

  describe('key display format', () => {
    it('defaults to Camelot', () => {
      const mixer = new MixerService();

      expect(mixer.keyDisplayFormat()).toBe('camelot');
    });

    it('is page-level, not keyed to any one deck', () => {
      const mixer = new MixerService();

      mixer.setKeyDisplayFormat('note');

      expect(mixer.keyDisplayFormat()).toBe('note');
    });
  });

  describe('per-deck scale controls', () => {
    it('rests every scale control at home for a deck it has never been told about', () => {
      const mixer = new MixerService();

      expect(mixer.scalePosition('unknown-deck', 'cutoff')()).toBe(0);
      expect(mixer.scaleCoefficient('unknown-deck', 'cutoff')()).toBe(1);
      expect(mixer.keySemitones('unknown-deck')()).toBe(0);
      expect(mixer.keyCoefficient('unknown-deck')()).toBe(1);
      expect(mixer.filterMode('unknown-deck')()).toBe(null);
    });

    it('composes a position into a coefficient through the shared taper', () => {
      const mixer = new MixerService();

      mixer.setScalePosition(DECKS[0].id, 'cutoff', 1);

      expect(mixer.scalePosition(DECKS[0].id, 'cutoff')()).toBe(1);
      expect(mixer.scaleCoefficient(DECKS[0].id, 'cutoff')()).toBe(16);
    });

    it('composes a semitone offset into a coefficient through the shared taper, clamped and rounded to an integer', () => {
      const mixer = new MixerService();

      mixer.setKeySemitones(DECKS[0].id, 30); // past the ±12 bound

      expect(mixer.keySemitones(DECKS[0].id)()).toBe(12);
      expect(mixer.keyCoefficient(DECKS[0].id)()).toBe(2);
    });

    it("leaves deck B's controls at home when deck A's are set", () => {
      const mixer = new MixerService();

      mixer.setScalePosition(DECKS[0].id, 'resonance', -1);
      mixer.setKeySemitones(DECKS[0].id, 7);
      mixer.setFilterMode(DECKS[0].id, 'lowPass');

      expect(mixer.scalePosition(DECKS[1].id, 'resonance')()).toBe(0);
      expect(mixer.scaleCoefficient(DECKS[1].id, 'resonance')()).toBe(1);
      expect(mixer.keySemitones(DECKS[1].id)()).toBe(0);
      expect(mixer.filterMode(DECKS[1].id)()).toBe(null);
    });

    it('stores and reads back a forced filter mode independently per deck', () => {
      const mixer = new MixerService();

      mixer.setFilterMode(DECKS[0].id, 'bandPass');

      expect(mixer.filterMode(DECKS[0].id)()).toBe('bandPass');

      mixer.setFilterMode(DECKS[0].id, null);

      expect(mixer.filterMode(DECKS[0].id)()).toBe(null);
    });

    it('returns the same signal instance across repeated calls with the same arguments', () => {
      const mixer = new MixerService();

      expect(mixer.scalePosition(DECKS[0].id, 'pulseWidth')).toBe(
        mixer.scalePosition(DECKS[0].id, 'pulseWidth')
      );
      expect(mixer.scaleCoefficient(DECKS[0].id, 'pulseWidth')).toBe(
        mixer.scaleCoefficient(DECKS[0].id, 'pulseWidth')
      );
      expect(mixer.keySemitones(DECKS[0].id)).toBe(mixer.keySemitones(DECKS[0].id));
      expect(mixer.keyCoefficient(DECKS[0].id)).toBe(mixer.keyCoefficient(DECKS[0].id));
      expect(mixer.filterMode(DECKS[0].id)).toBe(mixer.filterMode(DECKS[0].id));
    });

    it('keeps a control keyed to its own deck+control pair distinct from every other pair', () => {
      const mixer = new MixerService();

      expect(mixer.scalePosition(DECKS[0].id, 'cutoff')).not.toBe(
        mixer.scalePosition(DECKS[0].id, 'resonance')
      );
      expect(mixer.scalePosition(DECKS[0].id, 'cutoff')).not.toBe(
        mixer.scalePosition(DECKS[1].id, 'cutoff')
      );
    });
  });
});
