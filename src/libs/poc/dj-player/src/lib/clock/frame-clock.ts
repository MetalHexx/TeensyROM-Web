const MICROSECONDS_PER_SECOND = 1_000_000;
const MICROSECONDS_PER_MILLISECOND = 1000;

/** Frames per `createScriptProcessor` buffer — 256 is ≈ 5.3 ms at 48 kHz. */
const AUDIO_BUFFER_FRAMES = 256;

/**
 * The most catch-up a single callback may emit after a stall.
 *
 * Catching up is normally self-correcting: the cartridge drained frames while we were stalled, so
 * emitting exactly what we owe puts its queue back where it was. That stops holding past the point
 * where the cartridge would have underflowed and re-buffered on its own — beyond there the queue has
 * already refilled itself, and a burst on top of it overflows rather than restores. 250 ms is
 * comfortably past every buffer size the cartridge offers at frame rates this engine runs.
 *
 * It also bounds how far the due times below can be trusted. A gap longer than this credits less
 * time than really passed, so the frames it releases are anchored up to `(gap − 250 ms)` later than
 * they truly fell due. Playback is unharmed — every one of them is in the past and goes out at
 * once — but a lag measured against those due times under-reports by that much, which is why such
 * frames are flagged to the tick callback rather than left to be averaged into a timing figure.
 */
const MAX_CATCH_UP_US = 250_000;

/** A callback gap beyond this multiple of the nominal buffer duration counts as late. */
const LATE_CALLBACK_FACTOR = 2;

/** What the clock has actually done since `start`, for the diagnostics panel. */
export interface FrameClockStats {
  readonly framesEmitted: number;
  readonly measuredMeanIntervalUs: number;
  readonly nominalIntervalUs: number;
  /**
   * Cumulative measured − nominal since `start`.
   *
   * Now that the clock advances on measured time, this is the check on that: frames fall due against
   * the wall clock, so a healthy stream holds this near zero. A figure that climbs steadily means the
   * engine is emitting at a different rate from the one it advertises to the cartridge, which is what
   * makes the cartridge's queue depth oscillate.
   */
  readonly driftMs: number;
  /**
   * Standard deviation of the gap between audio callbacks.
   *
   * The mean interval and the drift can both look healthy while individual callbacks scatter, and it
   * is the scatter that empties the cartridge's queue: no callback means no packet, and a queue that
   * runs dry re-buffers. Measured on the callback rather than on emitted frames so the figure means
   * the same thing whatever multispeed the tune carries.
   */
  readonly jitterMs: number;
  /**
   * The longest single gap between audio callbacks since `start`.
   *
   * The number that actually catches a rare dropout: one 200 ms main-thread stall barely moves the
   * standard deviation but empties any buffer outright.
   */
  readonly worstGapMs: number;
  /**
   * How many callbacks arrived more than `LATE_CALLBACK_FACTOR`x the nominal buffer duration apart.
   *
   * `worstGapMs` is a running maximum that never decays, so a single spike sets it for the session
   * and cannot be told apart from a constant problem. This is the frequency alongside it.
   */
  readonly lateCallbacks: number;
}

/**
 * A source of frame ticks at audio rate.
 *
 * Kept deliberately small so another implementation can replace it without touching the engine.
 */
// TODO(R6): AudioWorklet variant — worth building only if the ear says the ScriptProcessorNode
// implementation below disappoints.
export interface FrameClock {
  /**
   * Starts ticking every `intervalUs`. Must be called from a user gesture: it resumes an
   * `AudioContext`, which browsers only allow from one.
   *
   * `dueAtMs` is when that frame fell due on the `performance.now()` timeline, which is *before* the
   * tick that releases it: a callback releases every frame that fell inside the span it credits, so
   * frames arrive in bursts but carry due times one interval apart. `catchUpClamped` marks a frame
   * released from a span that credited less than the time really elapsed (see `MAX_CATCH_UP_US`),
   * whose due time is therefore later than the truth.
   */
  start(
    intervalUs: number,
    onFrame: (dueAtMs: number, catchUpClamped: boolean) => void
  ): Promise<void>;
  /** Takes effect on the next tick, without a restart and without dropping the accumulator. */
  setIntervalUs(intervalUs: number): void;
  stop(): void;
  readonly stats: FrameClockStats;
}

/**
 * Turns elapsed audio-buffer time into frame ticks.
 *
 * Split out from the clock because this is the arithmetic that decides how many frames a buffer
 * owes, and it is worth exercising without an `AudioContext` in the way.
 */
