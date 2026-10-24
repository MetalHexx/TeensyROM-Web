import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { describe, it, expect, beforeEach } from 'vitest';
import { FakeClock } from '@sidablist/core';
import type { FrameClock, ReplayRunner } from '@sidablist/core';
import { DeckSpeed } from './deck-speed';
import { DeckRuntime } from './deck-runtime';
import { FRAME_CLOCK_FACTORY, REPLAY_RUNNER_FACTORY, MIDI_ACCESS } from './ports';
import type { IMidiAccess, MidiAccessState, MidiPermission, MidiPortOption } from './ports/midi-access';
import type { Slot } from './slot';

const fakeReplayRunner: ReplayRunner = {
  run: () => Promise.reject(new Error('replay is not exercised here')),
  dispose: (): void => undefined,
};

const fakeMidiAccess: IMidiAccess = {
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

describe('DeckSpeed', () => {
  let speed: DeckSpeed;
  let runtime: DeckRuntime;

  const tempo = (slot: Slot): number => runtime.snapshot(slot).tempo.multiplier;
  const NUDGE = 0.05;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        DeckRuntime,
        { provide: FRAME_CLOCK_FACTORY, useValue: (): FrameClock => new FakeClock() },
        { provide: REPLAY_RUNNER_FACTORY, useValue: (): ReplayRunner => fakeReplayRunner },
        { provide: MIDI_ACCESS, useValue: fakeMidiAccess },
      ],
    });
    runtime = TestBed.inject(DeckRuntime);
    runtime.build('A');
    runtime.build('B');
    speed = TestBed.inject(DeckSpeed);
  });

  describe('setFader', () => {
    it('sets the tempo within the fader span and keeps the value', () => {
      speed.setFader('A', 1.25);

      expect(tempo('A')).toBe(1.25);
      expect(speed.faderValue('A')).toBe(1.25);
    });

    it('clamps to 0.5x–1.5x', () => {
      speed.setFader('A', 3);
      expect(tempo('A')).toBe(1.5);

      speed.setFader('A', 0.1);
      expect(tempo('A')).toBe(0.5);
    });

    it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])('ignores %s', (value) => {
      speed.setFader('A', 1.25);

      speed.setFader('A', value);

      expect(tempo('A')).toBe(1.25);
      expect(speed.faderValue('A')).toBe(1.25);
    });
  });

  describe('jump', () => {
    it('opens an excursion by stepping 0.5 from the fader value', () => {
      speed.setFader('A', 1.1);

      speed.jump('A', 'up');
      expect(tempo('A')).toBeCloseTo(1.6);

      speed.jump('A', 'home');
      expect(tempo('A')).toBe(1.1);
    });

    it('reaches the hard span past the fader span', () => {
      speed.setFader('A', 1.5);
      speed.jump('A', 'up');
      expect(tempo('A')).toBeCloseTo(1.7);

      speed.jump('A', 'home');
      speed.setFader('A', 0.5);
      speed.jump('A', 'down');
      expect(tempo('A')).toBeCloseTo(0.3);
    });

    it('treats a same-side press while open as a no-op and the opposite press as a return', () => {
      speed.jump('A', 'down');
      expect(tempo('A')).toBe(0.5);

      speed.jump('A', 'down');
      expect(tempo('A')).toBe(0.5);

      speed.jump('A', 'up');
      expect(tempo('A')).toBe(1);
    });

    it('returns Home with no excursion open to 1.0x', () => {
      speed.setFader('A', 1.4);

      speed.jump('A', 'home');

      expect(tempo('A')).toBe(1);
    });

    it('does not close an excursion on a fader move: the next opposite press restores the remembered value', () => {
      speed.setFader('A', 1.2);
      speed.jump('A', 'up');

      speed.setFader('A', 0.8);
      expect(tempo('A')).toBe(0.8);

      speed.jump('A', 'down');
      expect(tempo('A')).toBe(1.2);
    });
  });

  describe('setNudge', () => {
    it('adds the amount on top of the fader while held and lands on the fader exactly on release', () => {
      speed.setFader('A', 1.012);

      speed.setNudge('A', 'up', true, NUDGE);
      expect(tempo('A')).toBeCloseTo(1.062, 10);
      expect(speed.faderValue('A')).toBe(1.012);
      expect(speed.isNudging('A')).toBe(true);

      speed.setNudge('A', 'up', false, NUDGE);
      expect(tempo('A')).toBe(1.012);
      expect(speed.isNudging('A')).toBe(false);
    });

    it('subtracts the amount for the down pad', () => {
      speed.setFader('A', 1.012);

      speed.setNudge('A', 'down', true, NUDGE);
      expect(tempo('A')).toBeCloseTo(0.962, 10);

      speed.setNudge('A', 'down', false, NUDGE);
      expect(tempo('A')).toBe(1.012);
    });

    it('follows a fader move made while held, and releases onto the moved fader', () => {
      speed.setNudge('A', 'up', true, NUDGE);

      speed.setFader('A', 1.1);
      expect(tempo('A')).toBeCloseTo(1.15, 10);

      speed.setNudge('A', 'up', false, NUDGE);
      expect(tempo('A')).toBe(1.1);
    });

    it('plays the fader value with both pads held, and releasing down leaves the up amount applied', () => {
      speed.setFader('A', 0.9);

      speed.setNudge('A', 'up', true, NUDGE);
      speed.setNudge('A', 'down', true, NUDGE);
      expect(tempo('A')).toBe(0.9);

      speed.setNudge('A', 'down', false, NUDGE);
      expect(tempo('A')).toBeCloseTo(0.95, 10);
      expect(speed.isNudging('A')).toBe(true);

      speed.setNudge('A', 'up', false, NUDGE);
      expect(tempo('A')).toBe(0.9);
      expect(speed.isNudging('A')).toBe(false);
    });

    it('replaces the amount on a second press of a held pad rather than stacking', () => {
      speed.setNudge('A', 'up', true, NUDGE);
      speed.setNudge('A', 'up', true, 0.1);
      expect(tempo('A')).toBeCloseTo(1.1, 10);

      speed.setNudge('A', 'up', false, 0.1);
      expect(tempo('A')).toBe(1);
    });

    it('treats the release of a pad that is not held as a no-op, leaving the other pad held', () => {
      speed.setNudge('A', 'up', true, NUDGE);

      speed.setNudge('A', 'down', false, NUDGE);

      expect(tempo('A')).toBeCloseTo(1.05, 10);
      expect(speed.isNudging('A')).toBe(true);
    });

    it('clamps the played tempo to the hard span but not the stored fader value', () => {
      speed.setFader('A', 1.5);
      speed.setNudge('A', 'up', true, 1);
      expect(tempo('A')).toBeCloseTo(1.7);
      expect(speed.faderValue('A')).toBe(1.5);

      speed.setNudge('A', 'up', false, 1);
      expect(tempo('A')).toBe(1.5);
    });

    it('keeps each deck its own nudges', () => {
      speed.setNudge('A', 'up', true, NUDGE);

      expect(tempo('B')).toBe(1);
      expect(speed.isNudging('B')).toBe(false);
    });
  });

  describe('nudges with jump excursions', () => {
    it('holds at the upper limit and releases to the limit itself, not to a subtracted value', () => {
      speed.setFader('A', 1.5);
      speed.jump('A', 'up');
      const limit = tempo('A');
      expect(limit).toBeCloseTo(1.7);

      speed.setNudge('A', 'up', true, NUDGE);
      expect(tempo('A')).toBe(limit);

      speed.setNudge('A', 'up', false, NUDGE);
      expect(tempo('A')).toBe(limit);
    });

    it('holds at the lower limit and releases to the limit itself', () => {
      speed.setFader('A', 0.5);
      speed.jump('A', 'down');
      const limit = tempo('A');
      expect(limit).toBeCloseTo(0.3);

      speed.setNudge('A', 'down', true, NUDGE);
      expect(tempo('A')).toBe(limit);

      speed.setNudge('A', 'down', false, NUDGE);
      expect(tempo('A')).toBe(limit);
    });

    it('opens a jump from the fader value, not the nudged tempo, and closes onto it', () => {
      speed.setFader('A', 1.2);
      speed.setNudge('A', 'up', true, NUDGE);
      expect(tempo('A')).toBeCloseTo(1.25, 10);

      speed.jump('A', 'down');
      expect(tempo('A')).toBeCloseTo(0.75, 10);

      speed.setNudge('A', 'up', false, NUDGE);
      speed.jump('A', 'up');
      expect(tempo('A')).toBe(1.2);
    });

    it('closes onto the fader value with the nudge still applied while still held', () => {
      speed.setFader('A', 1.2);
      speed.setNudge('A', 'up', true, NUDGE);
      speed.jump('A', 'up');

      speed.jump('A', 'home');

      expect(tempo('A')).toBeCloseTo(1.25, 10);
      expect(speed.faderValue('A')).toBe(1.2);
    });

    it('adds a nudge pressed during an open excursion on top of the excursion value', () => {
      speed.jump('A', 'up');
      expect(tempo('A')).toBe(1.5);

      speed.setNudge('A', 'down', true, NUDGE);
      expect(tempo('A')).toBeCloseTo(1.45, 10);

      speed.jump('A', 'home');
      expect(tempo('A')).toBeCloseTo(0.95, 10);

      speed.setNudge('A', 'down', false, NUDGE);
      expect(tempo('A')).toBe(1);
    });

    it('reports a jump-moved fader value beyond the fader span', () => {
      speed.setFader('A', 1.5);
      speed.jump('A', 'up');

      expect(speed.faderValue('A')).toBeCloseTo(1.7);
    });
  });

  describe('reset', () => {
    it('returns the tempo to 1.0x', () => {
      speed.setFader('A', 1.4);

      speed.reset('A');

      expect(tempo('A')).toBe(1);
      expect(speed.faderValue('A')).toBe(1);
    });

    it('releases both nudges', () => {
      speed.setNudge('A', 'up', true, NUDGE);
      speed.setNudge('A', 'down', true, 0.1);

      speed.reset('A');

      expect(tempo('A')).toBe(1);
      expect(speed.isNudging('A')).toBe(false);

      speed.setFader('A', 1.2);
      expect(tempo('A')).toBe(1.2);
    });

    it('closes an open excursion, so the next jump opens a fresh one from the fader value', () => {
      speed.setFader('A', 1.2);
      speed.jump('A', 'up');

      speed.reset('A');
      speed.jump('A', 'down');
      expect(tempo('A')).toBe(0.5);

      speed.jump('A', 'home');
      expect(tempo('A')).toBe(1);
    });
  });

  it('keeps each deck its own tempo and excursion', () => {
    speed.setFader('A', 1.2);
    speed.jump('A', 'up');

    expect(tempo('B')).toBe(1);

    speed.jump('B', 'home');
    expect(tempo('A')).toBeCloseTo(1.7);
    expect(tempo('B')).toBe(1);

    speed.reset('B');
    speed.jump('A', 'home');
    expect(tempo('A')).toBe(1.2);
  });
});
