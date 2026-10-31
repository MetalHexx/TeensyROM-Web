import { afterEach, describe, it, expect, vi } from 'vitest';
import { WaveBankModel } from './model/wave-bank-model';
import { WaveStream, type EntryChange, type VoiceChange } from './model/wave-stream.mock';
import type { WaveVoice, WaveWindowState } from './model/wave-view';
import {
  WAVEFORM_PULSE,
  WAVE_FEED_LENGTH,
  WAVE_HEADER_COUNT,
  WAVE_HEADER_DROPPED,
  WAVE_HEADER_LENGTH,
  WAVE_HEADER_RESTARTED,
} from './wave-feed-layout';
import type { MainToWorker, WaveWorkerScope, WorkerToMain } from './wave-protocol';
import { WAVE_DRAW_INTERVAL_MS, WaveWorkerHost } from './wave-worker-host';

/** Every call on a context, by name; gradients get an `addColorStop`. */
class RecordingContext {
  readonly calls: string[] = [];

  count(name: string): number {
    return this.calls.filter((call) => call === name).length;
  }

  asContext(): OffscreenCanvasRenderingContext2D {
    return new Proxy(this, {
      get: (target, property: string) => {
        if (property in target) return (target as unknown as Record<string, unknown>)[property];
        return (...args: unknown[]) => {
          target.calls.push(property);
          return property.startsWith('create') ? { addColorStop: () => undefined } : args[0];
        };
      },
      set: () => true,
    }) as unknown as OffscreenCanvasRenderingContext2D;
  }
}

interface FakeCanvas {
  readonly canvas: { width: number; height: number };
  readonly context: RecordingContext;
  readonly offscreen: OffscreenCanvas;
}

function fakeCanvas(hasContext = true): FakeCanvas {
  const context = new RecordingContext();
  const canvas = {
    width: 300,
    height: 150,
    getContext: () => (hasContext ? context.asContext() : null),
  };
  return { canvas, context, offscreen: canvas as unknown as OffscreenCanvas };
}

const PALETTE: Extract<MainToWorker, { type: 'palette' }> = {
  type: 'palette',
  voices: [
    [255, 0, 0],
    [0, 255, 0],
    [0, 0, 255],
  ],
  glass: [6, 9, 10],
};

const NOTE: VoiceChange = {
  frequency: 2000,
  waveform: WAVEFORM_PULSE,
  pulseWidth: 2048,
  attack: 0,
  decay: 15,
  sustain: 15,
  release: 0,
  gate: 1,
  hit: 1,
};

/** Voices 0 and 1 strike a note; voice 2 stays silent. */
const SOUNDING: EntryChange = { 0: NOTE, 1: NOTE };
const ALL_SOUNDING: EntryChange = { 0: NOTE, 1: NOTE, 2: NOTE };

const FRAME_MS = 17;

interface HarnessOptions {
  now?: number;
  timeOrigin?: number;
  mainTimeOrigin?: number;
  layerError?: Error;
}

function harness(options: HarnessOptions = {}) {
  let now = options.now ?? 1000;
  const posted: { message: WorkerToMain; transfer?: Transferable[] }[] = [];
  const queue = new Map<number, () => void>();
  let nextHandle = 1;
  const layers: RecordingContext[] = [];

  const scope: WaveWorkerScope = {
    post: (message, transfer) => void posted.push({ message, transfer }),
    now: () => now,
    timeOrigin: options.timeOrigin ?? 0,
    requestFrame: (callback) => {
      const handle = nextHandle++;
      queue.set(handle, () => callback(now));
      return handle;
    },
    cancelFrame: (handle) => void queue.delete(handle),
    createLayer: () => {
      if (options.layerError) throw options.layerError;
      const context = new RecordingContext();
      layers.push(context);
      return { getContext: () => context.asContext() } as unknown as OffscreenCanvas;
    },
  };
  const host = new WaveWorkerHost(scope);

  return {
    host,
    posted,
    layers,
    pending: () => queue.size,
    recycled: () => posted.filter((entry) => entry.message.type === 'recycle'),
    faults: () => posted.filter((entry) => entry.message.type === 'fault'),
    /** Moves the clock on, then runs the frames that were waiting. */
    frame(ms = FRAME_MS): void {
      now += ms;
      const due = [...queue.values()];
      queue.clear();
      for (const run of due) run();
    },
  };
}

