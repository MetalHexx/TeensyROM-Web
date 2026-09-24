// Bench check to run before any hardware test, so a bench problem is not mistaken for a code problem.
// Checks the probe tooling, whether the API is running, which image the device is in, whether its
// firmware reports the boot-complete flag, and whether serial and TCP reach the same chip.
// Prints PASS / WARN / FAIL per check with what to do about it; exits 1 on any FAIL.
//   node preflight.mjs [--tcp 192.168.1.37[:2112]] [--uid 19277260] [--api-expected]
//   --api-expected   the API is meant to be running (api-swap.mjs); otherwise a running API is a FAIL
import { execFileSync } from 'node:child_process';
import { open, decode, listTeensyPorts, tokenBytes, Token, sleep } from './lib/wire.mjs';

const argv = process.argv.slice(2);
const option = (name) => { const i = argv.indexOf(name); return i < 0 ? null : argv[i + 1]; };
const tcpTarget = option('--tcp');
const expectedUid = option('--uid');
const apiExpected = argv.includes('--api-expected');

const results = [];
const report = (level, check, detail) => { results.push(level); console.log(`${level.padEnd(4)}  ${check}: ${detail}`); };

/** One version exchange on an open-able target; null when it cannot be opened (with the reason). */
async function version(target) {
  let link;
  try { link = await open(target, { connectTimeoutMs: 2000 }); } catch (err) { return { error: err.message }; }
  const got = { reply: null, boot: null, tokens: [] };
  decode(link, (e) => {
    if (e.type === 'reply') got.reply = e;
    if (e.type === 'boot') got.boot = e.state;
    if (e.type === 'token') got.tokens.push(e.name);
  });
  await link.write(tokenBytes(Token.Version));
  await sleep(600);
  if (!got.reply) { await link.write(tokenBytes(Token.FwCheck)); await sleep(300); }
  await link.close();
  return got;
}

// 1. Tooling
let ports;
try {
  ports = await listTeensyPorts();
  report('PASS', 'probe tooling', 'serialport loads');
} catch (err) {
  report('FAIL', 'probe tooling', err.message);
  process.exit(1);
}

// 2. The API
let apiRunning = false;
try {
  apiRunning = process.platform === 'win32'
    ? execFileSync('tasklist', ['/FI', 'IMAGENAME eq TeensyRom.Api.exe', '/NH'], { encoding: 'utf8' }).includes('TeensyRom.Api.exe')
    : execFileSync('pgrep', ['-f', 'TeensyRom.Api'], { encoding: 'utf8' }).trim().length > 0;
} catch { apiRunning = false; }
if (apiRunning && !apiExpected) {
  report('FAIL', 'API process', 'TeensyRom.Api is running: it opens every COM port during discovery and holds the one TCP session. Stop it for raw probes (Windows: taskkill /IM TeensyRom.Api.exe /F), or pass --api-expected for api-swap.mjs');
} else if (!apiRunning && apiExpected) {
  report('FAIL', 'API process', 'TeensyRom.Api is not running, but --api-expected was given');
} else {
  report('PASS', 'API process', apiRunning ? 'running, as expected' : 'not running');
}

// 3. USB ports
const full = ports.filter((p) => p.image === 'full');
const minimal = ports.filter((p) => p.image === 'minimal');
if (ports.length === 0) {
  report('FAIL', 'USB ports', 'no Teensy port: check the USB cable and that the TR is powered');
} else {
  report(full.length + minimal.length > 1 ? 'WARN' : 'PASS', 'USB ports',
    ports.map((p) => `${p.path} (${p.image}, pid ${p.pid})`).join(', ')
    + (full.length + minimal.length > 1 ? ' - more than one TR image on USB: check every UID below' : ''));
}
if (minimal.length > 0 && full.length === 0) {
  report('WARN', 'device image', 'the TR is in minimal (a large cart running?). Run: node reset.mjs serial');
}

// 4. Each port: can it be opened, what does it answer
const uids = new Set();
for (const port of ports) {
  const got = await version(port.path);
  if (got.error) {
    report('FAIL', `${port.path} open`, `${got.error} - another process holds it (API, a serial monitor, Arduino IDE, a stuck probe)`);
    continue;
  }
  if (got.reply) {
    uids.add(got.reply.uid);
    report('PASS', `${port.path} version`, `${got.reply.fw}, UID ${got.reply.uid}${got.reply.minimal ? ' (minimal)' : ''}`);
    if (!got.reply.minimal) {
      if (got.boot === null) report('WARN', `${port.path} boot flag`, 'no "Boot:" line: this firmware lacks the boot-complete flag, so boot waits fall back to the SID token');
      else report(got.boot === 'complete' ? 'PASS' : 'WARN', `${port.path} boot flag`, `Boot: ${got.boot}${got.boot === 'complete' ? '' : ' - the menu is still booting; wait and re-run'}`);
    }
  } else if (got.tokens.includes('FwMinimal')) {
    report('PASS', `${port.path} version`, 'minimal (answered the FW check only)');
  } else {
    report('FAIL', `${port.path} version`, 'opened but no reply: the device may be mid-boot or wedged. Re-run; if it persists, power-cycle the TR');
  }
}

// 5. TCP
if (tcpTarget) {
  const got = await version(tcpTarget);
  if (got.error) {
    report('FAIL', 'TCP', `${tcpTarget}: ${got.error} - another client holds the one TCP session (API, UI, hardware suite), the TR's TCP listener is off, or the IP is wrong`);
  } else if (!got.reply && got.tokens.includes('FwMinimal')) {
    report('WARN', 'TCP', `${tcpTarget} answers in minimal. Run: node reset.mjs ${tcpTarget}`);
  } else if (!got.reply) {
    report('FAIL', 'TCP', `${tcpTarget} connected but did not answer`);
  } else {
    uids.add(got.reply.uid);
    report('PASS', 'TCP', `${tcpTarget}: ${got.reply.fw}, UID ${got.reply.uid}, Boot: ${got.boot ?? 'no line'}`);
  }
}

// 6. Same chip everywhere, and the one expected
if (uids.size > 1) report('WARN', 'chip ids', `more than one UID answered (${[...uids].join(', ')}): more than one TR is live; target the one under test explicitly`);
if (expectedUid && !uids.has(expectedUid)) report('FAIL', 'chip ids', `expected UID ${expectedUid} did not answer (saw ${[...uids].join(', ') || 'none'})`);
else if (uids.size === 1) report('PASS', 'chip ids', `one chip on every path: ${[...uids][0]}`);

const failed = results.includes('FAIL');
console.log(failed ? '\npreflight: FAIL - fix the bench before testing' : '\npreflight: ready');
process.exit(failed ? 1 : 0);
