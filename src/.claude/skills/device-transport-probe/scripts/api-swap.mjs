// The swap routine through the API: launch a large cart (the TR reboots into minimal), wait, then launch
// a SID, which makes the API bring the device back to full before it can launch. Prints which transport
// the API is actually using first - the API keeps TCP whenever the device answers on both.
//   node api-swap.mjs --device 19277260 [--api http://localhost:213] [--rounds 10] [--wait 5000]
//        [--large "/games/Large/706k The Secret of Monkey Island (D42) [EasyFlash].crt"]
//        [--sid "/music/DEMOS/M-R/Melody.sid"] [--out file]
// A failed round waits 30 s, resets, and carries on, so one failure does not hide the rest.
import fs from 'node:fs';

const argv = process.argv.slice(2);
const option = (name, fallback) => { const i = argv.indexOf(name); return i < 0 ? fallback : argv[i + 1]; };
const api = option('--api', 'http://localhost:213');
const deviceId = option('--device', null);
const rounds = Number(option('--rounds', 10));
const waitMs = Number(option('--wait', 5000));
const largeFile = option('--large', '/games/Large/706k The Secret of Monkey Island (D42) [EasyFlash].crt');
const sidFile = option('--sid', '/music/DEMOS/M-R/Melody.sid');
const outFile = option('--out', null);
if (!deviceId) {
  console.error('usage: node api-swap.mjs --device <chipId> [--api url] [--rounds N] [--wait ms] [--large path] [--sid path] [--out file]');
  process.exit(2);
}
const write = (text) => { console.log(text); if (outFile) fs.appendFileSync(outFile, `${text}\n`); };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function call(method, path) {
  const start = performance.now();
  try {
    const response = await fetch(`${api}${path}`, { method, signal: AbortSignal.timeout(120000) });
    const body = await response.text();
    return { status: response.status, ms: Math.round(performance.now() - start), body };
  } catch (err) {
    return { status: 0, ms: Math.round(performance.now() - start), body: err.message };
  }
}
const launch = (file) => call('POST', `/api/devices/${deviceId}/storage/SD/launch?FilePath=${encodeURIComponent(file)}`);
const brief = (r) => (r.status === 200 ? '' : `  ${r.body.replace(/\s+/g, ' ').slice(0, 200)}`);

const scan = await call('GET', '/api/devices/?FullScan=true');
if (scan.status !== 200) { write(`discovery failed (${scan.status}): ${scan.body.slice(0, 200)}`); process.exit(1); }
const device = (JSON.parse(scan.body).devices ?? []).find((d) => d.deviceId === deviceId);
if (!device) { write(`device ${deviceId} not found by discovery`); process.exit(1); }
write(`device ${deviceId} on ${device.connectionType} (${device.comPort}), ${device.isMinimalFirmware ? 'minimal' : 'full'} firmware`);

const sidTimes = [];
let passed = 0;
for (let round = 1; round <= rounds; round++) {
  const large = await launch(largeFile);
  write(`round ${round}: large -> ${large.status} in ${large.ms} ms${brief(large)}`);
  await sleep(waitMs);
  const sid = await launch(sidFile);
  write(`round ${round}: sid   -> ${sid.status} in ${sid.ms} ms${brief(sid)}`);
  if (large.status === 200 && sid.status === 200) {
    passed += 1;
    sidTimes.push(sid.ms);
  } else {
    write(`round ${round}: FAIL - waiting 30 s, then reset`);
    await sleep(30000);
    const reset = await call('PUT', `/api/devices/${deviceId}/reset`);
    write(`round ${round}: reset -> ${reset.status} in ${reset.ms} ms${brief(reset)}`);
  }
  await sleep(8000);
}
sidTimes.sort((a, b) => a - b);
const median = sidTimes.length ? sidTimes[Math.floor(sidTimes.length / 2)] : null;
write(`done: ${passed}/${rounds} rounds passed on ${device.connectionType}`
  + (sidTimes.length ? `; SID step min ${sidTimes[0]} / median ${median} / max ${sidTimes[sidTimes.length - 1]} ms` : ''));
process.exit(passed === rounds ? 0 : 1);
