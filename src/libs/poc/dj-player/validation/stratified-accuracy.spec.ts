import { describe, it } from 'vitest';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseSidFile } from '../src/lib/sid/sid-file.parser';
import { scanTune } from '../src/lib/analysis/scan-tune';
import { detectLoop, MIN_TAIL_SECONDS, IDLE_PERIOD_SECONDS } from '../src/lib/analysis/loop-detect';

/** Root of a local HVSC collection, e.g. `C:/Users/you/HVSC/C64Music`. No sane default exists — this
 *  is a developer machine's music collection, not a repo asset — so the suite skips when it is unset
 *  or does not resolve to a real directory. */
const HVSC_ROOT = process.env['HVSC_ROOT'];

/** The grading key. Committed with the repo, so it keeps a repo-relative default; overridable for a
 *  differently-laid-out checkout. */
const CSV =
  process.env['SID_CSV'] ??
  join(__dirname, '../../../../apps/api/src/TeensyRom.Core/Assets/Music/SidList/SIDlist_82_UTF8.csv');

/** Where the full per-tune results land. Optional — when unset the run still prints its summary to
 *  the console, it just writes no file. */
const OUT = process.env['STRAT_OUT'];

const PAL_US = 19_950;
const NTSC_US = 16_715;
const SLOTS = 28;

/** Mirrors `TuneIndexService.SCAN_DEPTH_SECONDS` — the same ladder the shipped detector climbs. */
const LADDER = [90, 210, 450, 750];
const TARGET = 300;

type Verdict =
  | { kind: 'loop'; seconds: number; startSeconds: number; totalSeconds: number }
  | { kind: 'ended'; seconds: number }
  | { kind: 'silent' }
  | { kind: 'none' };

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      out.push(current);
      current = '';
    } else {
      current += c;
    }
  }
  out.push(current);
  return out;
}

function parseLen(s: string): number | null {
  const m = /^(\d+):(\d+(?:\.\d+)?)$/.exec(s.trim());
  return m === null ? null : parseInt(m[1], 10) * 60 + parseFloat(m[2]);
}

interface Rec {
  readonly path: string;
  readonly name: string;
  readonly songlen: number;
  readonly clock: string;
  readonly format: string;
  readonly model: string;
  readonly multispeed: boolean;
  readonly area: string;
  readonly era: string;
  readonly lenBucket: string;
}

function classify(c: string[], hvscRoot: string): Rec | null {
  const len = parseLen(c[10]);
  if (len === null || len < 5) return null;
  if (c[8] !== '1') return null;
  const path = hvscRoot + c[0];
  const area = c[0].split('/')[1] ?? '?';
  const yr = /((?:19|20)\d\d)/.exec(c[7]);
  const year = yr === null ? 0 : parseInt(yr[1], 10);
  const era = year === 0 ? 'unknown' : year < 1990 ? '80s' : year < 2000 ? '90s' : '2000s+';
  const speed = c[15] ?? '0x00000000';
  return {
    path,
    name: (c[0].split('/').pop() ?? '').replace('.sid', ''),
    songlen: len,
    clock: (c[18] || '?').toUpperCase(),
    format: c[1] || '?',
    model: c[19] || '?',
    multispeed: !/^0x0*$/.test(speed.replace(/0x0+$/, '0x0')) && speed !== '0x00000000',
    area,
    era,
    lenBucket: len < 30 ? 'short<30s' : len < 120 ? 'mid30-120s' : 'long>120s',
  };
}

/** Deterministic LCG so a run is reproducible. */
function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Stratifies on the dimensions expected to matter, then draws an even, reproducible sample —
 *  without replacement, so a small stratum never yields the same tune twice. */
