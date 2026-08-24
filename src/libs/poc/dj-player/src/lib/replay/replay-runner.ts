import { InjectionToken } from '@angular/core';
import type { ReplayResult } from './replay-to-frame';
import type { SidFile } from '../sid/sid-file.model';

/**
 * One jump, as it crosses the thread boundary. Everything here is structured-cloneable: `SidFile` is
 * a plain object around a `Uint8Array` and carries no methods.
 */
export interface ReplayRequest {
  /** Correlates the response, and decides whether it is still the one the engine is waiting on. */
  readonly id: number;
  readonly file: SidFile;
  readonly subtune: number;
  readonly targetFrame: number;
  readonly mutes: readonly boolean[];
}

/** A replay's outcome. A failure comes back as a message rather than a thrown error, because it was
 *  thrown somewhere this thread cannot catch. */
export type ReplayResponse =
  | { readonly id: number; readonly ok: true; readonly result: ReplayResult }
  | { readonly id: number; readonly ok: false; readonly error: string };

/** Runs `replayToFrame` somewhere other than here, one request at a time from the caller's view. */
export interface ReplayRunner {
  run(request: ReplayRequest): Promise<ReplayResponse>;
  /** Releases the thread the runner holds. Nothing outstanding is expected to resolve after it. */
  dispose(): void;
}

/**
 * The runner the engine's jump path goes through.
 *
 * A token rather than a `new Worker` in the engine, for the same two reasons `FRAME_CLOCK` is one:
 * a test can resolve a jump by hand instead of needing a `Worker` jsdom does not have, and the POC's
 * worker stays out of the app injector — the view provides it alongside the engine.
 */
export const REPLAY_RUNNER = new InjectionToken<ReplayRunner>('REPLAY_RUNNER');
