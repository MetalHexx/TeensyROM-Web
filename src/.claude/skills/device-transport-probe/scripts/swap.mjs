// Full -> minimal -> full swap, timed from the device's side with no API in between.
// Launches a large cart from full (the TR reboots into minimal to run it), waits, resets from minimal,
// then follows the way back to full: port/connection availability, every line the device prints,
// the first version reply, the "Boot:" states and the SID token.
//
//   node swap.mjs serial [--rounds 3] [--wait 5000] [--poll 50] [--settle 1500] [--no-transient] [--out file]
//   node swap.mjs tcp 192.168.1.37[:2112] [same options]
//   --file "/games/Large/706k The Secret of Monkey Island (D42) [EasyFlash].crt"   (SD path of a large cart)
//
// Serial: the tool finds the Teensy ports by USB product id (full 0489, minimal 0483), so nothing else
// may hold them - stop the API first. TCP: the TR takes one client at a time - same rule.
import fs from 'node:fs';
import {
  open, decode, listTeensyPorts, sendLaunch, tokenBytes, Token, Drive, since, sleep,
} from './lib/wire.mjs';

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const option = (name, fallback) => { const i = argv.indexOf(name); return i < 0 ? fallback : argv[i + 1]; };
const transport = argv[0];
const tcpTarget = transport === 'tcp' ? argv[1] : null;
if (!['serial', 'tcp'].includes(transport) || (transport === 'tcp' && !tcpTarget)) {
  console.error('usage: node swap.mjs serial|tcp <host[:port]> [--rounds N] [--wait ms] [--poll ms] [--settle ms] [--no-transient] [--file path] [--out file]');
  process.exit(2);
}
const rounds = Number(option('--rounds', 3));
const waitMs = Number(option('--wait', 5000));
const pollMs = Number(option('--poll', 50));
const settleMs = Number(option('--settle', 1500));
const probeTransient = !flag('--no-transient');
const largeFile = option('--file', '/games/Large/706k The Secret of Monkey Island (D42) [EasyFlash].crt');
const outFile = option('--out', null);
const phaseTimeoutMs = 20000;

const write = (text) => { console.log(text); if (outFile) fs.appendFileSync(outFile, `${text}\n`); };
const describe = (e) => (e.type === 'token' ? `token ${e.name}`
  : e.type === 'reply' ? `version reply (${e.minimal ? 'minimal' : 'full'}, UID ${e.uid})`
    : e.type === 'boot' ? `Boot: ${e.state}` : `"${e.text}"`);

/** Polls the Teensy port list and reports each port appearing or vanishing. */
function watchPorts(log, onChange) {
  let stopped = false;
  let previous = new Map();
  const done = (async () => {
    while (!stopped) {
      const now = new Map((await listTeensyPorts()).map((p) => [p.path, p]));
      for (const [name, port] of now) if (!previous.has(name)) { log(`${name} appeared (${port.image})`); onChange('up', port); }
      for (const [name, port] of previous) if (!now.has(name)) { log(`${name} vanished (${port.image})`); onChange('down', port); }
      previous = now;
      await sleep(25);
    }
  })();
  return { stop: async () => { stopped = true; await done; }, ports: () => [...previous.values()] };
}

async function openWithRetry(target, timeoutMs, log, retryMs = 25) {
  const start = performance.now();
  let lastError = null;
  while (performance.now() - start < timeoutMs) {
    try { return await open(target, { connectTimeoutMs: 500 }); } catch (err) {
      if (err.message !== lastError) { log(`${target} open failed: ${err.message}`); lastError = err.message; }
    }
    await sleep(retryMs);
  }
  return null;
}

function attach(link, log, onEvent = () => {}, quiet = () => false) {
  decode(link, (e) => { if (!quiet(e)) log(`${link.name} ${describe(e)}`); onEvent(e); });
  link.onClose((why) => log(`${link.name} link closed (${why})`));
}

const waitUntil = async (test, timeoutMs) => {
  const start = performance.now();
  while (!test()) { if (performance.now() - start > timeoutMs) return false; await sleep(10); }
  return true;
};

