// Timeline of compositor BeginFrame (vsync) vs main-frame requests, to see whether a frame asked
// for mid-interval runs at once (a "missed" BeginFrame) or waits for the next vsync.
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const [, , path, fromS = '5', count = '60'] = process.argv;
const raw = readFileSync(path);
const doc = JSON.parse((raw[0] === 0x1f && raw[1] === 0x8b ? gunzipSync(raw) : raw).toString('utf8'));
const ev = doc.traceEvents;
const names = new Map();
for (const e of ev) if (e.ph === 'M' && e.name === 'thread_name') names.set(`${e.pid}:${e.tid}`, e.args.name);
const keep = ev.filter((e) => ['BeginFrame', 'RequestMainThreadFrame', 'BeginMainThreadFrame', 'NeedsBeginFrameChanged'].includes(e.name) || (e.name === 'TimerFire' && names.get(`${e.pid}:${e.tid}`) === 'CrRendererMain') || (e.name === 'FireAnimationFrame')).sort((a, b) => a.ts - b.ts);
const t0 = keep[0].ts + Number(fromS) * 1e6;
let lastBf = null;
let shown = 0;
// Stats: for each BeginMainThreadFrame, time since the last BeginFrame and whether a RequestMainThreadFrame came after that BeginFrame.
let lastReq = null, viaMissed = 0, viaNext = 0;
const lat = [];
for (const e of keep) {
  if (e.name === 'BeginFrame') lastBf = e;
  if (e.name === 'RequestMainThreadFrame') lastReq = e;
  if (e.name === 'BeginMainThreadFrame' && lastBf && lastReq) {
    if (lastReq.ts > lastBf.ts) viaMissed++; else viaNext++;
    lat.push((e.ts - lastBf.ts) / 1000);
  }
  if (e.ts >= t0 && shown < Number(count)) {
    shown++;
    const tag = e.name === 'BeginFrame' ? `BF seq ${e.args.frameSeqId}` : e.name === 'NeedsBeginFrameChanged' ? `NBF ${e.args.data.needsBeginFrame}` : e.name === 'TimerFire' ? `TimerFire ${e.args?.data?.timerId}` : e.name;
    console.log(`${((e.ts - t0) / 1000).toFixed(2).padStart(8)}  ${tag}`);
  }
}
lat.sort((a, b) => a - b);
console.log(`\nBeginMainThreadFrame after a request made AFTER the last BeginFrame (ran in that interval): ${viaMissed}; request before it: ${viaNext}`);
console.log(`time from last BeginFrame to BeginMainThreadFrame: p50 ${lat[lat.length >> 1].toFixed(2)} p90 ${lat[Math.floor(lat.length * 0.9)].toFixed(2)} max ${lat.at(-1).toFixed(2)}`);
