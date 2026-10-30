/** The transport's playhead readouts: the bar's thumb and fill, the elapsed time and the frame. */
export interface TransportPlayheadTarget {
  /** The playhead as a share of the tune's length, 0–100. */
  setLivePosition(percent: number): void;
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

/** Every playhead readout of one deck. */
export interface DeckPlayheadTargets {
  readonly transport: TransportPlayheadTarget;
  readonly loops: LoopLapTarget;
}