/** Follows the device from a reset (or reboot) back to full: first reply, boot states, SID token. */
async function followToFull(link, log, marks, since0) {
  let done = false;
  let replies = 0;
  let lastBoot = null;
  // The poll repeats the same reply every few ms: log only the first reply, boot-state changes,
  // and anything that is not a routine Ack.
  const quiet = (e) => (e.type === 'token' && e.name === 'Ack')
    || (e.type === 'reply' && replies >= 1)
    || (e.type === 'boot' && e.state === lastBoot);
  let lastReplyAt = null;
  attach(link, log, (e) => {
    if (e.type === 'reply') {
      replies += 1;
      // The longest silence between replies, i.e. the longest the main loop stopped serving commands.
      const now = since0();
      if (lastReplyAt != null && now - lastReplyAt > (marks.longestGap?.ms ?? 0)) {
        marks.longestGap = { ms: Math.round(now - lastReplyAt), from: lastReplyAt, to: now };
      }
      lastReplyAt = now;
    }
    if (e.type === 'boot') lastBoot = e.state;
    if (e.type === 'reply' && !e.minimal && marks.firstReply == null) marks.firstReply = since0();
    if (e.type === 'boot' && e.state === 'in progress' && marks.inProgress == null) marks.inProgress = since0();
    if (e.type === 'boot' && e.state === 'complete' && marks.complete == null) marks.complete = since0();
    if (e.type === 'token' && (e.name === 'GoodSid' || e.name === 'BadSid') && marks.sid == null) marks.sid = since0();
  }, quiet);
  const start = performance.now();
  while (!done && link.isOpen() && performance.now() - start < phaseTimeoutMs) {
    await link.write(tokenBytes(Token.Version));
    await sleep(pollMs);
    if (marks.complete != null && since0() - marks.complete >= settleMs) done = true;
  }
  await link.close();
}

async function serialRound(round) {
  const t0 = performance.now();
  let tReset = null;
  const log = (what) => write(`  +${String(since(t0)).padStart(8)} ms  ${what}`);
  const sinceReset = () => (tReset == null ? null : since(tReset));
  const marks = {};
  let fullFollow = null;
  const transientProbes = [];

  const watcher = watchPorts(log, (change, port) => {
    if (tReset == null) return;
    if (change === 'down' && port.image === 'minimal') marks.minimalGone ??= sinceReset();
    if (change === 'up' && port.image === 'minimal') {
      marks.transientUp ??= sinceReset();
      if (probeTransient) transientProbes.push(probeTransientPort(port.path, log, marks, sinceReset));
    }
    if (change === 'down' && port.image === 'minimal' && marks.transientUp != null) marks.transientDown ??= sinceReset();
    if (change === 'up' && port.image === 'full' && !fullFollow) {
      marks.fullUp = sinceReset();
      fullFollow = (async () => {
        const link = await openWithRetry(port.path, 10000, log);
        if (!link) return;
        marks.fullOpened = sinceReset();
        await followToFull(link, log, marks, sinceReset);
      })();
    }
  });
  await sleep(100);

  const full = watcher.ports().find((p) => p.image === 'full');
  if (!full) { await watcher.stop(); throw new Error('no full-firmware Teensy port found - is the TR in full, and is the API stopped?'); }

  write(`round ${round}: launch "${largeFile}" from ${full.path}`);
  const launchLink = await open(full.path);
  attach(launchLink, log);
  await sendLaunch(launchLink, Drive.SD, largeFile);
  const inMinimal = await waitUntil(() => watcher.ports().some((p) => p.image === 'minimal'), phaseTimeoutMs);
  await launchLink.close();
  if (!inMinimal) { await watcher.stop(); throw new Error('the TR never came up in minimal after the launch'); }

  const minimalPort = watcher.ports().find((p) => p.image === 'minimal');
  const minimalLink = await openWithRetry(minimalPort.path, 5000, log);
  let minimalAnswered = false;
  attach(minimalLink, log, (e) => { if (e.type === 'token' && e.name === 'FwMinimal') minimalAnswered = true; });
  await minimalLink.write(tokenBytes(Token.FwCheck));
  await waitUntil(() => minimalAnswered, 3000);
  log(minimalAnswered ? 'minimal answered the FW check' : 'minimal did not answer the FW check');
  await sleep(waitMs);

  log('--- reset sent from minimal: times below in the summary are from here ---');
  tReset = performance.now();
  await minimalLink.write(tokenBytes(Token.Reset));
  await waitUntil(() => !minimalLink.isOpen(), 3000);
  await minimalLink.close();

  await waitUntil(() => fullFollow != null, phaseTimeoutMs);
  if (fullFollow) await fullFollow;
  await Promise.all(transientProbes);
  await watcher.stop();
  return marks;
}

