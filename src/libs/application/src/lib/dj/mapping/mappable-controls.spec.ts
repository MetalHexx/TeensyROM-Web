import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { frames } from '@sidablist/core';
import type { MappableControl } from './mappable-controls';
import { logWarn } from '@teensyrom-nx/utils';
import { DeckRuntime } from '../deck-runtime';
import { EMPTY_DECK_LOOPS } from '../dj-store';
import {
  DECK_CONTROL_IDS,
  SET_CONTROL_IDS,
  VOICE_NUMBERS,
  VOICE_STRIP_CONTROLS,
  controlKey,
  type ControlId,
  type ControlOwner,
} from './mapping.models';
import { setUpMappingHarness, type MappingHarness } from './testing/mapping-harness';

vi.mock('@teensyrom-nx/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@teensyrom-nx/utils')>();
  return { ...actual, logWarn: vi.fn(actual.logWarn) };
});

/** Lets every pending promise callback run. */
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

function deferred() {
  let resolve!: () => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('MappableControls', () => {
  let h: MappingHarness;

  beforeEach(() => {
    TestBed.resetTestingModule();
    h = setUpMappingHarness();
  });

  function pick<N extends MappableControl['nature']>(
    owner: ControlOwner,
    id: ControlId,
    nature: N
  ): Extract<MappableControl, { nature: N }> {
    const control = h.controls.find({ owner, control: id });
    if (control === null || control.nature !== nature) {
      throw new Error(`${owner}:${id} is not a ${nature} control`);
    }
    return control as Extract<MappableControl, { nature: N }>;
  }

  describe('the list', () => {
    it('holds 93 controls per deck and 3 for the set, 189 in all, each deck carrying the whole list', () => {
      expect(h.controls.all).toHaveLength(189);
      expect(new Set(h.controls.all.map((c) => controlKey(c.identity))).size).toBe(189);

      for (const owner of ['A', 'B'] as const) {
        const ids = h.controls.all
          .filter((c) => c.identity.owner === owner)
          .map((c) => c.identity.control);
        expect(ids).toHaveLength(93);
        expect([...ids].sort()).toEqual([...DECK_CONTROL_IDS].sort());
      }
    });

    it('gives every voice every panel control and none of the removed names', () => {
      const ids = new Set(
        h.controls.all.filter((c) => c.identity.owner === 'A').map((c) => c.identity.control)
      );

      for (const n of VOICE_NUMBERS) {
        for (const control of VOICE_STRIP_CONTROLS) {
          expect(ids.has(`voice-${n}-${control}` as ControlId)).toBe(true);
        }
      }
      for (const removed of ['level', 'cutoff', 'resonance', 'pulse-width', 'crossfader']) {
        expect(ids.has(removed as ControlId)).toBe(false);
      }
    });

    it('finds a control by identity and nothing for an owner that does not carry it', () => {
      expect(h.controls.find({ owner: 'B', control: 'speed' })?.name).toBe('Speed');
      expect(h.controls.find({ owner: 'mixer', control: 'speed' })).toBeNull();
    });
  });

  describe('value controls', () => {
    it('key reads and sets the deck key through the mixer', () => {
      h.makeShapeable('A');
      const key = pick('A', 'key', 'value');

      key.set(4);

      expect(h.djStore.deckPanel('A')().keySemitones).toBe(4);
      expect(key.read()).toBe(4);
      expect(h.djStore.deckPanel('B')().keySemitones).toBe(0);
    });

    it('key keeps the mixer command gate: a deck with nothing loaded refuses', () => {
      const key = pick('A', 'key', 'value');

      key.set(4);

      expect(h.djStore.deckPanel('A')().keySemitones).toBe(0);
    });

    it('speed sets the engine tempo and reads it back clamped to the fader travel', () => {
      h.makeShapeable('A');
      const speed = pick('A', 'speed', 'value');

      speed.set(1.25);
      expect(h.djStore.deck('A')().speed).toBe(1.25);
      expect(speed.read()).toBe(1.25);

      h.deckService.jumpSpeed('A', 'up');
      expect(h.djStore.deck('A')().speed).toBeGreaterThan(1.5);
      expect(speed.read()).toBe(1.5);
    });

    it('speed reads the fader, not the nudged tempo', () => {
      h.makeShapeable('A');
      const speed = pick('A', 'speed', 'value');
      speed.set(1.2);

      h.deckService.setNudge('A', 'up', true, 0.1);

      expect(h.djStore.deck('A')().speed).toBeCloseTo(1.3, 10);
      expect(speed.read()).toBe(1.2);
    });

    it("seek reads the engine's live playhead as a percentage, not the store's last sample", () => {
      h.djStore.setDeckStructure({
        slot: 'A',
        structure: { loopStartFrame: null, loopPeriodFrames: null, endedAtFrame: null },
        lengthFrames: 200,
      });
      h.djStore.samplePosition({ slot: 'A', positionFrames: 10 });
      vi.spyOn(TestBed.inject(DeckRuntime), 'position').mockReturnValue(frames(50));

      expect(pick('A', 'seek', 'value').read()).toBe(25);
    });

    it("seek carries its deck's hand, and no other control carries one", () => {
      const withHand = h.controls.all
        .filter((control) => control.nature === 'value' && control.hand !== undefined)
        .map((control) => controlKey(control.identity));

      expect(withHand).toEqual(['A:seek', 'B:seek']);
      expect(pick('A', 'seek', 'value').hand).not.toBe(pick('B', 'seek', 'value').hand);
    });

    it('declares each value control with its range, home, step and CC defaults', () => {
      const key = pick('A', 'key', 'value');
      expect([key.min, key.max, key.home, key.step]).toEqual([-12, 12, 0, 1]);
      expect(key.defaults).toEqual({
        ccStyle: 'relative-offset',
        sensitivity: 1 / 24,
        stepAmount: 1 / 24,
      });

      const seek = pick('B', 'seek', 'value');
      expect([seek.min, seek.max, seek.home]).toEqual([0, 100, 0]);
    });
  });

  describe('seek coalescing', () => {
    it('keeps only the latest request while one is in flight, and issues it when that one settles', async () => {
      const inFlight = deferred();
      const seekSpy = vi
        .spyOn(h.deckService, 'seek')
        .mockReturnValueOnce(inFlight.promise)
        .mockResolvedValue();
      const seek = pick('A', 'seek', 'value');

      seek.set(10);
      seek.set(20);
      seek.set(30);
      expect(seekSpy).toHaveBeenCalledTimes(1);
      expect(seekSpy).toHaveBeenLastCalledWith('A', 10);

      inFlight.resolve();
      await vi.waitFor(() => expect(seekSpy).toHaveBeenCalledTimes(2));

      expect(seekSpy).toHaveBeenLastCalledWith('A', 30);
    });

    it('issues nothing more when the latest request equals the one that settled', async () => {
      const inFlight = deferred();
      const seekSpy = vi
        .spyOn(h.deckService, 'seek')
        .mockReturnValueOnce(inFlight.promise)
        .mockResolvedValue();
      const seek = pick('A', 'seek', 'value');

      seek.set(10);
      seek.set(20);
      seek.set(10);
      inFlight.resolve();
      await flush();

      expect(seekSpy).toHaveBeenCalledTimes(1);
    });

    it('coalesces each deck on its own', () => {
      const seekSpy = vi.spyOn(h.deckService, 'seek').mockReturnValue(deferred().promise);

      pick('A', 'seek', 'value').set(10);
      pick('B', 'seek', 'value').set(20);

      expect(seekSpy).toHaveBeenCalledTimes(2);
    });

    it('seeks again after a seek that failed', async () => {
      const failing = deferred();
      const seekSpy = vi
        .spyOn(h.deckService, 'seek')
        .mockReturnValueOnce(failing.promise)
        .mockResolvedValue();
      const seek = pick('A', 'seek', 'value');

      seek.set(10);
      failing.reject(new Error('replay failed'));
      await flush();
      expect(vi.mocked(logWarn)).toHaveBeenCalled();

      seek.set(40);

      expect(seekSpy).toHaveBeenCalledTimes(2);
      expect(seekSpy).toHaveBeenLastCalledWith('A', 40);
    });
  });

  describe('state, hold and trigger controls', () => {
    it.each([0, 1, 2])('voice %i mute reads and sets that voice only', (voice) => {
      h.makeShapeable('B');
      const mute = pick('B', `voice-${voice + 1}-mute` as ControlId, 'state');

      mute.set(true);

      expect(
        h.djStore
          .deck('B')()
          .voices.map((v) => v.muted)
      ).toEqual([0, 1, 2].map((i) => i === voice));
      expect(mute.read()).toBe(true);
    });

    it.each([0, 1, 2])('voice %i hold holds the voice while on and lets go when off', (voice) => {
      h.makeShapeable('A');
      const hold = pick('A', `voice-${voice + 1}-hold` as ControlId, 'hold');

      hold.set(true, null);
      expect(h.djStore.deck('A')().voices[voice].held).toBe(true);

      hold.set(false, null);
      expect(h.djStore.deck('A')().voices[voice].held).toBe(false);
    });

    it.each([
      ['up', 0.05, 1.05],
      ['down', 0.05, 0.95],
    ] as const)(
      'nudge %s holds the speed by the amount and releases to the fader',
      (direction, amount, expected) => {
        h.makeShapeable('A');
        const nudge = pick('A', `speed-nudge-${direction}` as ControlId, 'hold');
        expect(nudge.amountDefault).toBe(0.05);

        nudge.set(true, amount);
        expect(h.djStore.deck('A')().speed).toBeCloseTo(expected, 10);

        nudge.set(false, null);
        expect(h.djStore.deck('A')().speed).toBe(1);
      }
    );

    it('a nudge uses the amount it is given, and the default when given none', () => {
      h.makeShapeable('A');
      const nudge = pick('A', 'speed-nudge-up', 'hold');

      nudge.set(true, 0.2);
      expect(h.djStore.deck('A')().speed).toBeCloseTo(1.2, 10);
      nudge.set(false, null);

      nudge.set(true, null);
      expect(h.djStore.deck('A')().speed).toBeCloseTo(1.05, 10);
    });

    it('a voice hold takes no amount', () => {
      expect(pick('A', 'voice-1-hold', 'hold').amountDefault).toBeNull();
    });

    it.each([
      ['play-pause', 'togglePlayPause', []],
      ['stop', 'stop', []],
      ['subtune-previous', 'previousSubtune', []],
      ['subtune-next', 'nextSubtune', []],
      ['set-previous', 'previousRow', []],
      ['set-next', 'nextRow', []],
      ['speed-jump-up', 'jumpSpeed', ['up']],
      ['speed-jump-home', 'jumpSpeed', ['home']],
      ['speed-jump-down', 'jumpSpeed', ['down']],
    ] as const)('%s fires deckService.%s for its own deck', (id, command, extra) => {
      const spy = vi.spyOn(h.deckService, command).mockImplementation(() => undefined as never);

      pick('B', id, 'trigger').fire();

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('B', ...extra);
    });
  });

  describe('live loop and slip', () => {
    /** 24 play calls a beat: twelve sizes, ⅛ beat up to 128 beats; 4 beats is index 6. */
    const GRID = {
      beatFrames: 24,
      beatOneFrame: 0,
      startFrame: 0,
      endFrame: null,
      source: 'scan',
    } as const;

    const seedGrid = (): void => h.djStore.setDeckBeatGrid({ slot: 'A', beatGrid: GRID });
    const setRunning = (running: boolean): void =>
      h.djStore.setLiveLoop({
        slot: 'A',
        live: running ? { startFrame: 0, endFrame: 96, pendingEndFrame: null } : null,
      });

    describe('live-loop', () => {
      it('offers hold beside the state styles, latch first', () => {
        const styles = pick('A', 'live-loop', 'state').styles;

        expect(styles?.[0]).toBe('latch');
        expect(styles).toContain('hold');
      });

      it('reads whether a live loop runs', () => {
        const live = pick('A', 'live-loop', 'state');
        expect(live.read()).toBe(false);

        setRunning(true);

        expect(live.read()).toBe(true);
      });

      it('pushes when idle and ends when running, and does nothing otherwise', () => {
        const toggle = vi.spyOn(h.deckService, 'toggleLiveLoop').mockImplementation(() => undefined);
        const end = vi.spyOn(h.deckService, 'endLiveLoop').mockImplementation(() => undefined);
        const live = pick('A', 'live-loop', 'state');

        live.set(false);
        live.set(true);
        expect(toggle.mock.calls).toEqual([['A']]);
        expect(end).not.toHaveBeenCalled();

        setRunning(true);
        live.set(true);
        live.set(false);
        expect(toggle).toHaveBeenCalledTimes(1);
        expect(end.mock.calls).toEqual([['A']]);
      });
    });

    describe('slip', () => {
      it('reads the deck slip and sets it through the deck service', () => {
        const slip = pick('A', 'slip', 'state');
        const set = vi.spyOn(h.deckService, 'setSlip');

        slip.set(true);

        expect(set).toHaveBeenCalledWith('A', true);
        expect(slip.read()).toBe(true);
        expect(pick('B', 'slip', 'state').read()).toBe(false);
      });
    });

    describe('live-loop-size', () => {
      const size = () => pick('A', 'live-loop-size', 'value');

      it('spans the ladder, with relative and absolute styles', () => {
        expect(size().max).toBe(0);

        seedGrid();

        expect(size().max).toBe(11);
        expect(size().wholeSteps).toBe(true);
        expect(size().styles).toContain('absolute');
      });

      it('reads the current size as its rung index', () => {
        seedGrid();
        expect(size().read()).toBe(6);

        h.deckService.setLiveLoopBeats('A', 8);

        expect(size().read()).toBe(7);
      });

      it('sets the size of the rung it is given, and leaves an unchanged rung alone', () => {
        const set = vi.spyOn(h.deckService, 'setLiveLoopBeats');
        seedGrid();

        size().set(6);
        expect(set).not.toHaveBeenCalled();

        size().set(8);
        expect(set).toHaveBeenCalledTimes(1);
        const [, beats] = set.mock.calls[0];
        expect(h.djStore.deck('A')().liveLoopBeats).toBe(beats);
        expect(size().read()).toBe(8);
      });

      it('does nothing with no ladder', () => {
        const set = vi.spyOn(h.deckService, 'setLiveLoopBeats');

        size().set(0);

        expect(set).not.toHaveBeenCalled();
      });
    });

    it.each([
      ['live-loop-halve', 'halve'],
      ['live-loop-double', 'double'],
    ] as const)('%s steps the size %s for its own deck', (id, direction) => {
      const step = vi.spyOn(h.deckService, 'stepLiveLoopSize').mockImplementation(() => undefined);

      pick('B', id, 'trigger').fire();

      expect(step).toHaveBeenCalledWith('B', direction);
    });
  });

  describe('loop controls', () => {
    it.each([
      ['loop-toggle', 'toggleMarker', []],
      ['loop-play-now', 'playMarkerNow', []],
      ['loop-global', 'toggleMarkerGlobal', []],
      ['loop-wrap', 'toggleMarkerWrap', []],
      ['loop-add', 'addMarker', []],
      ['loop-duplicate', 'duplicateMarker', []],
      ['loop-stop', 'stopMarkerLoop', []],
      ['loop-in', 'setMarkerIn', []],
      ['loop-set-end', 'setMarkerOut', []],
      ['loop-clear-end', 'clearMarkerEnd', []],
      ['loop-move-earlier', 'moveMarker', [-1]],
      ['loop-move-later', 'moveMarker', [1]],
      ['loop-start-snap-previous', 'moveMarkerEdge', ['start', -1]],
      ['loop-start-snap-next', 'moveMarkerEdge', ['start', 1]],
      ['loop-end-snap-previous', 'moveMarkerEdge', ['end', -1]],
      ['loop-end-snap-next', 'moveMarkerEdge', ['end', 1]],
    ] as const)('%s fires deckService.%s for its own deck', (id, command, extra) => {
      const spy = vi
        .spyOn(h.deckService, command)
        .mockImplementation(() => Promise.resolve() as never);

      pick('B', id, 'trigger').fire();

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('B', ...extra);
    });

    it('loop-toggle logs a rejected toggle instead of leaving it unhandled', async () => {
      vi.spyOn(h.deckService, 'toggleMarker').mockRejectedValue(new Error('boom'));
      vi.mocked(logWarn).mockClear();

      pick('A', 'loop-toggle', 'trigger').fire();
      await flush();

      expect(vi.mocked(logWarn)).toHaveBeenCalledWith(expect.stringContaining('boom'));
    });

    describe('loop-length', () => {
      /** 24 play calls a beat: the ladder runs 1/12 (2 frames), then ⅛ to 128 beats, twelve sizes. */
      const GRID = {
        beatFrames: 24,
        beatOneFrame: 0,
        startFrame: 0,
        endFrame: null,
        source: 'scan',
      } as const;

      function seedMarker(end: number | null): void {
        h.djStore.setDeckBeatGrid({ slot: 'A', beatGrid: GRID });
        h.djStore.setDeckLoops({
          slot: 'A',
          loops: {
            ...EMPTY_DECK_LOOPS,
            markers: [
              {
                id: 'm',
                name: null,
                start: { frame: 240, offsetFrames: 0 },
                end: end === null ? null : { frame: 240 + end, offsetFrames: 0 },
                voices: [],
                settings: null,
                ownSettings: false,
                wraps: false,
                ready: true,
              },
            ],
            selectedId: 'm',
          },
        });
      }
      const length = () => pick('A', 'loop-length', 'value');

      it('counts the ladder sizes of the deck grid, none with no grid', () => {
        expect(length().max).toBe(0);

        seedMarker(96);

        expect(length().max).toBe(11);
        expect(length().wholeSteps).toBe(true);
      });

      it("reads the size's index, a half index off the ladder, the ends beyond it and the 4-beat index on a cue", () => {
        seedMarker(96);
        expect(length().read()).toBe(6);

        seedMarker(100);
        expect(length().read()).toBe(6.5);

        seedMarker(4000);
        expect(length().read()).toBe(11);

        seedMarker(1);
        expect(length().read()).toBe(0);

        seedMarker(null);
        expect(length().read()).toBe(6);
      });

      it('halves or doubles once for a step either way, whatever the length', () => {
        const resize = vi.spyOn(h.deckService, 'resizeMarker').mockImplementation(() => undefined);
        seedMarker(100);

        length().set(7.5);
        length().set(5.5);
        seedMarker(96);
        length().set(7);
        length().set(5);

        expect(resize.mock.calls).toEqual([
          ['A', 'double'],
          ['A', 'halve'],
          ['A', 'double'],
          ['A', 'halve'],
        ]);
      });

      it('does nothing for a turn past either end', () => {
        const resize = vi.spyOn(h.deckService, 'resizeMarker').mockImplementation(() => undefined);
        seedMarker(4000);
        length().set(11);
        seedMarker(1);
        length().set(0);

        expect(resize).not.toHaveBeenCalled();
      });

      describe('a message carrying several ticks', () => {
        /** A resize that lands, so each click changes the marker: double or halve its length. */
        function landingResize() {
          return vi.spyOn(h.deckService, 'resizeMarker').mockImplementation((_slot, direction) => {
            const marker = h.djStore.loops().A.markers[0];
            const frames = (marker.end?.frame ?? 0) - marker.start.frame;
            seedMarker(direction === 'double' ? frames * 2 : frames / 2);
          });
        }
        const endFrame = () => h.djStore.loops().A.markers[0].end?.frame;

        it('halves or doubles once per tick', () => {
          const resize = landingResize();
          seedMarker(96);

          length().set(9);
          expect(endFrame()).toBe(240 + 768);

          length().set(7);
          expect(endFrame()).toBe(240 + 192);
          expect(resize.mock.calls.map(([, direction]) => direction)).toEqual([
            'double',
            'double',
            'double',
            'halve',
            'halve',
          ]);
        });

        it('takes a half place, off the ladder or clamped at an end, as one click', () => {
          const resize = landingResize();
          seedMarker(100); // 6.5
          length().set(8.5);
          expect(resize).toHaveBeenCalledTimes(2);

          resize.mockClear();
          seedMarker(1000); // 9.5: a turn of five clamps to 11, a place and a half
          length().set(11);
          expect(resize).toHaveBeenCalledTimes(2);
        });

        it('stops after a resize that changes nothing', () => {
          const resize = vi.spyOn(h.deckService, 'resizeMarker').mockImplementation(() => undefined);
          seedMarker(96);

          length().set(9);

          expect(resize).toHaveBeenCalledTimes(1);
        });
      });
    });

    describe('loop-move-step', () => {
      const step = () => pick('A', 'loop-move-step', 'value');

      it('counts the six steps, the frame first, and reads the deck step', () => {
        expect(step().max).toBe(5);
        expect(step().read()).toBe(1);

        h.makeShapeable('A');
        h.deckService.setMoveStep('A', 8);

        expect(step().read()).toBe(4);
        expect(step().wholeSteps).toBe(true);
      });

      it('sets the step an index names through the deck service', () => {
        h.makeShapeable('A');

        step().set(3);
        expect(h.djStore.deck('A')().moveStepBeats).toBe(4);
        expect(h.djStore.deck('B')().moveStepBeats).toBe(1);

        step().set(0);
        expect(h.djStore.deck('A')().moveStepBeats).toBe('frame');
      });
    });

    describe('loop-select', () => {
      it('counts its range from the markers and reads the selected index, 0 when none', () => {
        const select = pick('A', 'loop-select', 'value');
        expect(select.max).toBe(0);

        h.seedMarkers('A', 4, 2);
        expect(select.max).toBe(3);
        expect(select.read()).toBe(2);

        h.seedMarkers('A', 4, null);
        expect(select.read()).toBe(0);
        expect(pick('B', 'loop-select', 'value').max).toBe(0);
      });

      it('selects the marker at an index through the deck service', () => {
        h.makeShapeable('A');
        h.seedMarkers('A', 4, 0);

        pick('A', 'loop-select', 'value').set(3);

        expect(h.djStore.deckLoops('A')().selectedId).toBe('marker-3');
      });

      it('offers only the relative and step styles and moves whole steps', () => {
        const select = pick('A', 'loop-select', 'value');

        expect(select.styles).toEqual([
          'relative-offset',
          'relative-signed',
          'step',
          'step-release',
        ]);
        expect(select.wholeSteps).toBe(true);
        expect(select.defaults).toEqual({
          ccStyle: 'relative-offset',
          sensitivity: 1,
          stepAmount: 1,
        });
      });
    });
  });

  describe('set controls', () => {
    const select = () => pick('set', 'set-select', 'value');

    it('belong to the set, once each, and are not on a deck', () => {
      const owned = h.controls.all
        .filter((c) => c.identity.owner === 'set')
        .map((c) => c.identity.control);

      expect(owned).toEqual([...SET_CONTROL_IDS]);
      expect(h.controls.find({ owner: 'A', control: 'set-select' })).toBeNull();
    });

    it('select counts its range from the real rows and reads the selected index, 0 when none', () => {
      expect(select().max).toBe(0);

      h.seedSetRows(4, 2);
      expect(select().max).toBe(3);
      expect(select().read()).toBe(2);

      h.seedSetRows(4, null);
      expect(select().read()).toBe(0);
    });

    it('select counts only real rows, so a row still fetching never lengthens the range', () => {
      h.seedSetRows(3, 1);
      h.djStore.setPendingRows({
        rows: [{ key: 'p1', setId: 'set-1', index: 1, title: 'Fetching', author: '' }],
      });

      expect(select().max).toBe(2);
      expect(select().read()).toBe(1);
    });

    it('select moves the selection through the set and offers whole steps only', () => {
      h.seedSetRows(4, 0);

      select().set(3);

      expect(h.djStore.sets.selectedRowId()).toBe('row-3');
      expect(select().wholeSteps).toBe(true);
      expect(select().styles).toEqual([
        'relative-offset',
        'relative-signed',
        'step',
        'step-release',
      ]);
    });

    it.each([
      ['set-load-a', 'A'],
      ['set-load-b', 'B'],
    ] as const)('%s loads the selected row onto deck %s', (id, slot) => {
      const spy = vi.spyOn(h.deckService, 'loadSelected').mockResolvedValue();

      pick('set', id, 'trigger').fire();

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(slot);
    });
  });

  describe('panel controls', () => {
    beforeEach(() => h.makeShapeable('A'));

    const voiceOf = (voice: number) => h.djStore.deckPanel('A')().voices[voice];

    it.each([
      ['coarse', 'coarse', 5],
      ['fine', 'fine', 12.5],
      ['pulse-width', 'pulseWidth', 300],
      ['attack', 'attack', 3],
      ['decay', 'decay', -4],
      ['sustain', 'sustain', 6],
      ['release', 'release', -2],
    ] as const)('voice knob %s sets and reads its own voice only', (id, field, offset) => {
      for (const n of VOICE_NUMBERS) {
        const knob = pick('A', `voice-${n}-${id}` as ControlId, 'value');
        knob.set(offset);

        expect(voiceOf(n - 1)[field]).toBe(offset);
        expect(knob.read()).toBe(offset);
        VOICE_NUMBERS.filter((other) => other > n).forEach((other) =>
          expect(voiceOf(other - 1)[field]).toBe(0)
        );
      }
    });

    it('declares each knob with the panel range and its CC defaults', () => {
      const coarse = pick('A', 'voice-2-coarse', 'value');
      expect([coarse.min, coarse.max, coarse.home, coarse.step]).toEqual([-96, 96, 0, 1]);
      expect(coarse.defaults).toEqual({
        ccStyle: 'relative-offset',
        sensitivity: 1 / 192,
        stepAmount: 1 / 192,
      });
      expect(pick('A', 'voice-1-fine', 'value').defaults.sensitivity).toBe(0.01);
      expect(pick('A', 'voice-3-attack', 'value').defaults.sensitivity).toBe(1 / 30);
      expect(pick('B', 'filter-cutoff', 'value').defaults.sensitivity).toBe(0.005);
      expect(pick('B', 'filter-resonance', 'value').defaults.sensitivity).toBe(1 / 30);
    });

    it.each([
      ['wave-triangle', 'triangle'],
      ['wave-sawtooth', 'sawtooth'],
      ['wave-pulse', 'pulse'],
      ['wave-noise', 'noise'],
    ] as const)('%s locks its voice to the waveform and its read follows the lock', (id, kind) => {
      const wave = pick('A', `voice-3-${id}`, 'state');
      expect(wave.read()).toBe(false);

      wave.set(true);
      expect(voiceOf(2).waveformLock).toBe(kind);
      expect(voiceOf(0).waveformLock).toBeNull();
      expect(wave.read()).toBe(true);

      wave.set(false);
      expect(voiceOf(2).waveformLock).toBeNull();
      expect(wave.read()).toBe(false);
    });

    it('a waveform reads off while another waveform holds the lock', () => {
      pick('A', 'voice-1-wave-noise', 'state').set(true);

      expect(pick('A', 'voice-1-wave-pulse', 'state').read()).toBe(false);
    });

    it.each([
      ['ring', 'ringLock'],
      ['sync', 'syncLock'],
      ['filter', 'filterLock'],
    ] as const)('%s locks its voice and its read follows the lock', (id, lock) => {
      const sw = pick('A', `voice-2-${id}`, 'state');
      expect(sw.read()).toBe(false);

      sw.set(true);
      expect(voiceOf(1)[lock]).not.toBeNull();
      expect(voiceOf(0)[lock]).toBeNull();
      expect(sw.read()).toBe(true);

      sw.set(false);
      expect(voiceOf(1)[lock]).toBeNull();
      expect(sw.read()).toBe(false);
    });

    it('filter knobs set and read the deck filter', () => {
      pick('A', 'filter-cutoff', 'value').set(400);
      pick('A', 'filter-resonance', 'value').set(7);

      expect(h.djStore.deckPanel('A')().cutoff).toBe(400);
      expect(pick('A', 'filter-cutoff', 'value').read()).toBe(400);
      expect(pick('A', 'filter-resonance', 'value').read()).toBe(7);
      expect(h.djStore.deckPanel('B')().cutoff).toBe(0);
    });

    it.each([
      ['filter-low-pass', 'low-pass'],
      ['filter-band-pass', 'band-pass'],
      ['filter-high-pass', 'high-pass'],
    ] as const)('%s locks the filter mode and its read follows the lock', (id, mode) => {
      const control = pick('A', id, 'state');

      control.set(true);
      expect(h.djStore.deckPanel('A')().filterModeLock).toBe(mode);
      expect(control.read()).toBe(true);
      expect(pick('A', 'filter-low-pass', 'state').read()).toBe(mode === 'low-pass');

      control.set(false);
      expect(h.djStore.deckPanel('A')().filterModeLock).toBeNull();
    });

    it('panic returns its own deck to home and leaves the other alone', () => {
      h.makeShapeable('B');
      pick('A', 'voice-1-attack', 'value').set(5);
      pick('B', 'voice-1-attack', 'value').set(5);

      pick('A', 'panic', 'trigger').fire();

      expect(voiceOf(0).attack).toBe(0);
      expect(h.djStore.deckPanel('B')().voices[0].attack).toBe(5);
    });

    it('a deck with nothing loaded refuses a panel knob', () => {
      pick('B', 'voice-1-coarse', 'value').set(3);

      expect(h.djStore.deckPanel('B')().voices[0].coarse).toBe(0);
    });
  });
});
