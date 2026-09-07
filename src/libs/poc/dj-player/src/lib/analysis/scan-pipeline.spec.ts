import { describe, it, expect } from 'vitest';
import { parseSidFile } from '@sidablist/core';
import { decodeBundledTune } from '../sid/bundled';
import { STILL_TIME_BASE64 } from '../sid/bundled/still-time.sid';
import { scanTune } from './scan-tune';
import { detectLoop } from './loop-detect';
import { segmentNotes } from './notes';
import { detectKey } from './key';

/**
 * The whole pipeline over one real tune, from emulation to a detected loop and key.
 *
 * Every other spec here feeds the detectors a hand-built fixture, which is exactly the thing that
 * silently follows a change to how a scan addresses its input. This one starts from a `.sid` file's
 * own bytes, so the numbers below can only stay right if the emulation, the recorded register
 * stream, the byte-identity comparison and the note segmentation all still agree with each other.
 *
 * The expected values are what the suite produced before the analysis data model moved off the
 * 28-slot ASID stream onto the SID's 25 registers. They are not thresholds or targets: they are the
 * answer for this tune, and a change to any of them is a behaviour change to explain rather than a
 * number to update.
 */

/** The third rung of `TuneIndexService`'s ladder — the shallowest depth at which Still Time's loop
 *  verifies, so the detector reaches a real verdict rather than "nothing found". */
const SCAN_FRAMES = 22_556;

/** `MIN_TAIL_SECONDS` and `IDLE_PERIOD_SECONDS` at the PAL play rate, converted the way
 *  `TuneIndexService.loopDetectOptions` converts them. */
const DETECT_OPTIONS = { minTailFrames: 752, idlePeriodFrames: 100 };

/** Emulating seven and a half minutes of a real tune runs well past the suite's default timeout. */
const SCAN_TIMEOUT_MS = 60_000;

describe('scanning a bundled tune end to end', () => {
  it('finds the loop and the key Still Time has', () => {
    const file = parseSidFile(decodeBundledTune(STILL_TIME_BASE64));

    const scan = scanTune(file, 1, SCAN_FRAMES);
    const loop = detectLoop(scan, DETECT_OPTIONS);
    const key = detectKey(segmentNotes(scan, file.clock));

    expect(loop).toEqual({ kind: 'loop', startFrame: 1411, periodFrames: 9152 });
    expect({ tonic: key.tonic, mode: key.mode, camelot: key.camelot }).toEqual({
      tonic: 9,
      mode: 'minor',
      camelot: '8A',
    });
  }, SCAN_TIMEOUT_MS);
});
