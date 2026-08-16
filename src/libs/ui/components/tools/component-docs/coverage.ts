import { CompodocCoverage } from './compodoc-source';

/** compodoc emits a percentage per file; only these two kinds are this library's responsibility. */
const GATED_TYPES = new Set(['component', 'directive']);

/** Documentation-coverage gate over the compodoc `coverage` block. */
export const DEFAULT_MIN_COVERAGE = 100;

export type CoverageFile = {
  filePath: string;
  name: string;
  coveragePercent: number;
  coverageCount: string;
};

export type CoverageResult = {
  min: number;
  /** Aggregate percentage across component/directive files only — the population this gate scores. */
  gatedPercent: number;
  /** compodoc's whole-project percentage; spans far more than this library and is never gated on. */
  globalPercent: number;
  passing: CoverageFile[];
  /** Component/directive files below `min`. */
  below: CoverageFile[];
  ok: boolean;
};

/**
 * Filter the compodoc `coverage` block to component/directive files and assert every one is at
 * or above `min`. A file exactly at `min` passes.
 */
export function evaluateCoverage(coverage: CompodocCoverage | undefined, min: number): CoverageResult {
  const files: CoverageFile[] = (coverage?.files ?? [])
    .filter((file) => GATED_TYPES.has(file.type))
    .map((file) => ({
      filePath: file.filePath,
      name: file.name,
      coveragePercent: file.coveragePercent,
      coverageCount: file.coverageCount,
    }));

  const passing = files.filter((file) => file.coveragePercent >= min);
  const below = files.filter((file) => file.coveragePercent < min);

  return {
    min,
    gatedPercent: aggregatePercent(files),
    globalPercent: coverage?.count ?? 0,
    passing,
    below,
    ok: below.length === 0,
  };
}

/**
 * Sum the documented/total counts compodoc reports per file (`'3/5'`) rather than averaging
 * per-file percentages, so a large undocumented file weighs more than a small one.
 */
function aggregatePercent(files: readonly CoverageFile[]): number {
  const totals = files.reduce(
    (running, file) => {
      const parsed = parseCoverageCount(file.coverageCount);
      return { documented: running.documented + parsed.documented, total: running.total + parsed.total };
    },
    { documented: 0, total: 0 },
  );

  return totals.total === 0 ? 100 : Math.round((totals.documented / totals.total) * 100);
}

function parseCoverageCount(coverageCount: string): { documented: number; total: number } {
  const match = /^(\d+)\/(\d+)$/.exec(coverageCount);
  if (match === null) {
    return { documented: 0, total: 0 };
  }
  return { documented: Number(match[1]), total: Number(match[2]) };
}
