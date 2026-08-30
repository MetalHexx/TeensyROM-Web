import { describe, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseSidFile } from '../src/lib/sid/sid-file.parser';
import { scanTune } from '../src/lib/analysis/scan-tune';
import { detectLoop, MIN_TAIL_SECONDS, IDLE_PERIOD_SECONDS } from '../src/lib/analysis/loop-detect';

const CEILING_FRAMES = Math.round((300 * 1_000_000) / 19_950);
const SECONDS_PER_FRAME = 0.01995;

/** Runs the real `detectLoop` — the same function the tune index scans against — over one bundled
 *  tune and reports what it verified. */
function analyse(name: string, scanFrames = CEILING_FRAMES): void {
  const bytes = new Uint8Array(readFileSync(join(__dirname, '../src/lib/sid/bundled', name)));
  const file = parseSidFile(bytes);
  const out = scanTune(file, file.startSong, scanFrames);
  const { frames, callsPerFrame } = out;
  const secPerCall = SECONDS_PER_FRAME / callsPerFrame;

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
  it('InSID3_Out (double scan window)', () => analyse('InSID3_Out.sid', CEILING_FRAMES * 2), 900_000);
  it('Still_Time', () => analyse('Still_Time.sid'), 900_000);
});
