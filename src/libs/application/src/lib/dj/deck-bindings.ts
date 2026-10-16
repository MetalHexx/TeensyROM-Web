import {
  effect,
  inject,
  Injectable,
  Injector,
  runInInjectionContext,
  untracked,
} from '@angular/core';
import { ALERT_SERVICE, midiPortDeviceToken, type IAlertService } from '@teensyrom-nx/domain';
import { logInfo, logWarn, LogType } from '@teensyrom-nx/utils';
import { DeviceStore } from '../device/device-store';
import { DeckRuntime } from './deck-runtime';
import { DjStore, type MidiState } from './dj-store';
import { MidiSettingsPersistence } from './midi-settings-persistence';
import { DECK_SLOTS, otherSlot, type Slot } from './slot';
import { MIDI_ACCESS } from './ports';
import type { IMidiAccess, MidiPortOption } from './ports';

/**
 * Each deck slot's cartridge: the TeensyROM device it is bound to, saved with the rest of the MIDI
 * settings through `MidiSettingsPersistence`, exclusive across the two slots, and joined to its
 * MIDI output by the `TeensyROM-<id>` token in the port's name. The binding is to the device; the
 * output is only where it currently shows up, so a cartridge that goes away keeps its slot and
 * re-attaches the moment its port returns.
 *
 * `IMidiAccess` owns a claims map, so a slot is present only when its cartridge's port exists and
 * the slot wins the claim on it.
 */
@Injectable({ providedIn: 'root' })
export class DeckBindings {
  private readonly persistence = inject(MidiSettingsPersistence);
  private readonly midiAccess: IMidiAccess = inject(MIDI_ACCESS);
  private readonly alertService: IAlertService = inject(ALERT_SERVICE);
  private readonly store = inject(DjStore);
  private readonly deviceStore = inject(DeviceStore);
  private readonly runtime = inject(DeckRuntime);
  private readonly injector = inject(Injector);

  private effectsInstalled = false;

  /**
   * Seeds the store from the saved MIDI settings, then — before the first reconcile — queries the
   * origin's standing MIDI permission and requests access on its own when it is already granted,
   * so a reload lands bound with no click: the first reconcile pass then already sees the freshly
   * enumerated ports and claims them, rather than reconciling unbound and catching up later.
   * Reconciles both slots against what is now enumerated, then installs the effects that keep
   * reconciling as ports and devices come and go. A granted origin whose auto-connect still fails
   * raises an `ALERT_SERVICE` error; `prompt`, `denied` and `unsupported` raise nothing here — the
   * binding card's own Enable button is the surface for those. Calls only `runtime.setPort` and
   * `runtime.resync` — never anything that would start a clock.
   */
  async hydrate(): Promise<void> {
    logInfo(LogType.Start, 'DeckBindings: hydrating deck bindings');

    const settings = await this.persistence.load();
    for (const record of settings.deckBindings) {
      this.store.setBinding({
        slot: record.slot,
        binding: {
          device: { id: record.deviceId, name: record.lastSeenName },
          portId: null,
          present: false,
          error: null,
        },
      });
    }

    if ((await this.midiAccess.queryPermission()) === 'granted') {
      await this.midiAccess.requestAccess();
      if (this.midiAccess.accessState() !== 'granted') {
        this.alertService.error(
          `MIDI could not be connected: ${this.midiAccess.lastError() ?? 'unknown error'}`
        );
      }
    }

    this.reconcileAll();
    this.installEffects();
  }

  /** `''` and `null` both clear the slot. Refused, not silent, when the other slot already holds
   *  the cartridge — the binding is left untouched and the refusal lands in `error`, cleared
   *  again on the next successful bind. */
  bindDevice(slot: Slot, deviceId: string | null): void {
    const id = deviceId === '' ? null : deviceId;
    const current = this.store.binding(slot)();

    if (id === null) {
      this.midiAccess.release(slot);
      this.runtime.setPort(slot, null);
      this.store.setBinding({
        slot,
        binding: { device: null, portId: null, present: false, error: null },
      });
      this.persistence.scheduleSave();
      return;
    }

    const holder = otherSlot(slot);
    if (this.store.binding(holder)().device?.id === id) {
      const message = `Deck ${holder} is already bound to that cartridge.`;
      logWarn(`DeckBindings: slot ${slot} refused cartridge ${id} — ${message}`);
      this.store.setBinding({ slot, binding: { ...current, error: message } });
      return;
    }

    const same = current.device?.id === id;
    const name =
      this.knownDevice(id)?.name ??
      this.portFor(id)?.name ??
      (same ? current.device?.name : undefined) ??
      id;
    this.store.setBinding({
      slot,
      binding: {
        device: { id, name },
        portId: same ? current.portId : null,
        present: same && current.present,
        error: null,
      },
    });
    this.reconcile(slot);
    this.persistence.scheduleSave();
  }

