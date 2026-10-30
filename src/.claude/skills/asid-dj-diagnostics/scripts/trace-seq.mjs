// Sequence of rendering frames: gap since previous rAF frame, which phases ran, Paint nodes,
// Layout args, InvalidateLayout / ScheduleStyleRecalculation args. Usage: node trace-seq.mjs <trace> [startSec] [count]
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const [, , path, s0 = '3', cnt = '40'] = process.argv;
const raw = readFileSync(path);
const doc = JSON.parse((raw[0] === 0x1f && raw[1] === 0x8b ? gunzipSync(raw) : raw).toString('utf8'));
const events = doc.traceEvents;
const names = new Map();
for (const e of events) if (e.ph === 'M' && e.name === 'thread_name') names.set(`${e.pid}:${e.tid}`, e.args.name);
const key = (e) => `${e.pid}:${e.tid}`;
const counts = new Map();
for (const e of events) if (e.ph === 'X' && names.get(key(e)) === 'CrRendererMain') counts.set(key(e), (counts.get(key(e)) ?? 0) + 1);
const mainKey = [...counts].sort((a, b) => b[1] - a[1])[0][0];
const all = events.filter((e) => key(e) === mainKey && e.ph !== 'M').sort((a, b) => a.ts - b.ts);
const t0 = all[0].ts;
const from = t0 + Number(s0) * 1e6;
const tasks = [];
let end = -1;
for (const e of all) if (e.ph === 'X' && e.name === 'RunTask' && e.ts >= end && e.ts >= from) { tasks.push({ t: e, kids: [] }); end = e.ts + e.dur; }
let ti = 0;
for (const e of all) {
  if (e.ts < from) continue;
  while (ti < tasks.length && tasks[ti].t.ts + tasks[ti].t.dur < e.ts) ti++;
  if (ti < tasks.length && e !== tasks[ti].t && e.ts >= tasks[ti].t.ts) tasks[ti].kids.push(e);
}
let prev = null, shown = 0;
const firstArgs = {};
for (const { t, kids } of tasks) {
  if (!kids.some((k) => k.name === 'FireAnimationFrame')) continue;
  const has = (n) => kids.some((k) => k.name === n);
  const gap = prev === null ? 0 : (t.ts - prev) / 1000;
  prev = t.ts;
  const paints = kids.filter((k) => k.name === 'Paint').map((k) => k.args?.data?.nodeName ?? k.args?.data?.nodeId).join(',');
  const lay = kids.find((k) => k.name === 'Layout');
  const inval = kids.filter((k) => k.name === 'InvalidateLayout').map((k) => k.args?.data?.nodeName ?? '').join(',');
  for (const n of ['Layout', 'InvalidateLayout', 'ScheduleStyleRecalculation', 'UpdateLayoutTree', 'PrePaint']) { const k = kids.find((x) => x.name === n); if (k && !firstArgs[n]) firstArgs[n] = k.args; }
  const lz = kids.filter((k) => k.name === 'Layerize').reduce((a, k) => a + k.dur, 0) / 1000;
  console.log(`+${gap.toFixed(1).padStart(5)} ${(t.dur / 1000).toFixed(2).padStart(5)}ms ${has('UpdateLayoutTree') ? 'S' : '-'}${has('Layout') ? 'L' : '-'}${has('Paint') ? 'P' : '-'} lz ${lz.toFixed(2)} ${lay ? `layoutRoot=${JSON.stringify(lay.args?.endData?.layoutRoots?.map?.((r) => r.nodeName ?? r.nodeId) ?? lay.args?.endData?.rootNode)} dirty=${lay.args?.beginData?.dirtyObjects}` : ''} ${inval ? `inval=[${inval}]` : ''} ${paints ? `paint=[${paints}]` : ''}`);
  if (++shown >= Number(cnt)) break;
}
console.log('\nfirst args:', JSON.stringify(firstArgs, null, 1).slice(0, 3000));