/** Opens a minimal port that appears during the boot back to full, asks for the version, and closes it. */
async function probeTransientPort(path, log, marks, sinceReset) {
  const link = await openWithRetry(path, 2000, log, 10);
  if (!link) { marks.transientOpen = 'never opened'; return; }
  marks.transientOpen = `opened at ${sinceReset()} ms`;
  attach(link, log, (e) => { if (e.type === 'reply') marks.transientAnswered = `${e.minimal ? 'minimal' : 'full'} reply at ${sinceReset()} ms`; });
  await link.write(tokenBytes(Token.Version));
  await waitUntil(() => !link.isOpen(), 1500);
  const closeError = await link.close();
  if (closeError) { log(`${path} close failed: ${closeError}`); marks.transientCloseError = closeError; }
}

async function tcpRound(round) {
  const t0 = performance.now();
  let tReset = null;
  const log = (what) => write(`  +${String(since(t0)).padStart(8)} ms  ${what}`);
  const sinceReset = () => (tReset == null ? null : since(tReset));
  const marks = {};

  write(`round ${round}: launch "${largeFile}" over ${tcpTarget}`);
  const launchLink = await open(tcpTarget);
  attach(launchLink, log);
  await sendLaunch(launchLink, Drive.SD, largeFile);
  await sleep(500);
  await launchLink.close();

  const connectMinimal = async () => {
    const start = performance.now();
    while (performance.now() - start < phaseTimeoutMs) {
      const link = await openWithRetry(tcpTarget, phaseTimeoutMs, log, 200);
      if (!link) return null;
      let minimal = false;
      attach(link, log, (e) => { if (e.type === 'token' && e.name === 'FwMinimal') minimal = true; });
      await link.write(tokenBytes(Token.FwCheck));
      if (await waitUntil(() => minimal, 1000)) return link;
      await link.close();
      await sleep(200);
    }
    return null;
  };
  const minimalLink = await connectMinimal();
  if (!minimalLink) throw new Error('the TR never answered in minimal over TCP after the launch');
  log('minimal answered the FW check');
  await sleep(waitMs);

  log('--- reset sent from minimal: times below in the summary are from here ---');
  tReset = performance.now();
  await minimalLink.write(tokenBytes(Token.Reset));
  await sleep(200);
  await minimalLink.close();

  const link = await openWithRetry(tcpTarget, phaseTimeoutMs, log, 200);
  if (!link) throw new Error('the TR never accepted a TCP connection after the reset');
  marks.fullOpened = sinceReset();
  await followToFull(link, log, marks, sinceReset);
  return marks;
}

const summaries = [];
for (let round = 1; round <= rounds; round++) {
  try {
    const marks = transport === 'serial' ? await serialRound(round) : await tcpRound(round);
    summaries.push(marks);
    write(`round ${round} summary (ms after the reset): ${JSON.stringify(marks)}`);
  } catch (err) {
    write(`round ${round} FAILED: ${err.message}`);
    summaries.push({ failed: err.message });
  }
  await sleep(3000);
}
write(`done: ${summaries.filter((s) => s.complete != null).length}/${rounds} rounds reached "Boot: complete"`);
