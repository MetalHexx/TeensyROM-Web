import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import type { KnownControllerRecord, MidiInputOpenResult, MidiSettingsRecord } from '../ports';
import {
  LAUNCH_CONTROL,
  ccSource,
  noteSource,
  setUpMappingHarness,
  type MappingHarness,
} from './testing/mapping-harness';

const NAME = 'Launch Control XL';

const controller = (overrides: Partial<KnownControllerRecord> = {}): KnownControllerRecord => ({
  id: LAUNCH_CONTROL,
  name: NAME,
  lastPortId: 'port-1',
  listening: true,
  ...overrides,
});

const levelMapping = (controllerId = LAUNCH_CONTROL, number = 7) => ({
  id: `level-${controllerId}-${number}`,
  source: ccSource(number, 1, controllerId),
  owner: 'A' as const,
  control: 'level',
  style: { kind: 'absolute' as const, amount: null },
});

const settings = (
  controllers: KnownControllerRecord[],
  mappings: MidiSettingsRecord['mappings'] = controllers.map((known) => levelMapping(known.id))
): MidiSettingsRecord => ({ controllers, mappings, deckBindings: [] });

const MISSING_ALERT = `MIDI controller "${NAME}" is not connected. Its mappings are kept and work again when it returns.`;
const UNAVAILABLE_ALERT = `MIDI controller "${NAME}" could not be opened. Another application, such as a DAW, may be using it. Its mappings are kept; switch its listening off and on to retry.`;
const UNMATCHED_ALERT = `MIDI controller "${NAME}" matches more than one port. Choose its port in the Bindings panel.`;

