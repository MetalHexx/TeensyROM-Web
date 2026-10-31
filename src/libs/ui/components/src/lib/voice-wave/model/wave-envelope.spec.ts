import { describe, it, expect } from 'vitest';
import { ATTACK_MS, WaveEnvelope } from './wave-envelope';

const SETTINGS = { attack: 5, decay: 5, sustain: 8, release: 6 };
const SUSTAIN_LEVEL = 8 / 15;

function open(envelope: WaveEnvelope, hit = 1, settings = SETTINGS): void {
  envelope.apply(1, hit, settings.attack, settings.decay, settings.sustain, settings.release);
}

function close(envelope: WaveEnvelope, settings = SETTINGS): void {
  envelope.apply(0, 0, settings.attack, settings.decay, settings.sustain, settings.release);
}

describe('WaveEnvelope', () => {
  it('rises through the attack in real time, falls to the sustain level and holds there', () => {
    const envelope = new WaveEnvelope();
    open(envelope);

    envelope.advance(ATTACK_MS[5] / 2);
    expect(envelope.level).toBeCloseTo(0.5, 1);

    envelope.advance(ATTACK_MS[5] / 2);
    expect(envelope.level).toBeGreaterThan(0.95);

    envelope.advance(2000);
    expect(envelope.level).toBeCloseTo(SUSTAIN_LEVEL, 3);
    envelope.advance(2000);
    expect(envelope.level).toBeCloseTo(SUSTAIN_LEVEL, 3);
  });

  it('falls monotonically through the release once the gate closes, then goes idle', () => {
    const envelope = new WaveEnvelope();
    open(envelope);
    envelope.advance(1000);
    close(envelope);

    let previous = envelope.level;
    for (let i = 0; i < 40; i++) {
      envelope.advance(20);
      expect(envelope.level).toBeLessThanOrEqual(previous);
      previous = envelope.level;
    }
    expect(envelope.level).toBe(0);
    expect(envelope.idle).toBe(true);
  });

  it('restarts the attack from the current height on a hit, without a jump to 0', () => {
    const envelope = new WaveEnvelope();
    open(envelope);
    envelope.advance(1000);
    close(envelope);
    envelope.advance(60);
    const releasing = envelope.level;
    expect(releasing).toBeGreaterThan(0);
    expect(releasing).toBeLessThan(SUSTAIN_LEVEL);

    open(envelope);
    expect(envelope.level).toBe(releasing);
    envelope.advance(20);
    expect(envelope.level).toBeGreaterThan(releasing);
    expect(envelope.attacks).toBe(2);
  });

  it('lifts from the current height on a hit whose gate closed again in the same entry, then releases', () => {
    const envelope = new WaveEnvelope();
    envelope.apply(0, 1, 0, 3, 0, 3);

    expect(envelope.level).toBeGreaterThan(0.5);
    const lifted = envelope.level;
    envelope.advance(40);
    expect(envelope.level).toBeLessThan(lifted);
  });

  it('adopts the sustain level at once for an open gate with no hit on an idle follower', () => {
    const envelope = new WaveEnvelope();
    open(envelope, 0);

    expect(envelope.level).toBeCloseTo(SUSTAIN_LEVEL, 5);
    expect(envelope.attacks).toBe(0);
  });

  it('treats a negative gap as none and an enormous one as a bounded stall', () => {
    const envelope = new WaveEnvelope();
    envelope.apply(0, 1, 0, 0, 0, 15);
    envelope.advance(20);
    const before = envelope.level;

    envelope.advance(-500);
    expect(envelope.level).toBe(before);

    envelope.advance(1e12);
    expect(envelope.level).toBeGreaterThan(0.5);
  });

  it('forgets a note in progress on reset but keeps counting attacks', () => {
    const envelope = new WaveEnvelope();
    open(envelope);
    envelope.advance(30);

    envelope.reset();

    expect(envelope.level).toBe(0);
    expect(envelope.idle).toBe(true);
    expect(envelope.attacks).toBe(1);
  });
});
