import { CoverageResult } from './coverage';
import { DocEntry } from './model';
import { renderCoverage, renderGetEntry, renderList } from './render';

function entry(overrides: Partial<DocEntry> = {}): DocEntry {
  return {
    kind: 'component',
    name: 'CardLayoutComponent',
    selector: 'lib-card-layout',
    summary: 'Wraps content in the glassy card chrome.',
    props: [],
    missing: [],
    ...overrides,
  };
}

describe('renderList', () => {
  it('prints one line per entry carrying name, selector, summary, and source path', () => {
    const output = renderList([
      entry({ sourcePath: 'libs/ui/components/src/lib/card-layout/card-layout.component.ts' }),
    ]);

    expect(output).toContain('CardLayoutComponent');
    expect(output).toContain('lib-card-layout');
    expect(output).toContain('Wraps content in the glassy card chrome.');
    expect(output).toContain('libs/ui/components/src/lib/card-layout/card-layout.component.ts');
  });

  it('renders one line per entry and nothing more', () => {
    const output = renderList([entry({ name: 'A' }), entry({ name: 'B' })]);

    expect(output.trim().split('\n')).toHaveLength(2);
  });

  it('reports no matches without throwing on an empty list', () => {
    expect(renderList([])).toContain('No entries matched.');
  });
});

describe('renderGetEntry', () => {
  it('renders the prop table with the required column header', () => {
    const output = renderGetEntry(
      entry({ props: [{ name: 'cardClass', type: 'string', required: false, description: '', kind: 'input' }] }),
    );

    expect(output).toContain('| Prop | Type | Default | Required | Description |');
    expect(output).toContain('cardClass');
  });

  it('prints an explicit note when the story is missing instead of silently omitting the narrative', () => {
    const output = renderGetEntry(entry({ missing: ['story'], narrative: undefined }));

    expect(output).toContain('> No story file found — narrative unavailable.');
  });

  it('renders the narrative when the story was found', () => {
    const output = renderGetEntry(entry({ narrative: 'Use it for panels.' }));

    expect(output).toContain('Use it for panels.');
    expect(output).not.toContain('No story file found');
  });

  it('renders the example block only when compodoc surfaced one', () => {
    const withExample = renderGetEntry(entry({ example: '```html\n<lib-card-layout></lib-card-layout>\n```' }));
    const withoutExample = renderGetEntry(entry());

    expect(withExample).toContain('## Example');
    expect(withoutExample).not.toContain('## Example');
  });
});

describe('renderCoverage', () => {
  it('reports the gated percentage, the global percentage, and files below the threshold', () => {
    const result: CoverageResult = {
      min: 100,
      gatedPercent: 60,
      globalPercent: 47,
      passing: [],
      below: [{ filePath: 'libs/ui/components/src/lib/card-layout/card-layout.component.ts', name: 'A', coveragePercent: 60, coverageCount: '3/5' }],
      ok: false,
    };

    const output = renderCoverage(result);

    expect(output).toContain('60%');
    expect(output).toContain('47%');
    expect(output).toContain('libs/ui/components/src/lib/card-layout/card-layout.component.ts');
  });

  it('reports every file meeting the threshold with no below-threshold table', () => {
    const result: CoverageResult = { min: 100, gatedPercent: 100, globalPercent: 90, passing: [], below: [], ok: true };

    const output = renderCoverage(result);

    expect(output).toContain('All gated files meet the threshold.');
    expect(output).not.toContain('## Below threshold');
  });
});
