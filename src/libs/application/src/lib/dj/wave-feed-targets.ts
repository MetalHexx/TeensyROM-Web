/**
 * The shape of the waveform renderer as the application sees it. Defined here, the way
 * `sid-panel-targets` defines the panel's, so the application imports nothing from the UI library;
 * the UI's deck wave target satisfies `DeckWaveTarget` structurally.
 */

/** How many register-write entries a deck keeps between two paints, at most. The UI library's own
 *  per-message entry limit is larger; this stays at or under it. */
export const WAVE_HISTORY_CAPACITY = 64;

/** What the deck is doing, as the renderer needs to know it: `held` is paused, `flat` is nothing
 *  that sounds (empty, loading, stopped, failed). */
export type WaveDeckState = 'playing' | 'held' | 'flat';

/** One voice at the end of a history entry. */
export interface WaveVoiceFields {
  /** 0…65535, as sent. */
  frequency: number;
  /** 0…15: bit 1 triangle, 2 sawtooth, 4 pulse, 8 noise. */
  waveform: number;
  /** 0…4095. */
  pulseWidth: number;
  /** 0 | 1. */
  ring: number;
  /** 0 | 1. */
  sync: number;
  /** 0…15. */
  attack: number;
  /** 0…15. */
  decay: number;
  /** 0…15. */
  sustain: number;
  /** 0…15. */
  release: number;
  /** 0 | 1: the gate as the entry ends. */
  gate: number;
  /** 0 | 1: whether the gate went closed to open within the entry. */
  hit: number;
}

/** One hand-off's worth of entries, written in order and then submitted by the target. */
export interface WaveFeedWriter {
  beginEntry(timeMs: number): void;
  setVoice(voice: number, fields: WaveVoiceFields): void;
  finish(restarted: boolean, dropped: number): void;
}

/** One deck's renderer. */
export interface DeckWaveTarget {
  /** Checks a writer out; null when every buffer is in flight, so try again on the next paint. */
  acquire(): WaveFeedWriter | null;
  /** Sends the checked-out writer. */
  submit(): void;
  /** Returns a checked-out writer that was not used. */
  discard(): void;
  setState(state: WaveDeckState): void;
  /** The renderer has failed for good (no worker, no off-screen canvas, a dead worker). */
  isFailed(): boolean;
  /** Bench only. */
  setSuppressed(suppressed: boolean): void;
  /** Bench only. */
  readStats(): Promise<Readonly<Record<string, number>>>;
}
