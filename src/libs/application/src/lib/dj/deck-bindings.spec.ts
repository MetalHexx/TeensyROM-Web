import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ALERT_SERVICE } from '@teensyrom-nx/domain';
import { DeckBindings } from './deck-bindings';
import { DeckRuntime } from './deck-runtime';
import { DjStore } from './dj-store';
import { DECK_BINDINGS_REPOSITORY, MIDI_ACCESS } from './ports';
import type {
  DeckBinding,
  IDeckBindingsRepository,
  IMidiAccess,
  MidiAccessState,
  MidiPermission,
  MidiPortOption,
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
  let runtime: { setPort: ReturnType<typeof vi.fn>; identify: ReturnType<typeof vi.fn> };
  let repository: IDeckBindingsRepository & { saved: DeckBinding[] };
  let alertService: { error: ReturnType<typeof vi.fn> };

  function configure(initial: readonly DeckBinding[] = []): void {
    TestBed.resetTestingModule();
    repository = fakeRepository(initial);
    midiAccess = new FakeMidiAccess();
    runtime = { setPort: vi.fn(), identify: vi.fn() };
    alertService = { error: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        DeckBindings,
        DjStore,
        { provide: DeckRuntime, useValue: runtime },
        { provide: DECK_BINDINGS_REPOSITORY, useValue: repository },
        { provide: MIDI_ACCESS, useValue: midiAccess },
        { provide: ALERT_SERVICE, useValue: alertService },
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

  it('hydration restores a present port', async () => {
    configure([{ slot: 'A', midiPortId: 'port-1', midiPortName: 'Port One' }]);
    midiAccess.ports.set([{ id: 'port-1', name: 'Port One', manufacturer: 'Acme' }]);

    await service.hydrate();

    const binding = store.binding('A')();
    expect(binding.port).toEqual({ id: 'port-1', name: 'Port One' });
    expect(binding.portPresent).toBe(true);
    expect(runtime.setPort).toHaveBeenCalledWith('A', 'port-1');
  });

  it('an absent id yields last-saw with runtime.setPort(slot, null)', async () => {
    configure([{ slot: 'A', midiPortId: 'port-missing', midiPortName: 'Missing Port' }]);

    await service.hydrate();

    const binding = store.binding('A')();
    expect(binding.port).toEqual({ id: 'port-missing', name: 'Missing Port' });
    expect(binding.portPresent).toBe(false);
    expect(runtime.setPort).toHaveBeenCalledWith('A', null);
  });

  it('a reappearing port id re-binds once enumerated again', async () => {
    configure([{ slot: 'A', midiPortId: 'port-1', midiPortName: 'Port One' }]);
    await service.hydrate();
    expect(store.binding('A')().portPresent).toBe(false);
    runtime.setPort.mockClear();

    midiAccess.ports.set([{ id: 'port-1', name: 'Port One', manufacturer: 'Acme' }]);
    TestBed.flushEffects();

    expect(store.binding('A')().portPresent).toBe(true);
    expect(runtime.setPort).toHaveBeenCalledWith('A', 'port-1');
  });

  describe('auto-connect on hydrate', () => {
    it('a granted query calls requestAccess before the first reconcile, binding an enumerated stored port with no gesture', async () => {
      configure([{ slot: 'A', midiPortId: 'port-1', midiPortName: 'Port One' }]);
      midiAccess.portsOnRequestAccess = [{ id: 'port-1', name: 'Port One', manufacturer: 'Acme' }];

      await service.hydrate();

      expect(midiAccess.requestAccessCalls).toBe(1);
      const binding = store.binding('A')();
      expect(binding.portPresent).toBe(true);
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

  describe('bindPort', () => {
    it('refuses when the other slot already holds the port, leaving the binding untouched', async () => {
      midiAccess.ports.set([{ id: 'port-1', name: 'Port One', manufacturer: 'Acme' }]);
      await service.bindPort('B', 'port-1');

      await service.bindPort('A', 'port-1');

      expect(store.binding('A')().error).toBe('Deck B is already bound to that port.');
      expect(store.binding('A')().port).toBeNull();
      expect(repository.saved.some((binding) => binding.slot === 'A')).toBe(false);
    });

    it('claims, sets the runtime port, and saves', async () => {
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

  it('enableMidi requests access once and reconciles both slots', async () => {
    store.setBinding({
      slot: 'A',
      binding: { port: { id: 'port-1', name: 'Port One' }, portPresent: false, error: null },
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
