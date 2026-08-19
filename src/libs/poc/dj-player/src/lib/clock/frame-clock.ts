const MICROSECONDS_PER_SECOND = 1_000_000;
const MICROSECONDS_PER_MILLISECOND = 1000;

/** Frames per `createScriptProcessor` buffer — 256 is ≈ 5.3 ms at 48 kHz. */
const AUDIO_BUFFER_FRAMES = 256;

/** What the clock has actually done since `start`, for the diagnostics panel. */
export interface FrameClockStats {
  readonly framesEmitted: number;
  readonly measuredMeanIntervalUs: number;
  readonly nominalIntervalUs: number;
  /** Cumulative measured − nominal since `start`. */
  readonly driftMs: number;
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
   */
  start(intervalUs: number, onFrame: () => void): Promise<void>;
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
   * Adds a buffer's worth of time and fires every frame that now falls due.
   *
   * More than one frame can fall inside a single buffer at short intervals, and they must all fire —
   * so this bursts several packets back to back. Absorbing bursts is exactly what the cartridge's
   * queue is for.
   */
  advance(elapsedUs: number, onFrame: () => void): void {
    this.accumulatorUs += elapsedUs;
    while (this.accumulatorUs >= this.intervalUs) {
      this.accumulatorUs -= this.intervalUs;
      this.frames++;
      this.nominalUsEmitted += this.intervalUs;
      onFrame();
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

  get stats(): FrameClockStats {
    const accumulator = this.accumulator;
    if (accumulator === null) {
      return { framesEmitted: 0, measuredMeanIntervalUs: 0, nominalIntervalUs: 0, driftMs: 0 };
    }

    const measuredElapsedUs = (this.lastTickAtMs - this.startedAtMs) * MICROSECONDS_PER_MILLISECOND;
    const framesEmitted = accumulator.framesEmitted;
    return {
      framesEmitted,
      measuredMeanIntervalUs: framesEmitted === 0 ? 0 : measuredElapsedUs / framesEmitted,
      nominalIntervalUs: accumulator.nominalIntervalUs,
      driftMs: (measuredElapsedUs - accumulator.nominalElapsedUs) / MICROSECONDS_PER_MILLISECOND,
    };
  }

  /** @throws {RangeError} when `intervalUs` is not a positive finite number. */
  async start(intervalUs: number, onFrame: () => void): Promise<void> {
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
    node.onaudioprocess = () => {
      this.lastTickAtMs = performance.now();
      accumulator.advance(bufferDurationUs, onFrame);
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
