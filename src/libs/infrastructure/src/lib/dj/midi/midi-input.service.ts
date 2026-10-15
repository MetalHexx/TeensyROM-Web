import { Injectable, computed, inject } from '@angular/core';
import { logError, logInfo, logWarn, LogType } from '@teensyrom-nx/utils';
import type { IMidiInput, MidiInputMessage, MidiInputOpenResult } from '@teensyrom-nx/application';
import { MidiAccessService, type MIDIInputLike } from './midi-access.service';

type MidiInputListener = (message: MidiInputMessage) => void;

/** Status bytes below this are data bytes; at or above `SYSTEM_STATUS` they are system messages
 *  (SysEx, clock, active sensing, …) that carry no channel. */
const STATUS_MIN = 0x80;
const SYSTEM_STATUS = 0xf0;
const CC_PRESSED_THRESHOLD = 64;

/**
 * Reads notes and control changes from MIDI controllers. Works over the page-level access
 * `MidiAccessService` already holds: it never prompts, and it opens a port only when asked to —
 * enumeration alone opens nothing. Bytes are decoded here, at the edge, so listeners only ever see
 * `MidiInputMessage`.
 */
@Injectable({ providedIn: 'root' })
export class MidiInputService implements IMidiInput {
  private readonly midiAccess = inject(MidiAccessService);

  readonly inputs = computed(() => this.midiAccess.inputPorts());

  /** portId → the input object that `open()` attached a handler to. */
  private readonly opened = new Map<string, MIDIInputLike>();
  private readonly listeners = new Set<MidiInputListener>();

  /**
   * `missing` when no such input is enumerated or it is disconnected; `unavailable` when it is
   * listed but would not open — another application such as a DAW most likely holds it. Idempotent
   * on an open port. Never rejects.
   */
  async open(portId: string): Promise<MidiInputOpenResult> {
    const input = this.midiAccess.inputFor(portId);
    if (input === null || input.state === 'disconnected') {
      return 'missing';
    }
    if (this.opened.get(portId) === input && input.connection === 'open') {
      return 'open';
    }

    try {
      await input.open();
    } catch (error) {
      logWarn(`MIDI: input "${portId}" could not be opened — ${error}`);
      return 'unavailable';
    }
    if (input.connection !== 'open') {
      logWarn(`MIDI: input "${portId}" did not open; another application may be holding it.`);
      return 'unavailable';
    }

    input.onmidimessage = (event) => this.handle(portId, event.data);
    this.opened.set(portId, input);
    logInfo(LogType.Midi, `MIDI: input "${portId}" opened.`);
    return 'open';
  }

  /** Stops delivery from `portId` and releases it. A no-op for a port this service has not opened. */
  close(portId: string): void {
    const input = this.opened.get(portId);
    if (input === undefined) {
      return;
    }
    this.opened.delete(portId);
    input.onmidimessage = null;
    void input.close().catch((error: unknown) => {
      logWarn(`MIDI: input "${portId}" did not close cleanly — ${error}`);
    });
  }

  /** True only while `open()` has succeeded for `portId` and the port still reports itself open. */
  isOpen(portId: string): boolean {
    return this.opened.get(portId)?.connection === 'open';
  }

  subscribe(listener: MidiInputListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private handle(portId: string, data: Uint8Array | null): void {
    const message = decode(portId, data);
    if (message === null) {
      return;
    }
    for (const listener of this.listeners) {
      try {
        listener(message);
      } catch (error) {
        logError('MIDI: an input listener threw.', error);
      }
    }
  }
}

/** A note or CC message, or null for anything else — malformed data, system messages and every
 *  channel message type other than note-on, note-off and control change. */
function decode(portId: string, data: Uint8Array | null): MidiInputMessage | null {
  if (data === null || data.length < 3) {
    return null;
  }
  const [status, number, value] = data;
  if (
    status < STATUS_MIN ||
    status >= SYSTEM_STATUS ||
    number >= STATUS_MIN ||
    value >= STATUS_MIN
  ) {
    return null;
  }

  const channel = (status & 0x0f) + 1;
  switch (status & 0xf0) {
    case 0x90:
      return { portId, kind: 'note', channel, number, value, pressed: value > 0 };
    case 0x80:
      return { portId, kind: 'note', channel, number, value: 0, pressed: false };
    case 0xb0:
      return { portId, kind: 'cc', channel, number, value, pressed: value >= CC_PRESSED_THRESHOLD };
    default:
      return null;
  }
}
