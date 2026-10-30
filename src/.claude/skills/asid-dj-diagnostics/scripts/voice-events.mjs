// Voice events over a frame span: control/envelope changes and one-call pitch spikes, per voice.
// Usage: node voice-events.mjs <file.sid> <fromFrame> <toFrame>   (CALL_MS=<ms per play call>, default InSID3 Out's)
import { readFileSync } from 'node:fs';
import { loadSidablist } from './lib/sidablist.mjs';
const core = await loadSidablist('core');
const [, , path, fromArg, toArg] = process.argv;
const from = +fromArg, to = +toArg, CALL_MS = Number(process.env.CALL_MS ?? 9.975);
const file = core.parseSidFile(new Uint8Array(readFileSync(path)));
const regs = new Uint8Array(25);
const m = core.createC64Machine(file, { onSidWrite(r, v) { regs[r] = v; } });
m.initSubtune(file.startSong ?? 1);
const h = (v) => v.toString(16).padStart(2, '0');
const wave = (c) => (c & 0x80 ? 'N' : '') + (c & 0x40 ? 'P' : '') + (c & 0x20 ? 'S' : '') + (c & 0x10 ? 'T' : '') + (c & 0x08 ? '+TEST' : '') + (c & 0x04 ? '+ring' : '') + (c & 0x02 ? '+sync' : '') + (c & 1 ? ' G' : ' -');
const frames = [];
for (let f = 0; f <= to + 1; f++) { m.runFrame(); if (f >= from - 1) frames.push({ f, r: regs.slice() }); }
const freq = (r, b) => r[b] | (r[b + 1] << 8);
for (const [vi, b] of [[1, 0], [2, 7], [3, 14]]) {
  const lines = [];
  for (let i = 1; i < frames.length - 1; i++) {
    const { f, r } = frames[i], p = frames[i - 1].r, n = frames[i + 1].r;
    const ev = [];
    if (r[b + 4] !== p[b + 4]) ev.push(`ctrl ${wave(p[b + 4]).trim()} → ${wave(r[b + 4]).trim()}`);
    if (r[b + 5] !== p[b + 5] || r[b + 6] !== p[b + 6]) ev.push(`AD/SR ${h(p[b + 5])}${h(p[b + 6])} → ${h(r[b + 5])}${h(r[b + 6])}`);
    const fp = freq(p, b), fr = freq(r, b), fn = freq(n, b);
    if (fr !== fp && fr !== fn && Math.abs(Math.log2((fr || 1) / (fp || 1))) > 0.5) ev.push(`ONE-CALL pitch $${fr.toString(16)} (was $${fp.toString(16)}, next $${fn.toString(16)})`);
    if (ev.length) lines.push(`  f${f} ${((f * CALL_MS) / 1000).toFixed(3)}s  ${ev.join(' | ')}`);
  }
  console.log(`Voice ${vi}: ${lines.length} event frames`);
  for (const l of lines) console.log(l);
}
