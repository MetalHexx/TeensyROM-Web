import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ALERT_SERVICE, type Device } from '@teensyrom-nx/domain';
import { DeviceStore } from '../device/device-store';
import { DeckBindings } from './deck-bindings';
import { DeckRuntime } from './deck-runtime';
import { DjStore } from './dj-store';
import { MIDI_ACCESS, MIDI_SETTINGS_REPOSITORY } from './ports';
import type {
  IMidiAccess,
  IMidiSettingsRepository,
  MidiAccessState,
  MidiPermission,
  MidiPortOption,
  MidiSettingsRecord,
} from './ports';

/** A real-enough claims map so `holderOf`/`claim`/`release` behave as `IMidiAccess`'s own contract
 *  describes, without pulling in the browser adapter. */
class FakeMidiAccess implements IMidiAccess {
  readonly accessState = signal<MidiAccessState>('granted');
  readonly ports = signal<readonly MidiPortOption[]>([]);
  readonly lastError = signal<string | null>(null);
  requestAccessCalls = 0;
  /** What `queryPermission` answers — a test sets this to drive `hydrate`'s auto-connect. */
  permission: MidiPermission = 'granted';
  /** Ports `requestAccess` reveals when called, mimicking the browser only enumerating once
   *  access is (re-)confirmed — null makes it a no-op on the port list, as most tests want. */
  portsOnRequestAccess: readonly MidiPortOption[] | null = null;
  private readonly claims = new Map<string, string>();

  async queryPermission(): Promise<MidiPermission> {
    return this.permission;
  }

