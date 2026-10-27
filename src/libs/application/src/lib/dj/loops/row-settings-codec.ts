import { logWarn } from '@teensyrom-nx/utils';
import type { PlainValue } from '@sidablist/tunes';
import type { DeckMixerSettings } from '../dj-store';
import { SPEED_INPUT_SPAN } from '../mixer/speed-excursion';
import { clamp } from './loop-marker-math';
import { decodeMixerSettings, encodeMixerSettings } from './marker-settings-codec';

const VERSION = 1;

/** What a set row keeps of one subtune's main track: the mixer settings, the speed fader and
 *  Repeat. Holds, nudges and the nudged tempo are never part of it. */
export interface DeckRowSettings {
  readonly mixer: DeckMixerSettings;
  /** The speed fader's value, 0.5–1.5. */
  readonly speed: number;
  readonly repeat: boolean;
}

/** The app's own versioned shape inside a subtune's `settings`:
 *  `{ v: 1, mixer: {…}, speed, repeat }`. */
export function encodeRowSettings(settings: DeckRowSettings): PlainValue {
  return {
    v: VERSION,
    mixer: encodeMixerSettings(settings.mixer),
    speed: settings.speed,
    repeat: settings.repeat,
  };
}

function isRecord(value: PlainValue | undefined): value is { readonly [key: string]: PlainValue } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function malformed(): null {
  logWarn('Row settings: ignoring stored settings of another version or malformed.');
  return null;
}

/** The stored value back as settings. Null, silently, when it is absent, the normal case for a
 *  subtune nothing was kept for; null with one `logWarn` when it is of another version or
 *  malformed. The speed is bounded to the fader's travel. */
export function decodeRowSettings(value: PlainValue | undefined): DeckRowSettings | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (!isRecord(value) || value['v'] !== VERSION) {
    return malformed();
  }
  const { mixer: storedMixer, speed, repeat } = value;
  if (storedMixer === undefined || storedMixer === null) {
    return malformed();
  }
  // A malformed mixer value is warned about by the mixer codec itself.
  const mixer = decodeMixerSettings(storedMixer);
  if (mixer === null) {
    return null;
  }
  if (typeof speed !== 'number' || !Number.isFinite(speed) || typeof repeat !== 'boolean') {
    return malformed();
  }
  return { mixer, speed: clamp(speed, 1 - SPEED_INPUT_SPAN, 1 + SPEED_INPUT_SPAN), repeat };
}
