import { InjectionToken } from '@angular/core';
import type { RegisterRecord } from '@sidablist/core';

/** Scans a tune's register record off the main thread. */
export interface RegisterRecorder {
  /** `bytes`' `subtune` for its first `frames` play calls; null when the scan fails. */
  record(bytes: Uint8Array, subtune: number, frames: number): Promise<RegisterRecord | null>;
  dispose(): void;
}

/** One per deck slot, like the replay runners: a record scan never waits behind the other deck's. */
export const REGISTER_RECORDER_FACTORY = new InjectionToken<() => RegisterRecorder>(
  'REGISTER_RECORDER_FACTORY'
);
