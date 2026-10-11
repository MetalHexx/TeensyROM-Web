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
    it('sets the tempo within the fader span', () => {
      speed.setFader('A', 1.25);

      expect(tempo('A')).toBe(1.25);
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
    });
  });

  describe('jump', () => {
    it('opens an excursion by stepping 0.5 from the live tempo', () => {
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

  describe('reset', () => {
    it('returns the tempo to 1.0x', () => {
      speed.setFader('A', 1.4);

      speed.reset('A');

      expect(tempo('A')).toBe(1);
    });

    it('closes an open excursion, so the next jump opens a fresh one from the live tempo', () => {
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
