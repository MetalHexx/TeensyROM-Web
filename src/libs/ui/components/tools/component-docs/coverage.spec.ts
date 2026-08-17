import { CompodocCoverage } from './compodoc-source';
import { evaluateCoverage } from './coverage';

function coverage(files: CompodocCoverage['files']): CompodocCoverage {
  return { count: 47, status: 'medium', files };
}

function file(overrides: Partial<CompodocCoverage['files'][number]> = {}): CompodocCoverage['files'][number] {
  return {
    filePath: 'libs/ui/components/src/lib/card-layout/card-layout.component.ts',
    type: 'component',
    linktype: 'component',
    name: 'CardLayoutComponent',
    coveragePercent: 100,
    coverageCount: '5/5',
    status: 'high',
    ...overrides,
  };
}

describe('evaluateCoverage', () => {
  it('filters the whole-project files list to component and directive types', () => {
    const result = evaluateCoverage(
      coverage([file(), file({ filePath: 'b.ts', type: 'class', name: 'B', coveragePercent: 0, coverageCount: '0/3' })]),
      100,
    );

    expect(result.passing.map((entry) => entry.filePath)).toEqual([
      'libs/ui/components/src/lib/card-layout/card-layout.component.ts',
    ]);
    expect(result.below).toEqual([]);
  });

  it('passes a file that sits exactly at the threshold', () => {
    const result = evaluateCoverage(coverage([file({ coveragePercent: 80, coverageCount: '4/5' })]), 80);

    expect(result.ok).toBe(true);
    expect(result.below).toEqual([]);
  });

  it('flags a file below the threshold and fails the gate', () => {
    const result = evaluateCoverage(coverage([file({ coveragePercent: 79, coverageCount: '4/5' })]), 80);

    expect(result.ok).toBe(false);
    expect(result.below.map((entry) => entry.filePath)).toEqual([
      'libs/ui/components/src/lib/card-layout/card-layout.component.ts',
    ]);
  });

  it('reports the ungated global percentage straight from the whole-project count', () => {
    const result = evaluateCoverage(coverage([]), 100);

    expect(result.globalPercent).toBe(47);
  });

  it('is vacuously ok with no gated files', () => {
    const result = evaluateCoverage(undefined, 100);

    expect(result.ok).toBe(true);
    expect(result.gatedPercent).toBe(100);
    expect(result.globalPercent).toBe(0);
  });

  it('aggregates the gated percentage from summed documented/total counts, not an average of percentages', () => {
    const result = evaluateCoverage(
      coverage([
        file({ coveragePercent: 100, coverageCount: '5/5' }),
        file({ filePath: 'b.ts', type: 'directive', name: 'B', coveragePercent: 0, coverageCount: '0/5' }),
      ]),
      50,
    );

    expect(result.gatedPercent).toBe(50);
    expect(result.below.map((entry) => entry.filePath)).toEqual(['b.ts']);
  });
});
