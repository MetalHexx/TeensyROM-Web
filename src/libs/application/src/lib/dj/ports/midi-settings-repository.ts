import { InjectionToken } from '@angular/core';
import type { ControlOwner } from '../mapping/mapping.models';
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
  | 'step'
  | 'latch-release'
  | 'on-release'
  | 'off-release'
  | 'step-release'
  | 'hand';

export interface KnownControllerRecord {
  readonly id: string;
  readonly name: string;
  readonly lastPortId: string | null;
  readonly listening: boolean;
}

export interface MidiSourceRecord {
  readonly controllerId: string;
  readonly channel: number;
  readonly kind: 'note' | 'cc' | 'pitch-bend';
  readonly number: number;
}

export interface ControlMappingRecord {
  readonly id: string;
  readonly source: MidiSourceRecord;
  readonly owner: ControlOwner;
  readonly control: string;
  readonly style: {
    readonly kind: MappingStyleKind;
    readonly amount: number | null;
    readonly grip?: number;
  };
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

/** How a save is sent. `keepalive` asks the transport to complete the request even as the page
 *  unloads. */
export interface MidiSettingsSaveOptions {
  readonly keepalive?: boolean;
}

/** Persists the MIDI settings set server-side so it survives a cleared browser. */
export interface IMidiSettingsRepository {
  load(): Promise<MidiSettingsRecord>;
  save(settings: MidiSettingsRecord, options?: MidiSettingsSaveOptions): Promise<void>;
}

export const MIDI_SETTINGS_REPOSITORY = new InjectionToken<IMidiSettingsRepository>(
  'MIDI_SETTINGS_REPOSITORY'
);
