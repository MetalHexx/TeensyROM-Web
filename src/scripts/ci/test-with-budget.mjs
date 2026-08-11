#!/usr/bin/env node
// Wraps the CI unit-test Nx invocation with a wall-clock budget.
//
// Usage: node scripts/ci/test-with-budget.mjs [--budget-seconds 180] -- <nx args...>
//
// Clears .test-timings/, runs `pnpm exec nx <nx args...>`, measures the
// wall-clock time of that run only (not this script's setup/teardown),
// reads the per-project Vitest JSON reports written into .test-timings/,
// and prints a slowest-first timing table. Exits non-zero when either the
// underlying command fails or the run exceeds the budget.
import { spawn } from 'node:child_process';
import { readdir, readFile, rm, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const DEFAULT_BUDGET_SECONDS = 180;
export const TIMINGS_DIR = '.test-timings';

/**
 * Splits argv into the wrapper's own flags and the command to run after `--`.
 */
export function parseArgs(argv) {
  const separatorIndex = argv.indexOf('--');
  const flagArgs = separatorIndex === -1 ? argv : argv.slice(0, separatorIndex);
  const commandArgs = separatorIndex === -1 ? [] : argv.slice(separatorIndex + 1);

  let budgetSeconds;
  for (let i = 0; i < flagArgs.length; i++) {
    if (flagArgs[i] === '--budget-seconds') {
      const value = flagArgs[i + 1];
      if (value === undefined) {
        throw new Error('--budget-seconds requires a value');
      }
      budgetSeconds = Number(value);
      i++;
    }
  }

  if (commandArgs.length === 0) {
    throw new Error(
      'No command provided. Usage: test-with-budget.mjs [--budget-seconds N] -- <nx args...>'
    );
  }

  return { budgetSeconds, commandArgs };
}

/**
 * Resolves the effective budget: an explicit CLI flag wins, then
 * TEST_BUDGET_SECONDS, then the default. Throws on an unparsable override
 * so a typo fails loudly instead of silently falling back.
 */
export function resolveBudgetSeconds({ cliValue, envValue, defaultValue = DEFAULT_BUDGET_SECONDS }) {
  if (cliValue !== undefined) {
    if (Number.isNaN(cliValue)) {
      throw new Error('Invalid --budget-seconds value');
    }
    return cliValue;
  }
  if (envValue !== undefined && envValue !== '') {
    const parsed = Number(envValue);
    if (Number.isNaN(parsed)) {
      throw new Error('Invalid TEST_BUDGET_SECONDS value');
    }
    return parsed;
  }
  return defaultValue;
}

/**
 * Derives per-project duration and test count from the Vitest JSON reports
 * (resolved shape: outer `startTime`, `testResults[].endTime`, `numTotalTests`),
 * sorted slowest-first.
 */
export function aggregateTimings(reports) {
  return reports
    .map(({ project, report }) => {
      const testResults = report.testResults ?? [];
      const start = report.startTime ?? 0;
      const endTime = testResults.reduce((max, result) => Math.max(max, result.endTime ?? start), start);
      return {
        project,
        durationMs: Math.max(0, endTime - start),
        testCount: report.numTotalTests ?? 0,
      };
    })
    .sort((a, b) => b.durationMs - a.durationMs);
}

/**
 * Decides the wrapper's exit code. A non-zero exit code from the underlying
 * command always wins, so a failing suite fails the build regardless of
 * duration; only when the command succeeds does the budget get to fail it.
 */
export function decideOutcome({ exitCode, elapsedMs, budgetMs, timings }) {
  if (exitCode !== 0) {
    return { exitCode, overBudget: false, message: null };
  }
  if (elapsedMs > budgetMs) {
    const offenders = timings
      .slice(0, 3)
      .map((t) => `${t.project} (${(t.durationMs / 1000).toFixed(1)}s)`)
      .join(', ');
    const message =
      `Unit test step exceeded the ${(budgetMs / 1000).toFixed(0)}s budget: ` +
      `took ${(elapsedMs / 1000).toFixed(1)}s. Top offenders: ${offenders || 'none reported'}.`;
    return { exitCode: 1, overBudget: true, message };
  }
  return { exitCode: 0, overBudget: false, message: null };
}

function formatTable(timings) {
  const header = ['Project', 'Duration (s)', 'Tests'];
  const rows = timings.map((t) => [t.project, (t.durationMs / 1000).toFixed(2), String(t.testCount)]);
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
  const line = (cols) => cols.map((c, i) => c.padEnd(widths[i])).join('  ');
  return [line(header), widths.map((w) => '-'.repeat(w)).join('  '), ...rows.map(line)].join('\n');
}

async function readTimingReports(dir) {
  let entries;
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }

  const reports = [];
  for (const entry of entries) {
    if (!entry.endsWith('.json')) continue;
    const project = entry.slice(0, -'.json'.length);
    try {
      const content = await readFile(path.join(dir, entry), 'utf-8');
      reports.push({ project, report: JSON.parse(content) });
    } catch (error) {
      console.warn(`Could not read timing report for ${project}: ${error.message}`);
    }
  }
  return reports;
}

function runCommand(nxArgs) {
  return new Promise((resolve) => {
    // CI runs on ubuntu-latest, where `pnpm` spawns directly with no shell.
    // Windows can only resolve the `pnpm.cmd` shim through a shell; all args
    // here come from the workflow file or a developer's own CLI invocation,
    // never untrusted input, so shelling out on win32 is safe.
    const child = spawn('pnpm', ['exec', 'nx', ...nxArgs], {
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    child.on('close', (code) => resolve(code === null ? 1 : code));
  });
}

async function main() {
  const { budgetSeconds: cliBudget, commandArgs } = parseArgs(process.argv.slice(2));
  const budgetSeconds = resolveBudgetSeconds({
    cliValue: cliBudget,
    envValue: process.env.TEST_BUDGET_SECONDS,
  });
  const budgetMs = budgetSeconds * 1000;

  await rm(TIMINGS_DIR, { recursive: true, force: true });
  await mkdir(TIMINGS_DIR, { recursive: true });

  const start = Date.now();
  const exitCode = await runCommand(commandArgs);
  const elapsedMs = Date.now() - start;

  const reports = await readTimingReports(TIMINGS_DIR);
  const timings = aggregateTimings(reports);

  if (timings.length > 0) {
    console.log('\nPer-project test timings (slowest first):');
    console.log(formatTable(timings));
  }
  console.log(`\nUnit test step wall-clock: ${(elapsedMs / 1000).toFixed(1)}s (budget: ${budgetSeconds}s)`);

  const outcome = decideOutcome({ exitCode, elapsedMs, budgetMs, timings });
  if (outcome.message) {
    console.error(`\n${outcome.message}`);
  }
  process.exitCode = outcome.exitCode;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