function buildSample(hvscRoot: string): Rec[] {
  const lines = readFileSync(CSV, 'utf8').split('\n');
  const all: Rec[] = [];
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].length < 20) continue;
    const c = splitCsvLine(lines[i]);
    if (c.length < 20) continue;
    const r = classify(c, hvscRoot);
    if (r !== null) all.push(r);
  }
  console.log(`CSV rows usable (single-song, length known): ${all.length}`);

  const keyOf = (r: Rec) => `${r.clock}|${r.area}|${r.lenBucket}|${r.multispeed ? 'multi' : 'single'}`;
  const strata = new Map<string, Rec[]>();
  for (const r of all) {
    const k = keyOf(r);
    const a = strata.get(k);
    if (a === undefined) strata.set(k, [r]);
    else a.push(r);
  }
  const keys = [...strata.keys()].sort();
  console.log(`strata: ${keys.length}`);

  const rng = makeRng(20260829);
  const perStratum = Math.max(1, Math.ceil(TARGET / keys.length));
  const picked: Rec[] = [];
  for (const k of keys) {
    const pool = strata.get(k) ?? [];
    for (let n = 0; n < perStratum && pool.length > 0 && picked.length < TARGET * 3; n++) {
      const [r] = pool.splice(Math.floor(rng() * pool.length), 1);
      if (existsSync(r.path)) picked.push(r);
    }
  }
  // Trim to target, keeping the stratified spread.
  const out: Rec[] = [];
  const step = Math.max(1, picked.length / TARGET);
  for (let i = 0; out.length < TARGET && i < picked.length; i += step) out.push(picked[Math.floor(i)]);
  return out;
}

function detect(r: Rec): Verdict {
  const file = parseSidFile(new Uint8Array(readFileSync(r.path)));
  const probe = scanTune(file, file.startSong, 64);
  const cpf = probe.callsPerFrame || 1;
  const frameUs = file.clock === 'ntsc' ? NTSC_US : PAL_US;
  const secPerCall = frameUs / 1_000_000 / cpf;
  const minTailFrames = Math.round(MIN_TAIL_SECONDS / secPerCall);
  const idlePeriodFrames = Math.round(IDLE_PERIOD_SECONDS / secPerCall);

  for (const budget of LADDER) {
    const calls = Math.round(budget / secPerCall);
    const out = scanTune(file, file.startSong, calls);

    // Did the tune actually play? A constant stream means nothing sounded.
    let varied = false;
    for (let f = 1; f < out.frames && !varied; f++) {
      const x = f * SLOTS;
      for (let d = 0; d < SLOTS; d++) {
        if (out.slotValues[x + d] !== out.slotValues[d]) {
          varied = true;
          break;
        }
      }
    }
    if (!varied) return { kind: 'silent' };

    const loop = detectLoop(out, { minTailFrames, idlePeriodFrames });
    if (loop.kind === 'none') continue;
    if (loop.kind === 'ended') return { kind: 'ended', seconds: loop.endFrame * secPerCall };
    return {
      kind: 'loop',
      seconds: loop.periodFrames * secPerCall,
      startSeconds: loop.startFrame * secPerCall,
      totalSeconds: (loop.startFrame + loop.periodFrames) * secPerCall,
    };
  }
  return { kind: 'none' };
}

const collectionAvailable = HVSC_ROOT !== undefined && existsSync(HVSC_ROOT);
if (!collectionAvailable) {
  console.warn(
    `STRATIFIED VALIDATION vs HVSC: skipping — set HVSC_ROOT to a local HVSC collection root ` +
      `(got ${HVSC_ROOT ?? 'unset'}). See validation/README.md.`
  );
}

