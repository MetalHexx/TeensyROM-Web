import { InjectionToken } from '@angular/core';
import type { ScanOutput } from './scan-tune';
import type { SidFile } from '../sid/sid-file.model';

/** One scan request, as it crosses the thread boundary. `SidFile` is a plain object around a
 *  `Uint8Array` and carries no methods, so it survives structured clone untouched. */
export interface ScanRequest {
  /** Correlates the response, and decides whether it is still the one the caller is waiting on. */
  readonly id: number;
  /** Groups the rungs of one ladder. A request whose session matches the held one — same file, same
   *  subtune — deepens it; anything else starts from a clean init. Required rather than optional so
   *  neither caller can silently opt out of saying which ladder its request belongs to. */
  readonly session: number;
  readonly file: SidFile;
  readonly subtune: number;
  readonly maxFrames: number;
}

/** What the worker posts. Progress is a message; the promise never resolves to it. */
export type ScanMessage =
  | { readonly id: number; readonly kind: 'progress'; readonly frame: number }
  | { readonly id: number; readonly kind: 'done'; readonly output: ScanOutput }
  | { readonly id: number; readonly kind: 'failed'; readonly error: string };

/** What `scan()` resolves to — a terminal outcome only. */
export type ScanResult = Extract<ScanMessage, { kind: 'done' | 'failed' }>;

/** Runs `scanTune` somewhere other than here, so a long scan never sits in front of a scrub. */
export interface AnalysisScanner {
  scan(request: ScanRequest, onProgress?: (frame: number) => void): Promise<ScanResult>;
  /** Releases the thread the scanner holds. Nothing outstanding is expected to resolve after it. */
  dispose(): void;
}

/**
 * The runner an analysis view goes through to scan a tune.
 *
 * A token rather than a `new Worker` inside a component, for the same reason `REPLAY_RUNNER` is one:
 * a test resolves a scan by hand instead of needing a `Worker` jsdom does not have.
 */
export const ANALYSIS_SCANNER = new InjectionToken<AnalysisScanner>('ANALYSIS_SCANNER');
