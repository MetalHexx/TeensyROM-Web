import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateTimings,
  decideOutcome,
  resolveBudgetSeconds,
  parseArgs,
} from './test-with-budget.mjs';

test('decideOutcome propagates a non-zero exit code even when well under budget', () => {
  const outcome = decideOutcome({ exitCode: 1, elapsedMs: 5_000, budgetMs: 180_000, timings: [] });

  assert.equal(outcome.exitCode, 1);
  assert.equal(outcome.overBudget, false);
});

test('decideOutcome succeeds when the command passes and stays under budget', () => {
  const outcome = decideOutcome({ exitCode: 0, elapsedMs: 100_000, budgetMs: 180_000, timings: [] });

  assert.equal(outcome.exitCode, 0);
  assert.equal(outcome.overBudget, false);
  assert.equal(outcome.message, null);
});

test('decideOutcome fails and names the top offenders when the command passes but exceeds budget', () => {
  const timings = [
    { project: 'slow-lib', durationMs: 120_000, testCount: 10 },
    { project: 'medium-lib', durationMs: 80_000, testCount: 5 },
  ];

  const outcome = decideOutcome({ exitCode: 0, elapsedMs: 200_000, budgetMs: 180_000, timings });

  assert.equal(outcome.exitCode, 1);
  assert.equal(outcome.overBudget, true);
  assert.match(outcome.message, /slow-lib/);
  assert.match(outcome.message, /medium-lib/);
});

test('aggregateTimings derives duration from the outer startTime and the max testResults endTime, sorted slowest-first', () => {
  const reports = [
    {
      project: 'fast-lib',
      report: {
        numTotalTests: 3,
        startTime: 1_000,
        testResults: [{ startTime: 1_000, endTime: 1_500 }],
      },
    },
    {
      project: 'slow-lib',
      report: {
        numTotalTests: 7,
        startTime: 2_000,
        testResults: [
          { startTime: 2_000, endTime: 4_000 },
          { startTime: 2_500, endTime: 9_000 },
        ],
      },
    },
  ];

  const timings = aggregateTimings(reports);

  assert.deepEqual(
    timings.map((t) => t.project),
    ['slow-lib', 'fast-lib']
  );
  assert.equal(timings[0].durationMs, 7_000);
  assert.equal(timings[0].testCount, 7);
  assert.equal(timings[1].durationMs, 500);
});

test('aggregateTimings tolerates a report with no test results', () => {
  const timings = aggregateTimings([
    { project: 'empty-lib', report: { numTotalTests: 0, startTime: 5_000, testResults: [] } },
  ]);

  assert.equal(timings[0].durationMs, 0);
  assert.equal(timings[0].testCount, 0);
});

test('resolveBudgetSeconds prefers the CLI value over the environment and default', () => {
  const budget = resolveBudgetSeconds({ cliValue: 90, envValue: '300' });

  assert.equal(budget, 90);
});

test('resolveBudgetSeconds falls back to TEST_BUDGET_SECONDS when no CLI value is given', () => {
  const budget = resolveBudgetSeconds({ cliValue: undefined, envValue: '240' });

  assert.equal(budget, 240);
});

test('resolveBudgetSeconds falls back to the default when neither CLI nor env is set', () => {
  const budget = resolveBudgetSeconds({ cliValue: undefined, envValue: undefined });

  assert.equal(budget, 180);
});

test('resolveBudgetSeconds rejects an unparsable override instead of silently ignoring it', () => {
  assert.throws(() => resolveBudgetSeconds({ cliValue: undefined, envValue: 'not-a-number' }));
});

test('parseArgs splits wrapper flags from the nx command after --', () => {
  const { budgetSeconds, commandArgs } = parseArgs([
    '--budget-seconds',
    '90',
    '--',
    'affected',
    '--target=test',
  ]);

  assert.equal(budgetSeconds, 90);
  assert.deepEqual(commandArgs, ['affected', '--target=test']);
});

test('parseArgs requires a command after --', () => {
  assert.throws(() => parseArgs(['--budget-seconds', '90']));
});
