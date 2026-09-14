import { effect, inject, Injectable, Injector, runInInjectionContext, untracked } from '@angular/core';
import { logInfo, logWarn, LogType } from '@teensyrom-nx/utils';
import { DeviceStore } from '../device/device-store';
import { DeckRuntime } from './deck-runtime';
import { DjStore, type DeckBindingState, type MidiState } from './dj-store';
import { DECK_SLOTS, otherSlot, type Slot } from './slot';
import { DECK_BINDINGS_REPOSITORY, MIDI_ACCESS } from './ports';
import type { DeckBinding, IDeckBindingsRepository, IMidiAccess } from './ports';

/** A `DeckBindingState`'s port/device pair reduced to the repository's id/name fields — the shape
 *  `reconcile` and `repository.save` both work against. */
function recordFor(slot: Slot, binding: DeckBindingState): DeckBinding {
  return {
    slot,
    midiPortId: binding.port?.id ?? null,
    midiPortName: binding.port?.name ?? null,
    deviceId: binding.device?.id ?? null,
    deviceName: binding.device?.name ?? null,
  };
}

/**
 * Each deck slot's MIDI output port and TeensyROM device: loaded from `DECK_BINDINGS_REPOSITORY`
 * at startup, reconciled against what `IMidiAccess` enumerates and `DeviceStore` reports
 * connected, saved on every successful bind, exclusive across the two slots, and re-resolved the
 * moment an absent id reappears.
 *
 * A port claim and a device binding are enforced differently: `IMidiAccess` owns a claims map, so
 * a port bind either wins the claim or is refused outright; the device store carries no such map,
 * so a device bind is refused by comparing against the other slot's own binding state directly.
 * Both land the same fact — a taken option and a refused bind describe one another.
 */
@Injectable({ providedIn: 'root' })
export class DeckBindings {
  private readonly repository: IDeckBindingsRepository = inject(DECK_BINDINGS_REPOSITORY);
  private readonly midiAccess: IMidiAccess = inject(MIDI_ACCESS);
  private readonly deviceStore = inject(DeviceStore);
  private readonly store = inject(DjStore);
  private readonly runtime = inject(DeckRuntime);
  private readonly injector = inject(Injector);

  private effectsInstalled = false;

  /**
   * Seeds the store from the repository, reconciles both slots against what is currently
   * enumerated/connected, then installs the effects that keep reconciling as ports and devices
   * come and go. Calls only `runtime.setPort` — never anything that would start a clock — so a
   * refresh can hydrate ahead of the one user gesture MIDI access still needs.
   */
  async hydrate(): Promise<void> {
    logInfo(LogType.Start, 'DeckBindings: hydrating deck bindings');

    const stored = await this.repository.loadAll();
    for (const record of stored) {
      this.store.setBinding({ slot: record.slot, binding: this.stateFromRecord(record) });
    }

    for (const slot of DECK_SLOTS) {
      this.reconcile(slot);
    }

    this.installEffects();
  }

  /** `''` and `null` both clear the slot's port binding. Refused, not silent, when the other slot
   *  already holds the requested port — the binding is left untouched and the refusal lands in
   *  `error`, cleared again on the next successful bind. */
  async bindPort(slot: Slot, portId: string | null): Promise<void> {
    const id = portId === '' ? null : portId;
    const current = this.store.binding(slot)();

    if (id !== null) {
      const holder = this.midiAccess.holderOf(id);
      if (holder === otherSlot(slot)) {
        const message = `Deck ${holder} is already bound to that port.`;
        logWarn(`DeckBindings: slot ${slot} refused port ${id} — ${message}`);
        this.store.setBinding({ slot, binding: { ...current, error: message } });
        return;
      }
    }

    let port: DeckBindingState['port'] = null;
    if (id === null) {
      this.midiAccess.release(slot);
      this.runtime.setPort(slot, null);
    } else {
      this.midiAccess.claim(slot, id);
      this.runtime.setPort(slot, id);
      const name = this.midiAccess.ports().find((option) => option.id === id)?.name ?? '';
      port = { id, name };
    }

    const binding: DeckBindingState = { ...current, port, portPresent: id !== null, error: null };
    this.store.setBinding({ slot, binding });
    await this.repository.save(recordFor(slot, binding));
  }

