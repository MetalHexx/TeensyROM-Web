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

describe('ScriptProcessorFrameClock', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
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
    let frames = 0;
    const { clock, node } = await startedClock(20000, () => frames++);

    // Four 256-frame buffers at 48 kHz is 21.3 ms — one 20 ms frame's worth.
    node.fireBuffers(4);

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
    let frames = 0;
    const { clock, node } = await startedClock(20000, () => frames++);

    node.fireBuffers(4);
    clock.setIntervalUs(10000);
    node.fireBuffers(2);

    expect(clock.stats.nominalIntervalUs).toBe(10000);
    expect(frames).toBe(2);
  });

  it('detaches the callback and closes the context on stop, keeping the stats readable', async () => {
    let frames = 0;
    const { clock, context, node } = await startedClock(20000, () => frames++);
    node.fireBuffers(4);

    clock.stop();
    node.fireBuffers(8);

    expect(node.onaudioprocess).toBeNull();
    expect(node.disconnected).toBe(true);
    expect(context.closed).toBe(true);
    expect(frames).toBe(1);
    expect(clock.stats.framesEmitted).toBe(1);
  });
});
