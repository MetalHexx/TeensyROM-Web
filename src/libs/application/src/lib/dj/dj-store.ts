import { signalStore, withState, StateSignals, WritableStateSource } from '@ngrx/signals';
import { withDevtools } from '@angular-architects/ngrx-toolkit';
import { withDjActions } from './actions';
import { withDjSelectors } from './selectors';
import type { Slot } from './slot';
import type { DjFileKey } from './dj-file-key.util';
import type { MidiAccessState, MidiPortOption } from './ports/midi-access';
import type { TuneReference } from '@sidablist/tunes';

export type WritableStore<T extends object> = StateSignals<T> & WritableStateSource<T>;

export type DeckStatus =
  | 'empty'
  | 'loading'
  | 'indexing'
  | 'playing'
  | 'paused'
  | 'stopped'
  | 'failed';

export interface DeckStructure {
  readonly loopStartFrame: number | null;
  readonly loopPeriodFrames: number | null;
  readonly endedAtFrame: number | null;
}

export interface DeckState {
  loaded: TuneReference | null;
  status: DeckStatus;
  positionFrames: number;
  lengthFrames: number | null;
  structure: DeckStructure | null;
  subtune: number;
  subtuneCount: number;
  repeat: boolean;
  error: string | null;
}

export interface DeckBindingState {
  port: { id: string; name: string } | null;
  portPresent: boolean;
  device: { id: string; name: string } | null;
  devicePresent: boolean;
  error: string | null;
}

export interface MidiState {
  accessState: MidiAccessState;
  ports: readonly MidiPortOption[];
  lastError: string | null;
}

export interface DjState {
  decks: Record<Slot, DeckState>;
  bindings: Record<Slot, DeckBindingState>;
  midi: MidiState;
  seen: Record<DjFileKey, TuneReference>;
}

const initialDeckState: DeckState = {
  loaded: null,
  status: 'empty',
  positionFrames: 0,
  lengthFrames: null,
  structure: null,
  subtune: 0,
  subtuneCount: 0,
  repeat: true,
  error: null,
};

const initialBindingState: DeckBindingState = {
  port: null,
  portPresent: false,
  device: null,
  devicePresent: false,
  error: null,
};

const initialState: DjState = {
  decks: { A: { ...initialDeckState }, B: { ...initialDeckState } },
  bindings: { A: { ...initialBindingState }, B: { ...initialBindingState } },
  midi: { accessState: 'idle', ports: [], lastError: null },
  seen: {},
};

export const DjStore = signalStore(
  { providedIn: 'root' },
  withDevtools('dj'),
  withState(initialState),
  withDjSelectors(),
  withDjActions()
);
