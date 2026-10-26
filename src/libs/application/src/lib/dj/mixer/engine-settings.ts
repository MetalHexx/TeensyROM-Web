import type { JumpSettings, SidField } from '@sidablist/core';
import type { DeckPanelState, PanelFilterMode, PanelWaveform, SwitchLock } from '../dj-store';
import { voicePitchMultiplier } from './pitch';

const WAVEFORM_BITS: Record<PanelWaveform, number> = {
  triangle: 1,
  sawtooth: 2,
  pulse: 4,
  noise: 8,
};

const FILTER_TYPE_BITS: Record<PanelFilterMode, number> = {
  'low-pass': 1,
  'band-pass': 2,
  'high-pass': 4,
};

/** The field each voice switch sits on. */
export const SWITCH_FIELDS = { ring: 'ringMod', sync: 'sync', filter: 'filtered' } as const;

const VOICE_OFFSET_KNOBS = ['pulseWidth', 'attack', 'decay', 'sustain', 'release'] as const;

const VOICE_SWITCH_LOCKS = [
  ['ring', 'ringLock'],
  ['sync', 'syncLock'],
  ['filter', 'filterLock'],
] as const;

/** A switch lock as the field value to hold, `null` handing the field back to the tune. */
function switchValue(lock: SwitchLock): number | null {
  return lock === null ? null : lock ? 1 : 0;
}

/**
 * A deck panel, and optionally each voice's latched mute, as the engine's settings: one pitch
 * coefficient per voice (Key, Coarse and Fine as one), every offset the panel drives (0 hands it
 * back), and every lock it drives (null releases). Lists every field the panel owns, so applying it
 * replaces the panel's whole effect. `voiceMutes` is present only when `mutes` is given.
 */
export function engineSettingsOf(panel: DeckPanelState, mutes?: readonly boolean[]): JumpSettings {
  const fieldOffsets: { field: SidField; amount: number }[] = [];
  const fieldHolds: { field: SidField; value: number | null }[] = [];

  panel.voices.forEach((strip, voice) => {
    for (const knob of VOICE_OFFSET_KNOBS) {
      fieldOffsets.push({ field: { name: knob, voice }, amount: Math.round(strip[knob]) });
    }
    fieldHolds.push({
      field: { name: 'waveform', voice },
      value: strip.waveformLock === null ? null : WAVEFORM_BITS[strip.waveformLock],
    });
    for (const [sw, lockKey] of VOICE_SWITCH_LOCKS) {
      fieldHolds.push({
        field: { name: SWITCH_FIELDS[sw], voice },
        value: switchValue(strip[lockKey]),
      });
    }
  });

  fieldOffsets.push({ field: { name: 'cutoff' }, amount: Math.round(panel.cutoff) });
  fieldOffsets.push({ field: { name: 'resonance' }, amount: Math.round(panel.resonance) });
  fieldHolds.push({
    field: { name: 'filterType' },
    value: panel.filterModeLock === null ? null : FILTER_TYPE_BITS[panel.filterModeLock],
  });

  return {
    voicePitch: panel.voices.map((strip) =>
      voicePitchMultiplier(panel.keySemitones, strip.coarse, strip.fine)
    ),
    fieldOffsets,
    fieldHolds,
    ...(mutes === undefined ? {} : { voiceMutes: [...mutes] }),
  };
}