type Harness = ReturnType<typeof harness>;

/** A host with its palette set, ready for windows. */
function started(options: HarnessOptions = {}): Harness {
  const h = harness(options);
  h.host.handle({
    type: 'init',
    mainTimeOrigin: options.mainTimeOrigin ?? options.timeOrigin ?? 0,
  });
  h.host.handle(PALETTE);
  return h;
}

function attach(
  h: Harness,
  id: number,
  voice: WaveVoice,
  options: { bank?: string; visible?: boolean; width?: number; height?: number; dpr?: number } = {}
): FakeCanvas {
  const fake = fakeCanvas();
  h.host.handle({
    type: 'attach',
    id,
    bank: options.bank ?? 'a',
    voice,
    canvas: fake.offscreen,
    width: options.width ?? 80,
    height: options.height ?? 44,
    dpr: options.dpr ?? 2,
  });
  if (options.visible ?? true) h.host.handle({ type: 'visible', id, visible: true });
  return fake;
}

function setState(h: Harness, state: WaveWindowState, bank = 'a'): void {
  h.host.handle({ type: 'state', bank, state });
}

/** Cuts a continuing stream into feed buffers; entries start at 1000 on the main thread's clock. */
class Feeder {
  private readonly stream = new WaveStream(980);
  private taken = 0;

  next(entries: EntryChange[], header: { restarted?: boolean; dropped?: number }): Float64Array {
    for (const change of entries) this.stream.entry(change);
    const buffer = new Float64Array(WAVE_FEED_LENGTH);
    const from = this.stream.offset(this.taken);
    const to = this.stream.offset(this.stream.count);
    buffer.set(this.stream.data.subarray(from, to), WAVE_HEADER_LENGTH);
    buffer[WAVE_HEADER_COUNT] = this.stream.count - this.taken;
    buffer[WAVE_HEADER_RESTARTED] = header.restarted ? 1 : 0;
    buffer[WAVE_HEADER_DROPPED] = header.dropped ?? 0;
    this.taken = this.stream.count;
    return buffer;
  }
}

const feeders = new WeakMap<Harness, Map<string, Feeder>>();

/** Delivers the next entries of a bank's stream as one feed and returns the buffer sent. */
function feed(
  h: Harness,
  entries: EntryChange[],
  options: { bank?: string; restarted?: boolean; dropped?: number } = {}
): Float64Array {
  const bank = options.bank ?? 'a';
  let banks = feeders.get(h);
  if (!banks) feeders.set(h, (banks = new Map()));
  let feeder = banks.get(bank);
  if (!feeder) banks.set(bank, (feeder = new Feeder()));
  const buffer = feeder.next(entries, options);
  h.host.handle({ type: 'feed', bank, buffer });
  return buffer;
}

function statsOf(h: Harness): Record<string, number> {
  const message = h.posted[h.posted.length - 1].message;
  if (message.type !== 'stats') throw new Error('no stats were posted');
  return message.values;
}

function draws(fake: FakeCanvas): number {
  return fake.context.count('drawImage');
}

function traced(fake: FakeCanvas): boolean {
  return fake.context.count('stroke') > 0;
}

