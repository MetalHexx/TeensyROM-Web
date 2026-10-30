// The wave worker's entry point: a scope over the real worker global around the host. Relative
// imports only, so the worker bundles without a path-alias plugin.
import type { MainToWorker, WorkerToMain } from './wave-protocol';
import { WAVE_DRAW_INTERVAL_MS, WaveWorkerHost } from './wave-worker-host';

/**
 * The worker global as far as this file uses it. `/// <reference lib="webworker" />` would collide
 * with the DOM lib the app's program is compiled with, so the global is cast to this instead.
 */
interface WaveWorkerGlobal {
  onmessage: ((event: { data: MainToWorker }) => void) | null;
  postMessage(message: WorkerToMain, transfer: Transferable[]): void;
  requestAnimationFrame?: (callback: (timeMs: number) => void) => number;
  cancelAnimationFrame?: (id: number) => void;
  setTimeout(callback: () => void, delayMs: number): number;
  clearTimeout(id: number): void;
}

const worker = self as unknown as WaveWorkerGlobal;

const host = new WaveWorkerHost({
  post: (message, transfer) => worker.postMessage(message, transfer ?? []),
  now: () => performance.now(),
  timeOrigin: performance.timeOrigin,
  requestFrame: (callback) =>
    worker.requestAnimationFrame
      ? worker.requestAnimationFrame(callback)
      : worker.setTimeout(() => callback(performance.now()), WAVE_DRAW_INTERVAL_MS),
  cancelFrame: (id) =>
    worker.cancelAnimationFrame ? worker.cancelAnimationFrame(id) : worker.clearTimeout(id),
  createLayer: (width, height) => new OffscreenCanvas(width, height),
});

worker.onmessage = (event) => host.handle(event.data);