  /** The manual path for an origin that has not granted — `hydrate` already auto-connects one
   *  that has. Idempotent once granted: `IMidiAccess.requestAccess` re-enumerates and this
   *  reconciles both slots against the fresh list. */
  async enableMidi(): Promise<void> {
    await this.midiAccess.requestAccess();
    this.reconcileAll();
  }

  identify(slot: Slot): void {
    this.runtime.identify(slot, `DECK ${slot}`);
  }

  private knownDevice(deviceId: string) {
    return this.deviceStore.devices().find((device) => device.deviceId === deviceId);
  }

  /** The enumerated output carrying `deviceId` in its name, and nothing else: a different
   *  cartridge can never take the slot. */
  private portFor(deviceId: string): MidiPortOption | undefined {
    return this.midiAccess.ports().find((option) => midiPortDeviceToken(option.name) === deviceId);
  }

  private reconcileAll(): void {
    for (const slot of DECK_SLOTS) {
      this.reconcile(slot);
    }
  }

  /**
   * Recomputes one slot's presence against what is currently enumerated, always built from the
   * store's own current binding. The slot is present when its cartridge's port exists and the slot
   * wins the claim on it; `runtime.setPort` follows the claim, not the enumeration. An absent slot
   * keeps its device, so the binding survives until the port returns.
   *
   * A present slot adopts the device's current name from `DeviceStore` and schedules a save when
   * it changed. A slot that has just come to a port — the cartridge returned, or was newly chosen —
   * while its deck is playing or paused has the start handshake re-sent: a cartridge that went
   * away was power-cycled and has not heard it.
   */
  private reconcile(slot: Slot): void {
    const current = this.store.binding(slot)();
    const device = current.device;

    const port = device === null ? undefined : this.portFor(device.id);
    const present = port !== undefined && this.midiAccess.claim(slot, port.id);
    const portId = present && port !== undefined ? port.id : null;
    if (!present) {
      this.midiAccess.release(slot);
    }
    this.runtime.setPort(slot, portId);

    const freshName = present && device !== null ? this.knownDevice(device.id)?.name : undefined;
    const renamed = device !== null && freshName !== undefined && freshName !== device.name;
    const nextDevice = renamed ? { id: device.id, name: freshName } : device;

    if (renamed || present !== current.present || portId !== current.portId) {
      this.store.setBinding({ slot, binding: { ...current, device: nextDevice, portId, present } });
    }
    if (renamed) {
      this.persistence.scheduleSave();
    }

    if (portId !== null && portId !== current.portId) {
      const { transport } = this.runtime.snapshot(slot);
      if (transport === 'playing' || transport === 'paused') {
        this.runtime.resync(slot);
      }
    }
  }

  /** Installed once, in the injector context — `AudioBootstrapService.init`'s own pattern. One
   *  effect re-runs both slots' reconcile whenever the enumerated ports change, so a reappearing
   *  cartridge re-binds and a vanished one flips to absent; a second does the same when
   *  `DeviceStore.devices()` changes, so a renamed device's name stays fresh; a third mirrors
   *  `IMidiAccess`'s own state onto `store.setMidi`. Every store read a reconcile pass makes runs
   *  `untracked` so each effect depends only on its own source — never on the store writes
   *  reconcile itself makes, which would otherwise retrigger it. */
  private installEffects(): void {
    if (this.effectsInstalled) {
      return;
    }
    this.effectsInstalled = true;

    runInInjectionContext(this.injector, () => {
      effect(() => {
        this.midiAccess.ports();
        untracked(() => this.reconcileAll());
      });

      effect(() => {
        this.deviceStore.devices();
        untracked(() => this.reconcileAll());
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
