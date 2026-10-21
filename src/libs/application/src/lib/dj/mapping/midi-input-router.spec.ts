import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MidiSettingsRecord } from '../ports';
import type { ControlIdentity } from './mapping.models';
import {
  LAUNCH_CONTROL,
  ccSource,
  setUpMappingHarness,
  type MappingHarness,
} from './testing/mapping-harness';

const NAME = 'Launch Control XL';
const PLAY_A: ControlIdentity = { owner: 'A', control: 'play-pause' };

const saved = (listening = true): MidiSettingsRecord => ({
  controllers: [{ id: LAUNCH_CONTROL, name: NAME, lastPortId: 'port-1', listening }],
  mappings: [
    {
      id: 'level',
      source: ccSource(7),
      owner: 'A',
      control: 'level',
      style: { kind: 'absolute', amount: null },
    },
  ],
  deckBindings: [],
});

describe('MidiInputRouter', () => {
  let h: MappingHarness;

  async function settle(): Promise<void> {
    for (let pass = 0; pass < 4; pass++) {
      TestBed.flushEffects();
      await vi.advanceTimersByTimeAsync(0);
    }
  }

  async function start(settings: MidiSettingsRecord = saved()): Promise<void> {
    TestBed.resetTestingModule();
    h = setUpMappingHarness(settings);
    h.makeShapeable('A');
    h.midiInput.plug('port-1', NAME);
    h.midiInput.plug('port-2', 'Stranger');
    await h.controllers.hydrate();
    h.router.start();
    await settle();
  }

  const level = () => h.djStore.deckMix('A')().level;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('subscribes to the input once however often it is started', async () => {
    await start();

    h.router.start();
    h.router.start();

    expect(h.midiInput.subscriberCount).toBe(1);
  });

  it('hands a mapped controller\'s messages to the engine', async () => {
    await start();

    h.midiInput.emit('port-1', 'cc', 7, 0);

    expect(level()).toBe(0);
  });

  it('keeps the channel and number apart: only the mapped source drives the control', async () => {
    await start();

    h.midiInput.emit('port-1', 'cc', 7, 0, 2);
    h.midiInput.emit('port-1', 'cc', 8, 0);

    expect(level()).toBe(1);
  });

  it('drops a message from a port no controller owns', async () => {
    await start();
    const handle = vi.spyOn(h.engine, 'handle');

    h.midiInput.emit('port-2', 'cc', 7, 0);
    h.midiInput.emit('unlisted', 'cc', 7, 0);

    expect(handle).not.toHaveBeenCalled();
    expect(level()).toBe(1);
  });

  it('keeps a controller silent while its listening is off, though mapping mode holds its port', async () => {
    await start(saved(false));
    await h.controllers.setMappingMode(true);
    await settle();
    expect(h.midiInput.isOpen('port-1')).toBe(true);

    h.midiInput.emit('port-1', 'cc', 7, 0);

    expect(level()).toBe(1);
  });

  it('gives learn the message first, so a captured message never reaches the engine', async () => {
    await start();
    await h.controllers.setMappingMode(true);
    const handle = vi.spyOn(h.engine, 'handle');
    h.learn.select(PLAY_A);

    h.midiInput.emit('port-1', 'cc', 20, 127);

    expect(h.mappingStore.mappings().some((mapping) => mapping.control.control === 'play-pause')).toBe(
      true
    );
    expect(handle).not.toHaveBeenCalled();
  });

  describe('a key-up while learn is capturing', () => {
    const HOLD_1_A: ControlIdentity = { owner: 'A', control: 'voice-1-hold' };
    const held = (): boolean => h.djStore.deck('A')().voices[0].held;
    const holdMappings = () =>
      h.mappingStore.mappings().filter((mapping) => mapping.control.control === 'voice-1-hold');

    async function holdWithCcKey(): Promise<void> {
      await start();
      h.mappings.bind(ccSource(30), HOLD_1_A, { kind: 'hold', amount: null });
      await h.controllers.setMappingMode(true);
      h.midiInput.emit('port-1', 'cc', 30, 127);
      expect(held()).toBe(true);
    }

    it('ends the hold it belongs to, though learn is waiting on that same control', async () => {
      await holdWithCcKey();
      h.learn.select(HOLD_1_A);

      h.midiInput.emit('port-1', 'cc', 30, 0);

      expect(held()).toBe(false);
      expect(holdMappings()).toHaveLength(1);
      expect(h.mappingStore.learn()?.phase).toBe('waiting');
    });

    it('ends the hold without taking the key for the control learn is waiting on', async () => {
      await holdWithCcKey();
      h.learn.select(PLAY_A);

      h.midiInput.emit('port-1', 'cc', 30, 0);

      expect(held()).toBe(false);
      expect(holdMappings()).toHaveLength(1);
      expect(h.mappingStore.learn()?.control).toEqual(PLAY_A);
    });

    it('is still captured by learn when no hold is in progress', async () => {
      await start();
      await h.controllers.setMappingMode(true);
      h.learn.select(PLAY_A);

      h.midiInput.emit('port-1', 'cc', 20, 0);

      expect(
        h.mappingStore.mappings().some((mapping) => mapping.control.control === 'play-pause')
      ).toBe(true);
    });
  });

  it('stops delivering once the service is destroyed', async () => {
    await start();

    TestBed.resetTestingModule();

    expect(h.midiInput.subscriberCount).toBe(0);
  });
});
