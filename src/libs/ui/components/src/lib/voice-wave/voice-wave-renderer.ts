import { Injectable, InjectionToken, NgZone, effect, inject, untracked } from '@angular/core';
import { ThemeService } from '@teensyrom-nx/ui/styles';
import { logWarn } from '@teensyrom-nx/utils';
import { defaultWaveWorkerFactory } from './default-wave-worker';
import { parseWaveColour, type WaveRgb } from './wave-colour';
import { WaveFeedBuffer } from './wave-feed-buffer';
import type { WaveVoice, WaveWindowState } from './model/wave-view';
import type { MainToWorker, WaveWorkerPort, WorkerToMain } from './wave-protocol';

/** Builds the worker the renderer talks to. Stories and specs provide their own. */
export const WAVE_WORKER_FACTORY = new InjectionToken<() => WaveWorkerPort>('WAVE_WORKER_FACTORY', {
  providedIn: 'root',
  factory: () => defaultWaveWorkerFactory,
});

/** What a registered window gives back. */
export interface WaveWindowHandle {
  /** Poses this window apart from its bank's state; `null` hands it back to the bank. */
  setOverride(state: WaveWindowState | null): void;
  /** Detaches the window and drops its observers. Safe to call more than once. */
  release(): void;
}

/** Buffers per bank: one being written, the rest in flight to or from the worker. */
const POOL_SIZE = 3;

const VOICE_TOKENS = ['--synth-wave-1', '--synth-wave-2', '--synth-wave-3'];
const GLASS_TOKEN = '--synth-display-face';
const FALLBACK_VOICES: WaveRgb[] = [
  [255, 43, 214],
  [0, 229, 255],
  [255, 245, 157],
];
const FALLBACK_GLASS: WaveRgb = [8, 6, 10];
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

interface BankPool {
  /** Reset and ready to hand out. */
  readonly free: WaveFeedBuffer[];
  /** Posted to the worker and not yet back, oldest first. */
  readonly inFlight: WaveFeedBuffer[];
  /** The one buffer a paint is writing into. */
  checkedOut: WaveFeedBuffer | null;
}

interface Registered {
  readonly id: number;
  readonly canvas: HTMLCanvasElement;
  readonly bank: string;
  readonly voice: WaveVoice;
  intersecting: boolean;
  visible: boolean;
  width: number;
  height: number;
  attached: boolean;
  released: boolean;
  disconnect: (() => void)[];
}

const INERT_HANDLE: WaveWindowHandle = { setOverride: () => undefined, release: () => undefined };

/**
 * Owns the wave worker and everything the worker cannot ask for: it builds the worker when the first
 * window registers and terminates it when the last is released, pools the feed buffers, watches the
 * browser (size, visibility, density, reduced motion, theme) and posts what changes, and remembers
 * the per-bank state and flags so it can replay them into a fresh worker.
 *
 * Every failure (no Worker, no offscreen canvas, a factory that throws, a dying worker) logs one
 * warning, sets `failed` and leaves the windows dark; the worker is never restarted in a session.
 */
@Injectable({ providedIn: 'root' })
export class VoiceWaveRenderer {
  private readonly zone = inject(NgZone);
  private readonly theme = inject(ThemeService);
  private readonly factory = inject(WAVE_WORKER_FACTORY);

  private worker: WaveWorkerPort | null = null;
  private failedForGood = false;
  private nextId = 1;
  private readonly windows = new Map<number, Registered>();
  private readonly pools = new Map<string, BankPool>();
  private readonly bankStates = new Map<string, WaveWindowState>();
  private suppressed = false;
  private density = 1;
  private globalDisconnect: (() => void)[] = [];
  private statsRequest = 0;
  private readonly statsPending = new Map<number, (values: Record<string, number>) => void>();

  constructor() {
    effect(() => {
      this.theme.currentTheme();
      untracked(() => {
        if (this.worker !== null) this.post({ type: 'palette', ...this.resolvePalette() });
      });
    });
  }

  /** True once the worker or the browser support has failed for good. */
  get failed(): boolean {
    return this.failedForGood;
  }

  /** Hands `canvas` to the worker as the window for `voice` of `bank`; the first call builds the worker. */
  register(canvas: HTMLCanvasElement, bank: string, voice: WaveVoice): WaveWindowHandle {
    if (this.failedForGood) return INERT_HANDLE;
    if (typeof canvas.transferControlToOffscreen !== 'function') {
      this.fail('this browser cannot hand a canvas to a worker');
      return INERT_HANDLE;
    }
    if (this.worker === null && !this.createWorker()) return INERT_HANDLE;

    const observed = typeof IntersectionObserver === 'function';
    const win: Registered = {
      id: this.nextId++,
      canvas,
      bank,
      voice,
      intersecting: !observed,
      visible: !observed && !documentHidden(),
      width: canvas.clientWidth || 0,
      height: canvas.clientHeight || 0,
      attached: false,
      released: false,
      disconnect: [],
    };
    this.windows.set(win.id, win);
    if (!this.attach(win)) return INERT_HANDLE;
    this.zone.runOutsideAngular(() => this.observe(win));
    if (this.suppressed) canvas.style.visibility = 'hidden';

    return {
      setOverride: (state) => {
        if (win.attached) this.post({ type: 'override', id: win.id, state });
      },
      release: () => this.release(win),
    };
  }

