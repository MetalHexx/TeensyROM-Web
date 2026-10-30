import { NgZone } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ThemeService } from '@teensyrom-nx/ui/styles';
import { logWarn } from '@teensyrom-nx/utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WaveFeedBuffer } from './wave-feed-buffer';
import { WAVE_FEED_LENGTH } from './wave-feed-layout';
import type { MainToWorker, WaveWorkerPort, WorkerToMain } from './wave-protocol';
import { VoiceWaveRenderer, WAVE_WORKER_FACTORY } from './voice-wave-renderer';

interface Sent {
  message: MainToWorker;
  transfer?: Transferable[];
}

class FakeWorker implements WaveWorkerPort {
  readonly sent: Sent[] = [];
  terminated = false;
  readonly assignedInZone: Record<string, boolean> = {};
  private messageHandler: ((event: { data: WorkerToMain }) => void) | null = null;
  private errorHandler: ((event: unknown) => void) | null = null;

  get onmessage(): ((event: { data: WorkerToMain }) => void) | null {
    return this.messageHandler;
  }
  set onmessage(handler: ((event: { data: WorkerToMain }) => void) | null) {
    this.assignedInZone['onmessage'] = NgZone.isInAngularZone();
    this.messageHandler = handler;
  }
  get onerror(): ((event: unknown) => void) | null {
    return this.errorHandler;
  }
  set onerror(handler: ((event: unknown) => void) | null) {
    this.assignedInZone['onerror'] = NgZone.isInAngularZone();
    this.errorHandler = handler;
  }

  postMessage(message: MainToWorker, transfer?: Transferable[]): void {
    this.sent.push({ message, transfer });
    // A real transfer detaches the sender's buffer.
    if (message.type === 'feed') structuredClone(message.buffer, { transfer: [message.buffer.buffer] });
  }

  terminate(): void {
    this.terminated = true;
  }

  types(): string[] {
    return this.sent.map((entry) => entry.message.type);
  }

  of<T extends MainToWorker['type']>(type: T): Extract<MainToWorker, { type: T }>[] {
    return this.sent
      .map((entry) => entry.message)
      .filter((message): message is Extract<MainToWorker, { type: T }> => message.type === type);
  }

  say(message: WorkerToMain): void {
    this.onmessage?.({ data: message });
  }
}

function acquired(wave: VoiceWaveRenderer, bank: string): WaveFeedBuffer {
  const feed = wave.acquireFeed(bank);
  if (!feed) throw new Error(`no feed available for bank ${bank}`);
  return feed;
}

function fakeCanvas(): HTMLCanvasElement {
  return {
    clientWidth: 120,
    clientHeight: 40,
    style: { visibility: '' },
    transferControlToOffscreen: () => ({}) as OffscreenCanvas,
  } as unknown as HTMLCanvasElement;
}

class FakeObserver {
  static instances: FakeObserver[] = [];
  disconnected = false;
  readonly builtInZone = NgZone.isInAngularZone();
  constructor(readonly callback: (entries: unknown[]) => void) {
    FakeObserver.instances.push(this);
  }
  observe(): void {
    /* no-op */
  }
  disconnect(): void {
    this.disconnected = true;
  }
}

vi.mock('@teensyrom-nx/utils', () => ({ logWarn: vi.fn() }));

