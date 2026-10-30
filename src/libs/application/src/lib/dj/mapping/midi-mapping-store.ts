import { signalStore, withState } from '@ngrx/signals';
import { withDevtools } from '../../with-devtools';
import { withMidiMappingActions } from './actions';
import { withMidiMappingSelectors } from './selectors';
import type {
  ControlIdentity,
  ControlMapping,
  KnownController,
  MidiSource,
} from './mapping.models';

/** Where a known controller stands right now. Runtime only; never saved. */
export type ControllerStatus =
  | 'listening'
  | 'off'
  | 'idle'
  | 'missing'
  | 'unavailable'
  | 'unmatched';

/** A mapping capture in progress for one control: waiting for the first message, then sampling
 *  the source it came from. */
export interface LearnState {
  readonly control: ControlIdentity;
  readonly phase: 'waiting' | 'sampling';
  /** The mapping id being re-learned, or `null` for a new binding. */
  readonly replacing: string | null;
  /** Set while sampling. */
  readonly source: MidiSource | null;
}

export interface MidiMappingState {
  loaded: boolean;
  controllers: readonly KnownController[];
  mappings: readonly ControlMapping[];
  mappingMode: boolean;
  learn: LearnState | null;
  /** Runtime only, never saved. */
  controllerStatus: Record<string, ControllerStatus>;
  /** Runtime only: the resolved input port per controller. */
  controllerPorts: Record<string, string | null>;
  /** The latest live-region message. */
  announcement: string | null;
}

const initialState: MidiMappingState = {
  loaded: false,
  controllers: [],
  mappings: [],
  mappingMode: false,
  learn: null,
  controllerStatus: {},
  controllerPorts: {},
  announcement: null,
};

/** The MIDI controllers the app knows and the mappings from their sources onto controls. */
export const MidiMappingStore = signalStore(
  { providedIn: 'root' },
  withDevtools('midi-mapping'),
  withState(initialState),
  withMidiMappingSelectors(),
  withMidiMappingActions()
);
