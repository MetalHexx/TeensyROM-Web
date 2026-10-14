import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import { FakeClock, frames, SID_FILTER_MODE_HIGH_PASS, SID_FILTER_MODE_LOW_PASS } from '@sidablist/core';
import type { ReplayRunner, SidField } from '@sidablist/core';
import type { TuneReference } from '@sidablist/tunes';
import { logError, logWarn } from '@teensyrom-nx/utils';
import { MixerApplier } from './mixer-applier';
import { MixerService } from './mixer.service';
import { DeckRuntime } from './deck-runtime';
import { DjStore } from './dj-store';
import { FRAME_CLOCK_FACTORY, REPLAY_RUNNER_FACTORY, MIDI_ACCESS } from './ports';
import type { IMidiAccess, MidiAccessState, MidiPermission, MidiPortOption } from './ports/midi-access';
import { DECK_SLOTS, type Slot } from './slot';
import { linearCrossfaderGain } from './mixer/crossfader-curve';
import { scaleCoefficientFor } from './mixer/scale-taper';
import {
  cutoffSweepDrives,
  dipSteps,
  FILTER_SWEEP,
  resonanceDrive,
  tuneFilterStateFrom,
} from './mixer/filter-sweep';

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
  let holdField: MockInstance<DeckRuntime['holdField']>;
  let releaseField: MockInstance<DeckRuntime['releaseField']>;
  let tuneRegisters: MockInstance<DeckRuntime['tuneRegisters']>;

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
    holdField = vi.spyOn(runtime, 'holdField');
    releaseField = vi.spyOn(runtime, 'releaseField');
    tuneRegisters = vi.spyOn(runtime, 'tuneRegisters');
  }

  function clearSpies(): void {
    for (const spy of [
      setOutputGain,
      setRegisterScale,
      setKeyCoefficient,
      setFilterMode,
      holdField,
      releaseField,
      tuneRegisters,
    ]) {
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

  /** The `$D418` byte (and `$D417`'s routing) the tune itself wrote, as `tuneRegisters` reports it. */
  function tuneWrites(volumeAndMode: number, routing = 0): void {
    const written = new Uint8Array(25);
    written[23] = routing;
    written[24] = volumeAndMode;
    tuneRegisters.mockReturnValue(written);
  }

  function heldOn(slot: Slot, name: string, voice?: number): { value: number; amount: number } | undefined {
    const call = holdField.mock.calls
      .filter(([calledSlot, field]) => calledSlot === slot && matches(field, name, voice))
      .pop();
    return call === undefined ? undefined : { value: call[2], amount: call[3] };
  }

  function releasedOn(slot: Slot, name: string, voice?: number): boolean {
    return releaseField.mock.calls.some(
      ([calledSlot, field]) => calledSlot === slot && matches(field, name, voice)
    );
  }

  function matches(field: SidField, name: string, voice?: number): boolean {
    return field.name === name && (voice === undefined || ('voice' in field && field.voice === voice));
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

    it('pushes the pulse-width scale, the key coefficient and the stored filter mode at centre', () => {
      makeShapeable('A');
      service.setKnob('A', 'pulseWidth', 1);
      service.setKeySemitones('A', 12);
      service.setFilterMode('A', 'highPass');

      applier.applyDeck('A');

      expect(setRegisterScale).toHaveBeenCalledWith('A', 'pulseWidth', scaleCoefficientFor(1));
      expect(setKeyCoefficient).toHaveBeenCalledWith('A', 2);
      expect(setFilterMode).toHaveBeenCalledExactlyOnceWith('A', 'highPass');
    });

    it('never sets the cutoff or resonance register scales', () => {
      makeShapeable('A');
      service.setKnob('A', 'cutoff', -0.6);
      service.setKnob('A', 'resonance', 0.6);

      applier.applyDeck('A');
      applier.applyDeck('B');

      expect(setRegisterScale.mock.calls.every(([, group]) => group === 'pulseWidth')).toBe(true);
    });

    it('never touches the other slot', () => {
      makeShapeable('A');
      service.setKnob('A', 'cutoff', 0.6);
      service.setKnob('A', 'resonance', 0.6);

      applier.applyDeck('A');

      expect(holdField).toHaveBeenCalled();
      for (const spy of [
        setOutputGain,
        setRegisterScale,
        setKeyCoefficient,
        setFilterMode,
        holdField,
        releaseField,
        tuneRegisters,
      ]) {
        expect(spy.mock.calls.every(([slot]) => slot === 'A')).toBe(true);
      }
    });

    describe('the cutoff sweep', () => {
      const { deadZone, glideZone } = FILTER_SWEEP;

      beforeEach(() => makeShapeable('A'));

      it('releases every cutoff field at centre and applies the stored filter mode in place of the filter-type hold', () => {
        service.setFilterMode('A', 'bandPass');

        applier.applyDeck('A');

        expect(holdField).not.toHaveBeenCalled();
        expect(releasedOn('A', 'cutoff')).toBe(true);
        for (const voice of [0, 1, 2]) {
          expect(releasedOn('A', 'filtered', voice)).toBe(true);
        }
        expect(releasedOn('A', 'filterType')).toBe(false);
        expect(setFilterMode).toHaveBeenCalledExactlyOnceWith('A', 'bandPass');
        expect(tuneRegisters).not.toHaveBeenCalled();
      });

      it.each([
        ['left', -0.6, SID_FILTER_MODE_LOW_PASS],
        ['right', 0.6, SID_FILTER_MODE_HIGH_PASS],
      ])('holds the filter type, all three voices and the cutoff when the knob is %s of centre', (_side, position, type) => {
        service.setKnob('A', 'cutoff', position);

        applier.applyDeck('A');

        expect(heldOn('A', 'filterType')).toEqual({ value: type, amount: 1 });
        for (const voice of [0, 1, 2]) {
          expect(heldOn('A', 'filtered', voice)).toEqual({ value: 1, amount: 1 });
        }
        expect(heldOn('A', 'cutoff')?.amount).toBe(1);
        expect(releasedOn('A', 'cutoff')).toBe(false);
        expect(setFilterMode).not.toHaveBeenCalled();
      });

      it('leaves the other deck at centre when only one deck is swept', () => {
        service.setKnob('A', 'cutoff', 0.6);

        applier.applyDeck('A');
        applier.applyDeck('B');

        expect(heldOn('A', 'cutoff')).toBeDefined();
        expect(heldOn('B', 'cutoff')).toBeUndefined();
        expect(releasedOn('B', 'cutoff')).toBe(true);
        expect(setFilterMode).toHaveBeenCalledExactlyOnceWith('B', null);
      });

      it('releases voice 3 from the filter when the tune has switched it off', () => {
        tuneWrites(0x80);
        service.setKnob('A', 'cutoff', -0.6);

        applier.applyDeck('A');

        expect(releasedOn('A', 'filtered', 2)).toBe(true);
        expect(heldOn('A', 'filtered', 0)).toBeDefined();
        expect(heldOn('A', 'filtered', 1)).toBeDefined();
        expect(heldOn('A', 'filtered', 2)).toBeUndefined();
      });

      it("glides in from the tune's own open cutoff and hands the filter type back to the stored mode", () => {
        tuneWrites(0x40, 0x01);
        service.setKnob('A', 'cutoff', deadZone + glideZone / 2);
        service.setFilterMode('A', 'lowPass');

        applier.applyDeck('A');

        const held = heldOn('A', 'cutoff');
        expect(held?.value).toBe(0);
        expect(held?.amount).toBeGreaterThan(0);
        expect(held?.amount).toBeLessThan(1);
        expect(releasedOn('A', 'filterType')).toBe(false);
        expect(setFilterMode).toHaveBeenCalledExactlyOnceWith('A', 'lowPass');
        expect(heldOn('A', 'filterType')).toBeUndefined();
        expect(heldOn('A', 'filtered', 0)).toBeUndefined();
      });
    });

    describe('the resonance knob', () => {
      beforeEach(() => makeShapeable('A'));

      it('holds the resonance field above rest', () => {
        service.setKnob('A', 'resonance', 0.5);

        applier.applyDeck('A');

        expect(heldOn('A', 'resonance')).toEqual(resonanceDrive(0.5).hold);
        expect(releasedOn('A', 'resonance')).toBe(false);
      });

      it('releases the resonance field at rest', () => {
        service.setKnob('A', 'resonance', 0.5);
        applier.applyDeck('A');
        clearSpies();

        service.setKnob('A', 'resonance', 0);
        applier.applyDeck('A');

        expect(releasedOn('A', 'resonance')).toBe(true);
        expect(heldOn('A', 'resonance')).toBeUndefined();
      });
    });

    describe('the volume dip around a filter switch', () => {
      const { factors, flipAt } = dipSteps();
      let frame: number;
      let position: MockInstance<DeckRuntime['position']>;

      function sentGain(slot: Slot): number {
        const gain = gainFor(slot);
        if (gain === undefined) {
          throw new Error(`no gain was sent to deck ${slot}`);
        }
        return gain;
      }

      /** The engine builds `count` more frames, each seen by the dip's next poll. */
      function framesGoOut(count: number): void {
        for (let i = 0; i < count; i++) {
          frame++;
          vi.advanceTimersByTime(5);
        }
      }

      function finishDip(): void {
        framesGoOut(factors.length);
      }

      beforeEach(() => {
        vi.useFakeTimers();
        frame = 0;
        position = vi.spyOn(runtime, 'position').mockImplementation(() => frames(frame));
        makeShapeable('A');
        store.setDeckStatus({ slot: 'A', status: 'playing' });
        applier.applyDeck('A');
        clearSpies();
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      it('fades the gain out and holds the switches back until a silent frame has gone out', () => {
        service.setKnob('A', 'cutoff', -0.6);
        applier.applyDeck('A');

        expect(gainFor('A')).toBeCloseTo(factors[0], 10);
        framesGoOut(flipAt - 1);
        expect(gainFor('A')).toBe(0);
        expect(heldOn('A', 'filterType')).toBeUndefined();
        expect(heldOn('A', 'filtered', 0)).toBeUndefined();

        framesGoOut(1);

        expect(heldOn('A', 'filterType')).toEqual({ value: SID_FILTER_MODE_LOW_PASS, amount: 1 });
        for (const voice of [0, 1, 2]) {
          expect(heldOn('A', 'filtered', voice)).toEqual({ value: 1, amount: 1 });
        }
        expect(gainFor('A')).toBeCloseTo(factors[flipAt] ?? 1, 10);

        finishDip();

        expect(gainFor('A')).toBe(1);
      });

      it('keeps waiting while no frame goes out', () => {
        service.setKnob('A', 'cutoff', -0.6);
        applier.applyDeck('A');

        vi.advanceTimersByTime(50);

        expect(heldOn('A', 'filterType')).toBeUndefined();
        expect(gainFor('A')).toBeCloseTo(factors[0], 10);
      });

      it('steps on anyway once no frame has gone out for a while, so the gain is never left down', () => {
        service.setKnob('A', 'cutoff', -0.6);
        applier.applyDeck('A');

        vi.advanceTimersByTime(150 * (factors.length + 1));

        expect(heldOn('A', 'filterType')).toEqual({ value: SID_FILTER_MODE_LOW_PASS, amount: 1 });
        expect(gainFor('A')).toBe(1);
      });

      it('sends the latest knob position with the flip', () => {
        service.setKnob('A', 'cutoff', -0.6);
        applier.applyDeck('A');
        service.setKnob('A', 'cutoff', -0.9);
        applier.applyDeck('A');

        framesGoOut(flipAt);

        const expected = cutoffSweepDrives(-0.9, () => tuneFilterStateFrom(new Uint8Array(25)))[0].hold;
        expect(heldOn('A', 'cutoff')).toEqual(expected);
      });

      it('moves the cutoff at once, with no dip, while the switches stay as they are', () => {
        service.setKnob('A', 'cutoff', -0.6);
        applier.applyDeck('A');
        finishDip();
        clearSpies();

        service.setKnob('A', 'cutoff', -0.8);
        applier.applyDeck('A');

        expect(gainFor('A')).toBe(1);
        expect(heldOn('A', 'cutoff')?.value).toBeLessThan(2047);
      });

      it('dips again to hand the switches back at centre', () => {
        service.setKnob('A', 'cutoff', -0.6);
        applier.applyDeck('A');
        finishDip();
        clearSpies();

        service.setKnob('A', 'cutoff', 0);
        applier.applyDeck('A');

        expect(gainFor('A')).toBeCloseTo(factors[0], 10);
        framesGoOut(flipAt - 1);
        expect(setFilterMode).not.toHaveBeenCalled();

        framesGoOut(1);

        expect(setFilterMode).toHaveBeenCalledExactlyOnceWith('A', null);
        expect(releasedOn('A', 'filtered', 0)).toBe(true);

        finishDip();

        expect(gainFor('A')).toBe(1);
      });

      it('does not dip a deck that is not playing', () => {
        store.setDeckStatus({ slot: 'A', status: 'paused' });
        service.setKnob('A', 'cutoff', -0.6);

        applier.applyDeck('A');

        expect(heldOn('A', 'filterType')).toEqual({ value: SID_FILTER_MODE_LOW_PASS, amount: 1 });
        expect(gainFor('A')).toBe(1);
      });

      it('keeps level and crossfader moves working during the dip, scaled by its current factor', () => {
        service.setLevel('A', 0.5);
        applier.applyDeck('A');
        service.setKnob('A', 'cutoff', 0.6);
        applier.applyDeck('A');
        expect(gainFor('A')).toBeCloseTo(0.5 * factors[0], 10);

        framesGoOut(1);
        service.setLevel('A', 0.8);
        applier.applyDeck('A');
        expect(gainFor('A')).toBeCloseTo(0.8 * (factors[1] ?? 1), 10);

        service.setCrossfader(0.5);
        applier.applyDeck('A');
        const crossfaded = 0.8 * linearCrossfaderGain(0.5, 'a');
        expect(gainFor('A')).toBeCloseTo(crossfaded * (factors[1] ?? 1), 10);

        finishDip();

        expect(gainFor('A')).toBeCloseTo(crossfaded, 10);
      });

      it('starts a new dip, without raising the gain, when a switch changes during the fade back', () => {
        service.setKnob('A', 'cutoff', -0.6);
        applier.applyDeck('A');
        framesGoOut(flipAt + 1);
        const before = sentGain('A');
        expect(before).toBeLessThan(1);
        clearSpies();

        service.setKnob('A', 'cutoff', 0.6);
        applier.applyDeck('A');

        const sent = [sentGain('A')];
        for (let i = 0; i < 2 * factors.length && heldOn('A', 'filterType') === undefined; i++) {
          framesGoOut(1);
          if (heldOn('A', 'filterType') === undefined) {
            sent.push(sentGain('A'));
          }
        }
        expect(sent[0]).toBeLessThanOrEqual(before);
        for (let i = 1; i < sent.length; i++) {
          expect(sent[i]).toBeLessThanOrEqual(sent[i - 1]);
        }
        expect(sent[sent.length - 1]).toBe(0);
        expect(heldOn('A', 'filterType')).toEqual({ value: SID_FILTER_MODE_HIGH_PASS, amount: 1 });

        finishDip();

        expect(gainFor('A')).toBe(1);
      });

      describe('when the dip fails', () => {
        const fault = new Error('engine fault');

        function throwFault(): never {
          throw fault;
        }

        it.each([
          ['reading the frame position', () => position.mockImplementationOnce(throwFault), 1],
          ['sending the switches', () => holdField.mockImplementationOnce(throwFault), flipAt],
        ])(
          'puts the gain back and applies the waiting switches when %s throws',
          (_where, breakIt, failingStep) => {
            service.setKnob('A', 'cutoff', -0.6);
            applier.applyDeck('A');
            framesGoOut(failingStep - 1);
            breakIt();

            framesGoOut(1);

            expect(logError).toHaveBeenCalledTimes(1);
            expect(vi.mocked(logError).mock.calls[0][0]).toContain('deck A');
            expect(gainFor('A')).toBe(1);
            expect(heldOn('A', 'filterType')).toEqual({
              value: SID_FILTER_MODE_LOW_PASS,
              amount: 1,
            });
            clearSpies();

            vi.advanceTimersByTime(200);

            expect(holdField).not.toHaveBeenCalled();
            expect(setOutputGain).not.toHaveBeenCalled();
          }
        );

        it('reports a failed recovery too and never throws out of the timer', () => {
          service.setKnob('A', 'cutoff', -0.6);
          applier.applyDeck('A');
          position.mockImplementationOnce(throwFault);
          setOutputGain.mockImplementation(throwFault);

          expect(() => framesGoOut(1)).not.toThrow();

          expect(logError).toHaveBeenCalledTimes(2);
          expect(heldOn('A', 'filterType')).toEqual({ value: SID_FILTER_MODE_LOW_PASS, amount: 1 });
        });
      });

      it('is dropped by a new-tune reset, which restores the gain at once and sends nothing late', () => {
        service.setKnob('A', 'cutoff', -0.6);
        applier.applyDeck('A');

        applier.resetTuneShaping('A');

        expect(gainFor('A')).toBe(1);
        expect(releasedOn('A', 'filtered', 0)).toBe(true);
        clearSpies();

        finishDip();
        vi.advanceTimersByTime(200);

        expect(holdField).not.toHaveBeenCalled();
        expect(setOutputGain).not.toHaveBeenCalled();
      });
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

      expect(heldOn('A', 'cutoff')).toBeDefined();
      for (const spy of [holdField, releaseField, setOutputGain, setRegisterScale]) {
        expect(spy.mock.calls.some(([slot]) => slot === 'B')).toBe(false);
      }
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
      expect(releasedOn('B', 'cutoff')).toBe(true);
      expect(setFilterMode).toHaveBeenCalledWith('B', null);
    });
  });

  describe('resetTuneShaping', () => {
    it('returns the engine to home tune shaping before returning, without waiting on an effect', () => {
      makeShapeable('A');
      service.setLevel('A', 0.5);
      service.setCrossfader(-0.5);
      service.setKnob('A', 'cutoff', 0.75);
      service.setKnob('A', 'resonance', 0.75);
      service.setKnob('A', 'pulseWidth', 0.5);
      service.setKeySemitones('A', 7);
      service.setFilterMode('A', 'lowPass');
      applier.applyDeck('A');
      expect(heldOn('A', 'cutoff')).toBeDefined();
      expect(heldOn('A', 'resonance')).toBeDefined();
      clearSpies();

      applier.resetTuneShaping('A');

      expect(store.deckMix('A')()).toMatchObject({
        cutoff: 0,
        resonance: 0,
        pulseWidth: 0,
        keySemitones: 0,
        filterMode: null,
      });
      expect(holdField).not.toHaveBeenCalled();
      expect(releasedOn('A', 'cutoff')).toBe(true);
      expect(releasedOn('A', 'resonance')).toBe(true);
      for (const voice of [0, 1, 2]) {
        expect(releasedOn('A', 'filtered', voice)).toBe(true);
      }
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
