// Raw download probe, straight to a TeensyROM (engine stopped): does the board send the whole file?
// Usage: node download-probe.mjs <COM12 | 192.168.1.38> <device path> <local copy to compare> [pauseAtByte:pauseMs]
// Sends GetFile, then reads everything that comes back until 8 s of silence, logging when each part
// arrives: Ack, length, checksum, body progress, any gap over 200 ms, and what follows the body.
// Arriving bytes are copied into one buffer set aside up front, so the reader never slows as the file grows.
// pauseAtByte:pauseMs (serial only) stops reading for pauseMs once that many bytes have arrived: a computer
// that is briefly slow to read, on purpose.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { open, tokenBytes, since } from '../../device-transport-probe/scripts/lib/wire.mjs';

const GetFile = 0x64b0, SD = 1, SilenceMs = 8000;
const [target, devicePath, localPath, pauseArg] = process.argv.slice(2);
if (!target || !devicePath || !localPath) {
  console.error('usage: node download-probe.mjs <COM12 | ip> <device path> <local copy> [pauseAtByte:pauseMs]');
  process.exit(2);
}
const expected = fs.readFileSync(localPath);
const [pauseAt, pauseMs] = pauseArg ? pauseArg.split(':').map(Number) : [0, 0];

const t0 = performance.now();
const log = (msg) => console.log(`${since(t0).toFixed(1).padStart(8)} ms  ${msg}`);
const hex = (buf) => [...buf].map((b) => b.toString(16).padStart(2, '0')).join(' ');
const text = (buf) => [...buf].map((b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : '.')).join('');

// With a pause asked for, open the serial port here so it can be paused; wire.mjs does not expose that.
async function openPausable(portName) {
  const tools = new URL('../../device-transport-probe/tools/package.json', import.meta.url);
  const { SerialPort } = createRequire(tools)('serialport');
  const port = new SerialPort({ path: portName, baudRate: 115200, autoOpen: false });
  await new Promise((resolve, reject) => port.open((err) => (err ? reject(err) : resolve())));
  await new Promise((resolve) => port.set({ dtr: true }, () => resolve()));
  return {
    write: (buf) => new Promise((resolve) => port.write(buf, () => port.drain(() => resolve()))),
    close: () => new Promise((resolve) => (port.isOpen ? port.close((err) => resolve(err ? err.message : null)) : resolve(null))),
    onData: (fn) => port.on('data', fn),
    pause: () => port.pause(),
    resume: () => port.resume(),
  };
}

const link = pauseMs > 0 ? await openPausable(target) : await open(target);
const all = Buffer.alloc(expected.length + 65536);
let n = 0;
let overflow = 0;
let paused = false;
let lastByteAt = performance.now();
const gaps = [];
link.onData((chunk) => {
  const now = performance.now();
  if (n > 0 && now - lastByteAt > 200) gaps.push([Math.round(now - lastByteAt), n]);
  lastByteAt = now;
  const room = all.length - n;
  if (chunk.length > room) overflow += chunk.length - room;
  n += chunk.copy(all, n, 0, Math.min(chunk.length, room));
  if (pauseMs > 0 && !paused && n >= pauseAt) {
    paused = true;
    link.pause();
    log(`   pausing the reader for ${pauseMs} ms at byte ${n}`);
    setTimeout(() => { log('   resuming the reader'); link.resume(); }, pauseMs);
  }
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(pred, timeoutMs) {
  const end = performance.now() + timeoutMs;
  while (performance.now() < end) { if (pred()) return true; await wait(5); }
  return false;
}

const summary = { target, devicePath, expectedLength: expected.length };
try {
  log('-> GetFile token');
  await link.write(tokenBytes(GetFile));
  if (!(await until(() => n >= 2, 3000))) throw new Error('no reply to the GetFile token');
  log(`<- ${hex(all.subarray(0, 2))} (expect cc 64)`);
  await link.write(Buffer.concat([Buffer.from([SD]), Buffer.from(devicePath, 'latin1'), Buffer.from([0])]));
  log(`-> storage SD + ${devicePath}`);
  if (!(await until(() => n >= 4, 5000))) throw new Error('no reply to the path');
  log(`<- ${hex(all.subarray(2, 4))} (expect cc 64)`);
  if (!(await until(() => n >= 8, 5000))) throw new Error('no length');
  const length = all.readUInt32LE(4);
  log(`<- length ${length}`);
  if (!(await until(() => n >= 12, 20000))) throw new Error('no checksum');
  log(`<- checksum ${all.readUInt32LE(8)}`);
  summary.length = length;
  const bodyStart = performance.now();

  // Read until the line goes quiet; the wait only sleeps, so the data handler never competes with it.
  let reportedDoneAt = 0;
  while (performance.now() - lastByteAt < SilenceMs) {
    if (!reportedDoneAt && n >= 12 + length) { reportedDoneAt = performance.now(); log(`   body complete after ${(reportedDoneAt - bodyStart).toFixed(0)} ms`); }
    await wait(50);
  }
  for (const [ms, at] of gaps) log(`   gap of ${ms} ms before byte ${at}`);

  const body = all.subarray(12, Math.min(n, 12 + length));
  const tail = all.subarray(12 + length, Math.max(n, 12 + length));
  summary.totalReceived = n + overflow;
  summary.bodyReceived = body.length;
  summary.missing = 12 + length + 2 - (n + overflow);
  let firstMismatch = -1;
  for (let i = 0; i < body.length; i++) if (body[i] !== expected[i]) { firstMismatch = i; break; }
  summary.firstMismatch = firstMismatch;
  summary.bodyComplete = body.length === length;
  summary.bodyMatches = summary.bodyComplete && firstMismatch === -1;
  summary.after = hex(tail.subarray(0, 16));
  log(`body ${body.length}/${length}, first mismatch at ${firstMismatch}, then ${tail.length} more bytes: ${hex(tail.subarray(0, 16))}`);
  if (firstMismatch >= 0) {
    const from = Math.max(0, firstMismatch - 4);
    log(`   at the mismatch: ${hex(body.subarray(from, from + 48))}`);
  }
  log(`   last 64 bytes as text: ${text(all.subarray(Math.max(0, n - 64), n))}`);
} catch (err) {
  log(`ERROR: ${err.message} (received ${n} bytes)`);
  summary.error = err.message;
  summary.totalReceived = n;
  log(`   last 64 bytes as text: ${text(all.subarray(Math.max(0, n - 64), n))}`);
} finally {
  const closeErr = await link.close();
  if (closeErr) log(`close: ${closeErr}`);
  console.log(`SUMMARY ${JSON.stringify(summary)}`);
}
