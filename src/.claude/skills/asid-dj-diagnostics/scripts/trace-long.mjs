// What makes long main-thread tasks long: self time by event name summed over every top-level task
// of at least <minMs>, plus the breakdown of the single longest one.
// Usage: node trace-long.mjs <trace> [minMs=4]
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

const [, , path, minArg] = process.argv;
const minUs = Number(minArg ?? 4) * 1000;
const raw = readFileSync(path);
const doc = JSON.parse((raw[0] === 0x1f && raw[1] === 0x8b ? gunzipSync(raw) : raw).toString('utf8'));
const events = doc.traceEvents;
const names = new Map();
for (const e of events) if (e.ph === 'M' && e.name === 'thread_name') names.set(`${e.pid}:${e.tid}`, e.args.name);
const key = (e) => `${e.pid}:${e.tid}`;
const counts = new Map();
for (const e of events) if (e.ph === 'X' && names.get(key(e)) === 'CrRendererMain') counts.set(key(e), (counts.get(key(e)) ?? 0) + 1);
const mainKey = [...counts].sort((a, b) => b[1] - a[1])[0][0];
const main = events.filter((e) => key(e) === mainKey && e.ph === 'X').sort((a, b) => a.ts - b.ts || b.dur - a.dur);
const t0 = main[0].ts + 500_000;

const stack = [];
const tops = [];
for (const s of main) {
  while (stack.length && stack.at(-1).ts + stack.at(-1).dur < s.ts + s.dur) stack.pop();
  s.parent = stack.at(-1) ?? null;
  s.kids = [];
  if (s.parent) s.parent.kids.push(s);
  else if (s.name === 'RunTask' && s.ts >= t0) tops.push(s);
  stack.push(s);
}
const selfOf = (s) => s.dur - s.kids.reduce((n, k) => n + k.dur, 0);
const long = tops.filter((t) => t.dur >= minUs);
const by = new Map();
const walk = (s, fn) => { fn(s); for (const k of s.kids) walk(k, fn); };
for (const t of long) walk(t, (s) => {
  const d = s.args?.data;
  const nm = s.name === 'FunctionCall' ? `FunctionCall ${d?.functionName || '(anon)'} ${(d?.url ?? '').split('/').pop()}:${d?.lineNumber ?? ''}` : s.name;
  by.set(nm, (by.get(nm) ?? 0) + Math.max(0, selfOf(s)));
});
const total = long.reduce((n, t) => n + t.dur, 0);
console.log(`${long.length} tasks ≥ ${minUs / 1000} ms, ${(total / 1000).toFixed(1)} ms in all (mean ${(total / 1000 / long.length).toFixed(2)} ms); self time share:`);
for (const [nm, us] of [...by].sort((a, b) => b[1] - a[1]).slice(0, 16)) {
  console.log(`  ${((us / total) * 100).toFixed(1).padStart(5)}%  ${(us / 1000 / long.length).toFixed(2).padStart(5)} ms/task  ${nm}`);
}
const worst = [...long].sort((a, b) => b.dur - a.dur)[0];
console.log(`\nlongest: ${(worst.dur / 1000).toFixed(1)} ms at t=${((worst.ts - main[0].ts) / 1e6).toFixed(2)} s`);
const lines = [];
const show = (s, depth) => {
  for (const k of [...s.kids].sort((a, b) => b.dur - a.dur).filter((k) => k.dur >= 300).slice(0, 5)) {
    const d = k.args?.data;
    const extra = k.name === 'FunctionCall' ? ` ${d?.functionName || '(anon)'} ${(d?.url ?? '').split('/').pop()}:${d?.lineNumber}` : k.name === 'UpdateLayoutTree' ? ` elements=${k.args?.elementCount ?? d?.elementCount ?? '?'}` : '';
    lines.push(`${'  '.repeat(depth)}${(k.dur / 1000).toFixed(2)} ms ${k.name}${extra}`);
    if (depth < 4) show(k, depth + 1);
  }
};
show(worst, 1);
console.log(lines.join('\n'));
