import type { MappingStyleKind } from '../ports';
import type { Slot } from '../slot';

/** Every deck control a MIDI source can drive. The server's allow-list mirrors this list.
 *
 *  Adding a control also takes its `MappableControls` entry, an anchor in the dj-mixer feature's
 *  `CONTROL_ANCHORS` (plus the `data-control` attribute on the element), and the name in the
 *  backend's `MidiSettingsAllowLists.DeckControls`. */
export const DECK_CONTROL_IDS = [
  'play-pause',
  'stop',
  'subtune-previous',
  'subtune-next',
  'seek',
  'speed',
  'speed-jump-up',
  'speed-jump-home',
  'speed-jump-down',
  'repeat',
  'voice-1-mute',
  'voice-2-mute',
  'voice-3-mute',
  'voice-1-hold',
  'voice-2-hold',
  'voice-3-hold',
  'clear-voice-mutes',
  'key',
] as const;

export type DeckControlId = (typeof DECK_CONTROL_IDS)[number];

export type ControlId = DeckControlId;

/** Who a control belongs to. A later surface (a playlist) adds one member here. */
export type ControlOwner = Slot | 'mixer';

export interface ControlIdentity {
  readonly owner: ControlOwner;
  readonly control: ControlId;
}

/** How a control behaves: a trigger fires, a state is on or off, a value has a range, and a hold
 *  is on only while its key is down. */
export type ControlNature = 'trigger' | 'state' | 'value' | 'hold';

export type MidiSourceKind = 'note' | 'cc';

export interface MidiSource {
  readonly controllerId: string;
  /** 1–16. */
  readonly channel: number;
  readonly kind: MidiSourceKind;
  /** 0–127: the note number or the controller number. */
  readonly number: number;
}

export interface MappingStyle {
  readonly kind: MappingStyleKind;
  /** A fraction of the control's range; `null` for every kind that takes none. */
  readonly amount: number | null;
}

export interface ControlMapping {
  readonly id: string;
  readonly source: MidiSource;
  readonly control: ControlIdentity;
  readonly style: MappingStyle;
}

export interface KnownController {
  readonly id: string;
  readonly name: string;
  readonly lastPortId: string | null;
  readonly listening: boolean;
}

/** One decoded message from a source: `value` is 0–127 and `pressed` is its key edge state. */
export interface SourceEvent extends MidiSource {
  readonly value: number;
  readonly pressed: boolean;
}

const CONTROL_IDS: ReadonlySet<string> = new Set<string>(DECK_CONTROL_IDS);

export function isControlId(value: string): value is ControlId {
  return CONTROL_IDS.has(value);
}

/** The identity of a control, unique across owners. */
export function controlKey(identity: ControlIdentity): string {
  return `${identity.owner}:${identity.control}`;
}

/** The identity of a source, unique across controllers. */
export function sourceKey(source: MidiSource): string {
  return `${source.controllerId}|${source.channel}|${source.kind}|${source.number}`;
}
