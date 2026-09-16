import { Injectable, signal } from '@angular/core';
import { logInfo, logWarn, LogType } from '@teensyrom-nx/utils';
import type {
  IMidiAccess,
  MidiAccessState,
  MidiPermission,
  MidiPortOption,
} from '@teensyrom-nx/application';
import type { MidiOutputPort } from '@sidablist/asid';
import { midiOutputPortFrom } from '@sidablist/asid/web-midi';

/**
 * TypeScript's bundled DOM lib declares `Navigator.requestMIDIAccess` itself, but the types behind
 * it are incomplete: `MIDIOutputMap` only exposes `forEach` (no `get`), and `MIDIOutput.send` is
 * typed to take `number[]` rather than the `Uint8Array` every browser actually accepts. Rather than
 * pull in `@types/webmidi` for the rest of the surface, this file works against its own minimal
 * shape and casts the real access object into it once, at the boundary.
 */
export interface MIDIOutputLike {
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
 * Page-level Web MIDI access: one instance for the whole app injector, holding the permission
 * grant, the enumerated output list, and which holder currently holds each port. A holder's own
 * selection, its persistence, and its identify gesture live above this service in application
 * code, which claims a port here and routes its `send`/`cancelPending` calls through this service
 * by port id.
 */
@Injectable({ providedIn: 'root' })
export class MidiAccessService implements IMidiAccess {
  readonly accessState = signal<MidiAccessState>('idle');
  readonly ports = signal<readonly MidiPortOption[]>([]);
  readonly lastError = signal<string | null>(null);

  private access: MIDIAccessLike | null = null;
  /** portId → the id of the holder currently holding it. A holder holds at most one port at a
   *  time — `claim()` releases whatever the calling holder held before recording the new one. */
  private readonly claims = new Map<string, string>();
  /** The most recently wrapped output and its wrapper, per port id — see `outputPortFor`. */
  private readonly wrapped = new Map<string, { output: MIDIOutputLike; port: MidiOutputPort }>();

  /**
   * The origin's standing Web MIDI (SysEx) permission, read via the Permissions API without
   * prompting. `unsupported` when the browser exposes no `requestMIDIAccess` at all; `prompt`
   * when the Permissions API itself cannot answer — absent, throws, or does not know the `midi`
   * name — since that is the safe default a caller should treat the same as "not yet decided".
   * Never rejects.
   */
  async queryPermission(): Promise<MidiPermission> {
    if (!this.ensureSupported()) {
      return 'unsupported';
    }

    try {
      const status = await navigator.permissions?.query(
        // `lib.dom`'s `PermissionName` does not list `midi` and `PermissionDescriptor` has no
        // `sysex` — the real, browser-supported query shape has both, so the cast is required.
        { name: 'midi', sysex: true } as unknown as PermissionDescriptor
      );
      const permission = (status?.state as MidiPermission | undefined) ?? 'prompt';
      logInfo(LogType.Midi, `MIDI: queryPermission() → ${permission}`);
      return permission;
    } catch (error) {
      logInfo(LogType.Midi, `MIDI: queryPermission() could not read a standing grant — ${error}`);
      return 'prompt';
    }
  }

  /**
   * Triggers the browser's SysEx permission prompt. Must be called from a user gesture — Chrome
   * silently ignores (or Firefox queues) a request made outside one, and `access.outputs` stays
   * empty until the promise resolves either way.
   *
   * Idempotent once granted: a second call while `accessState()` is already `'granted'`
   * re-enumerates rather than re-prompting, so any holder's Enable MIDI button can call this with
   * no knowledge of whether another one already has.
   */
  async requestAccess(): Promise<void> {
    if (this.accessState() === 'granted') {
      this.refreshPorts();
      return;
    }

    if (!this.ensureSupported()) {
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

  /** Which holder currently holds this port, or null. */
  holderOf(portId: string): string | null {
    return this.claims.get(portId) ?? null;
  }

  /**
   * Records the claim; false when another holder already holds it. Releases the calling holder's
   * previous claim on success, so a holder can never be shown as holding two ports at once.
   */
  claim(holder: string, portId: string): boolean {
    const currentHolder = this.claims.get(portId);
    if (currentHolder !== undefined && currentHolder !== holder) {
      return false;
    }
    this.release(holder);
    this.claims.set(portId, holder);
    return true;
  }

  /** Drops whatever port `holder` currently holds. A no-op when it holds none. */
  release(holder: string): void {
    for (const [portId, currentHolder] of this.claims) {
      if (currentHolder === holder) {
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
      logWarn(
        `MIDI: send() called for a port that is not a current output — "${portId}" — bytes dropped.`
      );
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

  /** The bound output object for `portId`, or null when it names no currently enumerated output.
   *  Public so a caller outside this service — the ASID adapter — can reach the raw output it has to
   *  wrap; the permission request and the enumeration it depends on are unchanged. */
  outputFor(portId: string): MIDIOutputLike | null {
    return this.access?.outputs.get(portId) ?? null;
  }

  /** `portId` wrapped for an ASID sink, memoised on the underlying output object's identity rather
   *  than on `portId` alone — a same-id reconnect that replaces the output object re-wraps instead
   *  of sending into the detached one, and a steady stream of sends costs one map lookup rather
   *  than a fresh wrapper. Null when `portId` names no currently enumerated output. */
  outputPortFor(portId: string): MidiOutputPort | null {
    const output = this.outputFor(portId);
    if (output === null) {
      this.wrapped.delete(portId);
      return null;
    }
    const existing = this.wrapped.get(portId);
    if (existing !== undefined && existing.output === output) {
      return existing.port;
    }
    // The service works against its own minimal shape of the output; `midiOutputPortFrom` works
    // against the DOM lib's. Both describe the same object — this is where they meet.
    const port = midiOutputPortFrom(output as unknown as MIDIOutput);
    this.wrapped.set(portId, { output, port });
    return port;
  }

  /** `false` when `navigator.requestMIDIAccess` is missing — Web MIDI is unsupported in this
   *  browser — after setting `accessState`/`lastError` to say so; shared by `queryPermission` and
   *  `requestAccess` so the two never disagree about what "unsupported" looks like. */
  private ensureSupported(): boolean {
    if (typeof navigator.requestMIDIAccess === 'function') {
      return true;
    }
    this.accessState.set('unsupported');
    this.lastError.set('Web MIDI is not available in this browser. Try Chrome or Edge.');
    logWarn('MIDI: navigator.requestMIDIAccess is unavailable — Web MIDI unsupported here.');
    return false;
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