describe('WaveWorkerHost', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('ingest', () => {
    it('applies every entry of a feed in order even when nothing draws, then hands the buffer back', () => {
      const h = started();
      const ingest = vi.spyOn(WaveBankModel.prototype, 'ingestEntry');

      const buffer = feed(h, [SOUNDING, {}, {}, { 0: { gate: 0 } }]);

      expect(ingest.mock.calls.map(([data, offset]) => data[offset])).toEqual([
        1000, 1020, 1040, 1060,
      ]);
      expect(h.recycled()).toHaveLength(1);
      const recycle = h.recycled()[0];
      expect(recycle.message).toEqual({ type: 'recycle', bank: 'a', buffer });
      expect(recycle.transfer).toEqual([buffer.buffer]);
      expect(h.pending()).toBe(0);
    });

    it('ingests every delivery that arrives between frames and draws once from the newest', () => {
      const h = started();
      const ingest = vi.spyOn(WaveBankModel.prototype, 'ingestEntry');
      const win = attach(h, 1, 0);
      setState(h, 'playing');

      feed(h, [SOUNDING, {}, {}]);
      feed(h, [{}, {}]);
      feed(h, [{}, {}, {}, {}]);
      h.frame();

      expect(ingest).toHaveBeenCalledTimes(9);
      expect(h.recycled()).toHaveLength(3);
      expect(draws(win)).toBe(1);
      expect(traced(win)).toBe(true);
    });

    it('resets the model before the entries when the feed restarted or dropped entries', () => {
      const h = started();
      const restart = vi.spyOn(WaveBankModel.prototype, 'restart');
      const ingest = vi.spyOn(WaveBankModel.prototype, 'ingestEntry');

      feed(h, [SOUNDING, {}]);
      expect(restart).not.toHaveBeenCalled();

      feed(h, [SOUNDING, {}], { restarted: true });
      feed(h, [SOUNDING, {}], { dropped: 3 });

      expect(restart).toHaveBeenCalledTimes(2);
      expect(restart.mock.invocationCallOrder[0]).toBeLessThan(ingest.mock.invocationCallOrder[2]);
      expect(restart.mock.invocationCallOrder[0]).toBeGreaterThan(
        ingest.mock.invocationCallOrder[1]
      );
    });

    it('keeps a model per bank', () => {
      const h = started();
      const left = attach(h, 1, 0, { bank: 'left' });
      const right = attach(h, 2, 0, { bank: 'right' });
      setState(h, 'playing', 'left');
      setState(h, 'playing', 'right');

      feed(h, [SOUNDING, {}], { bank: 'left' });
      h.frame();

      expect(traced(left)).toBe(true);
      expect(traced(right)).toBe(false);
    });
  });

  describe('time base', () => {
    it("steps the model to the worker's clock expressed on the entries' clock", () => {
      const h = started({ now: 600, timeOrigin: 1_000_500, mainTimeOrigin: 1_000_000 });
      const step = vi.spyOn(WaveBankModel.prototype, 'step');
      const win = attach(h, 1, 0);
      setState(h, 'playing');
      feed(h, [SOUNDING, {}]);

      h.frame();

      expect(step).toHaveBeenCalledWith(600 + FRAME_MS + 500);
      expect(traced(win)).toBe(true);
    });
  });

  describe('drawing', () => {
    it('draws only the visible windows, once each when flat', () => {
      const h = started();
      const shown = attach(h, 1, 0);
      const hidden = attach(h, 2, 1, { visible: false });
      setState(h, 'flat');

      h.frame();

      expect(draws(shown)).toBe(1);
      expect(draws(hidden)).toBe(0);
      expect(h.pending()).toBe(0);

      h.host.handle({ type: 'visible', id: 2, visible: true });
      h.frame();
      expect(draws(hidden)).toBe(1);
    });

    it('draws nothing until a palette has arrived', () => {
      const h = harness();
      const win = attach(h, 1, 0);
      setState(h, 'flat');
      expect(h.pending()).toBe(0);

      h.host.handle(PALETTE);
      h.frame();

      expect(draws(win)).toBe(1);
    });

    it('schedules nothing when every window is flat and drawn', () => {
      const h = started();
      const windows = [attach(h, 1, 0), attach(h, 2, 1), attach(h, 3, 2)];
      setState(h, 'flat');
      h.frame();

      feed(h, [SOUNDING, {}]);
      setState(h, 'flat');
      h.host.handle({ type: 'visible', id: 1, visible: true });

      expect(h.pending()).toBe(0);
      expect(windows.map(draws)).toEqual([1, 1, 1]);
      expect(windows.some(traced)).toBe(false);
    });

    it('draws a held window once while its model keeps ingesting', () => {
      const h = started();
      const ingest = vi.spyOn(WaveBankModel.prototype, 'ingestEntry');
      const win = attach(h, 1, 0);
      setState(h, 'held');
      feed(h, [SOUNDING, {}]);
      h.frame();

      feed(h, [{}, {}, {}]);
      h.frame();

      expect(draws(win)).toBe(1);
      expect(h.pending()).toBe(0);
      expect(ingest).toHaveBeenCalledTimes(5);
    });

    it('keeps drawing a sounding playing window and stops once it has fallen silent', () => {
      const h = started();
      const win = attach(h, 1, 0);
      setState(h, 'playing');
      feed(h, [SOUNDING, {}]);

      h.frame();
      h.frame();
      h.frame();
      expect(draws(win)).toBe(3);
      expect(h.pending()).toBe(1);

      feed(h, [{ 0: { gate: 0 } }]);
      for (let i = 0; i < 4; i++) h.frame();

      expect(h.pending()).toBe(0);
      const settled = draws(win);
      h.frame();
      expect(draws(win)).toBe(settled);
    });

    it('draws a playing window whose voice is silent as one flat line and then leaves it', () => {
      const h = started();
      const win = attach(h, 1, 2);
      setState(h, 'playing');
      h.frame();

      feed(h, [{}, {}]);
      h.frame();

      expect(draws(win)).toBe(1);
      expect(traced(win)).toBe(false);
      expect(win.context.count('fillRect')).toBe(1);
      expect(h.pending()).toBe(0);
    });

    it('draws no faster than the draw interval and counts the frames it skipped', () => {
      const h = started();
      const win = attach(h, 1, 0);
      setState(h, 'playing');
      feed(h, [SOUNDING, {}]);

      h.frame(FRAME_MS);
      h.frame(5);
      h.frame(5);
      h.frame(WAVE_DRAW_INTERVAL_MS);

      expect(draws(win)).toBe(2);
      h.host.handle({ type: 'stats', request: 7 });
      expect(statsOf(h)).toMatchObject({ draws: 2, skipped: 2 });
    });

    it('forces one redraw on a change of size, density, palette or state', () => {
      const h = started();
      const win = attach(h, 1, 0);
      setState(h, 'flat');
      h.frame();
      expect(draws(win)).toBe(1);
      expect([win.canvas.width, win.canvas.height]).toEqual([160, 88]);

      h.host.handle({ type: 'resize', id: 1, width: 100, height: 40, dpr: 1 });
      expect([win.canvas.width, win.canvas.height]).toEqual([160, 88]);
      h.frame();
      expect(draws(win)).toBe(2);
      expect([win.canvas.width, win.canvas.height]).toEqual([100, 40]);
      expect(h.pending()).toBe(0);

      h.host.handle({ type: 'resize', id: 1, width: 100, height: 40, dpr: 2 });
      h.frame();
      expect(draws(win)).toBe(3);
      expect(win.canvas.width).toBe(200);

      h.host.handle({ ...PALETTE, glass: [1, 2, 3] });
      h.frame();
      expect(draws(win)).toBe(4);

      setState(h, 'held');
      h.frame();
      expect(draws(win)).toBe(5);
      expect(h.pending()).toBe(0);
    });

    it('does not draw a detached window', () => {
      const h = started();
      const kept = attach(h, 1, 0);
      const gone = attach(h, 2, 1);
      setState(h, 'flat');
      h.frame();

      h.host.handle({ type: 'detach', id: 2 });
      h.host.handle(PALETTE);
      h.frame();

      expect(draws(kept)).toBe(2);
      expect(draws(gone)).toBe(1);
    });

    it('gives every window its own painter, so a neighbour never forces a rebuild', () => {
      const h = started();
      const windows = [attach(h, 1, 0), attach(h, 2, 1), attach(h, 3, 2)];
      setState(h, 'playing');
      feed(h, [ALL_SOUNDING, {}]);

      for (let i = 0; i < 5; i++) h.frame();

      expect(windows.map(draws)).toEqual([5, 5, 5]);
      expect(h.layers).toHaveLength(3);
    });
  });

  describe('pose', () => {
    it('lets a window override its bank state, and return to it', () => {
      const h = started();
      const win = attach(h, 1, 0);
      setState(h, 'playing');
      feed(h, [SOUNDING, {}]);

      h.host.handle({ type: 'override', id: 1, state: 'flat' });
      h.frame();
      expect(draws(win)).toBe(1);
      expect(traced(win)).toBe(false);
      expect(h.pending()).toBe(0);

      h.host.handle({ type: 'override', id: 1, state: null });
      h.frame();
      expect(traced(win)).toBe(true);
      expect(h.pending()).toBe(1);
    });

    it('holds a playing window still under reduced motion, and leaves a flat one flat', () => {
      const h = started();
      const playing = attach(h, 1, 0);
      const flat = attach(h, 2, 1, { bank: 'b' });
      h.host.handle({ type: 'motion', reduced: true });
      setState(h, 'playing');
      setState(h, 'flat', 'b');
      feed(h, [SOUNDING, {}]);

      h.frame();
      feed(h, [{}, {}]);
      h.frame();

      expect(draws(playing)).toBe(1);
      expect(traced(playing)).toBe(true);
      expect(draws(flat)).toBe(1);
      expect(traced(flat)).toBe(false);
      expect(h.pending()).toBe(0);
    });

    it('does not leave a stopped deck frozen on its last picture under reduced motion', () => {
      const h = started();
      const win = attach(h, 1, 0);
      h.host.handle({ type: 'motion', reduced: true });
      setState(h, 'playing');
      feed(h, [SOUNDING, {}]);
      h.frame();
      expect(win.context.count('fillRect')).toBe(0);

      setState(h, 'flat');
      h.frame();

      expect(draws(win)).toBe(2);
      expect(win.context.count('fillRect')).toBe(1);
    });

    it('moves a held window again when motion is no longer reduced', () => {
      const h = started();
      const win = attach(h, 1, 0);
      h.host.handle({ type: 'motion', reduced: true });
      setState(h, 'playing');
      feed(h, [SOUNDING, {}]);
      h.frame();
      expect(h.pending()).toBe(0);

      h.host.handle({ type: 'motion', reduced: false });
      h.frame();
      h.frame();

      expect(draws(win)).toBe(3);
      expect(h.pending()).toBe(1);
    });
  });

  describe('suppress', () => {
    it('clears each canvas once and stops all drawing until lifted', () => {
      const h = started();
      const first = attach(h, 1, 0);
      const second = attach(h, 2, 1);
      setState(h, 'playing');
      feed(h, [SOUNDING, {}]);
      h.frame();
      expect(h.pending()).toBe(1);

      h.host.handle({ type: 'suppress', suppressed: true });
      h.host.handle({ type: 'suppress', suppressed: true });
      feed(h, [{}, {}]);
      h.frame();

      expect(first.context.count('clearRect')).toBe(1);
      expect(second.context.count('clearRect')).toBe(1);
      expect(h.pending()).toBe(0);
      expect(draws(first)).toBe(1);
      expect(h.recycled()).toHaveLength(2);

      h.host.handle({ type: 'suppress', suppressed: false });
      h.frame();
      expect(draws(first)).toBe(2);
      expect(draws(second)).toBe(2);
    });
  });

  describe('stats', () => {
    it('answers with the draw counts and the mean and maximum draw time', () => {
      const h = started();
      attach(h, 1, 0);
      setState(h, 'flat');
      h.frame();

      h.host.handle({ type: 'stats', request: 3 });

      expect(h.posted[h.posted.length - 1].message).toEqual({
        type: 'stats',
        request: 3,
        values: { draws: 1, skipped: 0, meanDrawMs: 0, maxDrawMs: 0 },
      });
    });
  });

  describe('faults', () => {
    it('posts one fault for a window that cannot be drawn on, and ignores everything after', () => {
      const h = started();
      const bad = fakeCanvas(false);

      h.host.handle({
        type: 'attach',
        id: 1,
        bank: 'a',
        voice: 0,
        canvas: bad.offscreen,
        width: 80,
        height: 44,
        dpr: 1,
      });
      h.host.handle({
        type: 'attach',
        id: 2,
        bank: 'a',
        voice: 1,
        canvas: bad.offscreen,
        width: 80,
        height: 44,
        dpr: 1,
      });
      feed(h, [SOUNDING]);

      expect(h.faults()).toHaveLength(1);
      expect(h.faults()[0].message).toEqual({
        type: 'fault',
        message: 'the wave canvas has no 2d context',
      });
      expect(h.recycled()).toHaveLength(0);
      expect(h.pending()).toBe(0);
    });

    it('stops drawing after an error thrown while drawing', () => {
      const h = started({ layerError: new Error('no layer for you') });
      const win = attach(h, 1, 0);
      setState(h, 'playing');
      feed(h, [SOUNDING, {}]);

      h.frame();

      expect(h.faults().map((entry) => entry.message)).toEqual([
        { type: 'fault', message: 'no layer for you' },
      ]);
      expect(h.pending()).toBe(0);

      setState(h, 'playing');
      feed(h, [{}]);
      h.frame();
      expect(h.faults()).toHaveLength(1);
      expect(h.pending()).toBe(0);
      expect(draws(win)).toBe(0);
    });
  });
});
