// Profiles one SID through sidablist's own engine: header, play rate, per-frame cost, writes.
// Usage: node profile-tune.mjs <file.sid> [subtune] [seconds]
import { readFileSync } from 'node:fs';
import { loadSidablist } from './lib/sidablist.mjs';

const core = await loadSidablist('core');
const analysis = await loadSidablist('analysis');

const [, , path, subArg, secArg] = process.argv;
const bytes = new Uint8Array(readFileSync(path));
const file = core.parseSidFile(bytes);
const sub = subArg ? Number(subArg) : file.startSong ?? 1;
const seconds = secArg ? Number(secArg) : 120;

const { bytes: _b, data: _d, payload: _p, ...header } = file;
console.log('header:', JSON.stringify(header, (k, v) => (v instanceof Uint8Array ? `<${v.length} bytes>` : v)));

// Per-frame cost on a bare machine, the way the player's tick runs it.
let writes = 0;
const machine = core.createC64Machine(file, { onSidWrite() { writes++; } });
machine.initSubtune(sub);
console.log('callsPerFrame', machine.callsPerFrame, 'exact', machine.exactCallsPerFrame,
  'cyclesPerPlayCall', machine.cyclesPerPlayCall, 'budget', machine.frameCycleBudget,
  'playAddr', machine.resolvedPlayAddress?.toString(16));

const frameCount = Math.round(seconds * 50.125);
const times = new Float64Array(frameCount);
const cycles = new Float64Array(frameCount);
const wc = new Uint16Array(frameCount);
for (let i = 0; i < 200; i++) machine.runFrame(); // warm the JIT
for (let i = 0; i < frameCount; i++) {
  writes = 0;
  const t0 = performance.now();
  const r = machine.runFrame();
  times[i] = performance.now() - t0;
  cycles[i] = r.cyclesUsed;
  wc[i] = writes;
}
const sorted = Float64Array.from(times).sort();
const pct = (p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))].toFixed(3);
const sum = times.reduce((a, b) => a + b, 0);
const cyc = Float64Array.from(cycles).sort();
const wcs = Uint16Array.from(wc).sort();
console.log(`runFrame ms over ${frameCount} frames: mean ${(sum / frameCount).toFixed(3)} p50 ${pct(0.5)} p99 ${pct(0.99)} max ${sorted[sorted.length - 1].toFixed(3)}`);
console.log(`cycles/frame: p50 ${cyc[cyc.length >> 1]} p99 ${cyc[Math.floor(cyc.length * 0.99)]} max ${cyc[cyc.length - 1]}`);
console.log(`sid writes/frame: p50 ${wcs[wcs.length >> 1]} p99 ${wcs[Math.floor(wcs.length * 0.99)]} max ${wcs[wcs.length - 1]}`);

// The record scan a deck load starts (R1): how long one costs a worker core.
const t1 = performance.now();
const scan = new analysis.TuneScan(file, sub);
scan.advanceTo(frameCount);
console.log(`TuneScan of ${seconds}s: ${(performance.now() - t1).toFixed(0)} ms`);
