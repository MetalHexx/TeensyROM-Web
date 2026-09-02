import type { TimingMode } from '../engine/play-rate';

/** Bumped whenever a detector's weights or algorithm changes in a way that would make a previously
 *  stored answer wrong rather than merely stale. A record whose `formatVersion` does not match this
 *  is treated as if it were never written, so it gets re-scanned and overwritten. */
export const TUNE_INDEX_FORMAT_VERSION = 3;

export type DetectorConfidence = 'strong' | 'weak' | 'none';

/** One above-threshold peak of the change curve, as the indexing scan found it. Frame numbers are
 *  absolute tune frames, on the same basis every other frame field on this record uses. */
export interface DetectedMoment {
  readonly frame: number;
  readonly strength: number; // 0..1
}

/**
 * The compact, persisted answer for one `(filename, subtune)` pair. Every detector field is
 * nullable because "no answer" — no loop, no key, no pulse — is a completed outcome to cache, not a
 * reason to re-scan the tune on every subsequent launch.
 *
 * Deliberately excludes the raw `ScanOutput`, the `FeatureMatrix`, the novelty curve, the similarity
 * matrix, the chroma, and the segmented notes: those run hundreds of KB to over a megabyte per tune,
 * are cheap to recompute, and nothing re-reads them from storage. A record stays on the order of
 * 0.5–1 KB of JSON.
 *
 * Lengths are stored as frames and never as seconds: a frame count carries no video-standard
 * assumption, so the displayed duration follows whichever rate is in force at display time rather
 * than freezing whatever was in force when the scan ran.
 */
export interface TuneIndexRecord {
  readonly filename: string;
  readonly subtune: number;

  // loop — from detectLoop(); start and period are set together, `endedAtFrame` alone, or all three
  // null when detection declined to answer
  readonly loopStartFrame: number | null; // 0 when the tune repeats from the top
  readonly loopPeriodFrames: number | null; // one lap
  readonly endedAtFrame: number | null;
  // arrangement — from computeStructure()
  readonly sectionBoundaries: readonly number[]; // frame numbers
  // moments — from computeNovelty(), filtered once at write time
  readonly detectedMoments: readonly DetectedMoment[];

  // key — from detectKey()
  readonly tonic: number | null; // 0..11, null = no clear key
  readonly mode: 'major' | 'minor' | null;
  readonly camelot: string | null; // e.g. '5A'
  readonly tuningReferenceHz: number | null;
  readonly tuningCents: number | null;
  readonly keyConfidence: DetectorConfidence;
  readonly scalePitchClasses: readonly number[];

  // pulse — from computePulse() / impliedTempo()
  readonly dominantIntervalFrames: number | null;
  readonly pulseConfidence: DetectorConfidence;
  readonly nativeTempo: number | null; // BPM

  readonly callsPerFrame: number; // rounded integer — reinterprets stored frames as time later
  /** The un-rounded rate the tune's timer describes, so the Timing toggle can flip between the two
   *  without a re-scan. */
  readonly exactCallsPerFrame: number;
  readonly timingMode: TimingMode;
  readonly formatVersion: number;
  readonly computedAt: string; // ISO-8601
}
