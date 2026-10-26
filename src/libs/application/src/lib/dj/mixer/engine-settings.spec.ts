import { describe, it, expect } from 'vitest';
import { HOME_DECK_PANEL, HOME_VOICE_STRIP, type DeckPanelState } from '../dj-store';
import { engineSettingsOf } from './engine-settings';
import { voicePitchMultiplier } from './pitch';

const VOICE_OFFSET_NAMES = ['pulseWidth', 'attack', 'decay', 'sustain', 'release'] as const;

/** A panel with every knob and lock away from home. */
function shapedPanel(): DeckPanelState {
  return {
    voices: [
      {
        ...HOME_VOICE_STRIP,
        coarse: 5,
        fine: -12.5,
        pulseWidth: 900,
        attack: 3,
        decay: -4,
        sustain: 7,
        release: -15,
        waveformLock: 'triangle',
        ringLock: true,
        syncLock: false,
        filterLock: true,
      },
      { ...HOME_VOICE_STRIP, waveformLock: 'noise', ringLock: false },
      { ...HOME_VOICE_STRIP, coarse: -24, waveformLock: 'pulse', syncLock: true },
    ],
    cutoff: -300,
    resonance: 11,
    filterModeLock: 'band-pass',
    keySemitones: 4,
  };
}

function offsetOf(
  settings: ReturnType<typeof engineSettingsOf>,
  name: string,
  voice?: number
): number | undefined {
  return settings.fieldOffsets?.find(
    ({ field }) =>
      field.name === name && (voice === undefined || ('voice' in field && field.voice === voice))
  )?.amount;
}

function holdOf(
  settings: ReturnType<typeof engineSettingsOf>,
  name: string,
  voice?: number
): number | null | undefined {
  return settings.fieldHolds?.find(
    ({ field }) =>
      field.name === name && (voice === undefined || ('voice' in field && field.voice === voice))
  )?.value;
}

describe('engineSettingsOf', () => {
  it('lists a home panel as unit pitch, every offset handed back and every lock released', () => {
    const settings = engineSettingsOf(HOME_DECK_PANEL);

    expect(settings.voicePitch).toEqual([1, 1, 1]);
    expect(settings.fieldOffsets).toHaveLength(3 * VOICE_OFFSET_NAMES.length + 2);
    expect(settings.fieldOffsets?.every(({ amount }) => amount === 0)).toBe(true);
    expect(settings.fieldHolds).toHaveLength(3 * 4 + 1);
    expect(settings.fieldHolds?.every(({ value }) => value === null)).toBe(true);
  });

  it('composes Key, Coarse and Fine into one coefficient per voice', () => {
    const settings = engineSettingsOf(shapedPanel());

    expect(settings.voicePitch).toEqual([
      voicePitchMultiplier(4, 5, -12.5),
      voicePitchMultiplier(4, 0, 0),
      voicePitchMultiplier(4, -24, 0),
    ]);
  });

  it('lists every offset the panel drives on the field it drives', () => {
    const settings = engineSettingsOf(shapedPanel());

    expect(VOICE_OFFSET_NAMES.map((name) => offsetOf(settings, name, 0))).toEqual([
      900, 3, -4, 7, -15,
    ]);
    expect(VOICE_OFFSET_NAMES.map((name) => offsetOf(settings, name, 1))).toEqual([0, 0, 0, 0, 0]);
    expect(offsetOf(settings, 'cutoff')).toBe(-300);
    expect(offsetOf(settings, 'resonance')).toBe(11);
  });

  it('rounds an offset to a whole number', () => {
    const panel: DeckPanelState = {
      ...HOME_DECK_PANEL,
      cutoff: 10.6,
      voices: [{ ...HOME_VOICE_STRIP, attack: 2.4 }, HOME_VOICE_STRIP, HOME_VOICE_STRIP],
    };

    const settings = engineSettingsOf(panel);

    expect(offsetOf(settings, 'cutoff')).toBe(11);
    expect(offsetOf(settings, 'attack', 0)).toBe(2);
  });

  it('holds each lock at its register value and releases the rest', () => {
    const settings = engineSettingsOf(shapedPanel());

    expect([0, 1, 2].map((voice) => holdOf(settings, 'waveform', voice))).toEqual([1, 8, 4]);
    expect([0, 1, 2].map((voice) => holdOf(settings, 'ringMod', voice))).toEqual([1, 0, null]);
    expect([0, 1, 2].map((voice) => holdOf(settings, 'sync', voice))).toEqual([0, null, 1]);
    expect([0, 1, 2].map((voice) => holdOf(settings, 'filtered', voice))).toEqual([1, null, null]);
    expect(holdOf(settings, 'filterType')).toBe(2);
  });

  it('carries the voices mutes only when it is given them', () => {
    expect('voiceMutes' in engineSettingsOf(shapedPanel())).toBe(false);
    expect(engineSettingsOf(shapedPanel(), [true, false, true]).voiceMutes).toEqual([
      true,
      false,
      true,
    ]);
  });
});
