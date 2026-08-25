import { Injectable, signal } from '@angular/core';
import { logInfo, logWarn, LogType } from '@teensyrom-nx/utils';
import { buildDisplayCharsPacket } from '../asid/asid-encoder';

export type MidiAccessState = 'idle' | 'requesting' | 'granted' | 'denied' | 'unsupported';

export interface MidiPortOption {
  readonly id: string;
  readonly name: string;
  readonly manufacturer: string;
}

/**
 * TypeScript's bundled DOM lib declares `Navigator.requestMIDIAccess` itself, but the types behind
 * it are incomplete: `MIDIOutputMap` only exposes `forEach` (no `get`), and `MIDIOutput.send` is
 * typed to take `number[]` rather than the `Uint8Array` every browser actually accepts. Rather than
 * pull in `@types/webmidi` for the rest of the surface, this file works against its own minimal
 * shape and casts the real access object into it once, at the boundary. Kept here — it is part of
 * the throwaway.
 */
interface MIDIOutputLike {
  id: string;
  name: string | null;
  manufacturer: string | null;
  send(data: Uint8Array, timestamp?: number): void;
  /**
   * Specified by Web MIDI, but the API is not baseline — Chrome's implementation tracked a draft
   * that omitted it. Detected on the port object itself (see `updateSupportsCancel`), never assumed
   * from a browser check, and `cancelPending()` never calls it without confirming it exists first.
   */
  clear?: () => void;
}
interface MIDIAccessLike {
  outputs: Map<string, MIDIOutputLike>;
  onstatechange: ((e: unknown) => void) | null;
}

/** Namespaced so a later POC or app feature reusing `localStorage` can't collide with this key. */
const SELECTED_PORT_STORAGE_KEY = 'asid-dj-0.selected-midi-port';

/**
 * Requests Web MIDI SysEx access, tracks the enumerated outputs, and sends ASID packets to whichever
 * one the tester picks. Provided by the view component rather than `root` — this is a quarantined
 * POC surface and should not register a provider in the app injector.
 */
@Injectable()
export class MidiOutputService {
  readonly accessState = signal<MidiAccessState>('idle');
  readonly ports = signal<readonly MidiPortOption[]>([]);
  readonly selectedPortId = signal<string | null>(null);
  readonly lastError = signal<string | null>(null);
  /**
   * Whether the currently selected port exposes `clear()`. Kept current by every path that can
   * change the selection — `selectPort()`, `restoreSelectedPort()` and `refreshPorts()` — rather than
   * resolved lazily, so a remembered port's capability is known as soon as it is restored rather than
   * waiting on the first `send()`.
   */
  readonly supportsCancel = signal<boolean>(false);

  private access: MIDIAccessLike | null = null;

  /**
   * Triggers the browser's SysEx permission prompt. Must be called from a user gesture — Chrome
   * silently ignores (or Firefox queues) a request made outside one, and `access.outputs` stays
   * empty until the promise resolves either way.
   */
  async requestAccess(): Promise<void> {
    if (typeof navigator.requestMIDIAccess !== 'function') {
      this.accessState.set('unsupported');
      this.lastError.set('Web MIDI is not available in this browser. Try Chrome or Edge.');
      logWarn('MIDI: navigator.requestMIDIAccess is unavailable — Web MIDI unsupported here.');
      return;
    }

    this.accessState.set('requesting');
    this.lastError.set(null);

    let access: MIDIAccessLike;
    try {
      access = (await navigator.requestMIDIAccess({ sysex: true })) as unknown as MIDIAccessLike;
    } catch (error) {
      this.access = null;
      const message = describeAccessDenial(error);
      this.accessState.set('denied');
      this.lastError.set(message);
      logWarn(`MIDI: SysEx access request was denied — ${message}`);
      return;
    }

    this.access = access;
    access.onstatechange = () => this.refreshPorts();
    this.accessState.set('granted');
    this.refreshPorts();
    this.restoreSelectedPort();
    logInfo(LogType.Midi, 'MIDI: SysEx access granted.');
  }

  /** No-ops (with a warning) for an id that is not in the current `ports()` list. */
  selectPort(id: string): void {
    if (!this.ports().some((port) => port.id === id)) {
      logWarn(`MIDI: selectPort called with an id that is not a current output — "${id}".`);
      return;
    }

    this.selectedPortId.set(id);
    this.lastError.set(null);
    this.updateSupportsCancel();

    try {
      localStorage.setItem(SELECTED_PORT_STORAGE_KEY, id);
    } catch (error) {
      logWarn(`MIDI: could not persist the selected port to localStorage — ${error}`);
    }
  }

