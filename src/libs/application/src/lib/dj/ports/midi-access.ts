import { InjectionToken, Signal } from '@angular/core';
import type { MidiOutputPort } from '@sidablist/asid';

export type MidiAccessState = 'idle' | 'requesting' | 'granted' | 'denied' | 'unsupported';

export interface MidiPortOption {
  readonly id: string;
  readonly name: string;
  readonly manufacturer: string;
}

/**
 * Page-level Web MIDI access: the permission grant, the enumerated output list, and which holder
 * currently holds each port. A holder is any application-side owner of a port claim — a deck, for
 * now — identified by an opaque string id it chooses itself.
 */
export interface IMidiAccess {
  readonly accessState: Signal<MidiAccessState>;
  readonly ports: Signal<readonly MidiPortOption[]>;
  readonly lastError: Signal<string | null>;
  /** Must be called from a user gesture. Idempotent once granted: re-enumerates. */
  requestAccess(): Promise<void>;
  /** Which slot holds `portId`, or null. */
  holderOf(portId: string): string | null;
  /** Records the claim; false when another holder has it. Releases the caller's previous claim on success. */
  claim(holder: string, portId: string): boolean;
  release(holder: string): void;
  /** `portId` wrapped for an ASID sink, memoised on the underlying output's identity; null when not enumerated. */
  outputPortFor(portId: string): MidiOutputPort | null;
}

export const MIDI_ACCESS = new InjectionToken<IMidiAccess>('MIDI_ACCESS');
