import { TestBed } from '@angular/core/testing';
import { signal, type WritableSignal } from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Device, DeviceState, StorageType } from '@teensyrom-nx/domain';
import { DeckBindings } from './deck-bindings';
import { DeckRuntime } from './deck-runtime';
import { DjStore } from './dj-store';
import { DeviceStore } from '../device/device-store';
import { DECK_BINDINGS_REPOSITORY, MIDI_ACCESS } from './ports';
import type {
  DeckBinding,
  IDeckBindingsRepository,
  IMidiAccess,
  MidiAccessState,
  MidiPortOption,
} from './ports';

function createMockDevice(deviceId: string, overrides?: Partial<Device>): Device {
  return {
    deviceId,
    comPort: 'COM3',
    name: `Test Device ${deviceId}`,
    fwVersion: '1.0.0',
    isCompatible: true,
    isConnected: true,
    deviceState: DeviceState.Connected,
    isEnabled: true,
    usbStorage: { deviceId, type: StorageType.Usb, available: true, indexExists: false },
    sdStorage: { deviceId, type: StorageType.Sd, available: true, indexExists: false },
    ...overrides,
  };
}

/** A real-enough claims map so `holderOf`/`claim`/`release` behave as `IMidiAccess`'s own contract
 *  describes, without pulling in the browser adapter. */
class FakeMidiAccess implements IMidiAccess {
  readonly accessState = signal<MidiAccessState>('granted');
  readonly ports = signal<readonly MidiPortOption[]>([]);
  readonly lastError = signal<string | null>(null);
  requestAccessCalls = 0;
  private readonly claims = new Map<string, string>();

  async requestAccess(): Promise<void> {
    this.requestAccessCalls++;
    this.accessState.set('granted');
  }

  holderOf(portId: string): string | null {
    return this.claims.get(portId) ?? null;
  }

  claim(holder: string, portId: string): boolean {
    const heldBy = this.claims.get(portId);
    if (heldBy !== undefined && heldBy !== holder) {
      return false;
    }
    for (const [id, existingHolder] of [...this.claims]) {
      if (existingHolder === holder && id !== portId) {
        this.claims.delete(id);
      }
    }
    this.claims.set(portId, holder);
    return true;
  }

  release(holder: string): void {
    for (const [id, existingHolder] of [...this.claims]) {
      if (existingHolder === holder) {
        this.claims.delete(id);
      }
    }
  }

  outputPortFor(): null {
    return null;
  }
}

function fakeRepository(
  initial: readonly DeckBinding[] = []
): IDeckBindingsRepository & { saved: DeckBinding[] } {
  const stored = new Map(initial.map((binding) => [binding.slot, binding]));
  const saved: DeckBinding[] = [];
  return {
    saved,
    load: async (slot) => stored.get(slot) ?? null,
    loadAll: async () => [...stored.values()],
    save: async (binding) => {
      stored.set(binding.slot, binding);
      saved.push(binding);
    },
  };
}

