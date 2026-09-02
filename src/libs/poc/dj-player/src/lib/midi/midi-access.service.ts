import { Injectable, signal } from '@angular/core';
import { logInfo, logWarn, LogType } from '@teensyrom-nx/utils';

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
   * that omitted it. Detected on the port object itself (see `supportsCancel`), never assumed from
   * a browser check, and `cancelPending()` never calls it without confirming it exists first.
   */
  clear?: () => void;
}
interface MIDIAccessLike {
  outputs: Map<string, MIDIOutputLike>;
  onstatechange: ((e: unknown) => void) | null;
}

/**
 * Page-level Web MIDI access: one instance for the origin, holding the permission grant, the
 * enumerated output list, and which deck currently holds each port. Per-deck concerns — a deck's
 * own selection, its persistence, and identify — live in `DeckMidiBinding`, which claims a port
 * here and routes its `send`/`cancelPending` calls through this service by port id.
 *
 * Provided by the view rather than `root` — this is a quarantined POC surface and should not
 * register a provider in the app injector.
 */
@Injectable()
export class MidiAccessService {
  readonly accessState = signal<MidiAccessState>('idle');
  readonly ports = signal<readonly MidiPortOption[]>([]);
  readonly lastError = signal<string | null>(null);

  private access: MIDIAccessLike | null = null;
  /** portId → the id of the deck currently holding it. A deck holds at most one port at a time —
   *  `claim()` releases whatever the calling deck held before recording the new one. */
  private readonly claims = new Map<string, string>();

  /**
   * Triggers the browser's SysEx permission prompt. Must be called from a user gesture — Chrome
   * silently ignores (or Firefox queues) a request made outside one, and `access.outputs` stays
   * empty until the promise resolves either way.
   *
   * Idempotent once granted: a second call while `accessState()` is already `'granted'`
   * re-enumerates rather than re-prompting, so either deck's Enable MIDI button can call this with
   * no knowledge of whether the other one already has.
   */
  async requestAccess(): Promise<void> {
    if (this.accessState() === 'granted') {
      this.refreshPorts();
      return;
    }

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
    logInfo(LogType.Midi, 'MIDI: SysEx access granted.');
  }

  /** Which deck currently holds this port, or null. */
  deckHolding(portId: string): string | null {
    return this.claims.get(portId) ?? null;
  }

  /**
   * Records the claim; false when another deck already holds it. Releases the calling deck's
   * previous claim on success, so a deck can never be shown as holding two ports at once.
   */
  claim(deckId: string, portId: string): boolean {
    const holder = this.claims.get(portId);
    if (holder !== undefined && holder !== deckId) {
      return false;
    }
    this.release(deckId);
    this.claims.set(portId, deckId);
    return true;
  }

  /** Drops whatever port `deckId` currently holds. A no-op when it holds none. */
  release(deckId: string): void {
    for (const [portId, holder] of this.claims) {
      if (holder === deckId) {
        this.claims.delete(portId);
      }
    }
  }

  /** No-op with a warning when `portId` names no currently enumerated output — bytes dropped.
   * `timestampMs` passes straight through to the underlying `output.send`; omitting it sends
   * immediately. */
  send(portId: string, bytes: Uint8Array, timestampMs?: number): void {
    const output = this.outputFor(portId);
    if (!output) {
      logWarn(`MIDI: send() called for a port that is not a current output — "${portId}" — bytes dropped.`);
      return;
    }

    if (timestampMs === undefined) {
      output.send(bytes);
    } else {
      output.send(bytes, timestampMs);
    }
  }

  /**
   * Cancels whatever is still sitting in `portId`'s timestamped send queue, if the browser exposes
   * a way to. Returns whether it actually cancelled — `false` covers "no such port" and "the port
   * has no `clear()`" alike, so a caller never has to separately check `supportsCancel()` before
   * trusting the result. Never throws: a `clear()` that misbehaves despite being detected as
   * present is swallowed and reported as "did not cancel", not propagated.
   */
  cancelPending(portId: string): boolean {
    const output = this.outputFor(portId);
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

  /** Whether `portId` currently exposes `clear()` — feature-detected on the port object itself,
   *  never assumed from a browser check. */
  supportsCancel(portId: string): boolean {
    return typeof this.outputFor(portId)?.clear === 'function';
  }

  private outputFor(portId: string): MIDIOutputLike | null {
    return this.access?.outputs.get(portId) ?? null;
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
  }
}

function describeAccessDenial(error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error);
  return `MIDI SysEx access was denied: ${detail}`;
}
