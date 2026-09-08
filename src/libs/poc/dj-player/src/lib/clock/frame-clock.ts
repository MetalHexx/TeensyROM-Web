import {
  createFrameAccumulator,
  MAX_CATCH_UP_US,
  MICROSECONDS_PER_SECOND,
  microseconds,
  milliseconds,
} from '@sidablist/core';
import type {
  FrameAccumulator,
  FrameClock,
  FrameClockStats,
  Microseconds,
  Milliseconds,
} from '@sidablist/core';

const MICROSECONDS_PER_MILLISECOND = 1000;

/** Frames per `createScriptProcessor` buffer — 256 is ≈ 5.3 ms at 48 kHz. */
const AUDIO_BUFFER_FRAMES = 256;

/** A callback gap beyond this multiple of the nominal buffer duration counts as late. */
const LATE_CALLBACK_FACTOR = 2;

/**
 * A frame clock driven by `ScriptProcessorNode.onaudioprocess` — the application's adapter onto
 * core's `FrameClock` port, and the only part of the cadence that has to know about a browser.
 *
 * It runs on the main thread by design. `createScriptProcessor` is deprecated, and it is still the
 * right choice here: its callback fires on the main thread at audio buffer boundaries, keeps firing
 * while the tab is backgrounded — where `setTimeout` is throttled — and costs zero thread crossings
 * to reach Web MIDI's main-thread-only `send()`. An `AudioWorklet` would have to `postMessage` back
 * and land in the same task queue anyway.
 */
// TODO(R6): AudioWorklet variant — worth building only if the ear says the ScriptProcessorNode
// implementation below disappoints.
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
        measuredMeanIntervalUs: microseconds(0),
        nominalIntervalUs: microseconds(0),
        driftMs: milliseconds(0),
        jitterMs: milliseconds(0),
        worstGapMs: milliseconds(0),
        lateCallbacks: 0,
      };
    }

    const measuredElapsedUs = (this.lastTickAtMs - this.startedAtMs) * MICROSECONDS_PER_MILLISECOND;
    const framesEmitted = accumulator.framesEmitted;
    return {
      framesEmitted,
      measuredMeanIntervalUs: microseconds(
        framesEmitted === 0 ? 0 : measuredElapsedUs / framesEmitted
      ),
      nominalIntervalUs: accumulator.nominalIntervalUs,
      driftMs: milliseconds(
        (measuredElapsedUs - accumulator.nominalElapsedUs) / MICROSECONDS_PER_MILLISECOND
      ),
      jitterMs: milliseconds(this.gapStandardDeviationMs()),
      worstGapMs: milliseconds(this.worstGapMs),
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
    intervalUs: Microseconds,
    onFrame: (dueAtMs: Milliseconds, catchUpClamped: boolean) => void
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

    const accumulator = createFrameAccumulator(intervalUs);
    const bufferDurationUs = (AUDIO_BUFFER_FRAMES / context.sampleRate) * MICROSECONDS_PER_SECOND;

    this.startedAtMs = performance.now();
    this.lastTickAtMs = this.startedAtMs;
    this.gapCount = 0;
    this.gapSumMs = 0;
    this.gapSumSqMs = 0;
    this.worstGapMs = 0;
    this.lateCallbacks = 0;

    const lateThresholdMs =
      (bufferDurationUs * LATE_CALLBACK_FACTOR) / MICROSECONDS_PER_MILLISECOND;
    let firstCallback = true;
    // The end of the span the running callback credits, and whether that span was clamped. Held out
    // here so the frame handler is built once rather than per callback: allocating on this path is
    // the jitter the clock exists to measure.
    let creditedUntilMs = this.startedAtMs;
    let catchUpClamped = false;
    const emitFrame = (lagUs: Microseconds): void =>
      onFrame(milliseconds(creditedUntilMs - lagUs / MICROSECONDS_PER_MILLISECOND), catchUpClamped);

    node.onaudioprocess = () => {
      const now = performance.now();

      // Credit the accumulator with the time that actually passed, not with the buffer duration the
      // sample rate implies. Those differ by a fraction of a percent — the audio device's crystal
      // against `performance.now()` — and that fraction is a *sustained rate error*: the cartridge
      // re-times playback to the interval this clock advertises, so a stream that runs slow against
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
        elapsedUs = gapMs * MICROSECONDS_PER_MILLISECOND;
        // Resolved before the advance rather than from its return value: `emitFrame` reads this flag
        // as each frame is released, so it has to be true by the time the first one comes out.
        catchUpClamped = elapsedUs > MAX_CATCH_UP_US;
      }

      this.lastTickAtMs = now;
      // Every frame this advance releases is placed against this reading rather than a second one:
      // the span just credited ends here, and each frame's own lag says how far back inside it the
      // frame fell due.
      creditedUntilMs = now;
      // The accumulator applies `MAX_CATCH_UP_US` itself, so the measured span goes over unclamped.
      accumulator.advance(microseconds(elapsedUs), emitFrame);
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
  setIntervalUs(intervalUs: Microseconds): void {
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
