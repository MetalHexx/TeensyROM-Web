// Zero-gap reset -> launch through the API: PUT /reset immediately followed by a SID launch, with no
// pause between them, to prove a command lands safely on the very edge of the reset primitive's own
// boot wait rather than racing it. A round passes only when both calls return 200 - the launch answers
// 200 only once the firmware's GoodSIDToken has been seen, so a 200 here is the boot-complete wait
// actually holding.
//   node reset-launch.mjs --device 19277260 [--rounds 10] [--api http://localhost:213]
//        [--sid "/music/DEMOS/M-R/Melody.sid"] [--out file]
import fs from 'node:fs';

const argv = process.argv.slice(2);
const option = (name, fallback) => { const i = argv.indexOf(name); return i < 0 ? fallback : argv[i + 1]; };
const api = option('--api', 'http://localhost:213');
const deviceId = option('--device', null);
const rounds = Number(option('--rounds', 10));
const sidFile = option('--sid', '/music/DEMOS/M-R/Melody.sid');
const outFile = option('--out', null);
if (!deviceId) {
  console.error('usage: node reset-launch.mjs --device <chipId> [--api url] [--rounds N] [--sid path] [--out file]');
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
const brief = (r) => (r.status === 200 ? '' : `  ${r.body.replace(/\s+/g, ' ').slice(0, 200)}`);

let passed = 0;
for (let round = 1; round <= rounds; round++) {
  const reset = await call('PUT', `/api/devices/${deviceId}/reset`);
  write(`round ${round}: reset -> ${reset.status} in ${reset.ms} ms${brief(reset)}`);

  const launch = await call('POST', `/api/devices/${deviceId}/storage/SD/launch?FilePath=${encodeURIComponent(sidFile)}`);
  write(`round ${round}: launch -> ${launch.status} in ${launch.ms} ms${brief(launch)}`);

  if (reset.status === 200 && launch.status === 200) {
    passed += 1;
  } else {
    write(`round ${round}: FAIL`);
  }
  if (round < rounds) await sleep(3000);
}
write(`done ${passed}/${rounds}`);
process.exit(passed === rounds ? 0 : 1);
