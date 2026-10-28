import { signalStore, withState, StateSignals, WritableStateSource } from '@ngrx/signals';
import { withDevtools } from '@angular-architects/ngrx-toolkit';
import { withDjActions } from './actions';
import { withDjSelectors } from './selectors';
import type { Slot } from './slot';
import type { DjFileKey } from './dj-file-key.util';
import type { MidiAccessState, MidiPortOption } from './ports/midi-access';
import type { SetSummary, TuneReference, TuneSet } from '@sidablist/tunes';

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

export type PanelWaveform = 'triangle' | 'sawtooth' | 'pulse' | 'noise';

export type PanelFilterMode = 'low-pass' | 'band-pass' | 'high-pass';

/** `null` follows the tune; `true`/`false` is locked on/off. */
export type SwitchLock = boolean | null;

/** A voice's Ring, Sync or Filter-routing switch. */
export type VoiceSwitch = 'ring' | 'sync' | 'filter';

/** One voice's strip of the panel: offsets in the field's own units (integers except `fine`) and
 *  locks that hand the field back to the tune when `null`. */
export interface VoiceStripState {
  /** Whole semitones. */
  coarse: number;
  /** Cents, full resolution. */
  fine: number;
  pulseWidth: number;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  waveformLock: PanelWaveform | null;
  ringLock: SwitchLock;
  syncLock: SwitchLock;
  filterLock: SwitchLock;
}

/** One deck's SID panel: three voice strips, the filter offsets and lock, and Key. */
export interface DeckPanelState {
  /** Engine order, voice 0…2. */
  voices: readonly [VoiceStripState, VoiceStripState, VoiceStripState];
  cutoff: number;
  resonance: number;
  filterModeLock: PanelFilterMode | null;
  /** Integer −12…+12. */
  keySemitones: number;
}

/** A voice strip at home: every offset 0, every lock handed back to the tune. */
export const HOME_VOICE_STRIP: VoiceStripState = {
  coarse: 0,
  fine: 0,
  pulseWidth: 0,
  attack: 0,
  decay: 0,
  sustain: 0,
  release: 0,
  waveformLock: null,
  ringLock: null,
  syncLock: null,
  filterLock: null,
};

/** A whole panel at home. */
export const HOME_DECK_PANEL: DeckPanelState = {
  voices: [{ ...HOME_VOICE_STRIP }, { ...HOME_VOICE_STRIP }, { ...HOME_VOICE_STRIP }],
  cutoff: 0,
  resonance: 0,
  filterModeLock: null,
  keySemitones: 0,
};

/** A marker's own copy of the deck's mixer settings: the SID panel as the knobs hold it, and each
 *  voice's latched mute. Speed and the Kill/Punch holds are never part of it. */
export interface DeckMixerSettings {
  readonly panel: DeckPanelState;
  /** Voice 0…2's latched mute. */
  readonly mutes: readonly [boolean, boolean, boolean];
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
  /** The engine-reported tempo multiplier, home 1. It is what the speed display shows. */
  speed: number;
  /** The speed fader's own value, home 1. Jumps move it within 0.3–1.7; the screen pins its thumb
   *  to the fader's 0.5–1.5 travel. A nudge never moves it. */
  faderSpeed: number;
  /** True while either nudge is held. The speed display tints magenta while this is set. */
  nudging: boolean;
  /** Microseconds per play call for the loaded tune, or null while nothing is loaded. Converts
   *  `positionFrames` (play calls) to time. */
  playCallIntervalUs: number | null;
  voices: readonly DeckVoiceState[];
  detectedKey: DeckDetectedKey | null;
  /** True only while `DeckService` runs a load or subtune switch — narrower than `busy`, which
   *  also spans the `await` in a play toggle. */
  switching: boolean;
}

/** One deck slot's cartridge binding. The binding is to the device; the MIDI output is only where
 *  that device currently shows up. */
export interface DeckBindingState {
  /** The bound cartridge; `name` is the last one seen. */
  device: { id: string; name: string } | null;
  /** The device's resolved MIDI output, `null` while it is absent. */
  portId: string | null;
  present: boolean;
  error: string | null;
}

export interface MidiState {
  accessState: MidiAccessState;
  ports: readonly MidiPortOption[];
  lastError: string | null;
}

/** One end of a marker: the frame the performer captured it at and the signed nudge applied to it.
 *  The frame the engine jumps to is `max(0, frame + offsetFrames)`. */
export interface DeckLoopBoundary {
  readonly frame: number;
  readonly offsetFrames: number;
}

