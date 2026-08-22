import { describe, it, expect, afterEach, vi } from 'vitest';
import { FrameAccumulator, ScriptProcessorFrameClock } from './frame-clock';

const BUFFER_FRAMES = 256;
const SAMPLE_RATE = 48000;
const BUFFER_DURATION_US = (BUFFER_FRAMES / SAMPLE_RATE) * 1_000_000;

/**
 * Stands in for the browser's Web Audio graph, which jsdom does not implement. It exposes the same
 * three collaborators the clock touches — a context, a `ScriptProcessorNode` whose callback the test
 * fires by hand, and a gain node — and records the connections so the "reaches the destination"
 * requirement can be checked.
 */
class FakeAudioContext {
  static instances: FakeAudioContext[] = [];

  readonly sampleRate = SAMPLE_RATE;
  readonly destination = { id: 'destination' };
  readonly connections: [string, string][] = [];
  node: FakeScriptProcessorNode | null = null;
  gain: FakeGainNode | null = null;
  resumed = false;
  closed = false;

  constructor() {
    FakeAudioContext.instances.push(this);
  }

  resume(): Promise<void> {
    this.resumed = true;
    return Promise.resolve();
  }

  close(): Promise<void> {
    this.closed = true;
    return Promise.resolve();
  }

  createScriptProcessor(): FakeScriptProcessorNode {
    this.node = new FakeScriptProcessorNode(this);
    return this.node;
  }

  createGain(): FakeGainNode {
    this.gain = new FakeGainNode(this);
    return this.gain;
  }
}

class FakeScriptProcessorNode {
  onaudioprocess: (() => void) | null = null;
  disconnected = false;

  constructor(private readonly context: FakeAudioContext) {}

  connect(target: unknown): void {
    this.context.connections.push(['node', describeTarget(target)]);
  }

  disconnect(): void {
    this.disconnected = true;
  }

  /** Fires one audio buffer boundary, the way the browser's audio thread would. */
  fireBuffers(count: number): void {
    for (let i = 0; i < count; i++) {
      this.onaudioprocess?.();
    }
  }
}

class FakeGainNode {
  readonly gain = { value: 1 };

  constructor(private readonly context: FakeAudioContext) {}

  connect(target: unknown): void {
    this.context.connections.push(['gain', describeTarget(target)]);
  }

  disconnect(): void {
    // nothing to track: the node's own teardown is what the clock is responsible for
  }
}

function describeTarget(target: unknown): string {
  if (target instanceof FakeGainNode) {
    return 'gain';
  }
  return (target as { id?: string }).id === 'destination' ? 'destination' : 'unknown';
}

function installFakeAudioContext(): void {
  FakeAudioContext.instances = [];
  vi.stubGlobal('AudioContext', FakeAudioContext);
}

async function startedClock(intervalUs: number, onFrame: () => void) {
  installFakeAudioContext();
  const clock = new ScriptProcessorFrameClock();
  await clock.start(intervalUs, onFrame);
  const context = FakeAudioContext.instances[0];
  const node = context.node;
  if (node === null) {
    throw new Error('the clock did not create a script processor node');
  }
  return { clock, context, node };
}

describe('FrameAccumulator', () => {
  it('emits nothing until a whole interval has accumulated', () => {
    const accumulator = new FrameAccumulator(20000);
    let frames = 0;

    accumulator.advance(19999, () => frames++);

    expect(frames).toBe(0);
    expect(accumulator.framesEmitted).toBe(0);
  });

  it('emits every frame that falls inside one buffer when the interval is the shorter of the two', () => {
    const accumulator = new FrameAccumulator(1000);
    let frames = 0;

    accumulator.advance(5333, () => frames++);

    expect(frames).toBe(5);
    expect(accumulator.framesEmitted).toBe(5);
  });

  it('carries the remainder across advances rather than resetting it', () => {
    const accumulator = new FrameAccumulator(20000);
    let frames = 0;
    const tick = () => frames++;

    // Three buffers of 5333 µs is 15999 µs — one short — and the fourth crosses the interval.
    accumulator.advance(5333, tick);
    accumulator.advance(5333, tick);
    accumulator.advance(5333, tick);
    expect(frames).toBe(0);

    accumulator.advance(5333, tick);

    expect(frames).toBe(1);
  });

  it('applies a new interval on the next advance without dropping the accumulator', () => {
    const accumulator = new FrameAccumulator(1000);
    let frames = 0;
    const tick = () => frames++;

    accumulator.advance(900, tick);
    expect(frames).toBe(0);

    accumulator.setIntervalUs(500);
    accumulator.advance(200, tick);

    // The 900 µs already banked plus 200 µs is two 500 µs frames — the accumulator survived.
    expect(frames).toBe(2);
    expect(accumulator.nominalIntervalUs).toBe(500);
  });

  it('accounts nominal elapsed time at the interval in force for each frame', () => {
    const accumulator = new FrameAccumulator(1000);
    const tick = () => undefined;

    accumulator.advance(2000, tick);
    accumulator.setIntervalUs(500);
    accumulator.advance(1000, tick);

    expect(accumulator.framesEmitted).toBe(4);
    expect(accumulator.nominalElapsedUs).toBe(2000 + 1000);
  });

  it('rejects an interval that would never elapse', () => {
    expect(() => new FrameAccumulator(0)).toThrow(RangeError);
    expect(() => new FrameAccumulator(1000).setIntervalUs(Number.NaN)).toThrow(RangeError);
  });
});