  async requestAccess(): Promise<void> {
    this.requestAccessCalls++;
    this.accessState.set('granted');
    if (this.portsOnRequestAccess !== null) {
      this.ports.set(this.portsOnRequestAccess);
    }
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

const NO_SETTINGS: MidiSettingsRecord = { controllers: [], mappings: [], deckBindings: [] };

/** TeensyROM-1 and TeensyROM-2 as the browser enumerates them. */
const PORT_1: MidiPortOption = { id: 'port-1', name: 'TeensyROM-1111', manufacturer: 'Acme' };
const PORT_2: MidiPortOption = { id: 'port-2', name: 'TeensyROM-2222', manufacturer: 'Acme' };

function device(deviceId: string, name: string): Device {
  return { deviceId, name } as Device;
}

/** A repository holding one settings set in memory, the way the server does. */
function fakeRepository(initial: MidiSettingsRecord = NO_SETTINGS) {
  let stored = initial;
  const saved: MidiSettingsRecord[] = [];
  const repository: Partial<IMidiSettingsRepository> & {
    saved: MidiSettingsRecord[];
    stored: () => MidiSettingsRecord;
  } = {
    saved,
    stored: () => stored,
    load: vi.fn(async () => stored),
    save: vi.fn(async (settings: MidiSettingsRecord) => {
      stored = settings;
      saved.push(settings);
    }),
  };
  return repository;
}

describe('DeckBindings', () => {
  let service: DeckBindings;
  let store: InstanceType<typeof DjStore>;
  let midiAccess: FakeMidiAccess;
  let runtime: {
    setPort: ReturnType<typeof vi.fn>;
    identify: ReturnType<typeof vi.fn>;
    snapshot: ReturnType<typeof vi.fn>;
    resync: ReturnType<typeof vi.fn>;
  };
  let transport: 'stopped' | 'playing' | 'paused';
  let repository: ReturnType<typeof fakeRepository>;
  let alertService: { error: ReturnType<typeof vi.fn>; warning: ReturnType<typeof vi.fn> };
  let devices: ReturnType<typeof signal<Device[]>>;

  function configure(initial: MidiSettingsRecord = NO_SETTINGS, keepRepository = false): void {
    TestBed.resetTestingModule();
    repository = keepRepository ? repository : fakeRepository(initial);
    midiAccess = new FakeMidiAccess();
    transport = 'stopped';
    runtime = {
      setPort: vi.fn(),
      identify: vi.fn(),
      snapshot: vi.fn(() => ({ transport })),
      resync: vi.fn(),
    };
    alertService = { error: vi.fn(), warning: vi.fn() };
    devices = signal<Device[]>([]);

    TestBed.configureTestingModule({
      providers: [
        DeckBindings,
        DjStore,
        { provide: DeckRuntime, useValue: runtime },
        { provide: MIDI_SETTINGS_REPOSITORY, useValue: repository },
        { provide: MIDI_ACCESS, useValue: midiAccess },
        { provide: ALERT_SERVICE, useValue: alertService },
        { provide: DeviceStore, useValue: { devices } },
      ],
    });

    TestBed.runInInjectionContext(() => {
      service = TestBed.inject(DeckBindings);
    });
    store = TestBed.inject(DjStore);
  }

  function settingsWith(
    ...deckBindings: MidiSettingsRecord['deckBindings'][number][]
  ): MidiSettingsRecord {
    return { ...NO_SETTINGS, deckBindings };
  }

  beforeEach(() => {
    vi.useFakeTimers();
    configure();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('hydrate', () => {
    it('restores a saved cartridge as present once its port is enumerated', async () => {
      configure(settingsWith({ slot: 'A', deviceId: '1111', lastSeenName: 'TR-1' }));
      midiAccess.ports.set([PORT_1]);

      await service.hydrate();

      expect(store.binding('A')()).toEqual({
        device: { id: '1111', name: 'TR-1' },
        portId: 'port-1',
        present: true,
        error: null,
      });
      expect(runtime.setPort).toHaveBeenCalledWith('A', 'port-1');
    });

    it('leaves a saved cartridge whose port is missing absent, with its device kept', async () => {
      configure(settingsWith({ slot: 'A', deviceId: '1111', lastSeenName: 'TR-1' }));

      await service.hydrate();

      const binding = store.binding('A')();
      expect(binding.device).toEqual({ id: '1111', name: 'TR-1' });
      expect(binding.present).toBe(false);
      expect(binding.portId).toBeNull();
      expect(runtime.setPort).toHaveBeenCalledWith('A', null);
    });

    it('leaves both decks unbound and sends no save for the session when the load fails', async () => {
      repository.load = vi.fn().mockRejectedValue(new Error('offline'));
      midiAccess.ports.set([PORT_1]);

      await service.hydrate();
      service.bindDevice('A', '1111');
      await vi.advanceTimersByTimeAsync(1000);

      expect(store.binding('B')().device).toBeNull();
      expect(alertService.warning).toHaveBeenCalledTimes(1);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('does not resync a cartridge found at startup while nothing is playing', async () => {
      configure(settingsWith({ slot: 'A', deviceId: '1111', lastSeenName: 'TR-1' }));
      midiAccess.ports.set([PORT_1]);

      await service.hydrate();

      expect(runtime.resync).not.toHaveBeenCalled();
    });
  });

  describe('auto-connect on hydrate', () => {
    it('a granted query calls requestAccess before the first reconcile, binding an enumerated stored cartridge with no gesture', async () => {
      configure(settingsWith({ slot: 'A', deviceId: '1111', lastSeenName: 'TR-1' }));
      midiAccess.portsOnRequestAccess = [PORT_1];

      await service.hydrate();

      expect(midiAccess.requestAccessCalls).toBe(1);
      expect(store.binding('A')().present).toBe(true);
      expect(runtime.setPort).toHaveBeenCalledWith('A', 'port-1');
      expect(alertService.error).not.toHaveBeenCalled();
    });

    it('a prompt query never calls requestAccess and raises no alert', async () => {
      midiAccess.permission = 'prompt';

      await service.hydrate();

      expect(midiAccess.requestAccessCalls).toBe(0);
      expect(alertService.error).not.toHaveBeenCalled();
    });

    it('a granted query whose requestAccess lands denied raises exactly one ALERT_SERVICE.error', async () => {
      midiAccess.permission = 'granted';
      midiAccess.requestAccess = async () => {
        midiAccess.requestAccessCalls++;
        midiAccess.accessState.set('denied');
        midiAccess.lastError.set('SysEx access was denied');
      };

      await service.hydrate();

      expect(alertService.error).toHaveBeenCalledTimes(1);
      expect(alertService.error).toHaveBeenCalledWith(
        expect.stringContaining('SysEx access was denied')
      );
    });
  });

  describe('presence follows the port', () => {
    async function hydrateBound(): Promise<void> {
      configure(settingsWith({ slot: 'A', deviceId: '1111', lastSeenName: 'TR-1' }));
      midiAccess.ports.set([PORT_1]);
      await service.hydrate();
      TestBed.flushEffects();
      runtime.setPort.mockClear();
    }

    it('a port that disappears flips the slot to absent and keeps the device', async () => {
      await hydrateBound();

      midiAccess.ports.set([]);
      TestBed.flushEffects();

      const binding = store.binding('A')();
      expect(binding.present).toBe(false);
      expect(binding.portId).toBeNull();
      expect(binding.device).toEqual({ id: '1111', name: 'TR-1' });
      expect(runtime.setPort).toHaveBeenCalledWith('A', null);
    });

    it('a returning port re-attaches the slot with no call from the UI', async () => {
      await hydrateBound();
      midiAccess.ports.set([]);
      TestBed.flushEffects();
      runtime.setPort.mockClear();

      midiAccess.ports.set([PORT_1]);
      TestBed.flushEffects();

      expect(store.binding('A')().present).toBe(true);
      expect(runtime.setPort).toHaveBeenCalledWith('A', 'port-1');
    });

    it.each(['playing', 'paused'] as const)(
      'a returning port re-sends the start handshake while the deck is %s',
      async (state) => {
        await hydrateBound();
        midiAccess.ports.set([]);
        TestBed.flushEffects();
        transport = state;

        midiAccess.ports.set([PORT_1]);
        TestBed.flushEffects();

        expect(runtime.resync).toHaveBeenCalledTimes(1);
        expect(runtime.resync).toHaveBeenCalledWith('A');
      }
    );

    it('a returning port does not resync a stopped deck', async () => {
      await hydrateBound();
      midiAccess.ports.set([]);
      TestBed.flushEffects();

      midiAccess.ports.set([PORT_1]);
      TestBed.flushEffects();

      expect(runtime.resync).not.toHaveBeenCalled();
    });

    it('re-enumerating while the cartridge stays present does not resync', async () => {
      await hydrateBound();
      transport = 'playing';

      midiAccess.ports.set([PORT_1, PORT_2]);
      TestBed.flushEffects();

      expect(runtime.resync).not.toHaveBeenCalled();
    });

    it('a different cartridge appearing never takes the slot', async () => {
      configure(settingsWith({ slot: 'A', deviceId: '1111', lastSeenName: 'TR-1' }));
      await service.hydrate();
      TestBed.flushEffects();

      midiAccess.ports.set([PORT_2]);
      TestBed.flushEffects();

      expect(store.binding('A')().present).toBe(false);
      expect(store.binding('A')().device?.id).toBe('1111');
      expect(runtime.setPort).not.toHaveBeenCalledWith('A', 'port-2');
    });

    it('releases the claim on a port that vanished', async () => {
      await hydrateBound();
      expect(midiAccess.holderOf('port-1')).toBe('A');

      midiAccess.ports.set([]);
      TestBed.flushEffects();

      expect(midiAccess.holderOf('port-1')).toBeNull();
    });
  });

  describe('names', () => {
    it('a present slot adopts a changed device name from DeviceStore and saves it', async () => {
      configure(settingsWith({ slot: 'A', deviceId: '1111', lastSeenName: 'TR-1' }));
      midiAccess.ports.set([PORT_1]);
      await service.hydrate();
      TestBed.flushEffects();

      devices.set([device('1111', 'Studio cart')]);
      TestBed.flushEffects();
      await vi.advanceTimersByTimeAsync(300);

      expect(store.binding('A')().device).toEqual({ id: '1111', name: 'Studio cart' });
      expect(repository.saved.at(-1)?.deckBindings).toEqual([
        { slot: 'A', deviceId: '1111', lastSeenName: 'Studio cart' },
      ]);
    });

    it('an absent slot keeps its last seen name when the device is renamed', async () => {
      configure(settingsWith({ slot: 'A', deviceId: '1111', lastSeenName: 'TR-1' }));
      await service.hydrate();
      TestBed.flushEffects();

      devices.set([device('1111', 'Studio cart')]);
      TestBed.flushEffects();
      await vi.advanceTimersByTimeAsync(1000);

      expect(store.binding('A')().device?.name).toBe('TR-1');
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('a device DeviceStore does not know keeps the stored name while its port is present', async () => {
      configure(settingsWith({ slot: 'A', deviceId: '1111', lastSeenName: 'TR-1' }));
      midiAccess.ports.set([PORT_1]);
      await service.hydrate();
      TestBed.flushEffects();
      await vi.advanceTimersByTimeAsync(1000);

      expect(store.binding('A')().device?.name).toBe('TR-1');
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('bindDevice', () => {
    it('binds a cartridge, takes its name from DeviceStore, claims its port and saves it', async () => {
      devices.set([device('1111', 'TR-1')]);
      midiAccess.ports.set([PORT_1]);

      service.bindDevice('A', '1111');
      await vi.advanceTimersByTimeAsync(300);

      expect(store.binding('A')()).toEqual({
        device: { id: '1111', name: 'TR-1' },
        portId: 'port-1',
        present: true,
        error: null,
      });
      expect(runtime.setPort).toHaveBeenCalledWith('A', 'port-1');
      expect(midiAccess.holderOf('port-1')).toBe('A');
      expect(repository.saved.at(-1)?.deckBindings).toEqual([
        { slot: 'A', deviceId: '1111', lastSeenName: 'TR-1' },
      ]);
    });

    it('takes the port name for a cartridge DeviceStore does not know', () => {
      midiAccess.ports.set([PORT_2]);

      service.bindDevice('A', '2222');

      expect(store.binding('A')().device).toEqual({ id: '2222', name: 'TeensyROM-2222' });
    });

    it('binds a cartridge that is not plugged in as absent and still saves it', async () => {
      devices.set([device('1111', 'TR-1')]);

      service.bindDevice('A', '1111');
      await vi.advanceTimersByTimeAsync(300);

      expect(store.binding('A')().present).toBe(false);
      expect(store.binding('A')().device?.id).toBe('1111');
      expect(runtime.setPort).toHaveBeenCalledWith('A', null);
      expect(repository.saved.at(-1)?.deckBindings).toHaveLength(1);
    });

    it('a fresh hydrate restores what was chosen', async () => {
      devices.set([device('1111', 'TR-1')]);
      midiAccess.ports.set([PORT_1]);
      service.bindDevice('A', '1111');
      await vi.advanceTimersByTimeAsync(300);

      configure(undefined, true);
      midiAccess.ports.set([PORT_1]);
      await service.hydrate();

      expect(store.binding('A')().device).toEqual({ id: '1111', name: 'TR-1' });
      expect(store.binding('A')().present).toBe(true);
    });

    it('refuses a cartridge the other slot holds, leaving the binding untouched and unsaved', async () => {
      midiAccess.ports.set([PORT_1]);
      service.bindDevice('B', '1111');
      await vi.advanceTimersByTimeAsync(300);
      const savesBefore = repository.saved.length;

      service.bindDevice('A', '1111');
      await vi.advanceTimersByTimeAsync(1000);

      expect(store.binding('A')().error).toBe('Deck B is already bound to that cartridge.');
      expect(store.binding('A')().device).toBeNull();
      expect(store.binding('B')().present).toBe(true);
      expect(repository.saved).toHaveLength(savesBefore);
    });

    it('clears the error on the next successful bind', () => {
      midiAccess.ports.set([PORT_1, PORT_2]);
      service.bindDevice('B', '1111');
      service.bindDevice('A', '1111');

      service.bindDevice('A', '2222');

      expect(store.binding('A')().error).toBeNull();
      expect(store.binding('A')().device?.id).toBe('2222');
    });

    it("'' and null both clear the slot, release its port and save the clear", async () => {
      midiAccess.ports.set([PORT_1]);
      service.bindDevice('A', '1111');
      await vi.advanceTimersByTimeAsync(300);

      service.bindDevice('A', '');
      await vi.advanceTimersByTimeAsync(300);

      expect(store.binding('A')().device).toBeNull();
      expect(store.binding('A')().present).toBe(false);
      expect(runtime.setPort).toHaveBeenLastCalledWith('A', null);
      expect(midiAccess.holderOf('port-1')).toBeNull();
      expect(repository.saved.at(-1)?.deckBindings).toEqual([]);

      midiAccess.ports.set([PORT_1]);
      service.bindDevice('A', '1111');
      service.bindDevice('A', null);
      expect(store.binding('A')().device).toBeNull();
    });

    it('rebinding a slot to another cartridge while playing re-sends the handshake to its port', () => {
      midiAccess.ports.set([PORT_1, PORT_2]);
      service.bindDevice('A', '1111');
      transport = 'playing';
      runtime.resync.mockClear();

      service.bindDevice('A', '2222');

      expect(runtime.resync).toHaveBeenCalledWith('A');
      expect(runtime.setPort).toHaveBeenLastCalledWith('A', 'port-2');
    });

    it('rebinding a slot to the cartridge it already holds does not resync', () => {
      midiAccess.ports.set([PORT_1]);
      service.bindDevice('A', '1111');
      transport = 'playing';

      service.bindDevice('A', '1111');

      expect(runtime.resync).not.toHaveBeenCalled();
    });
  });

  it('enableMidi requests access once and reconciles both slots', async () => {
    store.setBinding({
      slot: 'A',
      binding: { device: { id: '1111', name: 'TR-1' }, portId: null, present: false, error: null },
    });
    midiAccess.ports.set([PORT_1]);

    await service.enableMidi();

    expect(midiAccess.requestAccessCalls).toBe(1);
    expect(store.binding('A')().present).toBe(true);
    expect(runtime.setPort).toHaveBeenCalledWith('A', 'port-1');
  });

  it('identify reaches the runtime with DECK A', () => {
    service.identify('A');

    expect(runtime.identify).toHaveBeenCalledWith('A', 'DECK A');
  });
});