describe('DeckBindings', () => {
  let service: DeckBindings;
  let store: InstanceType<typeof DjStore>;
  let midiAccess: FakeMidiAccess;
  let devices: WritableSignal<Device[]>;
  let runtime: { setPort: ReturnType<typeof vi.fn>; identify: ReturnType<typeof vi.fn> };
  let repository: IDeckBindingsRepository & { saved: DeckBinding[] };

  function configure(initial: readonly DeckBinding[] = []): void {
    TestBed.resetTestingModule();
    repository = fakeRepository(initial);
    midiAccess = new FakeMidiAccess();
    devices = signal<Device[]>([]);
    runtime = { setPort: vi.fn(), identify: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        DeckBindings,
        DjStore,
        { provide: DeviceStore, useValue: { devices } },
        { provide: DeckRuntime, useValue: runtime },
        { provide: DECK_BINDINGS_REPOSITORY, useValue: repository },
        { provide: MIDI_ACCESS, useValue: midiAccess },
      ],
    });

    TestBed.runInInjectionContext(() => {
      service = TestBed.inject(DeckBindings);
    });
    store = TestBed.inject(DjStore);
  }

  beforeEach(() => {
    configure();
  });

  it('hydration restores a present port and device', async () => {
    configure([
      { slot: 'A', midiPortId: 'port-1', midiPortName: 'Port One', deviceId: 'device-1', deviceName: 'Stored Device' },
    ]);
    midiAccess.ports.set([{ id: 'port-1', name: 'Port One', manufacturer: 'Acme' }]);
    devices.set([createMockDevice('device-1')]);

    await service.hydrate();

    const binding = store.binding('A')();
    expect(binding.port).toEqual({ id: 'port-1', name: 'Port One' });
    expect(binding.portPresent).toBe(true);
    expect(binding.device).toEqual({ id: 'device-1', name: 'Stored Device' });
    expect(binding.devicePresent).toBe(true);
    expect(runtime.setPort).toHaveBeenCalledWith('A', 'port-1');
  });

  it('an absent id yields last-saw with runtime.setPort(slot, null)', async () => {
    configure([
      { slot: 'A', midiPortId: 'port-missing', midiPortName: 'Missing Port', deviceId: null, deviceName: null },
    ]);

    await service.hydrate();

    const binding = store.binding('A')();
    expect(binding.port).toEqual({ id: 'port-missing', name: 'Missing Port' });
    expect(binding.portPresent).toBe(false);
    expect(runtime.setPort).toHaveBeenCalledWith('A', null);
  });

  it('a reappearing port id re-binds once enumerated again', async () => {
    configure([
      { slot: 'A', midiPortId: 'port-1', midiPortName: 'Port One', deviceId: null, deviceName: null },
    ]);
    await service.hydrate();
    expect(store.binding('A')().portPresent).toBe(false);
    runtime.setPort.mockClear();

    midiAccess.ports.set([{ id: 'port-1', name: 'Port One', manufacturer: 'Acme' }]);
    TestBed.flushEffects();

    expect(store.binding('A')().portPresent).toBe(true);
    expect(runtime.setPort).toHaveBeenCalledWith('A', 'port-1');
  });

  it('a device disappearing from DeviceStore flips it to last-saw', async () => {
    configure([
      { slot: 'A', midiPortId: null, midiPortName: null, deviceId: 'device-1', deviceName: 'Stored Device' },
    ]);
    devices.set([createMockDevice('device-1')]);
    await service.hydrate();
    expect(store.binding('A')().devicePresent).toBe(true);

    devices.set([]);
    TestBed.flushEffects();

    const binding = store.binding('A')();
    expect(binding.devicePresent).toBe(false);
    expect(binding.device).toEqual({ id: 'device-1', name: 'Stored Device' });
  });

  describe('bindPort', () => {
    it('refuses when the other slot already holds the port, leaving the binding untouched', async () => {
      midiAccess.ports.set([{ id: 'port-1', name: 'Port One', manufacturer: 'Acme' }]);
      await service.bindPort('B', 'port-1');

      await service.bindPort('A', 'port-1');

      expect(store.binding('A')().error).toBe('Deck B is already bound to that port.');
      expect(store.binding('A')().port).toBeNull();
      expect(repository.saved.some((binding) => binding.slot === 'A')).toBe(false);
    });

    it('claims, sets the runtime port, and saves with the device pair carried from current state', async () => {
      devices.set([createMockDevice('device-9')]);
      await service.bindDevice('A', 'device-9');
      midiAccess.ports.set([{ id: 'port-2', name: 'Port Two', manufacturer: 'Acme' }]);

      await service.bindPort('A', 'port-2');

      const binding = store.binding('A')();
      expect(binding.port).toEqual({ id: 'port-2', name: 'Port Two' });
      expect(binding.portPresent).toBe(true);
      expect(binding.error).toBeNull();
      expect(runtime.setPort).toHaveBeenCalledWith('A', 'port-2');
      expect(repository.saved.at(-1)).toEqual({
        slot: 'A',
        midiPortId: 'port-2',
        midiPortName: 'Port Two',
        deviceId: 'device-9',
        deviceName: 'Test Device device-9',
      });
    });

    it("'' and null both clear the binding", async () => {
      midiAccess.ports.set([{ id: 'port-1', name: 'Port One', manufacturer: 'Acme' }]);
      await service.bindPort('A', 'port-1');

      await service.bindPort('A', '');

      expect(store.binding('A')().port).toBeNull();
      expect(store.binding('A')().portPresent).toBe(false);
      expect(runtime.setPort).toHaveBeenCalledWith('A', null);
      expect(midiAccess.holderOf('port-1')).toBeNull();
    });
  });

  describe('bindDevice', () => {
    it('refuses when the other slot already holds the device, leaving the binding untouched', async () => {
      devices.set([createMockDevice('device-1')]);
      await service.bindDevice('B', 'device-1');

      await service.bindDevice('A', 'device-1');

      expect(store.binding('A')().error).toBe('Deck B is already bound to that device.');
      expect(store.binding('A')().device).toBeNull();
      expect(repository.saved.some((binding) => binding.slot === 'A')).toBe(false);
    });

    it('binds, marks it present, and saves — with no runtime call', async () => {
      devices.set([createMockDevice('device-2')]);

      await service.bindDevice('A', 'device-2');

      const binding = store.binding('A')();
      expect(binding.device).toEqual({ id: 'device-2', name: 'Test Device device-2' });
      expect(binding.devicePresent).toBe(true);
      expect(binding.error).toBeNull();
      expect(runtime.setPort).not.toHaveBeenCalled();
      expect(repository.saved.at(-1)?.deviceId).toBe('device-2');
    });
  });

  it('enableMidi requests access once and reconciles both slots', async () => {
    store.setBinding({
      slot: 'A',
      binding: { port: { id: 'port-1', name: 'Port One' }, portPresent: false, device: null, devicePresent: false, error: null },
    });
    midiAccess.ports.set([{ id: 'port-1', name: 'Port One', manufacturer: 'Acme' }]);

    await service.enableMidi();

    expect(midiAccess.requestAccessCalls).toBe(1);
    expect(store.binding('A')().portPresent).toBe(true);
    expect(runtime.setPort).toHaveBeenCalledWith('A', 'port-1');
  });

  it('identify reaches the runtime with DECK A', () => {
    service.identify('A');

    expect(runtime.identify).toHaveBeenCalledWith('A', 'DECK A');
  });
});