  /** Mirrors `bindPort`, refused against the other slot's own `device?.id` rather than a claims
   *  map — there is none for devices this iteration — and with no runtime call: the device
   *  binding drives no traffic yet. */
  async bindDevice(slot: Slot, deviceId: string | null): Promise<void> {
    const id = deviceId === '' ? null : deviceId;
    const current = this.store.binding(slot)();

    if (id !== null) {
      const holder = this.store.binding(otherSlot(slot))().device?.id === id ? otherSlot(slot) : null;
      if (holder !== null) {
        const message = `Deck ${holder} is already bound to that device.`;
        logWarn(`DeckBindings: slot ${slot} refused device ${id} — ${message}`);
        this.store.setBinding({ slot, binding: { ...current, error: message } });
        return;
      }
    }

    let device: DeckBindingState['device'] = null;
    let devicePresent = false;
    if (id !== null) {
      const found = this.deviceStore.devices().find((candidate) => candidate.deviceId === id);
      device = { id, name: found?.name ?? '' };
      devicePresent = found?.isConnected ?? false;
    }

    const binding: DeckBindingState = { ...current, device, devicePresent, error: null };
    this.store.setBinding({ slot, binding });
    await this.repository.save(recordFor(slot, binding));
  }

  /** Must be called from a user gesture — only ever the binding card's own Enable button.
   *  Idempotent once granted: `IMidiAccess.requestAccess` re-enumerates and this reconciles both
   *  slots against the fresh list. */
  async enableMidi(): Promise<void> {
    await this.midiAccess.requestAccess();
    for (const slot of DECK_SLOTS) {
      this.reconcile(slot);
    }
  }

  identify(slot: Slot): void {
    this.runtime.identify(slot, `DECK ${slot}`);
  }

  private stateFromRecord(record: DeckBinding): DeckBindingState {
    return {
      port: record.midiPortId === null ? null : { id: record.midiPortId, name: record.midiPortName ?? '' },
      portPresent: false,
      device: record.deviceId === null ? null : { id: record.deviceId, name: record.deviceName ?? '' },
      devicePresent: false,
      error: null,
    };
  }

  /**
   * Recomputes one slot's presence against what is currently enumerated (ports) or connected
   * (devices), always built from the store's own current binding — never from the array
   * `loadAll()` returned at hydration, which a port bound afterwards would otherwise be
   * reconciled back to on the next port-list change. The id/name pair itself is never touched
   * here, only the presence flags and the runtime port — a lost port keeps its "last saw *name*"
   * identity until something rebinds it.
   *
   * A present port claims it — `runtime.setPort` follows the claim, not the enumeration, so a
   * port claimed by the other slot in the interim still reads as absent here even though it is
   * enumerated. Devices mirror the same shape without a claim step: there is no claims map to
   * consult, only `DeviceStore`'s own connected flag.
   */
  private reconcile(slot: Slot): void {
    const current = this.store.binding(slot)();
    const port = current.port;
    const device = current.device;

    let portPresent = false;
    if (port !== null) {
      const enumerated = this.midiAccess.ports().some((option) => option.id === port.id);
      portPresent = enumerated && this.midiAccess.claim(slot, port.id);
    }
    this.runtime.setPort(slot, portPresent && port !== null ? port.id : null);

    let devicePresent = false;
    if (device !== null) {
      devicePresent = this.deviceStore
        .devices()
        .some((candidate) => candidate.deviceId === device.id && candidate.isConnected);
    }

    this.store.setBinding({ slot, binding: { ...current, portPresent, devicePresent } });
  }

  /** Installed once, in the injector context — `AudioBootstrapService.init`'s own pattern. Two
   *  effects re-run both slots' reconcile whenever the enumerated ports or the connected devices
   *  change, so a reappearing id re-binds and a vanished one flips to last-saw; a third mirrors
   *  `IMidiAccess`'s own state onto `store.setMidi`. Every store read a reconcile pass makes runs
   *  `untracked` so these effects depend only on `midiAccess.ports()` / `deviceStore.devices()` —
   *  never on the store writes reconcile itself makes, which would otherwise retrigger them. */
  private installEffects(): void {
    if (this.effectsInstalled) {
      return;
    }
    this.effectsInstalled = true;

    runInInjectionContext(this.injector, () => {
      effect(() => {
        this.midiAccess.ports();
        untracked(() => {
          for (const slot of DECK_SLOTS) {
            this.reconcile(slot);
          }
        });
      });

      effect(() => {
        this.deviceStore.devices();
        untracked(() => {
          for (const slot of DECK_SLOTS) {
            this.reconcile(slot);
          }
        });
      });

      effect(() => {
        const midi: MidiState = {
          accessState: this.midiAccess.accessState(),
          ports: this.midiAccess.ports(),
          lastError: this.midiAccess.lastError(),
        };
        untracked(() => {
          this.store.setMidi(midi);
        });
      });
    });
  }
}
