// Downloads one device file through the engine (trom file download) N times, compares each copy with the
// local original, and prints the engine log lines that explain a slow or failed run.
// Usage: node download-loop.mjs --device TR-1 --path /tr-fix-TR-1/big.crt --local <original> [--runs 10]
//        [--out <folder for the copies>] [--trom <path to trom>]
// From Git Bash, prefix the command with MSYS_NO_PATHCONV=1, or --path /x/y arrives as a Windows path.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
if (!args.device || !args.path || !args.local) {
  console.error('usage: node download-loop.mjs --device <name> --path <device file> --local <original> [--runs 10] [--out <folder>] [--trom <path>]');
  process.exit(2);
}

const trom = args.trom ?? 'trom';
const runs = Number(args.runs ?? 10);
const out = args.out ?? fs.mkdtempSync(path.join(os.tmpdir(), 'download-loop-'));
const sha = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const expected = sha(args.local);
const fileName = path.posix.basename(args.path);

// Remember where the engine's log stands, so only this run's lines are read back. An engine the first
// download starts writes a new log file, which is then read whole.
const engineLog = () => {
  const status = spawnSync(trom, ['engine', 'status', '--json'], { encoding: 'utf8' });
  try { return JSON.parse(status.stdout).logFile ?? null; } catch { return null; }
};
const logBefore = engineLog();
const logOffset = logBefore && fs.existsSync(logBefore) ? fs.statSync(logBefore).size : 0;

let whole = 0;
for (let run = 1; run <= runs; run++) {
  const to = path.join(out, `run-${run}`);
  fs.rmSync(to, { recursive: true, force: true });
  const started = performance.now();
  const result = spawnSync(trom, ['file', 'download', args.path, '--device', args.device, '--to', to], { encoding: 'utf8' });
  const seconds = ((performance.now() - started) / 1000).toFixed(1);
  const copy = path.join(to, fileName);
  const matches = fs.existsSync(copy) && sha(copy) === expected;
  if (matches) whole++;
  const said = `${result.stdout}${result.stderr}`.replace(/\s+/g, ' ').trim();
  console.log(`run ${String(run).padStart(2)}  ${seconds.padStart(5)} s  ${matches ? 'match' : 'MISMATCH'}  ${said}`);
}
console.log(`TOTAL ${whole}/${runs} whole (copies in ${out})`);

// The engine writes its log a moment after a download returns: read until every run's completion line is
// there, or 5 s pass.
const logAfter = engineLog();
if (logAfter && fs.existsSync(logAfter)) {
  const wanted = /GetFileCommand Completed|arrived \d+ bytes short|Read \d+ of \d+ bytes|DeviceRecovery:|Internal Error/;
  const readLines = () => fs.readFileSync(logAfter, 'utf8').slice(logAfter === logBefore ? logOffset : 0)
    .split(/\r?\n/).filter((line) => wanted.test(line));
  let lines = readLines();
  for (let waited = 0; waited < 5000 && lines.filter((line) => line.includes('GetFileCommand Completed')).length < runs; waited += 250) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    lines = readLines();
  }
  console.log(`\nEngine log (${logAfter}):`);
  for (const line of lines) console.log(`  ${line}`);
}
