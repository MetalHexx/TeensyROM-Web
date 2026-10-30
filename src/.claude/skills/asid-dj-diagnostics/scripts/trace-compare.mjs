// Compact side-by-side of DevTools traces: frame rate, main-thread load and blocks, audio-callback
// gaps, extension scripts, and MIDI service thread task spacing. Skips the first 500 ms (profiler start).
// Usage: node trace-compare.mjs <trace> [<trace> ...]
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

const SKIP_US = 500_000;
const pct = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
const f = (n, d = 1) => Number(n).toFixed(d);

for (const path of process.argv.slice(2)) {
  const raw = readFileSync(path);
  const doc = JSON.parse((raw[0] === 0x1f && raw[1] === 0x8b ? gunzipSync(raw) : raw).toString('utf8'));
  const events = doc.traceEvents;
  const names = new Map();
  for (const e of events) if (e.ph === 'M' && e.name === 'thread_name') names.set(`${e.pid}:${e.tid}`, e.args.name);
  const key = (e) => `${e.pid}:${e.tid}`;
  const counts = new Map();
  for (const e of events) if (e.ph === 'X' && names.get(key(e)) === 'CrRendererMain') counts.set(key(e), (counts.get(key(e)) ?? 0) + 1);
  const mainKey = [...counts].sort((a, b) => b[1] - a[1])[0][0];
  const all = events.filter((e) => key(e) === mainKey && e.ph === 'X').sort((a, b) => a.ts - b.ts);
  const start = all[0].ts + SKIP_US;
  const main = all.filter((e) => e.ts >= start);
  const span = (main.at(-1).ts - start) / 1e6;
  const n = (name) => main.filter((e) => e.name === name).length;
  const self = (name) => main.filter((e) => e.name === name).reduce((s, e) => s + e.dur, 0) / 1000 / span;

  // Top-level tasks (not nested in another RunTask).
  const tasks = [];
  let end = -1;
  for (const e of main) if (e.name === 'RunTask' && e.ts >= end) { tasks.push(e); end = e.ts + e.dur; }
  const busy = tasks.reduce((s, t) => s + t.dur, 0) / 1000 / span;
  const td = tasks.map((t) => t.dur / 1000);
  const fnIn = (t) => main.find((e) => e.name === 'FunctionCall' && e.ts >= t.ts && e.ts < t.ts + t.dur && e.dur > t.dur * 0.4);
  const label = (t) => {
    const d = fnIn(t)?.args?.data;
    if (!d) return main.some((e) => e.name === 'Layerize' && e.ts >= t.ts && e.ts < t.ts + t.dur) ? 'render' : 'other';
    const url = d.url ?? '';
    return url.startsWith('chrome-extension://') ? `ext ${url.split('/')[2].slice(0, 8)} ${url.split('/').pop()}` : `${d.functionName || '(anon)'} ${url.split('/').pop()}`;
  };
  const longest = [...tasks].sort((a, b) => b.dur - a.dur).slice(0, 6).map((t) => `${f(t.dur / 1000)}ms ${label(t)}`);

  const audio = main.filter((e) => e.name === 'FunctionCall' && e.args?.data?.functionName === 'node.onaudioprocess');
  const gaps = [];
  for (let i = 1; i < audio.length; i++) gaps.push((audio[i].ts - audio[i - 1].ts) / 1000);
  const gs = [...gaps].sort((a, b) => a - b);

  const ext = new Map();
  for (const e of main) {
    const url = e.name === 'FunctionCall' ? e.args?.data?.url ?? '' : '';
    if (!url.startsWith('chrome-extension://')) continue;
    const id = `${url.split('/')[2].slice(0, 8)} ${url.split('/').pop()}`;
    const r = ext.get(id) ?? { ms: 0, max: 0 };
    r.ms += e.dur / 1000;
    r.max = Math.max(r.max, e.dur / 1000);
    ext.set(id, r);
  }

  const midiKey = [...names].find(([, nm]) => /Midi/i.test(nm))?.[0];
  const midi = events.filter((e) => key(e) === midiKey && e.ph === 'X' && e.ts >= start).sort((a, b) => a.ts - b.ts);
  const mg = [];
  for (let i = 1; i < midi.length; i++) mg.push((midi[i].ts - midi[i - 1].ts) / 1000);
  const ms = [...mg].sort((a, b) => a - b);

  console.log(`\n=== ${path.split(/[\\/]/).pop()}  (${f(span)} s analysed, main ${mainKey}, DOM nodes in DOMStats: ${main.find((e) => e.name === 'DOMStats')?.args?.data?.totalNodes ?? '?'})`);
  console.log(`  frames/s: rAF ${f(n('FireAnimationFrame') / span)}  layerize ${f(n('Layerize') / span)}  layout ${f(n('Layout') / span)}  style ${f(n('UpdateLayoutTree') / span)}`);
  console.log(`  main busy ${f(busy)} ms/s; JS FunctionCall ${f(self('FunctionCall'))}  layerize ${f(self('Layerize'))}  layout ${f(self('Layout'))}  paint ${f(self('Paint'))}  style ${f(self('UpdateLayoutTree'))} (incl. ms/s)`);
  console.log(`  tasks: ${tasks.length}; ≥4ms ${td.filter((d) => d >= 4).length}  ≥8ms ${td.filter((d) => d >= 8).length}  ≥12ms ${td.filter((d) => d >= 12).length}; longest: ${longest.join(' | ')}`);
  if (gs.length) console.log(`  audio callbacks ${audio.length} (${f(audio.length / span)}/s); gap p50 ${f(pct(gs, 50), 2)} p99 ${f(pct(gs, 99), 2)} max ${f(gs.at(-1), 2)}; gaps >12ms ${gs.filter((g) => g > 12).length}, >15ms ${gs.filter((g) => g > 15).length}`);
  console.log(`  extensions: ${[...ext].map(([id, r]) => `${id} ${f(r.ms / span, 2)} ms/s max ${f(r.max)}ms`).join('; ') || 'none'}`);
  if (ms.length) console.log(`  MIDI thread: ${f(midi.length / span)} tasks/s; gap p50 ${f(pct(ms, 50), 2)} p90 ${f(pct(ms, 90), 2)} p99 ${f(pct(ms, 99), 2)} max ${f(ms.at(-1), 2)}; gaps 12–20ms ${ms.filter((g) => g > 12 && g <= 20).length}, >20ms ${ms.filter((g) => g > 20).length}`);
}
