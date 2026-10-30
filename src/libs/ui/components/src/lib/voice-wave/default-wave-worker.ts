import type { WaveWorkerPort } from './wave-protocol';

/**
 * Builds the real wave worker. This is the only module that holds the `new Worker(new URL(...))`
 * form, with no file extension, so the Angular builder emits the worker as its own file.
 */
export function defaultWaveWorkerFactory(): WaveWorkerPort {
  if (typeof Worker === 'undefined') {
    throw new Error('this browser has no Worker support');
  }
  const worker = new Worker(new URL('./voice-wave.worker', import.meta.url), { type: 'module' });
  // A Worker's `onmessage` takes a full MessageEvent; the port only reads `data`.
  return worker as unknown as WaveWorkerPort;
}