export class FrameAccumulator {
  private intervalUs: number;
  private accumulatorUs = 0;
  private frames = 0;
  private nominalUsEmitted = 0;

  constructor(intervalUs: number) {
    assertPositiveInterval(intervalUs);
    this.intervalUs = intervalUs;
  }

  get nominalIntervalUs(): number {
    return this.intervalUs;
  }

  get framesEmitted(): number {
    return this.frames;
  }

  /** The time the emitted frames were supposed to take, summed at the interval in force for each. */
  get nominalElapsedUs(): number {
    return this.nominalUsEmitted;
  }

  /** @throws {RangeError} when `intervalUs` is not a positive finite number. */
  setIntervalUs(intervalUs: number): void {
    assertPositiveInterval(intervalUs);
    this.intervalUs = intervalUs;
  }

  /**
   * Adds `elapsedUs` of time and fires every frame that now falls due.
   *
   * More than one frame can fall inside a single advance at short intervals, or after a caller
   * hands over a long measured gap, and they must all fire — so this bursts several packets back to
   * back. Absorbing bursts is exactly what the cartridge's queue is for.
   *
   * Each frame reports `lagUs`: how long before the end of the credited span it fell due. That is
   * exactly what remains in the accumulator once the frame's interval has come out of it, so a
   * caller holding the time that span ended can place every frame in the burst — one interval apart
   * rather than all at the instant the advance happened to run.
   */
  advance(elapsedUs: number, onFrame: (lagUs: number) => void): void {
    this.accumulatorUs += elapsedUs;
    while (this.accumulatorUs >= this.intervalUs) {
      this.accumulatorUs -= this.intervalUs;
      this.frames++;
      this.nominalUsEmitted += this.intervalUs;
      onFrame(this.accumulatorUs);
    }
  }
}

/**
 * A frame clock driven by `ScriptProcessorNode.onaudioprocess`.
 *
 * It runs on the main thread by design. `createScriptProcessor` is deprecated, and it is still the
 * right choice here: its callback fires on the main thread at audio buffer boundaries, keeps firing
 * while the tab is backgrounded — where `setTimeout` is throttled — and costs zero thread crossings
 * to reach Web MIDI's main-thread-only `send()`. An `AudioWorklet` would have to `postMessage` back
 * and land in the same task queue anyway.
 */
export class ScriptProcessorFrameClock implements FrameClock {
  private context: AudioContext | null = null;
  private node: ScriptProcessorNode | null = null;
  private sink: GainNode | null = null;
  private accumulator: FrameAccumulator | null = null;
  private startedAtMs = 0;
  private lastTickAtMs = 0;
  // Running sums rather than a kept list of samples: this updates on the audio callback, where
  // allocating per tick is exactly the jitter it is trying to measure.
  private gapCount = 0;
  private gapSumMs = 0;
  private gapSumSqMs = 0;
  private worstGapMs = 0;
  private lateCallbacks = 0;

  get stats(): FrameClockStats {
    const accumulator = this.accumulator;
    if (accumulator === null) {
      return {
        framesEmitted: 0,
        measuredMeanIntervalUs: 0,
        nominalIntervalUs: 0,
        driftMs: 0,
        jitterMs: 0,
        worstGapMs: 0,
        lateCallbacks: 0,
      };
    }

    const measuredElapsedUs = (this.lastTickAtMs - this.startedAtMs) * MICROSECONDS_PER_MILLISECOND;
    const framesEmitted = accumulator.framesEmitted;
    return {
      framesEmitted,
      measuredMeanIntervalUs: framesEmitted === 0 ? 0 : measuredElapsedUs / framesEmitted,
      nominalIntervalUs: accumulator.nominalIntervalUs,
      driftMs: (measuredElapsedUs - accumulator.nominalElapsedUs) / MICROSECONDS_PER_MILLISECOND,
      jitterMs: this.gapStandardDeviationMs(),
      worstGapMs: this.worstGapMs,
      lateCallbacks: this.lateCallbacks,
    };
  }

  /** Population standard deviation from the running sums, floored at 0 against float cancellation. */
  private gapStandardDeviationMs(): number {
    if (this.gapCount < 2) {
      return 0;
    }
    const mean = this.gapSumMs / this.gapCount;
    return Math.sqrt(Math.max(0, this.gapSumSqMs / this.gapCount - mean * mean));
  }

