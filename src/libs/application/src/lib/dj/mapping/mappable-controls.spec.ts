import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MappableControl } from './mappable-controls';
import { logWarn } from '@teensyrom-nx/utils';
import { controlKey, type ControlId, type ControlOwner } from './mapping.models';
import { setUpMappingHarness, type MappingHarness } from './testing/mapping-harness';

vi.mock('@teensyrom-nx/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@teensyrom-nx/utils')>();
  return { ...actual, logWarn: vi.fn(actual.logWarn) };
});

/** The deck controls the server's allow-list accepts. */
const SERVER_DECK_CONTROLS = [
  'play-pause',
  'stop',
  'subtune-previous',
  'subtune-next',
  'seek',
  'speed',
  'speed-jump-up',
  'speed-jump-home',
  'speed-jump-down',
  'repeat',
  'voice-1-mute',
  'voice-2-mute',
  'voice-3-mute',
  'voice-1-hold',
  'voice-2-hold',
  'voice-3-hold',
  'clear-voice-mutes',
  'key',
];

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
    it('holds 36 controls: every deck control for both decks', () => {
      expect(h.controls.all).toHaveLength(36);
      expect(new Set(h.controls.all.map((c) => controlKey(c.identity))).size).toBe(36);

      for (const owner of ['A', 'B'] as const) {
        const ids = h.controls.all
          .filter((c) => c.identity.owner === owner)
          .map((c) => c.identity.control);
        expect(ids.sort()).toEqual([...SERVER_DECK_CONTROLS].sort());
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

    it('seek reads the scrub position as a percentage', () => {
      h.djStore.setDeckStructure({
        slot: 'A',
        structure: { loopStartFrame: null, loopPeriodFrames: null, endedAtFrame: null },
        lengthFrames: 200,
      });
      h.djStore.samplePosition({ slot: 'A', positionFrames: 50 });

      expect(pick('A', 'seek', 'value').read()).toBe(25);
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
    it('repeat reads and sets the deck repeat flag', () => {
      const repeat = pick('A', 'repeat', 'state');
      expect(repeat.read()).toBe(true);

      repeat.set(false);

      expect(h.djStore.deck('A')().repeat).toBe(false);
      expect(repeat.read()).toBe(false);
    });

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

      hold.set(true);
      expect(h.djStore.deck('A')().voices[voice].held).toBe(true);

      hold.set(false);
      expect(h.djStore.deck('A')().voices[voice].held).toBe(false);
    });

    it('clear voice mutes clears every latched mute on its deck', () => {
      h.makeShapeable('A');
      h.deckService.setVoiceMuted('A', 0, true);
      h.deckService.setVoiceMuted('A', 2, true);

      pick('A', 'clear-voice-mutes', 'trigger').fire();

      expect(
        h.djStore
          .deck('A')()
          .voices.some((v) => v.muted)
      ).toBe(false);
    });

    it.each([
      ['play-pause', 'togglePlayPause', []],
      ['stop', 'stop', []],
      ['subtune-previous', 'previousSubtune', []],
      ['subtune-next', 'nextSubtune', []],
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
});
