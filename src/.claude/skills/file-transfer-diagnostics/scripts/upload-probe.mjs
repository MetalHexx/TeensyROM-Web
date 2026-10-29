// Raw upload probe, straight to a TeensyROM (engine stopped): what the firmware does with a broken upload.
// Usage: node upload-probe.mjs <COM12 | 192.168.1.37> <stall | window | checksum>
//   stall    - announce 1000 bytes, send 100, pause 700 ms, send the other 900 as VersionInfo tokens
//   window   - announce 1000 bytes, send 100, stop; version at Fail+500 ms and again at Fail+2500 ms
//   checksum - announce 1000 bytes with a wrong checksum, send all 1000
// Every test ends with a DeleteFile of its path: Ack means a partial file was left on the SD card.
import { open, decode, tokenBytes, sleep, since } from '../../device-transport-probe/scripts/lib/wire.mjs';

const PostFile = 0x64bb, DeleteFile = 0x64cf, Version = 0x6476, SD = 1;
const [target, test] = process.argv.slice(2);
if (!target || !['stall', 'window', 'checksum'].includes(test)) {
  console.error('usage: node upload-probe.mjs <COM12 | ip> <stall | window | checksum>');
  process.exit(2);
}

const t0 = performance.now();
const events = [];
const log = (msg) => console.log(`${since(t0).toFixed(1).padStart(8)} ms  ${msg}`);
const link = await open(target);
decode(link, (ev) => {
  events.push({ t: since(t0), ...ev });
  if (ev.type === 'token') log(`<- ${ev.name}`);
  else if (ev.type === 'text') log(`<- "${ev.text}"`);
});

const be = (value, bytes) => Buffer.from(Array.from({ length: bytes }, (_, i) => (value >> (8 * (bytes - 1 - i))) & 0xff));
const nul = (s) => Buffer.concat([Buffer.from(s, 'latin1'), Buffer.from([0])]);
const repliesSince = (i) => events.slice(i).filter((e) => e.type === 'reply').length;

async function waitToken(fromIndex, timeoutMs) {
  const end = performance.now() + timeoutMs;
  while (performance.now() < end) {
    const hit = events.slice(fromIndex).find((e) => e.type === 'token');
    if (hit) return hit;
    await sleep(10);
  }
  return null;
}

async function version(label, windowMs = 1500) {
  const i = events.length;
  log(`-> VersionInfo (${label})`);
  await link.write(tokenBytes(Version));
  await sleep(windowMs);
  const n = repliesSince(i);
  log(`   ${label}: ${n} version repl${n === 1 ? 'y' : 'ies'}`);
  return n;
}

async function header(length, checksum, path) {
  let i = events.length;
  log(`-> PostFile ${path}, ${length} bytes`);
  await link.write(tokenBytes(PostFile));
  if ((await waitToken(i, 2000))?.name !== 'Ack') throw new Error('no Ack for the PostFile token');
  i = events.length;
  await link.write(Buffer.concat([be(length, 4), be(checksum, 2), be(SD, 1), nul(path)]));
  if ((await waitToken(i, 3000))?.name !== 'Ack') throw new Error('no Ack for the header');
}

async function partialFileCheck(path) {
  let i = events.length;
  log(`-> DeleteFile ${path} (was a partial file left?)`);
  await link.write(tokenBytes(DeleteFile));
  if ((await waitToken(i, 2000))?.name !== 'Ack') { log('   no Ack for the DeleteFile token'); return 'unknown'; }
  i = events.length;
  await link.write(Buffer.concat([be(SD, 1), nul(path)]));
  const reply = await waitToken(i, 3000);
  await sleep(200);
  const verdict = reply?.name === 'Ack' ? 'PARTIAL FILE WAS LEFT (now deleted)' : reply?.name === 'Fail' ? 'no file left' : 'no answer';
  log(`   ${verdict}`);
  return verdict;
}

const path = `/tr-probe/${test}-${Date.now()}.bin`;
const body100 = Buffer.alloc(100, 0x41);
const summary = { target, test };

try {
  summary.preamble = await version('preamble');

  if (test === 'stall') {
    const rest = Buffer.alloc(900);
    for (let i = 0; i < 900; i += 2) { rest[i] = 0x64; rest[i + 1] = 0x76; }
    const sum = [...body100, ...rest].reduce((a, b) => a + b, 0) & 0xffff;
    await header(1000, sum, path);
    await link.write(body100);
    log('-> 100 bytes, then pausing 700 ms');
    await sleep(700);
    const i = events.length;
    await link.write(rest);
    log('-> other 900 bytes (450 VersionInfo tokens)');
    await sleep(4000);
    summary.versionRepliesFromLeftover = repliesSince(i);
    log(`   leftover bytes produced ${summary.versionRepliesFromLeftover} version replies`);
    summary.nextCommand = await version('next command');
  }

  if (test === 'window') {
    await header(1000, 0, path);
    const i = events.length;
    await link.write(body100);
    log('-> 100 bytes, then nothing');
    const fail = await waitToken(i, 3000);
    if (fail?.name !== 'Fail') throw new Error(`expected Fail after the stall, got ${fail?.name ?? 'nothing'}`);
    const tFail = performance.now();
    await sleep(Math.max(0, 500 - (performance.now() - tFail)));
    summary.at500ms = await version('Fail+500 ms', 1200);
    await sleep(Math.max(0, 2500 - (performance.now() - tFail)));
    summary.at2500ms = await version('Fail+2500 ms', 1500);
  }

  if (test === 'checksum') {
    const body = Buffer.alloc(1000, 0x41);
    const wrong = ((body.length * 0x41) + 1) & 0xffff;
    await header(1000, wrong, path);
    const i = events.length;
    await link.write(body);
    log('-> 1000 bytes with a wrong checksum');
    summary.reply = (await waitToken(i, 3000))?.name ?? 'nothing';
    await sleep(300);
  }

  summary.partialFile = await partialFileCheck(path);
} catch (err) {
  log(`ERROR: ${err.message}`);
  summary.error = err.message;
} finally {
  await link.close();
  console.log(`SUMMARY ${JSON.stringify(summary)}`);
}
