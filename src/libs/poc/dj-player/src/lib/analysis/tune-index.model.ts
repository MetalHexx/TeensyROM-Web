/** Bumped whenever a detector's weights or algorithm changes in a way that would make a previously
 *  stored answer wrong rather than merely stale. A record whose `formatVersion` does not match this
 *  is treated as if it were never written, so it gets re-scanned and overwritten. */
export const TUNE_INDEX_FORMAT_VERSION = 1;

export type DetectorConfidence = 'strong' | 'weak' | 'none';

/**
 * The compact, persisted answer for one `(filename, subtune)` pair. Every detector field is
 * nullable because "no answer" — no loop, no key, no pulse — is a completed outcome to cache, not a
 * reason to re-scan the tune on every subsequent launch.
 *
 * Deliberately excludes the raw `ScanOutput`, the `FeatureMatrix`, the novelty curve, the similarity
 * matrix, the chroma, and the segmented notes: those run hundreds of KB to over a megabyte per tune,
 * are cheap to recompute, and nothing re-reads them from storage. A record stays on the order of
 * 0.5–1 KB of JSON.
 */
export interface TuneIndexRecord {
  readonly filename: string;
  readonly subtune: number;

  // structure — from computeStructure()
  readonly nativeLengthSeconds: number | null; // null when no repeat was found
  readonly loopFrame: number | null;
  readonly structureConfidence: DetectorConfidence;
  readonly sectionBoundaries: readonly number[]; // frame numbers

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

  readonly callsPerFrame: number; // reinterprets stored frames as time later
  readonly formatVersion: number;
  readonly computedAt: string; // ISO-8601
}
