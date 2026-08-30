import { describe, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseSidFile } from '../src/lib/sid/sid-file.parser';
import { scanTune } from '../src/lib/analysis/scan-tune';
import { detectLoop, MIN_TAIL_SECONDS, IDLE_PERIOD_SECONDS } from '../src/lib/analysis/loop-detect';
import { PAL_FRAME_INTERVAL_US } from '../src/lib/asid/asid-constants';
import { playCallsPerSecond, type PlayRate } from '../src/lib/engine/play-rate';

/** Musical seconds deep enough to reach a verified repeat on both bundled tunes — matches the depth
 *  the production `TuneIndexService.SCAN_DEPTH_SECONDS` ladder ultimately reaches for them. */
const TARGET_SECONDS = 450;

/** A cheap first pass just to read the tune's `callsPerFrame` before sizing the real scan window —
 *  the same two-step `stratified-accuracy.spec.ts` uses. A target musical-seconds figure has to scale
 *  by that rate before it becomes a play-call count, or a multispeed tune's window ends up scanning
 *  half (or less) of the music it claims to — the exact defect R7 fixed in production. */
const PROBE_FRAMES = 64;

function rateFor(callsPerFrame: number): PlayRate {
  return { callsPerFrame, exactCallsPerFrame: callsPerFrame, roundedCallsPerFrame: callsPerFrame, mode: 'rounded' };
}

/** Runs the real `detectLoop` — the same function the tune index scans against — over one bundled
 *  tune and reports what it verified. */
function analyse(name: string, targetSeconds = TARGET_SECONDS): void {
  const bytes = new Uint8Array(readFileSync(join(__dirname, '../src/lib/sid/bundled', name)));
  const file = parseSidFile(bytes);

  const probe = scanTune(file, file.startSong, PROBE_FRAMES);
  const rate = rateFor(probe.callsPerFrame);
  const perSecond = playCallsPerSecond(PAL_FRAME_INTERVAL_US, rate);
  const scanFrames = Math.round(targetSeconds * perSecond);

  const out = scanTune(file, file.startSong, scanFrames);
  const { frames, callsPerFrame } = out;
  const secPerCall = 1 / perSecond;

  console.log(`\n===== ${name} =====`);
  console.log(
    `scanned ${frames} play-calls, callsPerFrame=${callsPerFrame} => ${(frames * secPerCall).toFixed(1)}s of music`
  );

  const loop = detectLoop(out, {
    minTailFrames: Math.round(MIN_TAIL_SECONDS / secPerCall),
    idlePeriodFrames: Math.round(IDLE_PERIOD_SECONDS / secPerCall),
  });

  if (loop.kind === 'none') {
    console.log(`>>> no verified repeat within the scan`);
    return;
  }
  if (loop.kind === 'ended') {
    console.log(
      `>>> settled into a static idle cycle at call ${loop.endFrame} (${(loop.endFrame * secPerCall).toFixed(2)}s)`
    );
    return;
  }

  const verifiedTail = frames - (loop.startFrame + loop.periodFrames);
  console.log(`>>> EXACT loop confirmed`);
  console.log(`    loop start  = call ${loop.startFrame} (${(loop.startFrame * secPerCall).toFixed(2)}s)`);
  console.log(`    period      = ${loop.periodFrames} calls (${(loop.periodFrames * secPerCall).toFixed(2)}s)`);
  console.log(`    verified over ${verifiedTail} consecutive calls, byte-identical`);
}

describe('EXACT MATCHING PROOF: detectLoop over the bundled tunes', () => {
  it('InSID3_Out', () => analyse('InSID3_Out.sid'), 900_000);
  it('InSID3_Out (double scan window)', () => analyse('InSID3_Out.sid', TARGET_SECONDS * 2), 900_000);
  it('Still_Time', () => analyse('Still_Time.sid'), 900_000);
});
