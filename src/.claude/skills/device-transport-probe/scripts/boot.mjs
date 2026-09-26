// Reset in full firmware, then ask for the version every --poll ms for --duration ms. Per run it reports
// when the "Boot:" flag moves, when the SID token arrives, the longest silence before "complete" (a
// menu boot step blocking the Teensy main loop), and anything wrong after "complete": gaps longer than
// the poll, or the flag going back to "in progress". A reset in full does not reboot the Teensy, so
// the link stays open across runs on both transports.
//   node boot.mjs <COM4 | 192.168.1.37[:2112]> [--runs 5] [--poll 50] [--duration 8000] [--pause 4000] [--out file]
import fs from 'node:fs';
import { open, decode, tokenBytes, Token, since, sleep } from './lib/wire.mjs';

const argv = process.argv.slice(2);
const option = (name, fallback) => { const i = argv.indexOf(name); return i < 0 ? fallback : argv[i + 1]; };
const target = argv[0];
if (!target || target.startsWith('--')) {
  console.error('usage: node boot.mjs <COM4 | 192.168.1.37[:2112]> [--runs 5] [--poll 50] [--duration 8000] [--pause 4000] [--out file]');
  process.exit(2);
}
const runs = Number(option('--runs', 5));
const pollMs = Number(option('--poll', 50));
const durationMs = Number(option('--duration', 8000));
const pauseMs = Number(option('--pause', 4000));
const outFile = option('--out', null);
const write = (text) => { console.log(text); if (outFile) fs.appendFileSync(outFile, `${text}\n`); };

const link = await open(target);
let run = null;
decode(link, (e) => {
  if (!run) return;
  const at = since(run.t0);
  if (e.type === 'reply') run.replies.push(at);
  if (e.type === 'token' && (e.name === 'GoodSid' || e.name === 'BadSid')) run.sid ??= at;
  if (e.type === 'boot' && e.state === 'in progress') {
    run.inProgress ??= at;
    if (run.complete != null) run.regressions += 1;
  }
  if (e.type === 'boot' && e.state === 'complete') run.complete ??= at;
});

let allGood = true;
for (let n = 1; n <= runs; n++) {
  run = { t0: performance.now(), replies: [], sid: null, inProgress: null, complete: null, regressions: 0 };
  await link.write(tokenBytes(Token.Reset));
  while (since(run.t0) < durationMs && link.isOpen()) {
    await sleep(pollMs);
    await link.write(tokenBytes(Token.Version));
  }

  let stall = { ms: 0, from: null, to: null };
  let gapsAfter = 0;
  for (let i = 1; i < run.replies.length; i++) {
    const [from, to] = [run.replies[i - 1], run.replies[i]];
    const gap = to - from;
    if ((run.complete == null || to <= run.complete) && gap > stall.ms) stall = { ms: Math.round(gap), from, to };
    if (run.complete != null && from >= run.complete && gap > pollMs + 60) gapsAfter += 1;
  }
  const ok = run.complete != null && gapsAfter === 0 && run.regressions === 0;
  allGood &&= ok;
  write(`run ${n}: ${ok ? 'PASS' : 'FAIL'}  first 'in progress' ${run.inProgress ?? 'n/a'} ms; SID ${run.sid ?? 'none'} ms; `
    + `stall ${stall.from ?? '-'}-${stall.to ?? '-'} ms (${stall.ms} ms); 'complete' ${run.complete ?? 'never'} ms; `
    + `${run.replies.length} replies; gaps>${pollMs + 60}ms after complete: ${gapsAfter}; 'in progress' after complete: ${run.regressions}`);
  run = null;
  if (n < runs) await sleep(pauseMs);
}
await link.close();
write(allGood ? 'done: all runs PASS' : 'done: at least one run FAILED');
process.exit(allGood ? 0 : 1);
