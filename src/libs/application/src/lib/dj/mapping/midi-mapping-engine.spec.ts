import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { logWarn } from '@teensyrom-nx/utils';
import type { ControlIdentity, MappingStyle, MidiSource } from './mapping.models';
import {
  LAUNCH_CONTROL,
  cc,
  ccSource,
  note,
  noteSource,
  setUpMappingHarness,
  type MappingHarness,
} from './testing/mapping-harness';

vi.mock('@teensyrom-nx/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@teensyrom-nx/utils')>();
  return { ...actual, logWarn: vi.fn(actual.logWarn) };
});

const REPEAT_A: ControlIdentity = { owner: 'A', control: 'repeat' };
const SPEED_A: ControlIdentity = { owner: 'A', control: 'speed' };
const KEY_A: ControlIdentity = { owner: 'A', control: 'key' };
const HOLD_1_A: ControlIdentity = { owner: 'A', control: 'voice-1-hold' };
const HOLD_2_A: ControlIdentity = { owner: 'A', control: 'voice-2-hold' };
const NUDGE_UP_A: ControlIdentity = { owner: 'A', control: 'speed-nudge-up' };

const style = (kind: MappingStyle['kind'], amount: number | null = null): MappingStyle => ({
  kind,
  amount,
});

describe('MidiMappingEngine', () => {
  let h: MappingHarness;

  beforeEach(() => {
    TestBed.resetTestingModule();
    vi.mocked(logWarn).mockClear();
    h = setUpMappingHarness();
    h.makeShapeable('A');
  });

  function map(source: MidiSource, control: ControlIdentity, mappingStyle: MappingStyle): string {
    return h.mappings.bind(source, control, mappingStyle).mapping.id;
  }

  const held = (voice: number): boolean => h.djStore.deck('A')().voices[voice].held;
  const speed = (): number => h.djStore.deck('A')().speed;

  describe('matching', () => {
    it('does nothing for a source with no mapping, or one on another channel or controller', () => {
      map(ccSource(7, 1), SPEED_A, style('absolute'));

      h.engine.handle(cc(7, 0, 2));
      h.engine.handle(cc(7, 0, 1, 'other-controller'));
      h.engine.handle(cc(8, 0));

      expect(speed()).toBe(1);
    });

    it('ignores a mapping whose control is not on the list and warns once', () => {
      h.mappingStore.upsertMapping({
        mapping: {
          id: 'stale',
          source: ccSource(7),
          control: { owner: 'A', control: 'tape-speed' as never },
          style: style('absolute'),
        },
      });

      expect(() => {
        h.engine.handle(cc(7, 100));
        h.engine.handle(cc(7, 20));
      }).not.toThrow();

      expect(vi.mocked(logWarn)).toHaveBeenCalledTimes(1);
    });

    it('drives one control from several sources', () => {
      map(ccSource(7), SPEED_A, style('absolute'));
      map(ccSource(8), SPEED_A, style('absolute'));

      h.engine.handle(cc(7, 0));
      expect(speed()).toBe(0.5);

      h.engine.handle(cc(8, 127));
      expect(speed()).toBe(1.5);
    });
  });

  describe('triggers', () => {
    let toggle: MockInstance;

    beforeEach(() => {
      toggle = vi.spyOn(h.deckService, 'togglePlayPause').mockResolvedValue();
    });

    it('press fires once on the press edge, not on repeats or the release', () => {
      map(noteSource(36), { owner: 'A', control: 'play-pause' }, style('press'));

      h.engine.handle(note(36, 100));
      h.engine.handle(note(36, 100));
      h.engine.handle(note(36, 0));

      expect(toggle).toHaveBeenCalledTimes(1);
    });

    it('release fires on the release edge only', () => {
      map(noteSource(36), { owner: 'A', control: 'play-pause' }, style('release'));

      h.engine.handle(note(36, 100));
      expect(toggle).not.toHaveBeenCalled();

      h.engine.handle(note(36, 0));
      h.engine.handle(note(36, 0));
      expect(toggle).toHaveBeenCalledTimes(1);
    });

    it('treats a CC button as a key: 64 and up is down', () => {
      map(ccSource(20), { owner: 'A', control: 'play-pause' }, style('press'));

      h.engine.handle(cc(20, 127));
      h.engine.handle(cc(20, 0));
      h.engine.handle(cc(20, 64));

      expect(toggle).toHaveBeenCalledTimes(2);
    });
  });

  describe('state controls', () => {
    it('latch flips the control on each press edge', () => {
      map(noteSource(40), REPEAT_A, style('latch'));
      expect(h.djStore.deck('A')().repeat).toBe(true);

      h.engine.handle(note(40, 100));
      expect(h.djStore.deck('A')().repeat).toBe(false);
      h.engine.handle(note(40, 0));
      expect(h.djStore.deck('A')().repeat).toBe(false);

      h.engine.handle(note(40, 100));
      expect(h.djStore.deck('A')().repeat).toBe(true);
    });

    it('on and off keys set the control whatever it was', () => {
      map(noteSource(40), REPEAT_A, style('off'));
      map(noteSource(41), REPEAT_A, style('on'));

      h.engine.handle(note(40, 100));
      expect(h.djStore.deck('A')().repeat).toBe(false);
      h.engine.handle(note(40, 0));
      h.engine.handle(note(40, 100));
      expect(h.djStore.deck('A')().repeat).toBe(false);

      h.engine.handle(note(41, 100));
      expect(h.djStore.deck('A')().repeat).toBe(true);
    });
  });

  describe('absolute', () => {
    it('maps 0–127 across the control range', () => {
      map(ccSource(7), SPEED_A, style('absolute'));

      h.engine.handle(cc(7, 0));
      expect(speed()).toBe(0.5);

      h.engine.handle(cc(7, 127));
      expect(speed()).toBe(1.5);

      h.engine.handle(cc(7, 64));
      expect(speed()).toBeCloseTo(0.5 + 64 / 127, 10);
    });

    it('rounds a stepped control to its step', () => {
      map(ccSource(7), KEY_A, style('absolute'));

      h.engine.handle(cc(7, 0));
      expect(h.djStore.deckPanel('A')().keySemitones).toBe(-12);

      h.engine.handle(cc(7, 127));
      expect(h.djStore.deckPanel('A')().keySemitones).toBe(12);

      h.engine.handle(cc(7, 64));
      expect(h.djStore.deckPanel('A')().keySemitones).toBe(0);
    });

    it('does nothing from a note', () => {
      h.mappingStore.upsertMapping({
        mapping: { id: 'odd', source: noteSource(7), control: SPEED_A, style: style('absolute') },
      });

      h.engine.handle(note(7, 0));
      h.engine.handle(note(7, 100));

      expect(speed()).toBe(1);
    });
  });

  describe('relative', () => {
    it('relative-offset moves by (raw − 64) ticks of the amount, either way', () => {
      map(ccSource(10), SPEED_A, style('relative-offset', 0.05));

      h.engine.handle(cc(10, 66));
      expect(speed()).toBeCloseTo(1.1, 10);

      h.engine.handle(cc(10, 63));
      expect(speed()).toBeCloseTo(1.05, 10);
    });

    it('relative-signed counts up from 0 and down from 127', () => {
      map(ccSource(10), SPEED_A, style('relative-signed', 0.05));

      h.engine.handle(cc(10, 2));
      expect(speed()).toBeCloseTo(1.1, 10);

      h.engine.handle(cc(10, 126));
      expect(speed()).toBeCloseTo(1, 10);
    });

    it('stops at the ends of the range', () => {
      map(ccSource(10), SPEED_A, style('relative-offset', 0.5));

      h.engine.handle(cc(10, 127));
      expect(speed()).toBe(1.5);

      h.engine.handle(cc(10, 0));
      expect(speed()).toBe(0.5);
    });

    it('a rest value moves nothing', () => {
      map(ccSource(10), SPEED_A, style('relative-offset', 0.5));
      map(ccSource(11), SPEED_A, style('relative-signed', 0.5));

      h.engine.handle(cc(10, 64));
      h.engine.handle(cc(11, 0));

      expect(speed()).toBe(1);
    });

    it('a stepped control accumulates small moves and moves by whole steps, keeping the remainder', () => {
      map(ccSource(10), KEY_A, style('relative-offset', 0.025));
      const key = (): number => h.djStore.deckPanel('A')().keySemitones;

      h.engine.handle(cc(10, 65));
      expect(key()).toBe(0);
      h.engine.handle(cc(10, 65));
      expect(key()).toBe(1);
      h.engine.handle(cc(10, 65));
      expect(key()).toBe(1);
      h.engine.handle(cc(10, 65));
      expect(key()).toBe(2);
    });

    it('a stepped control moves several steps for one large turn', () => {
      map(ccSource(10), KEY_A, style('relative-signed', 1 / 24));

      h.engine.handle(cc(10, 3));
      expect(h.djStore.deckPanel('A')().keySemitones).toBe(3);

      h.engine.handle(cc(10, 127));
      expect(h.djStore.deckPanel('A')().keySemitones).toBe(2);
    });

    it("keeps each mapping's remainder on its own", () => {
      map(ccSource(10), KEY_A, style('relative-offset', 0.025));
      map(ccSource(11), KEY_A, style('relative-offset', 0.025));

      h.engine.handle(cc(10, 65));
      h.engine.handle(cc(11, 65));

      expect(h.djStore.deckPanel('A')().keySemitones).toBe(0);
    });

    it('a stepped control pushed against its end does not bank the overshoot', () => {
      map(ccSource(10), KEY_A, style('relative-signed', 1 / 24));
      h.engine.handle(cc(10, 20));
      expect(h.djStore.deckPanel('A')().keySemitones).toBe(12);

      h.engine.handle(cc(10, 127));

      expect(h.djStore.deckPanel('A')().keySemitones).toBe(11);
    });

    it('seek turns a relative encoder into seeks from the playhead', () => {
      const seek = vi.spyOn(h.deckService, 'seek').mockResolvedValue();
      map(ccSource(12), { owner: 'A', control: 'seek' }, style('relative-offset', 0.01));

      h.engine.handle(cc(12, 66));

      expect(seek).toHaveBeenCalledWith('A', 2);
    });

    it('seek keeps every tick of a turn made while a seek is still in flight', async () => {
      let land: () => void = () => undefined;
      const seek = vi
        .spyOn(h.deckService, 'seek')
        .mockReturnValueOnce(new Promise<void>((resolve) => (land = resolve)))
        .mockResolvedValue();
      map(ccSource(12), { owner: 'A', control: 'seek' }, style('relative-offset', 0.01));

      h.engine.handle(cc(12, 66));
      h.engine.handle(cc(12, 66));
      h.engine.handle(cc(12, 65));
      expect(seek).toHaveBeenCalledTimes(1);
      expect(seek).toHaveBeenLastCalledWith('A', 2);

      land();
      await vi.waitFor(() => expect(seek).toHaveBeenCalledTimes(2));

      expect(seek).toHaveBeenLastCalledWith('A', 5);
    });
  });

  describe('step', () => {
    it('moves by its amount of the range on each press edge, up or down', () => {
      map(noteSource(50), SPEED_A, style('step', 0.1));
      map(noteSource(51), SPEED_A, style('step', -0.1));

      h.engine.handle(note(50, 100));
      h.engine.handle(note(50, 100));
      h.engine.handle(note(50, 0));
      expect(speed()).toBeCloseTo(1.1, 10);

      h.engine.handle(note(51, 100));
      expect(speed()).toBeCloseTo(1, 10);
    });

    it('moves a stepped control at least one step, in the sign of the amount', () => {
      map(noteSource(50), KEY_A, style('step', 0.001));
      map(noteSource(51), KEY_A, style('step', -0.001));

      h.engine.handle(note(50, 100));
      h.engine.handle(note(50, 0));
      expect(h.djStore.deckPanel('A')().keySemitones).toBe(1);

      h.engine.handle(note(51, 100));
      h.engine.handle(note(51, 0));
      h.engine.handle(note(51, 100));
      expect(h.djStore.deckPanel('A')().keySemitones).toBe(-1);
    });

    it('stops at the ends of the range', () => {
      map(noteSource(50), SPEED_A, style('step', 0.6));

      h.engine.handle(note(50, 100));

      expect(speed()).toBe(1.5);
    });
  });

  describe('holds', () => {
    beforeEach(() => {
      map(noteSource(60), HOLD_1_A, style('hold'));
      map(noteSource(61, 1, 'other-controller'), HOLD_2_A, style('hold'));
    });

    it('holds while the key is down and lets go on its release edge', () => {
      h.engine.handle(note(60, 100));
      expect(held(0)).toBe(true);

      h.engine.handle(note(60, 0));
      expect(held(0)).toBe(false);
    });

    it('reports a source as holding from its press until its release', () => {
      expect(h.engine.isHolding(noteSource(60))).toBe(false);

      h.engine.handle(note(60, 100));
      expect(h.engine.isHolding(noteSource(60))).toBe(true);
      expect(h.engine.isHolding(noteSource(61, 1, 'other-controller'))).toBe(false);

      h.engine.handle(note(60, 0));
      expect(h.engine.isHolding(noteSource(60))).toBe(false);
    });

    it('lets go when its mapping is removed', () => {
      const id = h.mappingStore.mappingBySource(`${LAUNCH_CONTROL}|1|note|60`)()?.id as string;
      h.engine.handle(note(60, 100));

      h.mappings.remove(id);

      expect(held(0)).toBe(false);
    });

    it('lets go when its source is bound to another control', () => {
      h.engine.handle(note(60, 100));

      h.mappings.bind(noteSource(60), { owner: 'A', control: 'stop' }, style('press'));

      expect(held(0)).toBe(false);
    });

    it('lets go when its mapping is moved to another source, and the new source then holds', () => {
      const id = h.mappingStore.mappingBySource(`${LAUNCH_CONTROL}|1|note|60`)()?.id as string;
      h.engine.handle(note(60, 100));

      h.mappings.replaceSource(id, noteSource(70), style('hold'));
      expect(held(0)).toBe(false);

      h.engine.handle(note(60, 0));
      h.engine.handle(note(70, 100));
      expect(held(0)).toBe(true);
    });

    it('releaseHolds lets go of every hold', () => {
      h.engine.handle(note(60, 100));
      h.engine.handle(note(61, 100, 1, 'other-controller'));
      expect(held(0) && held(1)).toBe(true);

      h.engine.releaseHolds();

      expect(held(0)).toBe(false);
      expect(held(1)).toBe(false);
    });

    it("releaseHolds with a controller lets go of only that controller's holds", () => {
      h.engine.handle(note(60, 100));
      h.engine.handle(note(61, 100, 1, 'other-controller'));

      h.engine.releaseHolds('other-controller');

      expect(held(0)).toBe(true);
      expect(held(1)).toBe(false);
    });

    it('holds again on the next press after a release, even with the key still down', () => {
      h.engine.handle(note(60, 100));
      h.engine.releaseHolds(LAUNCH_CONTROL);

      h.engine.handle(note(60, 0));
      h.engine.handle(note(60, 100));

      expect(held(0)).toBe(true);
    });

    it('lets go when the page is hidden', () => {
      h.engine.handle(note(60, 100));
      h.engine.handle(note(61, 100, 1, 'other-controller'));

      window.dispatchEvent(new Event('pagehide'));

      expect(held(0)).toBe(false);
      expect(held(1)).toBe(false);
    });

    describe('a nudge hold', () => {
      beforeEach(() => {
        map(noteSource(70), NUDGE_UP_A, style('hold', 0.1));
      });

      it('plays at the fader plus the mapping amount while the key is down, and releases to the fader', () => {
        h.engine.handle(note(70, 100));
        expect(speed()).toBeCloseTo(1.1, 10);

        h.engine.handle(note(70, 0));
        expect(speed()).toBe(1);
      });

      it.each([
        ['the controller is lost', () => h.engine.releaseHolds(LAUNCH_CONTROL)],
        ['the page is hidden', () => window.dispatchEvent(new Event('pagehide'))],
        ['its mapping is removed', () => h.mappings.remove(nudgeId())],
      ])('lets go when %s', (_when, release) => {
        h.engine.handle(note(70, 100));
        expect(speed()).toBeCloseTo(1.1, 10);

        release();

        expect(speed()).toBe(1);
      });

      function nudgeId(): string {
        return h.mappingStore.mappingBySource(`${LAUNCH_CONTROL}|1|note|70`)()?.id as string;
      }
    });

    it('lets go of a hold even when the deck stopped being shapeable under the key', () => {
      h.engine.handle(note(60, 100));
      h.djStore.setDeckStatus({ slot: 'A', status: 'loading' });

      h.engine.handle(note(60, 0));

      expect(held(0)).toBe(false);
    });
  });
});