describe('MidiControllers', () => {
  let h: MappingHarness;

  /** Lets the policy effect run, its opens settle and any run it asks for follow. */
  async function settle(): Promise<void> {
    for (let pass = 0; pass < 4; pass++) {
      TestBed.flushEffects();
      await vi.advanceTimersByTimeAsync(0);
    }
  }

  /** Sets up the harness over `saved` and `ports`, lets `beforeHydrate` arrange the fakes, then
   *  hydrates and settles. */
  async function start(
    saved: MidiSettingsRecord,
    ports: [string, string][] = [],
    beforeHydrate: () => void = () => undefined
  ): Promise<void> {
    TestBed.resetTestingModule();
    h = setUpMappingHarness(saved);
    h.makeShapeable('A');
    for (const [id, name] of ports) {
      h.midiInput.plug(id, name);
    }
    beforeHydrate();
    await h.controllers.hydrate();
    await settle();
  }

  const status = (id = LAUNCH_CONTROL) => h.mappingStore.controllerStatus()[id];
  const savedControllers = async () => {
    await vi.advanceTimersByTimeAsync(300);
    return (h.repository.save.mock.calls.at(-1)?.[0] as MidiSettingsRecord).controllers;
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('which ports are held open', () => {
    it('opens only the ports of controllers that are listening and have mappings', async () => {
      await start(
        settings(
          [
            controller(),
            controller({ id: 'off', name: 'Off pad', lastPortId: 'port-2', listening: false }),
            controller({ id: 'idle', name: 'Idle pad', lastPortId: 'port-3' }),
          ],
          [levelMapping(LAUNCH_CONTROL), levelMapping('off', 7)]
        ),
        [
          ['port-1', NAME],
          ['port-2', 'Off pad'],
          ['port-3', 'Idle pad'],
          ['port-4', 'Stranger'],
        ]
      );

      expect(h.midiInput.openCalls).toEqual(['port-1']);
      expect(status()).toBe('listening');
      expect(status('off')).toBe('off');
      expect(status('idle')).toBe('idle');
    });

    it('opens every input that is not a cartridge while mapping mode is on, and closes the unmapped ones on leaving', async () => {
      await start(settings([controller()]), [
        ['port-1', NAME],
        ['port-2', 'Other pad'],
        ['port-3', 'TeensyROM-12345678'],
      ]);

      await h.controllers.setMappingMode(true);
      await settle();

      expect(h.midiInput.isOpen('port-1')).toBe(true);
      expect(h.midiInput.isOpen('port-2')).toBe(true);
      expect(h.midiInput.isOpen('port-3')).toBe(false);

      await h.controllers.setMappingMode(false);
      await settle();

      expect(h.midiInput.isOpen('port-1')).toBe(true);
      expect(h.midiInput.isOpen('port-2')).toBe(false);
    });

    it('opens a controller plugged in after load, and lets go of a port once its listening is off', async () => {
      await start(settings([controller()]));
      expect(status()).toBe('missing');

      h.midiInput.plug('port-1', NAME);
      await settle();
      expect(h.midiInput.isOpen('port-1')).toBe(true);
      expect(status()).toBe('listening');

      h.controllers.setListening(LAUNCH_CONTROL, false);
      await settle();
      expect(h.midiInput.isOpen('port-1')).toBe(false);
      expect(status()).toBe('off');
      expect(h.mappingStore.mappings()).toHaveLength(1);
    });

    it('asks for MIDI access before mapping mode turns on when it is not granted', async () => {
      await start(settings([controller()]));
      h.accessState.set('idle');

      await h.controllers.setMappingMode(true);

      expect(h.requestAccess).toHaveBeenCalledTimes(1);
      expect(h.mappingStore.mappingMode()).toBe(true);
    });

    it('does not ask for access that is already granted', async () => {
      await start(settings([controller()]));

      await h.controllers.setMappingMode(true);

      expect(h.requestAccess).not.toHaveBeenCalled();
    });

    it('removes the controllers without mappings on leaving mapping mode, and saves', async () => {
      await start(
        settings([controller(), controller({ id: 'stray', name: 'Stray', lastPortId: 'port-2' })], [
          levelMapping(),
        ]),
        [
          ['port-1', NAME],
          ['port-2', 'Stray'],
        ]
      );
      await h.controllers.setMappingMode(true);

      await h.controllers.setMappingMode(false);

      expect(h.mappingStore.controllers().map((known) => known.id)).toEqual([LAUNCH_CONTROL]);
      expect(h.mappingStore.controllerStatus()['stray']).toBeUndefined();
      expect((await savedControllers()).map((known) => known.id)).toEqual([LAUNCH_CONTROL]);
    });
  });

  describe('a controller that cannot be reached', () => {
    it('alerts once when its port cannot be opened, however many times the policy runs, and keeps its mappings', async () => {
      await start(settings([controller()]), [['port-1', NAME]], () =>
        h.midiInput.answer('port-1', 'unavailable')
      );
      await h.controllers.applyPolicy();
      await h.controllers.applyPolicy();
      await settle();

      expect(status()).toBe('unavailable');
      expect(h.alerts.warning).toHaveBeenCalledTimes(1);
      expect(h.alerts.warning).toHaveBeenCalledWith(UNAVAILABLE_ALERT);
      expect(h.mappingStore.mappings()).toHaveLength(1);
    });

    it('returns to listening once the port opens, and alerts again for the next occurrence', async () => {
      await start(settings([controller()]), [['port-1', NAME]], () =>
        h.midiInput.answer('port-1', 'unavailable')
      );
      expect(status()).toBe('unavailable');

      h.midiInput.answer('port-1', 'open');
      h.controllers.setListening(LAUNCH_CONTROL, false);
      await settle();
      h.controllers.setListening(LAUNCH_CONTROL, true);
      await settle();
      expect(status()).toBe('listening');
      expect(h.alerts.warning).toHaveBeenCalledTimes(1);

      h.midiInput.unplug('port-1');
      await settle();
      h.midiInput.answer('port-1', 'unavailable');
      h.midiInput.plug('port-1', NAME);
      await settle();
      expect(status()).toBe('unavailable');
      expect(h.alerts.warning).toHaveBeenCalledTimes(3);
    });

    it('alerts once when it is not connected, across repeated runs, and listens again when it returns', async () => {
      await start(settings([controller()]));
      await h.controllers.applyPolicy();
      await h.controllers.applyPolicy();
      await settle();

      expect(status()).toBe('missing');
      expect(h.alerts.warning).toHaveBeenCalledTimes(1);
      expect(h.alerts.warning).toHaveBeenCalledWith(MISSING_ALERT);
      expect(h.mappingStore.mappings()).toHaveLength(1);

      h.midiInput.plug('port-1', NAME);
      await settle();

      expect(status()).toBe('listening');
      expect(h.alerts.warning).toHaveBeenCalledTimes(1);
    });

    it('waits for MIDI access: nothing is flagged missing or alerted before the inputs are enumerated', async () => {
      await start(settings([controller()]), [], () => h.accessState.set('idle'));

      expect(status()).toBeUndefined();
      expect(h.alerts.warning).not.toHaveBeenCalled();
      expect(h.midiInput.openCalls).toEqual([]);

      h.midiInput.plug('port-1', NAME);
      h.accessState.set('granted');
      await settle();

      expect(status()).toBe('listening');
      expect(h.midiInput.isOpen('port-1')).toBe(true);
      expect(h.alerts.warning).not.toHaveBeenCalled();
    });

    it('alerts once when a plugged controller is pulled out', async () => {
      await start(settings([controller()]), [['port-1', NAME]]);
      expect(h.alerts.warning).not.toHaveBeenCalled();

      h.midiInput.unplug('port-1');
      await settle();
      await h.controllers.applyPolicy();

      expect(status()).toBe('missing');
      expect(h.alerts.warning).toHaveBeenCalledTimes(1);
    });

    it('says nothing for a controller with no mappings or one that is switched off', async () => {
      await start(
        settings(
          [controller({ listening: false }), controller({ id: 'idle', name: 'Idle pad' })],
          [levelMapping(LAUNCH_CONTROL)]
        )
      );

      expect(status()).toBe('off');
      expect(status('idle')).toBe('idle');
      expect(h.alerts.warning).not.toHaveBeenCalled();
    });

    it('discards the result of an open that a newer run has overtaken', async () => {
      let finishOpen: (result: MidiInputOpenResult) => void = () => undefined;
      await start(settings([controller()]), [['port-1', NAME]], () => {
        vi.spyOn(h.midiInput, 'open').mockImplementationOnce(
          () => new Promise<MidiInputOpenResult>((resolve) => (finishOpen = resolve))
        );
      });
      expect(status()).toBeUndefined();

      h.midiInput.unplug('port-1');
      TestBed.flushEffects();
      finishOpen('unavailable');
      await settle();

      expect(status()).toBe('missing');
      expect(h.alerts.warning).toHaveBeenCalledTimes(1);
      expect(h.alerts.warning).toHaveBeenCalledWith(MISSING_ALERT);
    });
  });

  describe('finding a saved controller again', () => {
    it('finds it by its port id', async () => {
      await start(settings([controller({ lastPortId: 'port-9' })]), [
        ['port-9', 'Renamed by the OS'],
      ]);

      expect(status()).toBe('listening');
      expect(h.controllers.controllerForPort('port-9')).toBe(LAUNCH_CONTROL);
    });

    it('finds it by its unique name after its port id changes, and settles after one extra run', async () => {
      let upserts!: MockInstance;
      await start(settings([controller()]), [['port-new', NAME]], () => {
        upserts = vi.spyOn(h.mappingStore, 'upsertController');
      });

      expect(status()).toBe('listening');
      expect(h.mappingStore.controller(LAUNCH_CONTROL)()?.lastPortId).toBe('port-new');
      expect(upserts).toHaveBeenCalledTimes(1);
      expect((await savedControllers())[0].lastPortId).toBe('port-new');

      const saves = h.repository.save.mock.calls.length;
      await h.controllers.applyPolicy();
      await settle();
      await vi.advanceTimersByTimeAsync(1000);

      expect(upserts).toHaveBeenCalledTimes(1);
      expect(h.repository.save.mock.calls.length).toBe(saves);
    });

    it('marks it unmatched when two inputs carry its name, alerts once, then pointAt brings its mappings back', async () => {
      await start(settings([controller({ lastPortId: 'port-old' })]), [
        ['port-a', NAME],
        ['port-b', NAME],
      ]);
      await h.controllers.applyPolicy();

      expect(status()).toBe('unmatched');
      expect(h.midiInput.openCalls).toEqual([]);
      expect(h.alerts.warning).toHaveBeenCalledTimes(1);
      expect(h.alerts.warning).toHaveBeenCalledWith(UNMATCHED_ALERT);
      expect(h.mappingStore.mappings()).toHaveLength(1);

      h.controllers.pointAt(LAUNCH_CONTROL, 'port-b');
      await settle();

      expect(status()).toBe('listening');
      expect(h.controllers.controllerForPort('port-b')).toBe(LAUNCH_CONTROL);
      expect(h.midiInput.isOpen('port-b')).toBe(true);
      expect(h.midiInput.isOpen('port-a')).toBe(false);
      expect((await savedControllers())[0].lastPortId).toBe('port-b');
      expect(h.alerts.warning).toHaveBeenCalledTimes(1);
    });

    it('gives one port to one controller when two share a name and one is found by id', async () => {
      await start(
        settings([
          controller({ lastPortId: 'port-a' }),
          controller({ id: 'twin', lastPortId: 'port-gone' }),
        ]),
        [
          ['port-a', NAME],
          ['port-b', NAME],
        ]
      );

      expect(h.controllers.controllerForPort('port-a')).toBe(LAUNCH_CONTROL);
      expect(h.controllers.controllerForPort('port-b')).toBe('twin');
    });

    it('ignores an input that is not connected', async () => {
      await start(settings([controller()]));
      h.midiInput.inputs.set([
        { id: 'port-1', name: NAME, manufacturer: 'Test', connected: false },
      ]);
      await settle();

      expect(status()).toBe('missing');
      expect(h.midiInput.openCalls).toEqual([]);
    });
  });

  describe('holds', () => {
    async function pressHold(): Promise<void> {
      h.router.start();
      h.midiInput.emit('port-1', 'note', 36, 100);
    }

    const held = () => h.djStore.deck('A')().voices[0].held;

    function holdSettings(): MidiSettingsRecord {
      return settings(
        [controller()],
        [
          {
            id: 'hold',
            source: noteSource(36),
            owner: 'A',
            control: 'voice-1-hold',
            style: { kind: 'hold', amount: null },
          },
        ]
      );
    }

    it('lets go of a hold when its controller is lost', async () => {
      await start(holdSettings(), [['port-1', NAME]]);
      await pressHold();
      expect(held()).toBe(true);

      h.midiInput.unplug('port-1');
      await settle();

      expect(held()).toBe(false);
    });

    it('lets go of a hold when its listening is switched off', async () => {
      await start(holdSettings(), [['port-1', NAME]]);
      await pressHold();
      expect(held()).toBe(true);

      h.controllers.setListening(LAUNCH_CONTROL, false);
      await settle();

      expect(held()).toBe(false);
    });
  });

  describe('ensureController', () => {
    it('returns the controller already resolved to the port', async () => {
      await start(settings([controller()]), [['port-1', NAME]]);

      expect(h.controllers.ensureController('port-1', NAME)).toBe(LAUNCH_CONTROL);
      expect(h.mappingStore.controllers()).toHaveLength(1);
    });

    it('points a missing controller of the same name at the port', async () => {
      await start(settings([controller({ lastPortId: 'port-old' })]));
      expect(status()).toBe('missing');

      const id = h.controllers.ensureController('port-new', ` ${NAME} `);

      expect(id).toBe(LAUNCH_CONTROL);
      expect(h.mappingStore.controllers()).toHaveLength(1);
      expect(h.mappingStore.controller(LAUNCH_CONTROL)()?.lastPortId).toBe('port-new');
    });

    it('creates a listening controller for an unknown port and saves it', async () => {
      await start(settings([]));

      const id = h.controllers.ensureController('port-7', '  Nano  ');

      expect(h.mappingStore.controller(id)()).toEqual({
        id,
        name: 'Nano',
        lastPortId: 'port-7',
        listening: true,
      });
      expect(h.controllers.controllerForPort('port-7')).toBe(id);
      expect(h.controllers.ensureController('port-7', 'Nano')).toBe(id);
      expect(h.mappingStore.controllers()).toHaveLength(1);
      expect((await savedControllers()).map((known) => known.id)).toEqual([id]);
    });

    it('keeps the name inside what the server accepts', async () => {
      await start(settings([]));

      const long = h.mappingStore.controller(h.controllers.ensureController('p1', 'x'.repeat(300)))();
      const blank = h.mappingStore.controller(h.controllers.ensureController('p2', '   '))();

      expect(long?.name).toHaveLength(128);
      expect(blank?.name).toBe('Unnamed input');
    });

    it('finds a long-named controller again by its cut name', async () => {
      await start(settings([]));
      const id = h.controllers.ensureController('p1', 'x'.repeat(300));
      h.midiInput.plug('p2', 'x'.repeat(300));
      await settle();

      expect(h.mappingStore.controller(id)()?.lastPortId).toBe('p2');
    });
  });

  describe('connectedInputs', () => {
    it('lists the connected inputs that are not cartridges', async () => {
      await start(settings([]), [
        ['port-1', NAME],
        ['port-2', 'TeensyROM-12345678'],
      ]);
      h.midiInput.inputs.update((ports) => [
        ...ports,
        { id: 'port-3', name: 'Gone', manufacturer: 'Test', connected: false },
      ]);

      expect(h.controllers.connectedInputs()).toEqual([{ id: 'port-1', name: NAME }]);
    });
  });
});
