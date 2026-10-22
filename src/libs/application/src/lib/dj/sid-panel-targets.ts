/** A ring the painter drives with a level in 0…1. */
export interface PanelLevelTarget {
  setLiveLevel(level: number): void;
}

/** A light the painter drives: lit by the sent register, or a dashed ghost where a lock is
 *  overriding what the tune wrote. */
export interface PanelLightTarget {
  setLiveLight(lit: boolean, ghost: boolean): void;
}

/** One voice strip's live indicators. */
export interface VoiceStripTargets {
  /** Triangle, sawtooth, pulse, noise — bits 0…3 of the waveform field. */
  readonly waveforms: readonly PanelLightTarget[];
  readonly coarse: PanelLevelTarget;
  readonly fine: PanelLevelTarget;
  readonly pulseWidth: PanelLevelTarget;
  readonly attack: PanelLevelTarget;
  readonly decay: PanelLevelTarget;
  readonly sustain: PanelLevelTarget;
  readonly release: PanelLevelTarget;
  readonly ring: PanelLightTarget;
  readonly sync: PanelLightTarget;
  readonly filter: PanelLightTarget;
}

/** Every live indicator of one deck's SID panel. */
export interface DeckPanelTargets {
  /** Voice 0…2. */
  readonly voices: readonly VoiceStripTargets[];
  readonly cutoff: PanelLevelTarget;
  readonly resonance: PanelLevelTarget;
  /** Low, band, high — bits 0…2 of the filter type. */
  readonly filterModes: readonly PanelLightTarget[];
}