  /** The bank's feed buffer for a paint, reset; `null` with no worker, after a failure, or when every buffer is in flight. */
  acquireFeed(bank: string): WaveFeedBuffer | null {
    if (this.worker === null) return null;
    let pool = this.pools.get(bank);
    if (pool === undefined) {
      pool = {
        free: Array.from({ length: POOL_SIZE }, () => new WaveFeedBuffer()),
        inFlight: [],
        checkedOut: null,
      };
      this.pools.set(bank, pool);
    }
    if (pool.checkedOut !== null) {
      pool.checkedOut.reset();
      return pool.checkedOut;
    }
    const buffer = pool.free.pop();
    if (buffer === undefined) return null;
    buffer.reset();
    pool.checkedOut = buffer;
    return buffer;
  }

  /** Posts the bank's checked-out buffer to the worker, which detaches it here until it comes back. */
  submitFeed(bank: string): void {
    const pool = this.pools.get(bank);
    const buffer = pool?.checkedOut;
    if (pool === undefined || !buffer) return;
    pool.checkedOut = null;
    if (this.worker === null) {
      pool.free.push(buffer);
      return;
    }
    const array = buffer.array;
    pool.inFlight.push(buffer);
    this.worker.postMessage({ type: 'feed', bank, buffer: array }, [array.buffer]);
  }

  /** Returns the bank's checked-out buffer to the pool unsent. */
  discardFeed(bank: string): void {
    const pool = this.pools.get(bank);
    if (pool === undefined || pool.checkedOut === null) return;
    pool.free.push(pool.checkedOut);
    pool.checkedOut = null;
  }

  setBankState(bank: string, state: WaveWindowState): void {
    if (this.failedForGood) return;
    this.bankStates.set(bank, state);
    this.post({ type: 'state', bank, state });
  }

  /** Bench only: hides every canvas without changing layout, and stops the worker drawing. */
  setSuppressed(suppressed: boolean): void {
    if (this.failedForGood) return;
    this.suppressed = suppressed;
    for (const win of this.windows.values()) {
      win.canvas.style.visibility = suppressed ? 'hidden' : '';
    }
    this.post({ type: 'suppress', suppressed });
  }

  /** Bench only: the worker's draw counts and times; empty when there is no worker. */
  readStats(): Promise<Record<string, number>> {
    const worker = this.worker;
    if (worker === null) return Promise.resolve({});
    return new Promise((resolve) => {
      const request = ++this.statsRequest;
      this.statsPending.set(request, resolve);
      worker.postMessage({ type: 'stats', request });
    });
  }

  private post(message: MainToWorker, transfer?: Transferable[]): void {
    this.worker?.postMessage(message, transfer);
  }

  private createWorker(): boolean {
    let worker: WaveWorkerPort;
    try {
      worker = this.zone.runOutsideAngular(() => {
        const created = this.factory();
        created.onmessage = (event) => this.onWorkerMessage(event.data);
        created.onerror = () => this.fail('the wave worker stopped responding');
        return created;
      });
    } catch (error) {
      this.fail(`the wave worker could not start: ${reasonOf(error)}`);
      return false;
    }
    this.worker = worker;
    this.density = currentDensity();
    this.post({ type: 'init', mainTimeOrigin: performance.timeOrigin });
    this.post({ type: 'palette', ...this.resolvePalette() });
    this.post({ type: 'motion', reduced: prefersReducedMotion() });
    if (this.suppressed) this.post({ type: 'suppress', suppressed: true });
    for (const [bank, state] of this.bankStates) this.post({ type: 'state', bank, state });
    this.zone.runOutsideAngular(() => this.observeGlobals());
    return true;
  }

  /** Transfers the canvas to the worker; the worker draws nothing for it until it hears `visible`. */
  private attach(win: Registered): boolean {
    let offscreen: OffscreenCanvas;
    try {
      offscreen = win.canvas.transferControlToOffscreen();
    } catch (error) {
      this.fail(`the wave canvas could not move to the worker: ${reasonOf(error)}`);
      return false;
    }
    this.post(
      {
        type: 'attach',
        id: win.id,
        bank: win.bank,
        voice: win.voice,
        canvas: offscreen,
        width: win.width,
        height: win.height,
        dpr: this.density,
      },
      [offscreen]
    );
    win.attached = true;
    this.post({ type: 'visible', id: win.id, visible: win.visible });
    return true;
  }

  private release(win: Registered): void {
    if (win.released) return;
    win.released = true;
    for (const stop of win.disconnect) stop();
    win.disconnect = [];
    if (this.windows.delete(win.id) && win.attached) this.post({ type: 'detach', id: win.id });
    if (this.windows.size === 0) this.terminate();
  }

