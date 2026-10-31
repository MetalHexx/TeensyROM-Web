import type { WaveVoice, WaveWindowState } from './model/wave-view';

/** What the main thread sends the wave worker. Transferred members are noted on their message. */
export type MainToWorker =
  /** `performance.timeOrigin` on the main thread, so the worker can read the entries' clock. */
  | { type: 'init'; mainTimeOrigin: number }
  /** `canvas` is transferred. */
  | {
      type: 'attach';
      id: number;
      bank: string;
      voice: WaveVoice;
      canvas: OffscreenCanvas;
      width: number;
      height: number;
      dpr: number;
    }
  | { type: 'detach'; id: number }
  | { type: 'resize'; id: number; width: number; height: number; dpr: number }
  | { type: 'visible'; id: number; visible: boolean }
  | { type: 'override'; id: number; state: WaveWindowState | null }
  | { type: 'state'; bank: string; state: WaveWindowState }
  /** The three voice trace colours then the glass colour, each a 0…255 triple. */
  | { type: 'palette'; voices: [number, number, number][]; glass: [number, number, number] }
  | { type: 'motion'; reduced: boolean }
  /** Bench only. */
  | { type: 'suppress'; suppressed: boolean }
  /** `buffer` is transferred. */
  | { type: 'feed'; bank: string; buffer: Float64Array }
  /** Bench only. */
  | { type: 'stats'; request: number };

/** What the wave worker sends back. */
export type WorkerToMain =
  /** The transferred feed buffer, returned to the pool; posted with a transfer list. */
  | { type: 'recycle'; bank: string; buffer: Float64Array }
  | { type: 'fault'; message: string }
  | { type: 'stats'; request: number; values: Record<string, number> };

/** What the renderer talks to: a real `Worker` satisfies it, and so does a story's main-thread stand-in or a spec's fake. */
export interface WaveWorkerPort {
  postMessage(message: MainToWorker, transfer?: Transferable[]): void;
  onmessage: ((event: { data: WorkerToMain }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  terminate(): void;
}

/** What the worker host needs from its environment, so a spec can drive it with fakes. */
export interface WaveWorkerScope {
  post(message: WorkerToMain, transfer?: Transferable[]): void;
  /** `performance.now()` in this scope. */
  now(): number;
  /** `performance.timeOrigin` in this scope. */
  readonly timeOrigin: number;
  requestFrame(callback: (timeMs: number) => void): number;
  cancelFrame(id: number): void;
  createLayer(width: number, height: number): OffscreenCanvas;
}
