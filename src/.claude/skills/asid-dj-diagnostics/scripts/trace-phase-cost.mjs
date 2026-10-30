// Mean duration of each lifecycle phase per rendering-task signature, plus UpdateLayer count per task.
// Usage: node trace-phase-cost.mjs <trace>
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
const all = events.filter((e) => key(e) === mainKey && e.ph === 'X').sort((a, b) => a.ts - b.ts);
const start = all[0].ts + 500_000;
const main = all.filter((e) => e.ts >= start);
const tasks = [];
let end = -1;
for (const e of main) if (e.name === 'RunTask' && e.ts >= end) { tasks.push({ t: e, kids: [] }); end = e.ts + e.dur; }
let ti = 0;
for (const e of main) {
  while (ti < tasks.length && tasks[ti].t.ts + tasks[ti].t.dur < e.ts) ti++;
  if (ti < tasks.length && e !== tasks[ti].t && e.ts >= tasks[ti].t.ts) tasks[ti].kids.push(e);
}
const PH = ['FunctionCall', 'UpdateLayoutTree', 'Layout', 'PrePaint', 'Paint', 'Layerize', 'Commit', 'UpdateLayer'];
const groups = new Map();
for (const { t, kids } of tasks) {
  if (!kids.some((k) => k.name === 'Layerize')) continue;
  const s = ['UpdateLayoutTree', 'Layout', 'Paint'].filter((p) => kids.some((k) => k.name === p)).join('+') || 'none';
  const g = groups.get(s) ?? { n: 0, total: 0, ph: Object.fromEntries(PH.map((p) => [p, 0])), upd: 0, paints: 0, lz: [] };
  g.n++; g.total += t.dur;
  for (const p of PH) g.ph[p] += kids.filter((k) => k.name === p).reduce((a, k) => a + (p === 'Paint' ? 0 : k.dur), 0);
  // Paint events nest; count only outermost Paint duration.
  const paints = kids.filter((k) => k.name === 'Paint');
  g.ph.Paint += paints.filter((p) => !paints.some((q) => q !== p && q.ts <= p.ts && q.ts + q.dur >= p.ts + p.dur)).reduce((a, k) => a + k.dur, 0);
  g.upd += kids.filter((k) => k.name === 'UpdateLayer').length;
  g.paints += paints.length;
  g.lz.push(kids.filter((k) => k.name === 'Layerize').reduce((a, k) => a + k.dur, 0) / 1000);
  groups.set(s, g);
}
for (const [s, g] of groups) {
  const lz = g.lz.sort((a, b) => a - b);
  console.log(`[${s}] ${g.n} tasks, mean ${(g.total / g.n / 1000).toFixed(2)} ms; per task: ${PH.map((p) => `${p} ${(g.ph[p] / g.n / 1000).toFixed(2)}`).join('  ')}; UpdateLayer n ${(g.upd / g.n).toFixed(1)}, Paint events ${(g.paints / g.n).toFixed(1)}; layerize p50 ${lz[Math.floor(lz.length / 2)].toFixed(2)} p90 ${lz[Math.floor(lz.length * 0.9)].toFixed(2)} max ${lz.at(-1).toFixed(2)}`);
}
