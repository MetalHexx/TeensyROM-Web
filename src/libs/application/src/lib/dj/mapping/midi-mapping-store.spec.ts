import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ControlIdentity, ControlMapping, KnownController } from './mapping.models';
import { sourceKey } from './mapping.models';
import { MidiMappingStore } from './midi-mapping-store';

const SPEED_A: ControlIdentity = { owner: 'A', control: 'speed' };
const SPEED_B: ControlIdentity = { owner: 'B', control: 'speed' };
const MIXER_OWNED: ControlIdentity = { owner: 'mixer', control: 'speed' };

function mapping(
  id: string,
  number: number,
  control: ControlIdentity,
  controllerId = 'lc'
): ControlMapping {
  return {
    id,
    source: { controllerId, channel: 1, kind: 'cc', number },
    control,
    style: { kind: 'absolute', amount: null },
  };
}

const controller = (id: string, name = id): KnownController => ({
  id,
  name,
  lastPortId: null,
  listening: true,
});

describe('MidiMappingStore', () => {
  let store: InstanceType<typeof MidiMappingStore>;

  beforeEach(() => {
    TestBed.resetTestingModule();
    store = TestBed.inject(MidiMappingStore);
  });

  it('starts empty and unloaded, and loading the saved set marks it loaded', () => {
    expect(store.loaded()).toBe(false);
    expect(store.mappings()).toEqual([]);

    store.setMidiMappingData({
      controllers: [controller('lc')],
      mappings: [mapping('m1', 7, SPEED_A)],
    });

    expect(store.loaded()).toBe(true);
    expect(store.controllers()).toHaveLength(1);
    expect(store.mappings()).toHaveLength(1);
  });

  describe('mappings', () => {
    it('upserts by id: a new id appends and a known id replaces in place', () => {
      store.upsertMapping({ mapping: mapping('m1', 7, SPEED_A) });
      store.upsertMapping({ mapping: mapping('m2', 8, SPEED_B) });

      store.upsertMapping({
        mapping: { ...mapping('m1', 7, SPEED_A), style: { kind: 'step', amount: 0.1 } },
      });

      expect(store.mappings().map((m) => m.id)).toEqual(['m1', 'm2']);
      expect(store.mappings()[0].style.kind).toBe('step');
    });

    it('lets a source drive one control: upserting onto a used source drops the other mapping', () => {
      store.upsertMapping({ mapping: mapping('m1', 7, SPEED_A) });

      store.upsertMapping({ mapping: mapping('m2', 7, SPEED_B) });

      expect(store.mappings().map((m) => m.id)).toEqual(['m2']);
    });

    it('a control keeps several sources', () => {
      store.upsertMapping({ mapping: mapping('m1', 7, SPEED_A) });
      store.upsertMapping({ mapping: mapping('m2', 8, SPEED_A) });
      store.upsertMapping({ mapping: mapping('m3', 9, SPEED_B) });

      expect(
        store
          .mappingsForControl(SPEED_A)()
          .map((m) => m.id)
      ).toEqual(['m1', 'm2']);
    });

    it('removes by id', () => {
      store.upsertMapping({ mapping: mapping('m1', 7, SPEED_A) });
      store.upsertMapping({ mapping: mapping('m2', 8, SPEED_A) });

      store.removeMapping({ id: 'm1' });

      expect(store.mappings().map((m) => m.id)).toEqual(['m2']);
    });
  });

  describe('selectors', () => {
    beforeEach(() => {
      store.setMidiMappingData({
        controllers: [controller('lc', 'Launch Control XL'), controller('pad')],
        mappings: [
          mapping('m1', 7, SPEED_A),
          mapping('m2', 8, SPEED_B),
          mapping('m3', 9, MIXER_OWNED),
        ],
      });
    });

    it('finds a mapping by source key', () => {
      const key = sourceKey({ controllerId: 'lc', channel: 1, kind: 'cc', number: 8 });

      expect(store.mappingBySource(key)()?.id).toBe('m2');
      expect(store.mappingBySource('lc|1|cc|99')()).toBeNull();
    });

    it('finds a controller by id', () => {
      expect(store.controller('lc')()?.name).toBe('Launch Control XL');
      expect(store.controller('gone')()).toBeNull();
    });

    it('says whether a controller has any mapping', () => {
      expect(store.hasMappings('lc')()).toBe(true);
      expect(store.hasMappings('pad')()).toBe(false);
    });

    it('groups the mappings by the owner of their control', () => {
      const byOwner = store.mappingsByOwner()();

      expect(byOwner.A.map((m) => m.id)).toEqual(['m1']);
      expect(byOwner.B.map((m) => m.id)).toEqual(['m2']);
      expect(byOwner.mixer.map((m) => m.id)).toEqual(['m3']);
    });
  });

  describe('controllers', () => {
    it('upserts by id', () => {
      store.upsertController({ controller: controller('lc', 'Old name') });
      store.upsertController({ controller: controller('pad') });

      store.upsertController({ controller: controller('lc', 'Launch Control XL') });

      expect(store.controllers().map((c) => c.name)).toEqual(['Launch Control XL', 'pad']);
    });

    it('records runtime status and port per controller', () => {
      store.setControllerRuntime({ id: 'lc', status: 'listening', portId: 'port-1' });
      store.setControllerRuntime({ id: 'pad', status: 'missing', portId: null });

      expect(store.controllerStatus()).toEqual({ lc: 'listening', pad: 'missing' });
      expect(store.controllerPorts()).toEqual({ lc: 'port-1', pad: null });
    });
  });

  describe('mapping mode and learn', () => {
    const learn = { control: SPEED_A, phase: 'waiting', replacing: null, source: null } as const;

    it('turning mapping mode off also ends the capture in the same update', () => {
      store.setMappingMode({ on: true });
      store.setLearn({ learn });
      expect(store.learn()).toEqual(learn);

      store.setMappingMode({ on: false });

      expect(store.mappingMode()).toBe(false);
      expect(store.learn()).toBeNull();
    });

    it('turning mapping mode on leaves a capture alone', () => {
      store.setLearn({ learn });

      store.setMappingMode({ on: true });

      expect(store.learn()).toEqual(learn);
    });

    it('announces the latest message', () => {
      store.announce({ text: 'Binding deleted' });

      expect(store.announcement()).toBe('Binding deleted');
    });
  });
});
