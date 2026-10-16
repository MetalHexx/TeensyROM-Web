import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MidiInputMessage, MidiSettingsRecord } from '../ports';
import type { ControlIdentity } from './mapping.models';
import { guessValueStyle } from './midi-learn';
import {
  LAUNCH_CONTROL,
  ccSource,
  noteSource,
  setUpMappingHarness,
  type MappingHarness,
} from './testing/mapping-harness';

const NAME = 'Launch Control XL';
const PORT = 'port-1';

const PLAY_A: ControlIdentity = { owner: 'A', control: 'play-pause' };
const PLAY_B: ControlIdentity = { owner: 'B', control: 'play-pause' };
const LEVEL_A: ControlIdentity = { owner: 'A', control: 'level' };
const CUTOFF_A: ControlIdentity = { owner: 'A', control: 'cutoff' };

const SAVED_CONTROLLER = { id: LAUNCH_CONTROL, name: NAME, lastPortId: PORT, listening: true };

const SWEEP = [0, 30, 60, 90, 127];
const OFFSET_TURNS = [65, 63, 66, 62, 65];
const SIGNED_TURNS = [1, 127, 2, 126];

describe('MidiLearn', () => {
  let h: MappingHarness;

  async function settle(): Promise<void> {
    for (let pass = 0; pass < 4; pass++) {
      TestBed.flushEffects();
      await vi.advanceTimersByTimeAsync(0);
    }
  }

  /** The app as bootstrap leaves it, with the controller's input plugged in and mapping mode on. */
  async function start(
    saved: Partial<MidiSettingsRecord> = {},
    mappingMode = true
  ): Promise<void> {
    TestBed.resetTestingModule();
    h = setUpMappingHarness({ controllers: [], mappings: [], deckBindings: [], ...saved });
    h.makeShapeable('A');
    h.midiInput.plug(PORT, NAME);
    await h.controllers.hydrate();
    h.router.start();
    if (mappingMode) {
      await h.controllers.setMappingMode(true);
    }
    await settle();
  }

  const send = (kind: 'note' | 'cc', number: number, value: number, channel = 1) =>
    h.midiInput.emit(PORT, kind, number, value, channel);
  const sendAll = (number: number, values: readonly number[]) =>
    values.forEach((value) => send('cc', number, value));

  const learned = () => h.mappingStore.mappings();
  const level = () => h.djStore.deckMix('A')().level;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('selecting', () => {
    it('does nothing while mapping mode is off', async () => {
      await start({}, false);

      h.learn.select(PLAY_A);

      expect(h.mappingStore.learn()).toBeNull();
    });

    it('waits for the first message, and selecting the same control again cancels', async () => {
      await start();

      h.learn.select(PLAY_A);
      expect(h.mappingStore.learn()).toEqual({
        control: PLAY_A,
        phase: 'waiting',
        replacing: null,
        source: null,
      });

      h.learn.select(PLAY_A);
      expect(h.mappingStore.learn()).toBeNull();
    });

    it('moves to another control when a different one is selected', async () => {
      await start();
      h.learn.select(PLAY_A);

      h.learn.select(LEVEL_A);

      expect(h.mappingStore.learn()?.control).toEqual(LEVEL_A);
    });

    it('cancel clears learn and ends a sampling window without binding', async () => {
      await start();
      h.learn.select(LEVEL_A);
      sendAll(7, SWEEP);
      expect(h.mappingStore.learn()?.phase).toBe('sampling');

      h.learn.cancel();
      await vi.advanceTimersByTimeAsync(2000);

      expect(h.mappingStore.learn()).toBeNull();
      expect(learned()).toHaveLength(0);
    });
  });

  describe('binding a press or a CC on a button', () => {
    it('binds the first note press, creating its controller, and announces it', async () => {
      await start();
      h.learn.select(PLAY_A);

      send('note', 36, 100);

      const [mapping] = learned();
      const controllerId = mapping.source.controllerId;
      expect(mapping).toMatchObject({
        source: { channel: 1, kind: 'note', number: 36 },
        control: PLAY_A,
        style: { kind: 'press', amount: null },
      });
      expect(h.mappingStore.controller(controllerId)()).toMatchObject({
        name: NAME,
        lastPortId: PORT,
        listening: true,
      });
      expect(h.mappingStore.learn()).toBeNull();
      expect(h.mappingStore.announcement()).toBe(
        `Play / Pause, deck A, bound to ${NAME} · ch 1 · Note 36`
      );
    });

    it('binds a CC on a trigger at once, without sampling', async () => {
      await start();
      h.learn.select(PLAY_A);

      send('cc', 20, 127, 3);

      expect(learned()).toHaveLength(1);
      expect(learned()[0]).toMatchObject({
        source: { channel: 3, kind: 'cc', number: 20 },
        style: { kind: 'press' },
      });
    });

    it('binds a note on a value control as a step', async () => {
      await start();
      h.learn.select(LEVEL_A);

      send('note', 40, 90);

      expect(learned()[0].style.kind).toBe('step');
    });

    it('reuses the controller a known port belongs to', async () => {
      await start({ controllers: [SAVED_CONTROLLER] });
      h.learn.select(PLAY_A);

      send('note', 36, 100);

      expect(learned()[0].source.controllerId).toBe(LAUNCH_CONTROL);
      expect(h.mappingStore.controllers()).toHaveLength(1);
    });

    it('leaves a note release for the engine, so it can let go of a hold', async () => {
      await start({
        controllers: [SAVED_CONTROLLER],
        mappings: [
          {
            id: 'hold',
            source: noteSource(36),
            owner: 'A',
            control: 'voice-1-hold',
            style: { kind: 'hold', amount: null },
          },
        ],
      });
      const held = () => h.djStore.deck('A')().voices[0].held;
      send('note', 36, 100);
      expect(held()).toBe(true);

      h.learn.select(PLAY_A);
      send('note', 36, 0);

      expect(held()).toBe(false);
      expect(h.mappingStore.learn()?.phase).toBe('waiting');
      expect(learned()).toHaveLength(1);
    });
  });

  describe('sampling a CC on a value control', () => {
    it('keeps sampling for 1.5 s, then proposes absolute for a sweep', async () => {
      await start();
      h.learn.select(LEVEL_A);

      sendAll(7, SWEEP);
      expect(h.mappingStore.learn()).toMatchObject({ phase: 'sampling' });
      expect(h.mappingStore.learn()?.source).toMatchObject({ kind: 'cc', number: 7 });
      expect(learned()).toHaveLength(0);

      await vi.advanceTimersByTimeAsync(1499);
      expect(learned()).toHaveLength(0);
      await vi.advanceTimersByTimeAsync(1);

      expect(learned()[0]).toMatchObject({
        source: { kind: 'cc', number: 7 },
        control: LEVEL_A,
        style: { kind: 'absolute', amount: null },
      });
      expect(h.mappingStore.learn()).toBeNull();
      expect(h.mappingStore.announcement()).toBe(
        `Level, deck A, bound to ${NAME} · ch 1 · CC 7`
      );
    });

    it('proposes relative-offset, at the control sensitivity, for a 64-centred encoder', async () => {
      await start();
      h.learn.select(LEVEL_A);

      sendAll(7, OFFSET_TURNS);
      await vi.advanceTimersByTimeAsync(1500);

      expect(learned()[0].style).toEqual({ kind: 'relative-offset', amount: 0.01 });
    });

    it('proposes relative-signed for a signed-bit encoder', async () => {
      await start();
      h.learn.select(LEVEL_A);

      sendAll(7, SIGNED_TURNS);
      await vi.advanceTimersByTimeAsync(1500);

      expect(learned()[0].style).toEqual({ kind: 'relative-signed', amount: 0.01 });
    });

    it('proposes absolute for a sweep even where the control defaults to relative', async () => {
      await start();
      h.learn.select(CUTOFF_A);

      sendAll(7, SWEEP);
      await vi.advanceTimersByTimeAsync(1500);

      expect(learned()[0].style).toEqual({ kind: 'absolute', amount: null });
    });

    it('falls back to the control default when the samples say nothing', async () => {
      await start();
      h.learn.select(LEVEL_A);
      send('cc', 7, 100);
      await vi.advanceTimersByTimeAsync(1500);
      expect(learned()[0].style).toEqual({ kind: 'absolute', amount: null });

      h.learn.select(CUTOFF_A);
      send('cc', 8, 100);
      await vi.advanceTimersByTimeAsync(1500);
      expect(learned()[1].style).toEqual({ kind: 'relative-offset', amount: 0.01 });
    });

    it('stops at 24 samples without waiting for the window', async () => {
      await start();
      h.learn.select(LEVEL_A);

      sendAll(7, Array.from({ length: 24 }, (_, i) => i * 5));

      expect(learned()).toHaveLength(1);
      expect(learned()[0].style.kind).toBe('absolute');
      expect(h.mappingStore.learn()).toBeNull();
    });

    it('consumes only the sampled source and lets other messages through', async () => {
      await start();
      h.learn.select(LEVEL_A);
      send('cc', 7, 10);
      const message = (number: number, channel = 1): MidiInputMessage => ({
        portId: PORT,
        kind: 'cc',
        channel,
        number,
        value: 20,
        pressed: false,
      });

      expect(h.learn.offer(message(7), NAME)).toBe(true);
      expect(h.learn.offer(message(8), NAME)).toBe(false);
      expect(h.learn.offer(message(7, 2), NAME)).toBe(false);
      expect(h.learn.offer({ ...message(7), portId: 'elsewhere' }, NAME)).toBe(false);
    });

    it('does not bind when mapping mode ends during the window', async () => {
      await start();
      h.learn.select(LEVEL_A);
      sendAll(7, SWEEP);

      await h.controllers.setMappingMode(false);
      await vi.advanceTimersByTimeAsync(2000);

      expect(h.mappingStore.learn()).toBeNull();
      expect(learned()).toHaveLength(0);
    });

    it('does not let a stale window bind after another control was selected', async () => {
      await start();
      h.learn.select(LEVEL_A);
      sendAll(7, SWEEP);

      h.learn.select(CUTOFF_A);
      await vi.advanceTimersByTimeAsync(2000);

      expect(learned()).toHaveLength(0);
      expect(h.mappingStore.learn()).toMatchObject({ control: CUTOFF_A, phase: 'waiting' });
    });
  });

  describe('moving and re-learning', () => {
    it('moves a source that drives another control and announces the move', async () => {
      await start({
        controllers: [SAVED_CONTROLLER],
        mappings: [
          {
            id: 'play-a',
            source: noteSource(36),
            owner: 'A',
            control: 'play-pause',
            style: { kind: 'press', amount: null },
          },
        ],
      });
      h.learn.select(PLAY_B);

      send('note', 36, 100);

      expect(learned()).toHaveLength(1);
      expect(learned()[0].control).toEqual(PLAY_B);
      expect(h.mappingStore.announcement()).toBe(
        `Play / Pause, deck B, bound to ${NAME} · ch 1 · Note 36, moved from Play / Pause, deck A`
      );
    });

    it('re-learn replaces only that mapping\'s source', async () => {
      await start(
        {
          controllers: [SAVED_CONTROLLER],
          mappings: [
            {
              id: 'level',
              source: ccSource(7),
              owner: 'A',
              control: 'level',
              style: { kind: 'absolute', amount: null },
            },
            {
              id: 'cross',
              source: ccSource(8),
              owner: 'mixer',
              control: 'crossfader',
              style: { kind: 'absolute', amount: null },
            },
          ],
        },
        false
      );

      await h.learn.relearn('level');
      expect(h.mappingStore.mappingMode()).toBe(true);
      expect(h.mappingStore.learn()).toMatchObject({ control: LEVEL_A, replacing: 'level' });
      sendAll(9, SWEEP);
      await vi.advanceTimersByTimeAsync(1500);

      expect(learned().map((mapping) => [mapping.id, mapping.source.number])).toEqual(
        expect.arrayContaining([
          ['level', 9],
          ['cross', 8],
        ])
      );
      expect(learned()).toHaveLength(2);
      expect(h.mappingStore.learn()).toBeNull();
      expect(h.mappingStore.announcement()).toBe(`Level, deck A, bound to ${NAME} · ch 1 · CC 9`);
    });

    it('a message from the old source no longer drives the control after a re-learn', async () => {
      await start({
        controllers: [SAVED_CONTROLLER],
        mappings: [
          {
            id: 'level',
            source: ccSource(7),
            owner: 'A',
            control: 'level',
            style: { kind: 'absolute', amount: null },
          },
        ],
      });

      await h.learn.relearn('level');
      sendAll(9, SWEEP);
      await vi.advanceTimersByTimeAsync(1500);
      send('cc', 7, 0);
      expect(level()).toBe(1);
      send('cc', 9, 0);
      expect(level()).toBe(0);
    });
  });
});

