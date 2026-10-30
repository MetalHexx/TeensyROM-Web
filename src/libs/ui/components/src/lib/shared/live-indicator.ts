/** A control whose live level a painter sets directly, outside change detection. */
export interface LiveLevelIndicator {
  setLiveLevel(level: number): void;
}

/** A control whose live light (and, under a lock, the tune's own choice as a ghost) a painter sets. */
export interface LiveLightIndicator {
  setLiveLight(lit: boolean, ghost: boolean): void;
}

/** A position a painter sets directly, as a share of the track: 0–100. */
export interface LivePositionIndicator {
  setLivePosition(percent: number): void;
}

/** A playhead readout a painter sets directly: the position, the elapsed time and the frame. */
export interface LivePlayheadIndicator extends LivePositionIndicator {
  setLiveElapsed(text: string): void;
  setLiveFrame(label: string): void;
}

/** A progress a painter sets directly: 0–100. */
export interface LiveProgressIndicator {
  setLiveProgress(percent: number): void;
}
