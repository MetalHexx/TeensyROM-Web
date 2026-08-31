import { describe, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseSidFile } from '../src/lib/sid/sid-file.parser';
import { scanTune } from '../src/lib/analysis/scan-tune';
import { buildFeatureMatrix } from '../src/lib/analysis/frame-features';
import { computeStructure } from '../src/lib/analysis/structure';
import { dimensionWeightsFor, DEFAULT_FEATURE_WEIGHTS, rowDistance } from '../src/lib/analysis/novelty';

/**
 * `structure.ts` no longer runs a threshold-and-sustained-run search over the block similarity
 * matrix for loop detection — that job moved to `detectLoop`'s byte-exact register-stream comparison
 * in `loop-detect.ts` (see `exact-matching-proof.spec.ts`). This harness carries its own copy of the
 * abandoned perceptual search so the reasoning behind that move stays a standing, re-runnable
 * measurement instead of a claim nobody can check: it prints how loose a plausible similarity
 * threshold really is against the bundled tunes, and what a coarse search would have concluded.
 */

const CEILING_FRAMES = Math.round((300 * 1_000_000) / 19_950);
const SECONDS_PER_FRAME = 0.01995;
const ACCEPT_RUN_BLOCKS = 8;
const SIMILARITY_THRESHOLD = 0.85;

function analyse(name: string): void {
  const bytes = new Uint8Array(readFileSync(join(__dirname, '../src/lib/sid/bundled', name)));
  const file = parseSidFile(bytes);
  const out = scanTune(file, file.startSong, CEILING_FRAMES);
  const matrix = buildFeatureMatrix(out);
  const structure = computeStructure(matrix, DEFAULT_FEATURE_WEIGHTS);

  const dimensionWeights = dimensionWeightsFor(DEFAULT_FEATURE_WEIGHTS);
  let maxDistance = 0;
  for (let i = 0; i < dimensionWeights.length; i++) maxDistance += dimensionWeights[i];

  console.log(`\n===== ${name} =====`);
  console.log(`frames=${matrix.frames} callsPerFrame=${out.callsPerFrame}`);
  console.log(`blockCount=${structure.blockCount} blockFrames=${structure.blockFrames}`);
  console.log(`maxDistance(theoretical worst case)=${maxDistance.toFixed(3)}`);

  // Distribution of the similarity matrix: how loose is a 0.85 bar really?
  const sim = structure.matrix;
  const bc = structure.blockCount;
  const offdiag: number[] = [];
  for (let i = 0; i < bc; i++) {
    for (let j = i + 1; j < bc; j++) offdiag.push(sim[i * bc + j]);
  }
  offdiag.sort((a, b) => a - b);
  const pct = (p: number) => offdiag[Math.floor((offdiag.length - 1) * p)].toFixed(4);
  const above = offdiag.filter((v) => v >= SIMILARITY_THRESHOLD).length;
  console.log(
    `similarity off-diagonal: min=${pct(0)} p25=${pct(0.25)} median=${pct(0.5)} p75=${pct(0.75)} max=${pct(1)}`
  );
  console.log(
    `fraction of ALL block pairs >= ${SIMILARITY_THRESHOLD} threshold: ${((above / offdiag.length) * 100).toFixed(1)}%`
  );

  // What a threshold-and-sustained-run search sees at each of the first offsets, and where it would
  // have stopped and concluded a loop.
  console.log(`offsetBlocks -> longest sustained run (>=${ACCEPT_RUN_BLOCKS} is accepted):`);
  let concludedOffset = -1;
  for (let offset = 1; offset <= 12; offset++) {
    let longest = 0;
    let current = 0;
    for (let i = 0; i + offset < bc; i++) {
      if (sim[i * bc + (i + offset)] >= SIMILARITY_THRESHOLD) {
        current++;
        if (current > longest) longest = current;
      } else {
        current = 0;
      }
    }
    const accepted = longest >= ACCEPT_RUN_BLOCKS;
    if (accepted && concludedOffset === -1) concludedOffset = offset;
    console.log(
      `  offset=${offset} (${offset * structure.blockFrames} frames) run=${longest}${
        accepted ? '   <== ACCEPTED, search stops here' : ''
      }`
    );
  }
  if (concludedOffset === -1) {
    console.log(
      `>>> threshold-and-sustained-run search: no offset within the window reaches a run of ${ACCEPT_RUN_BLOCKS} blocks`
    );
  } else {
    const loopFrame = concludedOffset * structure.blockFrames;
    console.log(
      `>>> threshold-and-sustained-run search concludes offset=${concludedOffset} blocks => loopFrame=${loopFrame} (${(
        loopFrame * SECONDS_PER_FRAME
      ).toFixed(3)}s)`
    );
  }

  // What refinement would have done once the coarse offset above was accepted.
  const coarse = structure.blockFrames;
  const from = Math.max(1, coarse - structure.blockFrames);
  const to = coarse + structure.blockFrames;
  let best = Infinity;
  let bestOffset = -1;
  for (let offset = from; offset <= to; offset++) {
    if (offset >= matrix.frames) continue;
    const distance = rowDistance(matrix, 0, offset, dimensionWeights);
    if (distance < best) {
      best = distance;
      bestOffset = offset;
    }
  }
  console.log(
    `refineLoopOffset window=[${from}..${to}] -> picks offset=${bestOffset} (distance ${best.toFixed(4)})`
  );
}

describe('LOOP-DETECTION DIAGNOSIS: the abandoned perceptual search vs the bundled tunes', () => {
  it('InSID3_Out', () => analyse('InSID3_Out.sid'), 600_000);
  it('Still_Time', () => analyse('Still_Time.sid'), 600_000);
});