describe('guessValueStyle', () => {
  it.each([
    ['both directions of a signed-bit encoder', [1, 127, 2, 126], 'relative-signed'],
    ['signed-bit values at their limits', [15, 113], 'relative-signed'],
    ['six distinct signed-bit values', [1, 2, 3, 127, 126, 125], 'relative-signed'],
    ['signed-bit values with repeats', [1, 1, 1, 127, 127, 1, 127], 'relative-signed'],
    ['both directions of a 64-centred encoder', [63, 65, 63, 66], 'relative-offset'],
    ['64-centred values at their limits', [49, 79], 'relative-offset'],
    ['six distinct 64-centred values', [49, 50, 51, 77, 78, 79], 'relative-offset'],
    ['a sweep', [0, 40, 80, 127], 'absolute'],
    ['four distinct values in no pattern', [10, 10, 20, 30, 40], 'absolute'],
    ['seven distinct signed-bit values, which is too many to be an encoder', [1, 2, 3, 4, 127, 126, 125], 'absolute'],
    ['seven distinct 64-centred values', [49, 50, 51, 52, 77, 78, 79], 'absolute'],
    ['a signed-bit encoder turned up only', [1, 1, 2], 'relative-signed'],
    ['a signed-bit encoder turned down only', [127, 126, 127], 'relative-signed'],
    ['a single signed-bit tick', [1], 'relative-signed'],
    ['a 64-centred encoder turned up only', [65, 66, 65], 'relative-offset'],
    ['a 64-centred encoder turned down only', [63, 62, 63], 'relative-offset'],
    ['a single 64-centred tick', [63], 'relative-offset'],
    ['a signed-bit value just outside the range', [16, 127], null],
    ['a signed-bit value just below the downward range', [1, 112], null],
    ['a 64-centred value just outside the range', [48, 65], null],
    ['a 64-centred value just outside the upper range', [80, 63], null],
    ['64 itself, which an encoder never sends', [64, 65, 63], null],
    ['signed-bit and 64-centred values mixed', [1, 127, 65], null],
    ['three distinct values', [0, 40, 80], null],
    ['one value repeated outside both encoders', [100, 100, 100, 100], null],
    ['no samples', [], null],
  ])('%s', (_label, samples, expected) => {
    expect(guessValueStyle(samples)).toBe(expected);
  });
});