/** One saved position in the tune: a cue when it has no end, a loop when it has one. */
export interface DeckLoopMarker {
  readonly id: string;
  /** What the performer called it; null shows as 'Item N' by list position. */
  readonly name: string | null;
  readonly start: DeckLoopBoundary;
  readonly end: DeckLoopBoundary | null;
  readonly voices: readonly number[];
  /** Its resolved start frame is in the engine's `preparedFrames`: a jump to it lands instantly. */
  readonly ready: boolean;
  /** Its own settings; null until GBL is first unlatched, and kept when GBL latches again. */
  readonly settings: DeckMixerSettings | null;
  /** GBL unlatched: the marker plays with `settings`. False, the default, shares the main track's.
   *  Implies `settings !== null`. */
  readonly ownSettings: boolean;
}

/** One deck's markers for the tune it holds, and where the performer is working in them. */
export interface DeckLoopsState {
  /** List order is the 'Item N' order. */
  markers: readonly DeckLoopMarker[];
  selectedId: string | null;
  /** A marker loop the engine is running. */
  runningId: string | null;
  /** Queued in the engine, or waiting for readiness. */
  queuedId: string | null;
  selectionMovedWhileQueued: boolean;
  /** Frames, ascending, from the tune index. */
  detectedMoments: readonly number[];
  /** The marker whose own settings are in play, or null while the main track's are. */
  settingsInPlayId: string | null;
  /** The main track's settings, held aside while a marker's own are in play; null otherwise,
   *  when the panel and the engine's mutes are the main track's. */
  mainSettings: DeckMixerSettings | null;
}

/** The row a deck holds, and the subtune its loops and settings are kept under. */
export interface DeckHolding {
  readonly setId: string;
  readonly rowId: string;
  readonly sidHash: string;
  readonly subtune: number;
}

export type SetsSaveStatus = 'saved' | 'saving' | 'failed';

/** A SID dropped into the card that is still fetching: not yet a row, since its hash is unknown.
 *  `index` is the insertion gap among the set's real rows. */
export interface PendingRow {
  readonly key: string;
  readonly setId: string;
  readonly index: number;
  readonly title: string;
  readonly author: string;
}

export type RowPrep =
  | { readonly phase: 'analyzing' }
  | { readonly phase: 'unavailable'; readonly reason: string };

export interface DjSetsState {
  ready: boolean;
  /** Every saved set, for the tree. */
  summaries: readonly SetSummary[];
  currentSetId: string | null;
  /** Working copies: the current set and any set a deck holds a row of. */
  open: Record<string, TuneSet>;
  holdings: Record<Slot, DeckHolding | null>;
  /** The set knob's selection in the current set. */
  selectedRowId: string | null;
  /** Bumped by every Select command, even at an end. */
  selectTurns: number;
  pending: readonly PendingRow[];
  /** By row id. */
  prep: Record<string, RowPrep>;
  save: SetsSaveStatus;
  announcement: { readonly seq: number; readonly text: string } | null;
}

export interface DjState {
  decks: Record<Slot, DeckState>;
  bindings: Record<Slot, DeckBindingState>;
  midi: MidiState;
  seen: Record<DjFileKey, TuneReference>;
  panel: Record<Slot, DeckPanelState>;
  loops: Record<Slot, DeckLoopsState>;
  keyDisplayFormat: KeyDisplayFormat;
  sets: DjSetsState;
}

/** A deck holding no markers: its loop state while nothing is attached. */
export const EMPTY_DECK_LOOPS: DeckLoopsState = {
  markers: [],
  selectedId: null,
  runningId: null,
  queuedId: null,
  selectionMovedWhileQueued: false,
  detectedMoments: [],
  settingsInPlayId: null,
  mainSettings: null,
};

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
  faderSpeed: 1,
  nudging: false,
  playCallIntervalUs: null,
  voices: [
    { muted: false, held: false },
    { muted: false, held: false },
    { muted: false, held: false },
  ],
  detectedKey: null,
  switching: false,
};

const initialBindingState: DeckBindingState = {
  device: null,
  portId: null,
  present: false,
  error: null,
};

const initialState: DjState = {
  decks: { A: { ...initialDeckState }, B: { ...initialDeckState } },
  bindings: { A: { ...initialBindingState }, B: { ...initialBindingState } },
  midi: { accessState: 'idle', ports: [], lastError: null },
  seen: {},
  panel: { A: HOME_DECK_PANEL, B: HOME_DECK_PANEL },
  loops: { A: EMPTY_DECK_LOOPS, B: EMPTY_DECK_LOOPS },
  keyDisplayFormat: 'camelot',
  sets: {
    ready: false,
    summaries: [],
    currentSetId: null,
    open: {},
    holdings: { A: null, B: null },
    selectedRowId: null,
    selectTurns: 0,
    pending: [],
    prep: {},
    save: 'saved',
    announcement: null,
  },
};

export const DjStore = signalStore(
  { providedIn: 'root' },
  withDevtools('dj'),
  withState(initialState),
  withDjSelectors(),
  withDjActions()
);
