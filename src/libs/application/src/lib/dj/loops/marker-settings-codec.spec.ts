import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlainValue } from '@sidablist/tunes';
import { logWarn } from '@teensyrom-nx/utils';
import { HOME_DECK_PANEL, HOME_VOICE_STRIP, type DeckMixerSettings } from '../dj-store';
import { decodeMixerSettings, encodeMixerSettings } from './marker-settings-codec';

vi.mock('@teensyrom-nx/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@teensyrom-nx/utils')>();
  return { ...actual, logWarn: vi.fn() };
});

const SHAPED: DeckMixerSettings = {
  panel: {
    voices: [
      {
        ...HOME_VOICE_STRIP,
        coarse: -7,
        fine: 12.5,
        pulseWidth: 1000,
        attack: 3,
        decay: -2,
        sustain: 9,
        release: -15,
        waveformLock: 'sawtooth',
        ringLock: true,
        syncLock: false,
        filterLock: null,
      },
      { ...HOME_VOICE_STRIP, waveformLock: 'noise', filterLock: true },
      { ...HOME_VOICE_STRIP, coarse: 24 },
    ],
    cutoff: -400,
    resonance: 6,
    filterModeLock: 'high-pass',
    keySemitones: -5,
  },
  mutes: [true, false, true],
};

/** The stored value as a store would hand it back: through JSON. */
function viaJson(value: PlainValue): PlainValue {
  return JSON.parse(JSON.stringify(value)) as PlainValue;
}

interface StoredShape {
  v: PlainValue;
  panel: { voices: Record<string, PlainValue>[] } & Record<string, PlainValue>;
  mutes: PlainValue;
}

function stored(): StoredShape {
  return viaJson(encodeMixerSettings(SHAPED)) as unknown as StoredShape;
}

describe('marker settings codec', () => {
  beforeEach(() => vi.mocked(logWarn).mockClear());

  it('round-trips a panel and its mutes', () => {
    expect(decodeMixerSettings(viaJson(encodeMixerSettings(SHAPED)))).toEqual(SHAPED);
    expect(
      decodeMixerSettings(
        encodeMixerSettings({ panel: HOME_DECK_PANEL, mutes: [false, false, false] })
      )
    ).toEqual({
      panel: HOME_DECK_PANEL,
      mutes: [false, false, false],
    });
    expect(logWarn).not.toHaveBeenCalled();
  });

  it('stores a versioned shape', () => {
    expect(encodeMixerSettings(SHAPED)).toMatchObject({ v: 1, mutes: [true, false, true] });
  });

  it('answers null without a warning for an absent value', () => {
    expect(decodeMixerSettings(undefined)).toBeNull();
    expect(logWarn).not.toHaveBeenCalled();
  });

  it('answers null with one warning for another version', () => {
    expect(decodeMixerSettings({ ...stored(), v: 2 })).toBeNull();
    expect(logWarn).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['not an object', 'settings'],
    ['an array', [1, 2, 3]],
    ['no panel', { v: 1, mutes: [false, false, false] }],
    ['no mutes', { v: 1, panel: stored().panel }],
  ])('answers null with one warning for %s', (_name, value) => {
    expect(decodeMixerSettings(value as PlainValue)).toBeNull();
    expect(logWarn).toHaveBeenCalledTimes(1);
  });

  it('answers null for mutes that are not three booleans', () => {
    expect(decodeMixerSettings({ ...stored(), mutes: [true, false] })).toBeNull();
    expect(decodeMixerSettings({ ...stored(), mutes: [true, false, 1] })).toBeNull();
    expect(decodeMixerSettings({ ...stored(), mutes: [true, false, true, false] })).toBeNull();
  });

  it('answers null for a panel without exactly three voices', () => {
    const value = stored();
    expect(
      decodeMixerSettings({
        ...value,
        panel: { ...value.panel, voices: value.panel.voices.slice(1) },
      })
    ).toBeNull();
  });

  it.each([
    ['a number field that is not a number', { coarse: '3' }],
    ['a number field that is not finite', { fine: null }],
    ['a waveform outside the enum', { waveformLock: 'square' }],
    ['a waveform that is not a string', { waveformLock: 4 }],
    ['a switch lock that is not a boolean or null', { ringLock: 'on' }],
    ['a missing field', { attack: undefined }],
  ])('answers null for a voice with %s', (_name, patch) => {
    const value = stored();
    const voices = [{ ...value.panel.voices[0], ...patch }, ...value.panel.voices.slice(1)];

    expect(
      decodeMixerSettings({ ...value, panel: { ...value.panel, voices } } as PlainValue)
    ).toBeNull();
    expect(logWarn).toHaveBeenCalledTimes(1);
  });

  it('answers null for a filter mode outside the enum or a key that is not a number', () => {
    const value = stored();
    expect(
      decodeMixerSettings({ ...value, panel: { ...value.panel, filterModeLock: 'notch' } })
    ).toBeNull();
    expect(
      decodeMixerSettings({ ...value, panel: { ...value.panel, keySemitones: 'up' } })
    ).toBeNull();
  });

  it("bounds every number to its knob's travel and snaps the stepped ones", () => {
    const value = stored();
    const voices = [
      { ...value.panel.voices[0], coarse: 500, fine: -90, attack: 3.6, release: -0.2 },
      ...value.panel.voices.slice(1),
    ];
    const panel = { ...value.panel, voices, cutoff: 9999, resonance: -40, keySemitones: 30 };

    const decoded = decodeMixerSettings({ ...value, panel } as PlainValue);

    expect(decoded?.panel.voices[0]).toMatchObject({
      coarse: 96,
      fine: -50,
      attack: 4,
      release: 0,
    });
    expect(Object.is(decoded?.panel.voices[0].release, 0)).toBe(true);
    expect(decoded?.panel).toMatchObject({ cutoff: 2047, resonance: -15, keySemitones: 12 });
  });
});
