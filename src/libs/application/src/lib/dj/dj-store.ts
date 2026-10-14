import { signalStore, withState, StateSignals, WritableStateSource } from '@ngrx/signals';
import { withDevtools } from '@angular-architects/ngrx-toolkit';
import { withDjActions } from './actions';
import { withDjSelectors } from './selectors';
import type { Slot } from './slot';
import type { DjFileKey } from './dj-file-key.util';
import type { MidiAccessState, MidiPortOption } from './ports/midi-access';
import type { TuneReference } from '@sidablist/tunes';
import type { SidFilterMode } from '@sidablist/core';

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

/** How the Key readout renders a tune's key. Camelot is the DJ-mixing wheel number; note is the
 *  compact music-theory name. */
export type KeyDisplayFormat = 'camelot' | 'note';

/** A tune's confidently detected key, narrowed from the index record to its non-null fields. */
export interface DeckDetectedKey {
  readonly tonic: number;
  readonly mode: 'major' | 'minor';
  readonly camelot: string;
}

/** One SID voice's latched mute and momentary hold, as the engine reports them. */
export interface DeckVoiceState {
  readonly muted: boolean;
  readonly held: boolean;
}

/** One deck's mixer and tune-shaping controls. Positions are held at full resolution; only
 *  `keySemitones` is a whole number. */
export interface DeckMixState {
  /** 0…1, home 1. */
  level: number;
  /** −1…+1, home 0. */
  cutoff: number;
  /** 0…1, home 0 — 0 plays the tune's own resonance. */
  resonance: number;
  /** −1…+1, home 0. */
  pulseWidth: number;
  /** Integer −12…+12, home 0. */
  keySemitones: number;
  /** `null` plays the tune's own filter-mode bits (home). The mixer card no longer offers a
   *  selector, so this stays `null` in production; it is kept so the selector can come back. */
  filterMode: SidFilterMode | null;
}

export interface DeckState {
  loaded: TuneReference | null;
  status: DeckStatus;
  /** True for the whole span of an in-flight load or subtune switch, regardless of what `status`
   *  shows — a cache hit never reports `loading`/`indexing`, so this is what actually gates the
   *  transport while one is in flight. */
  busy: boolean;
  positionFrames: number;
  lengthFrames: number | null;
  structure: DeckStructure | null;
  subtune: number;
  subtuneCount: number;
  repeat: boolean;
  error: string | null;
  /** The engine-reported tempo multiplier, home 1. */
  speed: number;
  voices: readonly DeckVoiceState[];
  detectedKey: DeckDetectedKey | null;
  /** True only while `DeckService` runs a load or subtune switch — narrower than `busy`, which
   *  also spans the `await` in a play toggle. */
  switching: boolean;
}

export interface DeckBindingState {
  port: { id: string; name: string } | null;
  portPresent: boolean;
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
  mix: Record<Slot, DeckMixState>;
  /** −1 hard A … +1 hard B, home 0. */
  crossfader: number;
  keyDisplayFormat: KeyDisplayFormat;
}

const initialDeckState: DeckState = {
  loaded: null,
  status: 'empty',
  busy: false,
  positionFrames: 0,
  lengthFrames: null,
  structure: null,
  subtune: 0,
  subtuneCount: 0,
  repeat: true,
  error: null,
  speed: 1,
  voices: [
    { muted: false, held: false },
    { muted: false, held: false },
    { muted: false, held: false },
  ],
  detectedKey: null,
  switching: false,
};

const initialMixState: DeckMixState = {
  level: 1,
  cutoff: 0,
  resonance: 0,
  pulseWidth: 0,
  keySemitones: 0,
  filterMode: null,
};

const initialBindingState: DeckBindingState = {
  port: null,
  portPresent: false,
  error: null,
};

const initialState: DjState = {
  decks: { A: { ...initialDeckState }, B: { ...initialDeckState } },
  bindings: { A: { ...initialBindingState }, B: { ...initialBindingState } },
  midi: { accessState: 'idle', ports: [], lastError: null },
  seen: {},
  mix: { A: { ...initialMixState }, B: { ...initialMixState } },
  crossfader: 0,
  keyDisplayFormat: 'camelot',
};

export const DjStore = signalStore(
  { providedIn: 'root' },
  withDevtools('dj'),
  withState(initialState),
  withDjSelectors(),
  withDjActions()
);