  /** Drops the worker and everything tied to it; the pools go too, so a rebuilt worker starts with fresh, full ones. */
  private terminate(): void {
    const worker = this.worker;
    this.worker = null;
    this.pools.clear();
    this.stopGlobals();
    for (const resolve of this.statsPending.values()) resolve({});
    this.statsPending.clear();
    if (worker !== null) {
      worker.onmessage = null;
      worker.onerror = null;
      worker.terminate();
    }
  }

  private fail(reason: string): void {
    if (this.failedForGood) return;
    this.failedForGood = true;
    logWarn(`Voice waves are off: ${reason}.`);
    for (const win of this.windows.values()) {
      for (const stop of win.disconnect) stop();
      win.disconnect = [];
      // A transferred canvas keeps the worker's last frame and cannot be cleared from here.
      win.canvas.style.visibility = 'hidden';
    }
    this.terminate();
  }

  private onWorkerMessage(message: WorkerToMain): void {
    switch (message.type) {
      case 'recycle': {
        const pool = this.pools.get(message.bank);
        const buffer = pool?.inFlight.shift();
        if (pool === undefined || buffer === undefined) return;
        buffer.rewrap(message.buffer);
        pool.free.push(buffer);
        break;
      }
      case 'fault':
        this.fail(`the wave worker faulted: ${message.message}`);
        break;
      case 'stats':
        this.statsPending.get(message.request)?.(message.values);
        this.statsPending.delete(message.request);
        break;
    }
  }

  private observe(win: Registered): void {
    if (typeof ResizeObserver === 'function') {
      const observer = new ResizeObserver((entries) => {
        const rect = entries[entries.length - 1]?.contentRect;
        if (rect === undefined) return;
        win.width = rect.width;
        win.height = rect.height;
        this.post({
          type: 'resize',
          id: win.id,
          width: win.width,
          height: win.height,
          dpr: this.density,
        });
      });
      observer.observe(win.canvas);
      win.disconnect.push(() => observer.disconnect());
    }
    if (typeof IntersectionObserver === 'function') {
      const observer = new IntersectionObserver((entries) => {
        const latest = entries[entries.length - 1];
        if (latest === undefined) return;
        win.intersecting = latest.isIntersecting;
        this.syncVisible(win);
      });
      observer.observe(win.canvas);
      win.disconnect.push(() => observer.disconnect());
    }
  }

  private syncVisible(win: Registered): void {
    const visible = win.intersecting && !documentHidden();
    if (visible === win.visible) return;
    win.visible = visible;
    this.post({ type: 'visible', id: win.id, visible });
  }

  private observeGlobals(): void {
    const onDensity = (): void => {
      const density = currentDensity();
      if (density === this.density) return;
      this.density = density;
      for (const win of this.windows.values()) {
        this.post({
          type: 'resize',
          id: win.id,
          width: win.width,
          height: win.height,
          dpr: density,
        });
      }
    };
    window.addEventListener('resize', onDensity);
    this.globalDisconnect.push(() => window.removeEventListener('resize', onDensity));

    if (typeof window.matchMedia === 'function') {
      let stopDensity: (() => void) | null = null;
      const armDensity = (): void => {
        stopDensity?.();
        const query = window.matchMedia(`(resolution: ${currentDensity()}dppx)`);
        const onChange = (): void => {
          onDensity();
          armDensity();
        };
        query.addEventListener('change', onChange);
        stopDensity = () => query.removeEventListener('change', onChange);
      };
      armDensity();
      this.globalDisconnect.push(() => stopDensity?.());

      const motion = window.matchMedia(REDUCED_MOTION_QUERY);
      const onMotion = (event: MediaQueryListEvent): void =>
        this.post({ type: 'motion', reduced: event.matches });
      motion.addEventListener('change', onMotion);
      this.globalDisconnect.push(() => motion.removeEventListener('change', onMotion));
    }

    const onVisibility = (): void => {
      for (const win of this.windows.values()) this.syncVisible(win);
    };
    document.addEventListener('visibilitychange', onVisibility);
    this.globalDisconnect.push(() =>
      document.removeEventListener('visibilitychange', onVisibility)
    );
  }

  private stopGlobals(): void {
    for (const stop of this.globalDisconnect) stop();
    this.globalDisconnect = [];
  }

  private resolvePalette(): { voices: WaveRgb[]; glass: WaveRgb } {
    const style = getComputedStyle(document.documentElement);
    const read = (token: string, fallback: WaveRgb): WaveRgb => {
      const value = style.getPropertyValue(token).trim();
      if (value === '') return fallback;
      return parseWaveColour(value) ?? readThroughCanvas(value) ?? fallback;
    };
    return {
      voices: VOICE_TOKENS.map((token, index) => read(token, FALLBACK_VOICES[index])),
      glass: read(GLASS_TOKEN, FALLBACK_GLASS),
    };
  }
}

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function currentDensity(): number {
  return window.devicePixelRatio || 1;
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

function documentHidden(): boolean {
  return document.visibilityState === 'hidden';
}

/** Any CSS colour the pure parser does not know, read back as pixels from a one-pixel canvas. */
function readThroughCanvas(css: string): WaveRgb | null {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return null;
  context.fillStyle = '#000';
  context.fillStyle = css;
  context.fillRect(0, 0, 1, 1);
  const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;
  return [red, green, blue];
}
