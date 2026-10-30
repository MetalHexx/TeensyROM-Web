/** How a wave window is posed: following its voice, frozen on its last picture, or a flat line. */
export type WaveWindowState = 'playing' | 'held' | 'flat';

export type WaveVoice = 0 | 1 | 2;

/**
 * What one window should show. The model owns one per voice and updates it in place, so a reader
 * must not keep it across steps.
 *
 * `amplitude` 0…1 is the envelope height; `cycles` how many waves fit the window; `waveform` the
 * waveform bits; `duty` the pulse's high fraction; `syncCycles` and `ringCycles` the neighbouring
 * voice's cycle count when this voice syncs to or ring-modulates from it (0 when it does not, or the
 * source is silent); `sounding` whether anything is audible at all.
 */
export interface WaveVoiceView {
  amplitude: number;
  cycles: number;
  waveform: number;
  duty: number;
  syncCycles: number;
  ringCycles: number;
  sounding: boolean;
}
