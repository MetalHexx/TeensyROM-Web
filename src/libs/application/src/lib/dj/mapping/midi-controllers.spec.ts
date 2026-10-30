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

const speedMapping = (controllerId = LAUNCH_CONTROL, number = 7) => ({
  id: `speed-${controllerId}-${number}`,
  source: ccSource(number, 1, controllerId),
  owner: 'A' as const,
  control: 'speed',
  style: { kind: 'absolute' as const, amount: null },
});

const selectMapping = (id: string, controllerId: string, number: number) => ({
  id,
  source: ccSource(number, 1, controllerId),
  owner: 'set' as const,
  control: 'set-select',
  style: { kind: 'absolute' as const, amount: null },
});

const settings = (
  controllers: KnownControllerRecord[],
  mappings: MidiSettingsRecord['mappings'] = controllers.map((known) => speedMapping(known.id))
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
  const savedSettings = async () => {
    await vi.advanceTimersByTimeAsync(300);
    return h.repository.save.mock.calls.at(-1)?.[0] as MidiSettingsRecord;
  };
  const savedControllers = async () => (await savedSettings()).controllers;

  /** The controllers the engine hears from when `portId` sends a CC. */
  function heardFrom(portId: string, number = 7): string[] {
    h.router.start();
    const handle = vi.spyOn(h.engine, 'handle');
    handle.mockClear();
    h.midiInput.emit(portId, 'cc', number, 100);
    return handle.mock.calls.map(([message]) => message.controllerId);
  }

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
          [speedMapping(LAUNCH_CONTROL), speedMapping('off', 7)]
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
          speedMapping(),
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
          [speedMapping(LAUNCH_CONTROL)]
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
    it('finds it by its name when the browser hands out new port ids, and its mappings fire', async () => {
      await start(settings([controller({ lastPortId: 'input-2' })]), [['input-0', NAME]]);

      expect(status()).toBe('listening');
      expect(h.controllers.controllerForPort('input-0')).toBe(LAUNCH_CONTROL);
      expect(heardFrom('input-0')).toEqual([LAUNCH_CONTROL]);
    });

    it('does not take a port at its saved id that has another name, and reads missing', async () => {
      await start(settings([controller({ lastPortId: 'port-9' })]), [
        ['port-9', 'Renamed by the OS'],
      ]);

      expect(status()).toBe('missing');
      expect(h.controllers.controllerForPort('port-9')).toBeNull();
      expect(h.midiInput.openCalls).toEqual([]);
      expect(h.alerts.warning).toHaveBeenCalledWith(MISSING_ALERT);
    });

    it('does not take a cartridge input at its saved id, even one carrying its name', async () => {
      const cartridge = 'TeensyROM-12345678';
      await start(settings([controller({ name: cartridge, lastPortId: 'port-9' })]), [
        ['port-9', cartridge],
      ]);

      expect(status()).toBe('missing');
      expect(h.controllers.controllerForPort('port-9')).toBeNull();
      expect(h.midiInput.openCalls).toEqual([]);
    });

    it('keeps two same-named devices on their own ports when one is unplugged', async () => {
      await start(
        settings([
          controller({ lastPortId: 'port-a' }),
          controller({ id: 'twin', lastPortId: 'port-b' }),
        ]),
        [
          ['port-a', NAME],
          ['port-b', NAME],
        ]
      );
      expect(status()).toBe('listening');
      expect(status('twin')).toBe('listening');

      h.midiInput.unplug('port-a');
      await settle();

      expect(status()).toBe('missing');
      expect(status('twin')).toBe('listening');
      expect(h.controllers.controllerForPort('port-b')).toBe('twin');
      expect(h.mappingStore.controller('twin')()?.lastPortId).toBe('port-b');
    });

    it('keeps a mapping per controller on one control through a reshuffle', async () => {
      await start(
        settings(
          [
            controller({ lastPortId: 'input-2' }),
            controller({ id: 'nano', name: 'Nano', lastPortId: 'input-3' }),
          ],
          [
            selectMapping('launch-select', LAUNCH_CONTROL, 20),
            selectMapping('nano-select', 'nano', 21),
          ]
        ),
        [
          ['input-0', 'Nano'],
          ['input-1', NAME],
        ]
      );

      expect(h.mappingStore.mappings().map((mapping) => mapping.id)).toEqual([
        'launch-select',
        'nano-select',
      ]);
      expect(heardFrom('input-1', 20)).toEqual([LAUNCH_CONTROL]);
      expect(heardFrom('input-0', 21)).toEqual(['nano']);
      expect(
        (await savedSettings()).mappings.map((mapping) => mapping.source.controllerId)
      ).toEqual([LAUNCH_CONTROL, 'nano']);
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

    it('renames a missing controller to the differently named port the operator chooses, and its mappings fire', async () => {
      await start(settings([controller({ lastPortId: 'port-9' })]), [
        ['port-9', 'Renamed by the OS'],
      ]);
      expect(status()).toBe('missing');

      h.controllers.pointAt(LAUNCH_CONTROL, 'port-9');
      await settle();

      expect(h.mappingStore.controller(LAUNCH_CONTROL)()?.name).toBe('Renamed by the OS');
      expect(status()).toBe('listening');
      expect(heardFrom('port-9')).toEqual([LAUNCH_CONTROL]);
      expect((await savedControllers())[0]).toMatchObject({
        name: 'Renamed by the OS',
        lastPortId: 'port-9',
      });

      await start(settings([...(await savedControllers())]), [['port-new', 'Renamed by the OS']]);
      expect(status()).toBe('listening');
    });

    it('ignores a port that is not in the input list', async () => {
      await start(settings([controller()]));
      const saves = h.repository.save.mock.calls.length;

      h.controllers.pointAt(LAUNCH_CONTROL, 'port-nowhere');
      await vi.advanceTimersByTimeAsync(1000);

      expect(h.mappingStore.controller(LAUNCH_CONTROL)()).toEqual(controller());
      expect(h.repository.save.mock.calls.length).toBe(saves);
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

    const reusable: [string, MidiSettingsRecord, [string, string][]][] = [
      ['off', settings([controller({ listening: false })]), []],
      ['idle', settings([controller()], []), []],
      [
        'unmatched',
        settings([controller({ lastPortId: 'port-old' })]),
        [
          ['port-a', NAME],
          ['port-b', NAME],
        ],
      ],
    ];
    it.each(reusable)(
      'reuses a %s controller of the same name instead of adding one',
      async (expected, saved, ports) => {
        await start(saved, ports);
        expect(status()).toBe(expected);

        const id = h.controllers.ensureController('port-new', NAME);

        expect(id).toBe(LAUNCH_CONTROL);
        expect(h.mappingStore.controllers()).toHaveLength(1);
        expect(h.mappingStore.controller(LAUNCH_CONTROL)()?.lastPortId).toBe('port-new');
      }
    );

    it('reuses a controller whose status is not known yet instead of adding one', async () => {
      await start(settings([controller()]), [], () => h.accessState.set('idle'));
      expect(status()).toBeUndefined();

      expect(h.controllers.ensureController('port-new', NAME)).toBe(LAUNCH_CONTROL);
      expect(h.mappingStore.controllers()).toHaveLength(1);
    });

    it('adds a controller for a second device that carries the name of one already on another port', async () => {
      await start(settings([controller()]), [['port-1', NAME]]);
      expect(status()).toBe('listening');
      h.midiInput.plug('port-2', NAME);

      const id = h.controllers.ensureController('port-2', NAME);

      expect(id).not.toBe(LAUNCH_CONTROL);
      expect(h.mappingStore.controllers()).toHaveLength(2);
      expect(h.mappingStore.controller(LAUNCH_CONTROL)()?.lastPortId).toBe('port-1');
      expect(h.controllers.controllerForPort('port-2')).toBe(id);
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

  describe('repairing duplicate controllers', () => {
    const MRCC = 'MIDIIN3 (MRCC)';
    const duplicates = (overrides: Partial<KnownControllerRecord>[] = []) => [
      controller({
        id: 'dup-a',
        name: MRCC,
        lastPortId: 'input-2',
        listening: false,
        ...overrides[0],
      }),
      controller({ id: 'dup-b', name: MRCC, lastPortId: 'input-5', ...overrides[1] }),
    ];
    const duplicateMappings = () => [
      { ...speedMapping('dup-a', 7), id: 'speed-a' },
      { ...speedMapping('dup-b', 7), id: 'speed-b' },
      selectMapping('select-a', 'dup-a', 20),
      selectMapping('select-b', 'dup-b', 21),
    ];

    it('merges the controllers of one name into one with every mapping, keeps distinct sources and drops an exact duplicate', async () => {
      await start(settings(duplicates(), duplicateMappings()), [['input-0', MRCC]]);

      expect(h.mappingStore.controllers()).toEqual([
        { id: 'dup-a', name: MRCC, lastPortId: 'input-0', listening: true },
      ]);
      expect(h.mappingStore.mappings().map((mapping) => mapping.id)).toEqual([
        'speed-a',
        'select-a',
        'select-b',
      ]);
      expect(
        new Set(h.mappingStore.mappings().map((mapping) => mapping.source.controllerId))
      ).toEqual(new Set(['dup-a']));
      expect(status('dup-a')).toBe('listening');
      expect(status('dup-b')).toBeUndefined();
      expect(heardFrom('input-0', 21)).toEqual(['dup-a']);
    });

    it('saves the merged controllers and the rewritten mappings', async () => {
      await start(settings(duplicates(), duplicateMappings()), [['input-0', MRCC]]);

      const saved = await savedSettings();

      expect(saved.controllers).toEqual([
        { id: 'dup-a', name: MRCC, lastPortId: 'input-0', listening: true },
      ]);
      expect(saved.mappings.map((mapping) => [mapping.id, mapping.source.controllerId])).toEqual([
        ['speed-a', 'dup-a'],
        ['select-a', 'dup-a'],
        ['select-b', 'dup-a'],
      ]);
    });

    it('keeps the controller that was on the connected input', async () => {
      await start(settings(duplicates([{}, { lastPortId: 'input-0' }]), duplicateMappings()), [
        ['input-0', MRCC],
      ]);

      expect(h.mappingStore.controllers().map((known) => known.id)).toEqual(['dup-b']);
      expect(status('dup-b')).toBe('listening');
      expect(
        h.mappingStore.mappings().map((mapping) => [mapping.id, mapping.source.controllerId])
      ).toEqual([
        ['speed-a', 'dup-b'],
        ['select-a', 'dup-b'],
        ['select-b', 'dup-b'],
      ]);
    });

    it('merges when no input carries the name, and the merged controller listens once it is plugged in', async () => {
      await start(settings(duplicates(), duplicateMappings()));

      expect(h.mappingStore.controllers().map((known) => known.id)).toEqual(['dup-a']);
      expect(status('dup-a')).toBe('missing');

      h.midiInput.plug('input-9', MRCC);
      await settle();

      expect(status('dup-a')).toBe('listening');
      expect(heardFrom('input-9', 20)).toEqual(['dup-a']);
    });

    it('leaves same-named controllers alone while two inputs carry the name', async () => {
      await start(settings(duplicates(), duplicateMappings()), [
        ['input-2', MRCC],
        ['input-5', MRCC],
      ]);

      expect(h.mappingStore.controllers().map((known) => known.id)).toEqual(['dup-a', 'dup-b']);
      expect(h.mappingStore.mappings()).toHaveLength(4);
      expect(h.controllers.controllerForPort('input-2')).toBe('dup-a');
      expect(h.controllers.controllerForPort('input-5')).toBe('dup-b');
    });

    it('does not merge controllers of different names', async () => {
      await start(
        settings([controller(), controller({ id: 'nano', name: 'Nano', lastPortId: 'input-3' })]),
        [['input-0', NAME]]
      );

      expect(h.mappingStore.controllers().map((known) => known.id)).toEqual([
        LAUNCH_CONTROL,
        'nano',
      ]);
    });

    it('runs once per session and writes nothing when it has nothing to merge', async () => {
      let repairs!: MockInstance;
      await start(settings(duplicates(), duplicateMappings()), [['input-0', MRCC]], () => {
        repairs = vi.spyOn(h.mappingStore, 'repairControllers');
      });
      expect(repairs).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(300);
      const saves = h.repository.save.mock.calls.length;
      await h.controllers.applyPolicy();
      await settle();
      await vi.advanceTimersByTimeAsync(1000);

      expect(repairs).toHaveBeenCalledTimes(1);
      expect(h.repository.save.mock.calls.length).toBe(saves);
      expect(h.mappingStore.controllers()).toHaveLength(1);

      await start(settings([controller()]), [['port-1', NAME]], () => {
        repairs = vi.spyOn(h.mappingStore, 'repairControllers');
      });
      expect(repairs).not.toHaveBeenCalled();
    });

    it('waits for MIDI access, since the inputs are not listed before it', async () => {
      await start(settings(duplicates(), duplicateMappings()), [['input-0', MRCC]], () =>
        h.accessState.set('idle')
      );
      expect(h.mappingStore.controllers()).toHaveLength(2);

      h.accessState.set('granted');
      await settle();

      expect(h.mappingStore.controllers()).toHaveLength(1);
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