describe('STRATIFIED VALIDATION vs HVSC', () => {
  it.skipIf(!collectionAvailable)(
    'measures detection across SID characteristics',
    () => {
      const hvscRoot = HVSC_ROOT as string;
      const sample = buildSample(hvscRoot);

      const distinctPaths = new Set(sample.map((r) => r.path));
      if (distinctPaths.size !== sample.length) {
        throw new Error(
          `sampler produced ${sample.length - distinctPaths.size} duplicate pick(s) across ${sample.length} rows`
        );
      }
      console.log(`sampled ${sample.length} tunes, all distinct\n`);

      interface Row {
        r: Rec;
        verdict: string;
        best: number | null;
        delta: number | null;
        ratio: number | null;
        cls: string;
      }
      const rows: Row[] = [];
      let done = 0;

      for (const r of sample) {
        let v: Verdict;
        try {
          v = detect(r);
        } catch {
          rows.push({ r, verdict: 'error', best: null, delta: null, ratio: null, cls: 'error' });
          continue;
        }
        let best: number | null = null;
        if (v.kind === 'loop') {
          best =
            Math.abs(v.seconds - r.songlen) <= Math.abs(v.totalSeconds - r.songlen) ? v.seconds : v.totalSeconds;
        } else if (v.kind === 'ended') {
          best = v.seconds;
        }

        let cls: string = v.kind;
        let delta: number | null = null;
        let ratio: number | null = null;
        if (best !== null) {
          delta = Math.abs(best - r.songlen);
          ratio = best / r.songlen;
          if (delta <= 1) cls = 'exact<=1s';
          else if (delta <= 3) cls = 'close<=3s';
          else if (delta <= 5) cls = 'near<=5s';
          else {
            const up = ratio;
            const dn = 1 / ratio;
            const nearInt = (x: number) => x >= 1.85 && Math.abs(x - Math.round(x)) < 0.06;
            cls = nearInt(up) ? 'multiple' : nearInt(dn) ? 'submultiple' : 'mismatch';
          }
        }
        rows.push({ r, verdict: v.kind, best, delta, ratio, cls });
        if (++done % 25 === 0) console.log(`  ...${done}/${sample.length}`);
      }

      const n = rows.length;
      const count = (p: (x: Row) => boolean) => rows.filter(p).length;
      const pc = (k: number) => `${k}/${n} (${((k / n) * 100).toFixed(0)}%)`;

      console.log(`\n========== OVERALL (n=${n}) ==========`);
      for (const c of [
        'exact<=1s',
        'close<=3s',
        'near<=5s',
        'multiple',
        'submultiple',
        'mismatch',
        'ended',
        'none',
        'silent',
        'error',
      ]) {
        console.log(`${c.padEnd(14)} ${pc(count((x) => x.cls === c))}`);
      }
      const usable = count((x) => ['exact<=1s', 'close<=3s', 'near<=5s'].includes(x.cls));
      console.log(`\nwithin 5s TOTAL: ${pc(usable)}`);
      console.log(
        `defensible (within5s + multiple/submultiple): ${pc(
          usable + count((x) => x.cls === 'multiple' || x.cls === 'submultiple')
        )}`
      );

      const dims: [string, (r: Rec) => string][] = [
        ['clock', (r) => r.clock],
        ['format', (r) => r.format],
        ['model', (r) => r.model],
        ['speed', (r) => (r.multispeed ? 'multispeed' : 'single')],
        ['area', (r) => r.area],
        ['era', (r) => r.era],
        ['length', (r) => r.lenBucket],
      ];
      for (const [label, f] of dims) {
        console.log(`\n--- by ${label} ---`);
        const groups = new Map<string, Row[]>();
        for (const x of rows) {
          const k = f(x.r);
          const a = groups.get(k);
          if (a === undefined) groups.set(k, [x]);
          else a.push(x);
        }
        for (const k of [...groups.keys()].sort()) {
          const g = groups.get(k) ?? [];
          const ok = g.filter((x) => ['exact<=1s', 'close<=3s', 'near<=5s'].includes(x.cls)).length;
          const bad = g.filter((x) => ['silent', 'error'].includes(x.cls)).length;
          console.log(
            `  ${k.padEnd(14)} n=${String(g.length).padStart(3)}  within5s=${((ok / g.length) * 100)
              .toFixed(0)
              .padStart(3)}%  unplayable=${bad}`
          );
        }
      }

      if (OUT !== undefined) {
        writeFileSync(
          OUT,
          JSON.stringify(
            rows.map((x) => ({ ...x.r, verdict: x.verdict, best: x.best, delta: x.delta, ratio: x.ratio, cls: x.cls })),
            null,
            1
          )
        );
        console.log(`\nfull results -> ${OUT}`);
      } else {
        console.log(`\nSTRAT_OUT not set; per-tune results were printed above only, not written to disk.`);
      }
    },
    7_200_000
  );
});