describe('VoiceWaveRenderer', () => {
  let workers: FakeWorker[];
  let factory: () => WaveWorkerPort;
  const warn = vi.mocked(logWarn);

  function renderer(): VoiceWaveRenderer {
    return TestBed.inject(VoiceWaveRenderer);
  }

  beforeEach(() => {
    workers = [];
    factory = () => {
      const worker = new FakeWorker();
      workers.push(worker);
      return worker;
    };
    warn.mockClear();
    TestBed.configureTestingModule({
      providers: [{ provide: WAVE_WORKER_FACTORY, useValue: () => factory() }],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    FakeObserver.instances = [];
    document.documentElement.style.cssText = '';
  });

  describe('lifecycle', () => {
    it('builds the worker on the first register and replays what it holds', () => {
      const wave = renderer();
      wave.setBankState('a', 'playing');
      wave.setSuppressed(true);
      expect(workers).toHaveLength(0);

      const canvas = fakeCanvas();
      wave.register(canvas, 'a', 1);
      wave.register(fakeCanvas(), 'a', 2);

      expect(workers).toHaveLength(1);
      const worker = workers[0];
      expect(worker.types().slice(0, 3)).toEqual(['init', 'palette', 'motion']);
      expect(worker.of('suppress')).toEqual([{ type: 'suppress', suppressed: true }]);
      expect(worker.of('state')).toEqual([{ type: 'state', bank: 'a', state: 'playing' }]);
      expect(worker.types().indexOf('state')).toBeLessThan(worker.types().indexOf('attach'));
      const attaches = worker.of('attach');
      expect(attaches).toHaveLength(2);
      expect(attaches[0]).toMatchObject({ bank: 'a', voice: 1, width: 120, height: 40, dpr: 1 });
      expect(worker.sent.find((entry) => entry.message.type === 'attach')?.transfer).toHaveLength(1);
      expect(canvas.style.visibility).toBe('hidden');
    });

    it('terminates the worker when the last window is released, and builds a fresh one after', () => {
      const wave = renderer();
      const first = wave.register(fakeCanvas(), 'a', 0);
      const second = wave.register(fakeCanvas(), 'a', 1);

      first.release();
      first.release();
      expect(workers[0].terminated).toBe(false);
      expect(workers[0].of('detach')).toHaveLength(1);
      second.release();
      expect(workers[0].terminated).toBe(true);

      wave.register(fakeCanvas(), 'a', 0);
      expect(workers).toHaveLength(2);
    });

    it('forwards an override for a window', () => {
      const wave = renderer();
      const handle = wave.register(fakeCanvas(), 'a', 0);
      handle.setOverride('flat');
      expect(workers[0].of('override')).toEqual([
        { type: 'override', id: workers[0].of('attach')[0].id, state: 'flat' },
      ]);
    });

    it('hides and restores the canvases when suppressed', () => {
      const wave = renderer();
      const canvas = fakeCanvas();
      wave.register(canvas, 'a', 0);

      wave.setSuppressed(true);
      expect(canvas.style.visibility).toBe('hidden');
      wave.setSuppressed(false);
      expect(canvas.style.visibility).toBe('');
      expect(workers[0].of('suppress').map((m) => m.suppressed)).toEqual([true, false]);
    });

    it('answers a stats request from the worker', async () => {
      const wave = renderer();
      wave.register(fakeCanvas(), 'a', 0);
      const pending = wave.readStats();
      const request = workers[0].of('stats')[0].request;
      workers[0].say({ type: 'stats', request, values: { draws: 4 } });
      await expect(pending).resolves.toEqual({ draws: 4 });
    });
  });

  describe('outside the zone', () => {
    it('builds the worker and arms its handlers, observers and listeners outside Angular', () => {
      vi.stubGlobal('ResizeObserver', FakeObserver);
      vi.stubGlobal('IntersectionObserver', FakeObserver);
      const armedInZone: Record<string, boolean> = {};
      const addWindow = window.addEventListener.bind(window);
      vi.spyOn(window, 'addEventListener').mockImplementation(((type: string, listener: EventListenerOrEventListenerObject) => {
        armedInZone[`window:${type}`] = NgZone.isInAngularZone();
        return addWindow(type, listener);
      }) as typeof window.addEventListener);
      const addDocument = document.addEventListener.bind(document);
      vi.spyOn(document, 'addEventListener').mockImplementation(((type: string, listener: EventListenerOrEventListenerObject) => {
        armedInZone[`document:${type}`] = NgZone.isInAngularZone();
        return addDocument(type, listener);
      }) as typeof document.addEventListener);
      vi.stubGlobal('matchMedia', () => {
        armedInZone['matchMedia'] = NgZone.isInAngularZone();
        return { matches: false, addEventListener: () => undefined, removeEventListener: () => undefined };
      });
      let factoryInZone: boolean | null = null;
      factory = () => {
        factoryInZone = NgZone.isInAngularZone();
        const worker = new FakeWorker();
        workers.push(worker);
        return worker;
      };
      const zone = TestBed.inject(NgZone);
      const inside = vi.spyOn(zone, 'run');
      const wave = renderer();

      zone.run(() => {
        expect(NgZone.isInAngularZone()).toBe(true);
        wave.register(fakeCanvas(), 'a', 0);
      });

      expect(factoryInZone).toBe(false);
      expect(workers[0].assignedInZone).toEqual({ onmessage: false, onerror: false });
      expect(FakeObserver.instances).toHaveLength(2);
      expect(FakeObserver.instances.map((observer) => observer.builtInZone)).toEqual([false, false]);
      expect(armedInZone).toMatchObject({
        'window:resize': false,
        'document:visibilitychange': false,
        matchMedia: false,
      });

      inside.mockClear();
      wave.acquireFeed('a');
      wave.submitFeed('a');
      workers[0].say({ type: 'recycle', bank: 'a', buffer: new Float64Array(WAVE_FEED_LENGTH) });
      expect(inside).not.toHaveBeenCalled();
    });
  });

  describe('feed pool', () => {
    it('hands out distinct buffers until exhausted, and a recycle frees one', () => {
      const wave = renderer();
      expect(wave.acquireFeed('a')).toBeNull();
      wave.register(fakeCanvas(), 'a', 0);

      const seen = new Set<unknown>();
      for (let i = 0; i < 3; i++) {
        const buffer = wave.acquireFeed('a');
        expect(buffer).not.toBeNull();
        seen.add(buffer);
        wave.submitFeed('a');
      }
      expect(seen.size).toBe(3);
      expect(wave.acquireFeed('a')).toBeNull();

      workers[0].say({ type: 'recycle', bank: 'a', buffer: new Float64Array(WAVE_FEED_LENGTH) });
      expect(wave.acquireFeed('a')).not.toBeNull();
    });

    it('detaches a submitted buffer and takes the recycled array back', () => {
      const wave = renderer();
      wave.register(fakeCanvas(), 'a', 0);
      const buffers = [acquired(wave, 'a')];
      wave.submitFeed('a');
      expect(buffers[0].array.length).toBe(0);
      expect(workers[0].sent.find((e) => e.message.type === 'feed')?.transfer).toHaveLength(1);

      buffers.push(acquired(wave, 'a'));
      wave.submitFeed('a');
      buffers.push(acquired(wave, 'a'));
      wave.submitFeed('a');
      expect(wave.acquireFeed('a')).toBeNull();

      workers[0].say({ type: 'recycle', bank: 'a', buffer: new Float64Array(WAVE_FEED_LENGTH) });
      const again = wave.acquireFeed('a');
      expect(again).toBe(buffers[0]);
      expect(again?.array.length).toBe(WAVE_FEED_LENGTH);
      expect(again?.entryCount).toBe(0);
    });

    it('hands out the same reset buffer until submitted or discarded', () => {
      const wave = renderer();
      wave.register(fakeCanvas(), 'a', 0);
      const first = acquired(wave, 'a');
      first.beginEntry(5);
      expect(first.entryCount).toBe(1);

      const second = wave.acquireFeed('a');
      expect(second).toBe(first);
      expect(second?.entryCount).toBe(0);

      wave.discardFeed('a');
      expect(workers[0].of('feed')).toHaveLength(0);
      expect(wave.acquireFeed('a')).not.toBeNull();
    });

    it('fills the pool again after the worker is rebuilt', () => {
      const wave = renderer();
      const handle = wave.register(fakeCanvas(), 'a', 0);
      for (let i = 0; i < 3; i++) {
        wave.acquireFeed('a');
        wave.submitFeed('a');
      }
      expect(wave.acquireFeed('a')).toBeNull();

      handle.release();
      expect(wave.acquireFeed('a')).toBeNull();
      wave.register(fakeCanvas(), 'a', 0);
      for (let i = 0; i < 3; i++) {
        expect(wave.acquireFeed('a')).not.toBeNull();
        wave.submitFeed('a');
      }
    });

    it('returns a buffer to the pool when submitted with no worker', () => {
      const wave = renderer();
      const handle = wave.register(fakeCanvas(), 'a', 0);
      const buffer = acquired(wave, 'a');
      handle.release();
      wave.submitFeed('a');
      expect(buffer.array.length).toBe(WAVE_FEED_LENGTH);
    });
  });

  describe('failure', () => {
    it('warns once and leaves the window alone when the canvas cannot be transferred', () => {
      const wave = renderer();
      const canvas = { style: { visibility: '' } } as unknown as HTMLCanvasElement;
      wave.register(canvas, 'a', 0);
      wave.register(canvas, 'a', 1);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(wave.failed).toBe(true);
      expect(workers).toHaveLength(0);
      expect(wave.acquireFeed('a')).toBeNull();
    });

    it('warns once when the factory throws', () => {
      factory = () => {
        throw new Error('no Worker');
      };
      const wave = renderer();
      const handle = wave.register(fakeCanvas(), 'a', 0);
      handle.setOverride('flat');
      handle.release();
      wave.register(fakeCanvas(), 'a', 0);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(wave.failed).toBe(true);
    });

    it('goes quiet for good on a worker error, with no second worker', () => {
      const wave = renderer();
      wave.register(fakeCanvas(), 'a', 0);
      wave.acquireFeed('a');

      workers[0].onerror?.({});
      expect(warn).toHaveBeenCalledTimes(1);
      expect(workers[0].terminated).toBe(true);
      expect(wave.failed).toBe(true);

      wave.register(fakeCanvas(), 'a', 1);
      wave.setBankState('a', 'playing');
      expect(workers).toHaveLength(1);
      expect(wave.acquireFeed('a')).toBeNull();
    });

    it('treats a worker fault message as a failure', () => {
      const wave = renderer();
      wave.register(fakeCanvas(), 'a', 0);
      workers[0].say({ type: 'fault', message: 'boom' });
      expect(wave.failed).toBe(true);
      expect(warn).toHaveBeenCalledTimes(1);
    });

    it('hides already-drawn windows when the worker errors, so they read as dark glass', () => {
      const wave = renderer();
      const canvases = [fakeCanvas(), fakeCanvas()];
      canvases.forEach((canvas, voice) => wave.register(canvas, 'a', voice as 0 | 1));

      workers[0].onerror?.({});

      expect(canvases.map((canvas) => canvas.style.visibility)).toEqual(['hidden', 'hidden']);
    });

    it('hides already-drawn windows when the worker reports a fault', () => {
      const wave = renderer();
      const canvas = fakeCanvas();
      wave.register(canvas, 'a', 0);

      workers[0].say({ type: 'fault', message: 'boom' });

      expect(canvas.style.visibility).toBe('hidden');
      wave.setSuppressed(false);
      expect(canvas.style.visibility).toBe('hidden');
    });
  });

  describe('browser notices', () => {
    it('re-sends the palette from the tokens when the theme changes', () => {
      document.documentElement.style.setProperty('--synth-wave-1', '#ff0000');
      const wave = renderer();
      wave.register(fakeCanvas(), 'a', 0);
      TestBed.flushEffects();
      const before = workers[0].of('palette').length;

      document.documentElement.style.setProperty('--synth-wave-1', 'rgb(0, 0, 255)');
      TestBed.inject(ThemeService).setTheme(TestBed.inject(ThemeService).currentTheme() === 'dark' ? 'light' : 'dark');
      TestBed.flushEffects();

      const palettes = workers[0].of('palette');
      expect(palettes.length).toBe(before + 1);
      expect(palettes[0].voices[0]).toEqual([255, 0, 0]);
      expect(palettes[palettes.length - 1].voices[0]).toEqual([0, 0, 255]);
    });

    it('sends resize, visibility and disconnects its observers on release', () => {
      vi.stubGlobal('ResizeObserver', FakeObserver);
      vi.stubGlobal('IntersectionObserver', FakeObserver);
      const wave = renderer();
      const handle = wave.register(fakeCanvas(), 'a', 0);
      const [resize, intersect] = FakeObserver.instances;
      const id = workers[0].of('attach')[0].id;
      expect(workers[0].of('visible')).toEqual([{ type: 'visible', id, visible: false }]);

      resize.callback([{ contentRect: { width: 200, height: 50 } }]);
      expect(workers[0].of('resize')).toEqual([{ type: 'resize', id, width: 200, height: 50, dpr: 1 }]);

      intersect.callback([{ isIntersecting: true }]);
      expect(workers[0].of('visible').pop()).toEqual({ type: 'visible', id, visible: true });

      handle.release();
      expect(resize.disconnected && intersect.disconnected).toBe(true);
    });

    it('hides every window while the document is hidden and restores them after', () => {
      const wave = renderer();
      wave.register(fakeCanvas(), 'a', 0);
      const id = workers[0].of('attach')[0].id;
      let state: DocumentVisibilityState = 'hidden';
      vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => state);

      document.dispatchEvent(new Event('visibilitychange'));
      state = 'visible';
      document.dispatchEvent(new Event('visibilitychange'));

      expect(workers[0].of('visible').map((m) => m.visible)).toEqual([true, false, true]);
      expect(workers[0].of('visible')[1].id).toBe(id);
    });

    it('re-sends sizes when the device pixel ratio changes', () => {
      const wave = renderer();
      wave.register(fakeCanvas(), 'a', 0);
      vi.stubGlobal('devicePixelRatio', 2);
      window.dispatchEvent(new Event('resize'));
      expect(workers[0].of('resize')).toMatchObject([{ width: 120, height: 40, dpr: 2 }]);
    });

    it('reports reduced motion from matchMedia, live', () => {
      type MotionListener = (event: { matches: boolean }) => void;
      const motion: { onChange: MotionListener | null } = { onChange: null };
      vi.stubGlobal('matchMedia', (query: string) => ({
        matches: query.includes('reduced-motion'),
        addEventListener: (_: string, listener: MotionListener) => {
          if (query.includes('reduced-motion')) motion.onChange = listener;
        },
        removeEventListener: () => undefined,
      }));
      const wave = renderer();
      wave.register(fakeCanvas(), 'a', 0);
      expect(workers[0].of('motion')).toEqual([{ type: 'motion', reduced: true }]);

      motion.onChange?.({ matches: false });
      expect(workers[0].of('motion').pop()).toEqual({ type: 'motion', reduced: false });
    });
  });
});