/**
 * Drives `performance.now()` by hand, so a callback gap is whatever the test says it is rather than
 * however long the test itself happened to take.
 */
function installFakeNow(): (advanceMs: number) => void {
  let nowMs = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => nowMs);
  return (advanceMs: number) => {
    nowMs += advanceMs;
  };
}

/** Fires `count` callbacks `gapMs` apart on the faked clock. */
function fireEvenly(
  node: FakeScriptProcessorNode,
  advance: (ms: number) => void,
  count: number,
  gapMs: number
): void {
  for (let i = 0; i < count; i++) {
    advance(gapMs);
    node.fireBuffers(1);
  }
}

/**
 * Fires `count` callbacks at the nominal buffer spacing — the even, healthy case.
 *
 * The clock credits measured elapsed time rather than the buffer duration the sample rate implies,
 * so real time has to pass for a frame to fall due; firing buffers back to back advances nothing.
 */
function fireNominal(
  node: FakeScriptProcessorNode,
  advance: (ms: number) => void,
  count: number
): void {
  fireEvenly(node, advance, count, BUFFER_DURATION_US / 1000);
}

describe('ScriptProcessorFrameClock', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('jitter', () => {
    it('reports no scatter when every callback lands the same distance apart', async () => {
      const advance = installFakeNow();
      const { clock, node } = await startedClock(20000, () => undefined);

      fireEvenly(node, advance, 10, 5);

      expect(clock.stats.jitterMs).toBeCloseTo(0);
      expect(clock.stats.worstGapMs).toBeCloseTo(5);
    });

    it('catches a lone stall in the worst gap that barely moves the deviation', async () => {
      const advance = installFakeNow();
      const { clock, node } = await startedClock(20000, () => undefined);

      fireEvenly(node, advance, 50, 5);
      const evenJitter = clock.stats.jitterMs;

      advance(200); // one main-thread stall: no callback, so no packet goes out
      node.fireBuffers(1);
      fireEvenly(node, advance, 50, 5);

      // The point of carrying both figures — σ stays small enough to look healthy while the gap that
      // would empty any cartridge buffer is plainly visible.
      expect(clock.stats.worstGapMs).toBeCloseTo(200);
      expect(clock.stats.jitterMs).toBeGreaterThan(evenJitter);
      expect(clock.stats.jitterMs).toBeLessThan(25);
    });

    it('excludes the first gap, which spans resume() rather than the running clock', async () => {
      const advance = installFakeNow();
      const { clock, node } = await startedClock(20000, () => undefined);

      advance(500); // the audio graph coming up — a one-off cost, not the clock's behaviour
      node.fireBuffers(1);
      fireEvenly(node, advance, 10, 5);

      expect(clock.stats.worstGapMs).toBeCloseTo(5);
      expect(clock.stats.jitterMs).toBeCloseTo(0);
    });

    it('reports zeroes rather than dividing by zero before two callbacks have landed', async () => {
      const advance = installFakeNow();
      const { clock, node } = await startedClock(20000, () => undefined);

      advance(5);
      node.fireBuffers(1);

      expect(clock.stats.jitterMs).toBe(0);
      expect(clock.stats.worstGapMs).toBe(0);
    });

    it('starts a restarted clock over rather than carrying the old scatter forward', async () => {
      const advance = installFakeNow();
      const { clock, node } = await startedClock(20000, () => undefined);
      fireEvenly(node, advance, 5, 5);
      advance(300);
      node.fireBuffers(1);
      expect(clock.stats.worstGapMs).toBeCloseTo(300);

      const restarted = await startedClock(20000, () => undefined);
      fireEvenly(restarted.node, advance, 10, 5);

      expect(restarted.clock.stats.worstGapMs).toBeCloseTo(5);
    });
  });

  describe('advancing on measured time', () => {
    it('emits frames against the wall clock, not against the buffer duration the sample rate implies', async () => {
      const advance = installFakeNow();
      let frames = 0;
      const { node } = await startedClock(20000, () => frames++);

      // 100 callbacks 10 ms apart is very nearly a second of real time, which owes 49 frames at a
      // 20 ms interval. Crediting the nominal 5.33 ms buffer instead would account for only ~0.53 s
      // and emit 26 — the gap between those two numbers is the whole point of the change.
      fireEvenly(node, advance, 100, 10);

      expect(frames).toBe(49);
    });

    it('holds drift bounded rather than letting it accumulate with runtime', async () => {
      const advance = installFakeNow();
      const { clock, node } = await startedClock(20000, () => undefined);

      fireEvenly(node, advance, 100, 10);
      const early = Math.abs(clock.stats.driftMs);
      fireEvenly(node, advance, 400, 10);
      const late = Math.abs(clock.stats.driftMs);

      // Bounded by the frame still accumulating plus the first callback's assumed buffer, and — the
      // part that matters — no larger after five times the runtime. A clock advancing on assumed
      // time drifts by a fixed fraction of elapsed time instead, which grows without limit and is
      // what leaves the cartridge's re-timer hunting.
      const boundMs = 20 + BUFFER_DURATION_US / 1000;
      expect(early).toBeLessThan(boundMs);
      expect(late).toBeLessThan(boundMs);
    });

    it('makes up the frames a stall owed rather than leaving the stream short', async () => {
      const advance = installFakeNow();
      let frames = 0;
      const { node } = await startedClock(10000, () => frames++);

      fireEvenly(node, advance, 3, 5);
      expect(frames).toBe(1);

      // 40 ms with no callback: the cartridge drains straight through it, so the four frames that
      // fell due have to arrive rather than be skipped, or its queue stays that much shallower.
      advance(40);
      node.fireBuffers(1);

      expect(frames).toBe(5);
    });

    it('caps catch-up so a very long stall cannot flood the cartridge queue', async () => {
      const advance = installFakeNow();
      let frames = 0;
      const { node } = await startedClock(10000, () => frames++);

      fireEvenly(node, advance, 2, 5);
      const before = frames;

      advance(5000); // five seconds: past the point the cartridge re-buffered on its own
      node.fireBuffers(1);

      // 250 ms of catch-up at a 10 ms interval, not five seconds' worth.
      expect(frames - before).toBe(25);
    });

    it('counts callbacks arriving more than twice the buffer duration apart', async () => {
      const advance = installFakeNow();
      const { clock, node } = await startedClock(20000, () => undefined);

      fireEvenly(node, advance, 20, 5); // inside the ~10.7 ms threshold
      expect(clock.stats.lateCallbacks).toBe(0);

      advance(40);
      node.fireBuffers(1);
      advance(40);
      node.fireBuffers(1);

      // Separates one spike from a recurring one, which the running-maximum worst gap cannot.
      expect(clock.stats.lateCallbacks).toBe(2);
      expect(clock.stats.worstGapMs).toBeCloseTo(40);
    });
  });

  it('routes the processor through a silenced gain node into the destination', async () => {
    const { context } = await startedClock(20000, () => undefined);

    expect(context.resumed).toBe(true);
    expect(context.gain?.gain.value).toBe(0);
    expect(context.connections).toEqual([
      ['node', 'gain'],
      ['gain', 'destination'],
    ]);
  });

  it('emits a frame once the audio callbacks have covered the interval', async () => {
    const advance = installFakeNow();
    let frames = 0;
    const { clock, node } = await startedClock(20000, () => frames++);

    // Four 256-frame buffers at 48 kHz is 21.3 ms — one 20 ms frame's worth.
    fireNominal(node, advance, 4);

    expect(frames).toBe(1);
    expect(clock.stats.framesEmitted).toBe(1);
    expect(clock.stats.nominalIntervalUs).toBe(20000);
  });

  it('emits several frames from a single callback at short intervals', async () => {
    let frames = 0;
    const { node } = await startedClock(1000, () => frames++);

    node.fireBuffers(1);

    expect(frames).toBe(Math.floor(BUFFER_DURATION_US / 1000));
  });

  it('retimes a running clock without dropping the frames already counted', async () => {
    const advance = installFakeNow();
    let frames = 0;
    const { clock, node } = await startedClock(20000, () => frames++);

    fireNominal(node, advance, 4);
    clock.setIntervalUs(10000);
    fireNominal(node, advance, 2);

    expect(clock.stats.nominalIntervalUs).toBe(10000);
    expect(frames).toBe(2);
  });

  it('detaches the callback and closes the context on stop, keeping the stats readable', async () => {
    const advance = installFakeNow();
    let frames = 0;
    const { clock, context, node } = await startedClock(20000, () => frames++);
    fireNominal(node, advance, 4);

    clock.stop();
    fireNominal(node, advance, 8);

    expect(node.onaudioprocess).toBeNull();
    expect(node.disconnected).toBe(true);
    expect(context.closed).toBe(true);
    expect(frames).toBe(1);
    expect(clock.stats.framesEmitted).toBe(1);
  });
});
