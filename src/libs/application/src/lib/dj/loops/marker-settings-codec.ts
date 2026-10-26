import { logWarn } from '@teensyrom-nx/utils';
import type { PlainValue } from '@sidablist/tunes';
import type {
  DeckMixerSettings,
  DeckPanelState,
  PanelFilterMode,
  PanelWaveform,
  SwitchLock,
  VoiceStripState,
} from '../dj-store';
import { PANEL_RANGES, bounded, type PanelRange } from '../mixer/panel-ranges';

const VERSION = 1;

const WAVEFORMS: readonly PanelWaveform[] = ['triangle', 'sawtooth', 'pulse', 'noise'];

const FILTER_MODES: readonly PanelFilterMode[] = ['low-pass', 'band-pass', 'high-pass'];

type PlainRecord = { readonly [key: string]: PlainValue };

function isRecord(value: PlainValue | undefined): value is PlainRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A finite number, bounded to the knob's travel; null for anything else. */
function knobOf(range: PanelRange, value: PlainValue | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? bounded(range, value) : null;
}

/** One of `allowed` or null (the tune's own); undefined for anything else. */
function choiceOf<T extends string>(
  allowed: readonly T[],
  value: PlainValue | undefined
): T | null | undefined {
  if (value === null) {
    return null;
  }
  return typeof value === 'string' ? allowed.find((candidate) => candidate === value) : undefined;
}

function switchLockOf(value: PlainValue | undefined): SwitchLock | undefined {
  return value === null || typeof value === 'boolean' ? value : undefined;
}

function decodeStrip(value: PlainValue | undefined): VoiceStripState | null {
  if (!isRecord(value)) {
    return null;
  }
  const coarse = knobOf(PANEL_RANGES.coarse, value['coarse']);
  const fine = knobOf(PANEL_RANGES.fine, value['fine']);
  const pulseWidth = knobOf(PANEL_RANGES.pulseWidth, value['pulseWidth']);
  const attack = knobOf(PANEL_RANGES.attack, value['attack']);
  const decay = knobOf(PANEL_RANGES.decay, value['decay']);
  const sustain = knobOf(PANEL_RANGES.sustain, value['sustain']);
  const release = knobOf(PANEL_RANGES.release, value['release']);
  const waveformLock = choiceOf(WAVEFORMS, value['waveformLock']);
  const ringLock = switchLockOf(value['ringLock']);
  const syncLock = switchLockOf(value['syncLock']);
  const filterLock = switchLockOf(value['filterLock']);
  if (
    coarse === null ||
    fine === null ||
    pulseWidth === null ||
    attack === null ||
    decay === null ||
    sustain === null ||
    release === null ||
    waveformLock === undefined ||
    ringLock === undefined ||
    syncLock === undefined ||
    filterLock === undefined
  ) {
    return null;
  }
  return {
    coarse,
    fine,
    pulseWidth,
    attack,
    decay,
    sustain,
    release,
    waveformLock,
    ringLock,
    syncLock,
    filterLock,
  };
}

function decodePanel(value: PlainValue | undefined): DeckPanelState | null {
  if (!isRecord(value) || !Array.isArray(value['voices']) || value['voices'].length !== 3) {
    return null;
  }
  const voices = value['voices'].map(decodeStrip);
  const cutoff = knobOf(PANEL_RANGES.cutoff, value['cutoff']);
  const resonance = knobOf(PANEL_RANGES.resonance, value['resonance']);
  const filterModeLock = choiceOf(FILTER_MODES, value['filterModeLock']);
  const keySemitones = knobOf(PANEL_RANGES.key, value['keySemitones']);
  const [first, second, third] = voices;
  if (
    !first ||
    !second ||
    !third ||
    cutoff === null ||
    resonance === null ||
    filterModeLock === undefined ||
    keySemitones === null
  ) {
    return null;
  }
  return { voices: [first, second, third], cutoff, resonance, filterModeLock, keySemitones };
}

function decodeMutes(value: PlainValue | undefined): DeckMixerSettings['mutes'] | null {
  if (!Array.isArray(value) || value.length !== 3) {
    return null;
  }
  const [first, second, third] = value;
  return typeof first === 'boolean' && typeof second === 'boolean' && typeof third === 'boolean'
    ? [first, second, third]
    : null;
}

/** The app's own versioned shape inside `LoopMarker.settings`: `{ v: 1, panel: {…}, mutes: [b, b, b] }`. */
export function encodeMixerSettings(settings: DeckMixerSettings): PlainValue {
  const { panel, mutes } = settings;
  return {
    v: VERSION,
    panel: {
      voices: panel.voices.map((strip) => ({
        coarse: strip.coarse,
        fine: strip.fine,
        pulseWidth: strip.pulseWidth,
        attack: strip.attack,
        decay: strip.decay,
        sustain: strip.sustain,
        release: strip.release,
        waveformLock: strip.waveformLock,
        ringLock: strip.ringLock,
        syncLock: strip.syncLock,
        filterLock: strip.filterLock,
      })),
      cutoff: panel.cutoff,
      resonance: panel.resonance,
      filterModeLock: panel.filterModeLock,
      keySemitones: panel.keySemitones,
    },
    mutes: [mutes[0], mutes[1], mutes[2]],
  };
}

/** The stored value back as settings. Null, silently, when it is absent, the normal case for a
 *  marker that never left GBL; null with one `logWarn` when it is of another version or malformed.
 *  Every number is bounded to its knob's travel. */
export function decodeMixerSettings(value: PlainValue | undefined): DeckMixerSettings | null {
  if (value === undefined || value === null) {
    return null;
  }
  const panel = isRecord(value) && value['v'] === VERSION ? decodePanel(value['panel']) : null;
  const mutes = isRecord(value) ? decodeMutes(value['mutes']) : null;
  if (panel === null || mutes === null) {
    logWarn('Marker settings: ignoring stored settings of another version or malformed.');
    return null;
  }
  return { panel, mutes };
}
