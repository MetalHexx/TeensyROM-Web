// Per rendering update on the main thread: which lifecycle phases ran, and what Paint events name.
// Groups each top-level RunTask that contains a Layerize, Paint or FireAnimationFrame, and counts
// the phase signatures; then tallies Paint event args (nodeId / layer) and Layerize args.
// Usage: node trace-frames.mjs <trace>
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

const raw = readFileSync(process.argv[2]);
const doc = JSON.parse((raw[0] === 0x1f && raw[1] === 0x8b ? gunzipSync(raw) : raw).toString('utf8'));
const events = doc.traceEvents;
const names = new Map();
for (const e of events) if (e.ph === 'M' && e.name === 'thread_name') names.set(`${e.pid}:${e.tid}`, e.args.name);
const key = (e) => `${e.pid}:${e.tid}`;
const counts = new Map();
for (const e of events) if (e.ph === 'X' && names.get(key(e)) === 'CrRendererMain') counts.set(key(e), (counts.get(key(e)) ?? 0) + 1);
const mainKey = [...counts].sort((a, b) => b[1] - a[1])[0][0];
const all = events.filter((e) => key(e) === mainKey && (e.ph === 'X' || e.ph === 'I' || e.ph === 'i' || e.ph === 'R' || e.ph === 'n')).sort((a, b) => a.ts - b.ts);
const start = all[0].ts + 500_000;
const main = all.filter((e) => e.ts >= start);
const span = (main.at(-1).ts - start) / 1e6;

const tasks = [];
let end = -1;
for (const e of main) if (e.ph === 'X' && e.name === 'RunTask' && e.ts >= end) { tasks.push({ t: e, kids: [] }); end = e.ts + e.dur; }
let ti = 0;
for (const e of main) {
  while (ti < tasks.length && tasks[ti].t.ts + tasks[ti].t.dur < e.ts) ti++;
  if (ti < tasks.length && e !== tasks[ti].t && e.ts >= tasks[ti].t.ts) tasks[ti].kids.push(e);
}
const PHASES = ['FireAnimationFrame', 'UpdateLayoutTree', 'Layout', 'PrePaint', 'Paint', 'Layerize', 'Commit'];
const sig = new Map();
for (const { t, kids } of tasks) {
  const has = PHASES.filter((p) => kids.some((k) => k.name === p));
  if (!has.length) continue;
  const s = has.map((p) => p.replace('FireAnimationFrame', 'rAF').replace('UpdateLayoutTree', 'Style')).join(' ');
  const r = sig.get(s) ?? { n: 0, ms: 0 };
  r.n++;
  r.ms += t.dur / 1000;
  sig.set(s, r);
}
console.log(`${span.toFixed(1)} s; rendering-task signatures (count/s, mean ms):`);
for (const [s, r] of [...sig].sort((a, b) => b[1].n - a[1].n)) console.log(`  ${(r.n / span).toFixed(1).padStart(6)}/s  ${(r.ms / r.n).toFixed(2).padStart(5)} ms  ${s}`);

const argsOf = (name) => main.filter((e) => e.name === name).map((e) => e.args);
const tally = (list, fn) => {
  const m = new Map();
  for (const a of list) { const k = fn(a); m.set(k, (m.get(k) ?? 0) + 1); }
  return [...m].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, n]) => `${(n / span).toFixed(1)}/s ${k}`);
};
const paints = argsOf('Paint');
console.log(`\nPaint args sample: ${JSON.stringify(paints[0])}`);
console.log('Paint by nodeId/clip size:');
for (const l of tally(paints, (a) => { const d = a?.data ?? {}; const c = d.clip ?? []; const w = c.length >= 8 ? Math.round(Math.max(...[c[0], c[2], c[4], c[6]]) - Math.min(...[c[0], c[2], c[4], c[6]])) : '?'; const h = c.length >= 8 ? Math.round(Math.max(...[c[1], c[3], c[5], c[7]]) - Math.min(...[c[1], c[3], c[5], c[7]])) : '?'; return `node ${d.nodeId} layer ${d.layerId} ${w}x${h}`; })) console.log(`  ${l}`);
console.log(`\nLayerize args sample: ${JSON.stringify(argsOf('Layerize')[0])}`);
const otherNames = new Map();
for (const { kids } of tasks) if (kids.some((k) => k.name === 'Layerize')) for (const k of kids) otherNames.set(k.name, (otherNames.get(k.name) ?? 0) + 1);
console.log(`\nEvent names inside tasks that layerize (count/s):`);
console.log([...otherNames].sort((a, b) => b[1] - a[1]).slice(0, 45).map(([n, c]) => `${n} ${(c / span).toFixed(1)}`).join(' | '));
