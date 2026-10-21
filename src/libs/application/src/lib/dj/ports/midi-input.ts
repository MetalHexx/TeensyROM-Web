import { InjectionToken, Signal } from '@angular/core';

export interface MidiInputPort {
  readonly id: string;
  readonly name: string;
  readonly manufacturer: string;
  readonly connected: boolean;
}

/**
 * A decoded note or control change; no raw bytes ever cross this port.
 *
 * A note: `value` is the velocity (0 on release) and `pressed` is note-on with velocity > 0.
 * A CC: `value` is 0–127 and `pressed` is `value >= 64`, so a CC button acts as a key.
 */
export interface MidiInputMessage {
  readonly portId: string;
  readonly kind: 'note' | 'cc';
  /** 1–16. */
  readonly channel: number;
  /** 0–127: the note number or the controller number. */
  readonly number: number;
  /** 0–127. */
  readonly value: number;
  readonly pressed: boolean;
}

/**
 * `open`: the port is held and delivering. `unavailable`: the port is listed but could not be
 * opened — another application such as a DAW most likely holds it. `missing`: no such input, or it
 * is disconnected.
 */
export type MidiInputOpenResult = 'open' | 'unavailable' | 'missing';

/**
 * Reads MIDI input from controllers. Access is granted through `IMidiAccess.requestAccess()`; this
 * port never prompts and never opens a port the application did not ask for.
 */
export interface IMidiInput {
  /** Every enumerated input; empty until MIDI access is granted. */
  readonly inputs: Signal<readonly MidiInputPort[]>;
  /** Idempotent; never rejects. */
  open(portId: string): Promise<MidiInputOpenResult>;
  /** Idempotent. */
  close(portId: string): void;
  isOpen(portId: string): boolean;
  /** Registers `listener` for every decoded message from every open port; returns the unsubscribe. */
  subscribe(listener: (message: MidiInputMessage) => void): () => void;
}

export const MIDI_INPUT = new InjectionToken<IMidiInput>('MIDI_INPUT');