  /** No-op with a warning when no port is selected. `timestampMs` passes straight through to the
   * underlying `output.send`; omitting it sends immediately. */
  send(bytes: Uint8Array, timestampMs?: number): void {
    const output = this.selectedOutput();
    if (!output) {
      logWarn('MIDI: send() called with no MIDI port selected — bytes dropped.');
      return;
    }

    if (timestampMs === undefined) {
      output.send(bytes);
    } else {
      output.send(bytes, timestampMs);
    }
  }

  /**
   * Cancels whatever is still sitting in the selected port's timestamped send queue, if the browser
   * exposes a way to. Returns whether it actually cancelled — `false` covers "no port selected" and
   * "the port has no `clear()`" alike, so a caller never has to separately check `supportsCancel()`
   * before trusting the result. Never throws: a `clear()` that misbehaves despite being detected as
   * present is swallowed and reported as "did not cancel", not propagated.
   */
  cancelPending(): boolean {
    const output = this.selectedOutput();
    if (typeof output?.clear !== 'function') {
      return false;
    }
    try {
      output.clear();
      return true;
    } catch (error) {
      logWarn(`MIDI: output.clear() threw despite being detected as supported — ${error}`);
      return false;
    }
  }

  /**
   * Sends a display-chars packet so the tester can see which physical C64 the selected port drives.
   * Web MIDI exposes nothing that distinguishes two identical cartridges, so this is a confirmation
   * gesture, not a lookup — and it is not free: the firmware's `PrintflnToASID()` stops the playback
   * timer, drains the queue with a blocking wait, and re-initialises it, so sending this mid-tune
   * audibly interrupts the music.
   */
  identify(text: string): void {
    this.send(buildDisplayCharsPacket(text));
  }

  private selectedOutput(): MIDIOutputLike | null {
    const id = this.selectedPortId();
    if (id === null || this.access === null) {
      return null;
    }
    return this.access.outputs.get(id) ?? null;
  }

  private refreshPorts(): void {
    const nextPorts: MidiPortOption[] = [];
    this.access?.outputs.forEach((output, id) => {
      nextPorts.push({
        id,
        name: output.name ?? 'Unnamed output',
        manufacturer: output.manufacturer ?? 'Unknown manufacturer',
      });
    });
    this.ports.set(nextPorts);

    const selectedId = this.selectedPortId();
    if (selectedId !== null && !nextPorts.some((port) => port.id === selectedId)) {
      this.selectedPortId.set(null);
      this.lastError.set('The selected MIDI port disappeared — check the connection and re-select it.');
      logWarn(`MIDI: selected port "${selectedId}" is no longer present; selection cleared.`);
    }
    // `onstatechange` can replace a port object in place (e.g. a reconnect) without the selection
    // itself changing, so this re-checks unconditionally rather than only on the branch above.
    this.updateSupportsCancel();
  }

  /**
   * Restores a selection saved by a previous page load, if that port is still enumerated. Web MIDI
   * port `id`s are browser-generated and origin-scoped — stable enough to survive a reload of this
   * tab, but not a hardware identity, so this never assumes the id refers to the same physical
   * cartridge across browsers or origins.
   */
  private restoreSelectedPort(): void {
    if (this.selectedPortId() !== null) {
      return;
    }

    let storedId: string | null;
    try {
      storedId = localStorage.getItem(SELECTED_PORT_STORAGE_KEY);
    } catch (error) {
      logWarn(`MIDI: could not read the persisted port selection from localStorage — ${error}`);
      return;
    }

    if (storedId !== null && this.ports().some((port) => port.id === storedId)) {
      this.selectedPortId.set(storedId);
      this.updateSupportsCancel();
    }
  }

  /**
   * Re-derives `supportsCancel` from the selected port object, on demand rather than lazily — see
   * the field's own doc comment for why every selection-changing path calls this instead of leaving
   * it to the next `send()`.
   */
  private updateSupportsCancel(): void {
    this.supportsCancel.set(typeof this.selectedOutput()?.clear === 'function');
  }
}

function describeAccessDenial(error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error);
  return `MIDI SysEx access was denied: ${detail}`;
}
