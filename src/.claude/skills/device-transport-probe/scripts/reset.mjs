// Gets the TR back to full firmware from wherever it is (full, minimal, a running cart), and waits
// until full answers a version request. The way out of a probe run that left the device in minimal.
//   node reset.mjs serial            (finds the Teensy port by USB product id)
//   node reset.mjs <COM4 | 192.168.1.37[:2112]>
import { open, decode, listTeensyPorts, tokenBytes, Token, isTcpTarget, sleep } from './lib/wire.mjs';

const target = process.argv[2];
if (!target) {
  console.error('usage: node reset.mjs serial | <COM4 | 192.168.1.37[:2112]>');
  process.exit(2);
}
const deadlineMs = 25000;

/** Opens `name`, asks for the version, and resolves the reply plus its "Boot:" state (or null) within `ms`. */
async function askVersion(name, ms = 1500) {
  let link;
  try { link = await open(name, { connectTimeoutMs: 1000 }); } catch { return null; }
  let reply = null;
  let boot = null;
  decode(link, (e) => {
    if (e.type === 'reply') reply = e;
    if (e.type === 'boot') boot = e.state;
  });
  await link.write(tokenBytes(Token.Version));
  const start = performance.now();
  while (!reply && performance.now() - start < ms) await sleep(20);
  if (reply && !reply.minimal) await sleep(100); // the Boot: line follows the UID line
  await link.close();
  return reply ? { ...reply, boot } : null;
}

let resetTarget = target;
if (target === 'serial') {
  const ports = await listTeensyPorts();
  const port = ports.find((p) => p.image === 'minimal') ?? ports.find((p) => p.image === 'full');
  if (!port) { console.error('no Teensy port found'); process.exit(1); }
  resetTarget = port.path;
}

const link = await open(resetTarget);
await link.write(tokenBytes(Token.Reset));
await sleep(200);
await link.close();
console.log(`reset sent on ${resetTarget}; waiting for full firmware to answer...`);

const start = performance.now();
while (performance.now() - start < deadlineMs) {
  const candidates = target === 'serial' || !isTcpTarget(target)
    ? (await listTeensyPorts()).filter((p) => p.image === 'full').map((p) => p.path)
    : [target];
  for (const name of candidates) {
    const reply = await askVersion(name);
    // Firmware with the boot flag must also report "complete"; older firmware has no Boot: line.
    if (reply && !reply.minimal && (reply.boot === null || reply.boot === 'complete')) {
      const boot = reply.boot ? ', Boot: complete' : ', no Boot: line (firmware without the flag)';
      console.log(`full firmware answering on ${name} after ${Math.round(performance.now() - start)} ms (UID ${reply.uid}, ${reply.fw}${boot})`);
      process.exit(0);
    }
  }
  await sleep(250);
}
console.error(`full firmware did not answer within ${deadlineMs} ms - check the device (power, SD, cable) before retrying`);
process.exit(1);
