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
});
