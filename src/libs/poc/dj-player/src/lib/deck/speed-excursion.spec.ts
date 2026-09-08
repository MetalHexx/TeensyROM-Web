import { describe, it, expect, vi } from 'vitest';
import { createSpeedExcursion } from './speed-excursion';

/** Wide enough that none of the plain additive assertions accidentally clamp.
 *
 *  `getMultiplier` reads a live value that `setTempo` keeps in sync by default — mirroring the real
 *  wiring, where the player's tempo signal reflects whatever `setTempo` last set — but `setLive` lets
 *  a test move it independently, simulating a fader (or a tune load) that changes tempo without
 *  going through the excursion at all. */
function makeExcursion(slowest = 0.3, fastest = 1.7) {
  let live = 1;
  const setTempo = vi.fn((multiplier: number) => {
    live = multiplier;
  });
  const excursion = createSpeedExcursion({
    setTempo,
    getMultiplier: () => live,
    slowest,
    fastest,
  });
  return { excursion, setTempo, setLive: (value: number) => (live = value) };
}

describe('createSpeedExcursion', () => {
  it('starts at home with no excursion open', () => {
    const { excursion } = makeExcursion();

    expect(excursion.remembered()).toBeNull();
  });

  it('jumps additively from home on the first press, in either direction', () => {
    const { excursion, setTempo } = makeExcursion();

    excursion.jumpUp();
    expect(setTempo).toHaveBeenLastCalledWith(1.5);

    excursion.jumpDown(); // opposite button — closes the excursion, restoring home exactly
    setTempo.mockClear();
    excursion.jumpDown();
    expect(setTempo).toHaveBeenLastCalledWith(0.5);
  });

  it('clamps a jump to the given bounds rather than the raw additive result', () => {
    const { excursion, setTempo } = makeExcursion(0.3, 1.3);

    excursion.jumpUp(); // 1 + 0.5 = 1.5, clamped to the 1.3 ceiling handed in

    expect(setTempo).toHaveBeenLastCalledWith(1.3);
  });

  it('records the pre-jump multiplier into remembered on the first jump of an excursion', () => {
    const { excursion } = makeExcursion();

    expect(excursion.remembered()).toBeNull();
    excursion.jumpUp();
    expect(excursion.remembered()).toBe(1);
  });

  it('returns to the remembered multiplier exactly on the opposite button, and clears the excursion', () => {
    const { excursion, setTempo } = makeExcursion();

    excursion.jumpUp();
    excursion.jumpDown();

    expect(setTempo).toHaveBeenLastCalledWith(1);
    expect(excursion.remembered()).toBeNull();
  });

  it('is a no-op to press the same button again mid-excursion', () => {
    const { excursion, setTempo } = makeExcursion();

    excursion.jumpUp();
    setTempo.mockClear();

    excursion.jumpUp();

    expect(setTempo).not.toHaveBeenCalled();
    expect(excursion.remembered()).toBe(1);
  });

  it('returns exactly to the remembered multiplier even when the outbound jump clamped, never by re-deriving with arithmetic', () => {
    const { excursion, setTempo } = makeExcursion(0.3, 1.2);

    excursion.jumpUp(); // 1 + 0.5 = 1.5, clamped to 1.2
    expect(setTempo).toHaveBeenLastCalledWith(1.2);

    excursion.jumpDown(); // must land exactly on 1, not 1.2 - 0.5 = 0.7

    expect(setTempo).toHaveBeenLastCalledWith(1);
  });

  it('is dual-purpose: home() sets 1.0 directly with no excursion open', () => {
    const { excursion, setTempo } = makeExcursion();

    excursion.home();

    expect(setTempo).toHaveBeenLastCalledWith(1);
    expect(excursion.remembered()).toBeNull();
  });

  it('home() restores the remembered multiplier and closes the excursion when one is open, like an opposite jump', () => {
    const { excursion, setTempo } = makeExcursion();

    excursion.jumpUp();

    excursion.home();

    expect(setTempo).toHaveBeenLastCalledWith(1);
    expect(excursion.remembered()).toBeNull();
  });

  it('seeds a fresh excursion from the live multiplier, not a stale internally tracked one', () => {
    const { excursion, setTempo, setLive } = makeExcursion();

    setLive(1.2); // e.g. the fader, moved without going through the excursion at all

    excursion.jumpUp(); // must remember 1.2, not the excursion's own last-known value of 1
    expect(excursion.remembered()).toBe(1.2);
    expect(setTempo).toHaveBeenLastCalledWith(1.7);

    excursion.jumpDown(); // opposite button — must restore exactly 1.2
    expect(setTempo).toHaveBeenLastCalledWith(1.2);
    expect(excursion.remembered()).toBeNull();
  });

  it('opens a fresh excursion from wherever the previous one closed', () => {
    const { excursion, setTempo } = makeExcursion();

    excursion.jumpUp(); // 1 -> 1.5, remembered 1
    excursion.jumpDown(); // closes, back to 1

    excursion.jumpDown(); // a fresh excursion, additive from 1 again

    expect(setTempo).toHaveBeenLastCalledWith(0.5);
    expect(excursion.remembered()).toBe(1);
  });
});