  /** @throws {RangeError} when `intervalUs` is not a positive finite number. */
  async start(
    intervalUs: number,
    onFrame: (dueAtMs: number, catchUpClamped: boolean) => void
  ): Promise<void> {
    assertPositiveInterval(intervalUs);
    this.stop();

    const context = new AudioContext();
    await context.resume();

    const node = context.createScriptProcessor(AUDIO_BUFFER_FRAMES, 1, 1);
    const sink = context.createGain();
    sink.gain.value = 0;
    node.connect(sink);
    // The node is only pumped while its graph reaches the destination, silent or not.
    sink.connect(context.destination);

    const accumulator = new FrameAccumulator(intervalUs);
    const bufferDurationUs = (AUDIO_BUFFER_FRAMES / context.sampleRate) * MICROSECONDS_PER_SECOND;

    this.startedAtMs = performance.now();
    this.lastTickAtMs = this.startedAtMs;
    this.gapCount = 0;
    this.gapSumMs = 0;
    this.gapSumSqMs = 0;
    this.worstGapMs = 0;
    this.lateCallbacks = 0;

    const lateThresholdMs = (bufferDurationUs * LATE_CALLBACK_FACTOR) / MICROSECONDS_PER_MILLISECOND;
    let firstCallback = true;
    // The end of the span the running callback credits, and whether that span was clamped. Held out
    // here so the frame handler is built once rather than per callback: allocating on this path is
    // the jitter the clock exists to measure.
    let creditedUntilMs = this.startedAtMs;
    let catchUpClamped = false;
    const emitFrame = (lagUs: number): void =>
      onFrame(creditedUntilMs - lagUs / MICROSECONDS_PER_MILLISECOND, catchUpClamped);

    node.onaudioprocess = () => {
      const now = performance.now();

      // Credit the accumulator with the time that actually passed, not with the buffer duration the
      // sample rate implies. Those differ by a fraction of a percent — the audio device's crystal
      // against `performance.now()` — and that fraction is a *sustained rate error*: the cartridge
      // re-times playback to the interval this engine advertises, so a stream that runs slow against
      // its own advertised rate drains the cartridge's queue faster than it fills, until the
      // firmware's slow re-timer claws it back and the depth oscillates. Measuring instead of
      // assuming keeps the advertised rate honest.
      //
      // It also makes a stall self-correcting: no callback means no packet, and the cartridge drains
      // straight through it. Advancing by real elapsed time emits exactly the frames that fell due
      // and restores the depth the stall cost, where a fixed-duration advance would leave the queue
      // permanently shallower.
      let elapsedUs = bufferDurationUs;
      catchUpClamped = false;
      if (firstCallback) {
        firstCallback = false;
      } else {
        const gapMs = now - this.lastTickAtMs;
        this.gapCount++;
        this.gapSumMs += gapMs;
        this.gapSumSqMs += gapMs * gapMs;
        if (gapMs > this.worstGapMs) this.worstGapMs = gapMs;
        if (gapMs > lateThresholdMs) this.lateCallbacks++;
        const measuredUs = gapMs * MICROSECONDS_PER_MILLISECOND;
        catchUpClamped = measuredUs > MAX_CATCH_UP_US;
        elapsedUs = Math.min(measuredUs, MAX_CATCH_UP_US);
      }

      this.lastTickAtMs = now;
      // Every frame this advance releases is placed against this reading rather than a second one:
      // the span just credited ends here, and each frame's own lag says how far back inside it the
      // frame fell due.
      creditedUntilMs = now;
      accumulator.advance(elapsedUs, emitFrame);
    };

    this.context = context;
    this.node = node;
    this.sink = sink;
    this.accumulator = accumulator;
  }

  /**
   * Ignored before the first `start`, which carries its own interval.
   *
   * @throws {RangeError} when `intervalUs` is not a positive finite number.
   */
  setIntervalUs(intervalUs: number): void {
    this.accumulator?.setIntervalUs(intervalUs);
  }

  /** Tears the audio graph down but keeps the accumulator, so `stats` still reads after a stop. */
  stop(): void {
    if (this.node !== null) {
      this.node.onaudioprocess = null;
      this.node.disconnect();
      this.node = null;
    }
    this.sink?.disconnect();
    this.sink = null;

    const context = this.context;
    this.context = null;
    // Closing is asynchronous and nothing downstream waits on it; a failure to close a context we
    // have already detached is not worth surfacing.
    void context?.close().catch(() => undefined);
  }
}

function assertPositiveInterval(intervalUs: number): void {
  if (!Number.isFinite(intervalUs) || intervalUs <= 0) {
    throw new RangeError(`frame interval ${intervalUs} µs must be a positive finite number`);
  }
}
