import { InjectionToken } from '@angular/core';
import type { Slot } from '../slot';

export type MappingStyleKind =
  | 'press'
  | 'release'
  | 'latch'
  | 'on'
  | 'off'
  | 'hold'
  | 'absolute'
  | 'relative-offset'
  | 'relative-signed'
  | 'step';

export interface KnownControllerRecord {
  readonly id: string;
  readonly name: string;
  readonly lastPortId: string | null;
  readonly listening: boolean;
}

export interface MidiSourceRecord {
  readonly controllerId: string;
  readonly channel: number;
  readonly kind: 'note' | 'cc';
  readonly number: number;
}

export interface ControlMappingRecord {
  readonly id: string;
  readonly source: MidiSourceRecord;
  readonly owner: Slot | 'mixer';
  readonly control: string;
  readonly style: { readonly kind: MappingStyleKind; readonly amount: number | null };
}

/** Which TeensyROM device a deck slot is bound to, and the name it last went by. */
export interface DeckDeviceBindingRecord {
  readonly slot: Slot;
  readonly deviceId: string;
  readonly lastSeenName: string;
}

/** The whole MIDI settings set, as the server stores it. It is always read and written whole. */
export interface MidiSettingsRecord {
  readonly controllers: readonly KnownControllerRecord[];
  readonly mappings: readonly ControlMappingRecord[];
  readonly deckBindings: readonly DeckDeviceBindingRecord[];
}

/** Persists the MIDI settings set server-side so it survives a cleared browser. */
export interface IMidiSettingsRepository {
  load(): Promise<MidiSettingsRecord>;
  save(settings: MidiSettingsRecord): Promise<void>;
}

export const MIDI_SETTINGS_REPOSITORY = new InjectionToken<IMidiSettingsRepository>(
  'MIDI_SETTINGS_REPOSITORY'
);
