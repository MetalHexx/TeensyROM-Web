import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlainValue } from '@sidablist/tunes';
import { logWarn } from '@teensyrom-nx/utils';
import { HOME_DECK_PANEL, type DeckMixerSettings } from '../dj-store';
import { decodeRowSettings, encodeRowSettings, type DeckRowSettings } from './row-settings-codec';

vi.mock('@teensyrom-nx/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@teensyrom-nx/utils')>();
  return { ...actual, logWarn: vi.fn() };
});

const MIXER: DeckMixerSettings = {
  panel: { ...HOME_DECK_PANEL, cutoff: -300, keySemitones: 4 },
  mutes: [false, true, false],
};

const SETTINGS: DeckRowSettings = { mixer: MIXER, speed: 1.25, repeat: false };

/** The stored value as a store would hand it back: through JSON. */
function viaJson(value: PlainValue): PlainValue {
  return JSON.parse(JSON.stringify(value)) as PlainValue;
}

function stored(): Record<string, PlainValue> {
  return viaJson(encodeRowSettings(SETTINGS)) as Record<string, PlainValue>;
}

describe('row settings codec', () => {
  beforeEach(() => vi.mocked(logWarn).mockClear());

  it('round-trips the mixer settings, the speed and Repeat', () => {
    expect(decodeRowSettings(viaJson(encodeRowSettings(SETTINGS)))).toEqual(SETTINGS);
    expect(logWarn).not.toHaveBeenCalled();
  });

  it.each([undefined, null])('reads %s as nothing kept, without a warning', (value) => {
    expect(decodeRowSettings(value)).toBeNull();
    expect(logWarn).not.toHaveBeenCalled();
  });

  it.each([
    ['another version', { ...stored(), v: 2 }],
    ['a missing mixer', { ...stored(), mixer: null }],
    ['a mixer of another shape', { ...stored(), mixer: { v: 1, panel: 5, mutes: [] } }],
    ['a non-numeric speed', { ...stored(), speed: 'fast' }],
    ['a non-finite speed', { ...stored(), speed: null }],
    ['a missing Repeat', { ...stored(), repeat: undefined }],
    ['a non-record value', 'text'],
  ])('reads %s as nothing kept, with exactly one warning', (_name, value) => {
    expect(decodeRowSettings(value as PlainValue)).toBeNull();
    expect(logWarn).toHaveBeenCalledTimes(1);
  });

  it('bounds the speed to the fader travel', () => {
    expect(decodeRowSettings({ ...stored(), speed: 9 })?.speed).toBe(1.5);
    expect(decodeRowSettings({ ...stored(), speed: 0.01 })?.speed).toBe(0.5);
  });
});
