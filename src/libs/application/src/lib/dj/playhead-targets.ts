/** The transport's playhead readouts: the bar's thumb and fill, the elapsed time and the frame, and
 *  the slip's second playhead. */
export interface TransportPlayheadTarget {
  /** The playhead as a share of the tune's length, 0–100. */
  setLivePosition(percent: number): void;
  /** The frame the deck returns to, as a percent of the strip, or null to hide it. */
  setLiveReturnPosition(percent: number | null): void;
  /** 'mm:ss.t', e.g. '01:23.4'. */
  setLiveElapsed(text: string): void;
  /** 'frame N'. */
  setLiveFrame(label: string): void;
}

/** The running marker loop's lap: how far the playhead is through it. */
export interface LoopLapTarget {
  /** 0–100; 0 while no marker loop is running. */
  setLiveProgress(percent: number): void;
}

/** The speed display's tempo readout. */
export interface SpeedReadoutTarget {
  /** '125.31 BPM', or '---.-- BPM' with no tempo. */
  setLiveBpm(text: string): void;
}

/** Every playhead readout of one deck. */
export interface DeckPlayheadTargets {
  readonly transport: TransportPlayheadTarget;
  readonly loops: LoopLapTarget;
  readonly speed: SpeedReadoutTarget;
}
