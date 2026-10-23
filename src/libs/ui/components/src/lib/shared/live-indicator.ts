/** A control whose live level a painter sets directly, outside change detection. */
export interface LiveLevelIndicator {
  setLiveLevel(level: number): void;
}

/** A control whose live light (and, under a lock, the tune's own choice as a ghost) a painter sets. */
export interface LiveLightIndicator {
  setLiveLight(lit: boolean, ghost: boolean): void;
}
