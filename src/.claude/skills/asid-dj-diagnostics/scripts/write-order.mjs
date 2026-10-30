// What a tune does inside each play call that ASID's packet cannot carry, around a moment of interest.
// ASID applies one frame as: last value of every non-control register in slot order (0-3, 5-10,
// 12-17, 19-24), then voice control 4/11/18, then a second control write per voice. So it loses
// intermediate values, a third+ control write, and any order where a control write came first.
// Usage: node write-order.mjs <file.sid> <centreSeconds> [halfWindowSeconds] [subtune]
import { readFileSync } from 'node:fs';
import { loadSidablist } from './lib/sidablist.mjs';

const core = await loadSidablist('core');

const [, , path, centreArg, halfArg, subArg] = process.argv;
const file = core.parseSidFile(new Uint8Array(readFileSync(path)));
const sub = subArg ? Number(subArg) : file.startSong ?? 1;
const CALL_MS = Number(process.env.CALL_MS ?? 9.975); // ms per play call: InSID3 Out (2× PAL); set CALL_MS for another tune
const centre = Math.round((Number(centreArg) * 1000) / CALL_MS);
const half = Math.round(((halfArg ? Number(halfArg) : 4) * 1000) / CALL_MS);
const totalFrames = Math.round((180 * 1000) / CALL_MS);

const CTRL = new Set([4, 11, 18]);
const VOICE_OF = (r) => (r < 21 ? Math.floor(r / 7) : -1);
const NAMES = ['FREQ_LO', 'FREQ_HI', 'PW_LO', 'PW_HI', 'CTRL', 'AD', 'SR'];
const regName = (r) => (r < 21 ? `V${VOICE_OF(r) + 1}.${NAMES[r % 7]}` : ['FC_LO', 'FC_HI', 'RES_FILT', 'MODE_VOL'][r - 21]);
const hex = (v) => v.toString(16).padStart(2, '0');

let writes = [];
const machine = core.createC64Machine(file, { onSidWrite(register, value) { writes.push([register, value]); } });
machine.initSubtune(sub);
writes = [];

const perSecond = new Map(); // second -> counts of each lossy pattern
const bump = (sec, key) => { const m = perSecond.get(sec) ?? {}; m[key] = (m[key] ?? 0) + 1; perSecond.set(sec, m); };
const detail = [];
const lastCtrl = [0, 0, 0];

for (let f = 0; f < totalFrames; f++) {
  writes = [];
  machine.runFrame();
  const sec = Math.floor((f * CALL_MS) / 1000);
  const byReg = new Map();
  writes.forEach(([r, v], i) => { if (!byReg.has(r)) byReg.set(r, []); byReg.get(r).push([v, i]); });
  const notes = [];
  for (const [r, list] of byReg) {
    if (CTRL.has(r)) {
      if (list.length > 2) { bump(sec, 'ctrl3+'); notes.push(`${regName(r)} written ${list.length}x (${list.map(([v]) => hex(v)).join(' ')}) — ASID keeps first+last only`); }
      const v = VOICE_OF(r);
      for (const adsr of [r + 1, r + 2]) {
        const a = byReg.get(adsr);
        if (a && a[a.length - 1][1] > list[0][1]) { bump(sec, 'adsrAfterCtrl'); notes.push(`${regName(adsr)}=${hex(a[a.length - 1][0])} written after ${regName(r)}=${hex(list[0][0])} — ASID applies it first`); }
      }
      const first = list[0][0];
      if ((first & 0x08) || list.some(([x]) => x & 0x08)) bump(sec, 'testBit');
      if ((lastCtrl[v] & 1) && !(first & 1) && list.length === 1) bump(sec, 'gateOff');
      if (!(lastCtrl[v] & 1) && (list[list.length - 1][0] & 1)) bump(sec, 'gateOn');
      lastCtrl[v] = list[list.length - 1][0];
    } else if (list.length > 1) {
      const distinct = new Set(list.map(([x]) => x)).size;
      if (distinct > 1) { bump(sec, r === 24 ? 'volMulti' : 'regMulti'); notes.push(`${regName(r)} written ${list.length}x (${list.map(([x]) => hex(x)).join(' ')}) — only the last reaches the SID`); }
    }
  }
  if (Math.abs(f - centre) <= half && notes.length) detail.push(`f${f} t=${((f * CALL_MS) / 1000).toFixed(2)}s  ${notes.join(' | ')}`);
}

console.log(`file ${file.name ?? ''} — centre frame ${centre} (${centreArg}s), ±${half} frames`);
console.log('\nPer-second counts of what ASID cannot carry (whole tune, first 180 s):');
for (const [sec, m] of [...perSecond].sort((a, b) => a[0] - b[0])) {
  const lossy = (m.ctrl3plus ?? 0) + (m['ctrl3+'] ?? 0) + (m.adsrAfterCtrl ?? 0) + (m.regMulti ?? 0) + (m.volMulti ?? 0);
  if (lossy > 0 || Math.abs(sec - Number(centreArg)) <= 3) console.log(`  ${String(sec).padStart(3)}s  ${JSON.stringify(m)}`);
}
console.log(`\nDetail around the centre (${detail.length} frames with lossy writes):`);
for (const line of detail.slice(0, 80)) console.log('  ' + line);
