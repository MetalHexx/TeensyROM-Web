import { CliDeps, filterBySearch, run } from './cli';
import { CompodocJson, CompodocUnavailableError } from './compodoc-source';
import { DocEntry } from './model';

function docEntry(overrides: Partial<DocEntry> = {}): DocEntry {
  return {
    kind: 'component',
    name: 'CardLayoutComponent',
    selector: 'lib-card-layout',
    summary: 'Wraps content in the glassy card chrome.',
    description: 'Wraps content in the glassy card chrome. Use it for panels.',
    narrative: 'Use it for panels.',
    props: [{ name: 'cardClass', type: 'string', required: false, description: '', kind: 'input' }],
    sourcePath: 'libs/ui/components/src/lib/card-layout/card-layout.component.ts',
    storyPath: 'libs/ui/components/src/lib/card-layout/card-layout.component.stories.ts',
    missing: [],
    ...overrides,
  };
}

const catalogFixture: DocEntry[] = [
  docEntry(),
  docEntry({
    kind: 'directive',
    name: 'TooltipDirective',
    selector: '[libTooltip]',
    summary: 'Shows a tooltip.',
    description: 'Shows a tooltip.',
    narrative: undefined,
    sourcePath: 'libs/ui/components/src/lib/tooltip/tooltip.directive.ts',
    storyPath: undefined,
    missing: ['story'],
  }),
];

function coveragePayload(overrides: Partial<CompodocJson> = {}): CompodocJson {
  return {
    components: [],
    directives: [],
    coverage: {
      count: 47,
      status: 'medium',
      files: [
        {
          filePath: 'libs/ui/components/src/lib/card-layout/card-layout.component.ts',
          type: 'component',
          linktype: 'component',
          name: 'CardLayoutComponent',
          coveragePercent: 60,
          coverageCount: '3/5',
          status: 'medium',
        },
      ],
    },
    ...overrides,
  };
}

function createDeps(overrides: Partial<CliDeps> = {}) {
  const outChunks: string[] = [];
  const errChunks: string[] = [];
  const deps: CliDeps = {
    loadStoryModule: async () => {
      throw new Error('the story loader should not be invoked when loadCatalog is stubbed');
    },
    loadCatalog: async () => catalogFixture,
    loadCompodocJson: async () => coveragePayload(),
    stdout: (chunk) => void outChunks.push(chunk),
    stderr: (chunk) => void errChunks.push(chunk),
    ...overrides,
  };
  return { deps, stdout: () => outChunks.join(''), stderr: () => errChunks.join('') };
}

describe('run — help and dispatch', () => {
  it('prints top-level help and exits 0 with no command', async () => {
    const { deps, stdout } = createDeps();

    expect(await run([], deps)).toBe(0);
    expect(stdout()).toContain('component-docs list');
  });

  it('prints top-level help for --help', async () => {
    const { deps, stdout } = createDeps();

    expect(await run(['--help'], deps)).toBe(0);
    expect(stdout()).toContain('Usage:');
  });

  it('exits 2 on an unknown command', async () => {
    const { deps, stderr } = createDeps();

    expect(await run(['frobnicate'], deps)).toBe(2);
    expect(stderr()).toContain("unknown command 'frobnicate'");
  });
});

describe('run list', () => {
  it('prints the full index and exits 0', async () => {
    const { deps, stdout } = createDeps();

    expect(await run(['list'], deps)).toBe(0);
    expect(stdout()).toContain('CardLayoutComponent');
    expect(stdout()).toContain('TooltipDirective');
  });

  it('narrows by --search across name, selector, and summary', async () => {
    const { deps, stdout } = createDeps();

    expect(await run(['list', '--search', 'card'], deps)).toBe(0);
    expect(stdout()).toContain('CardLayoutComponent');
    expect(stdout()).not.toContain('TooltipDirective');
  });

  it('requests the catalog without component narrative', async () => {
    const loadCatalog = vi.fn(async () => catalogFixture);
    const { deps } = createDeps({ loadCatalog });

    await run(['list'], deps);

    expect(loadCatalog).toHaveBeenCalledWith(expect.objectContaining({ includeComponentNarrative: false }));
  });

  it('exits 2 on an unknown flag', async () => {
    const { deps, stderr } = createDeps();

    expect(await run(['list', '--bogus'], deps)).toBe(2);
    expect(stderr()).toContain("unknown flag '--bogus'");
  });

  it('prints the list help without loading the catalog', async () => {
    const loadCatalog = vi.fn(async () => catalogFixture);
    const { deps, stdout } = createDeps({ loadCatalog });

    expect(await run(['list', '--help'], deps)).toBe(0);
    expect(stdout()).toContain('component-docs list');
    expect(loadCatalog).not.toHaveBeenCalled();
  });
});

describe('run get', () => {
  it('prints description, prop table, and paths, and exits 0', async () => {
    const { deps, stdout } = createDeps();

    expect(await run(['get', '--component-name', 'card-layout'], deps)).toBe(0);
    const output = stdout();
    expect(output).toContain('Wraps content in the glassy card chrome. Use it for panels.');
    expect(output).toContain('| Prop | Type | Default | Required | Description |');
    expect(output).toContain('libs/ui/components/src/lib/card-layout/card-layout.component.ts');
  });

  it('resolves the same entry for the class name and the selector', async () => {
    const byClassName = createDeps();
    const bySelector = createDeps();

    await run(['get', '--component-name', 'CardLayoutComponent'], byClassName.deps);
    await run(['get', '--component-name', 'lib-card-layout'], bySelector.deps);

    expect(byClassName.stdout()).toBe(bySelector.stdout());
  });

  it('exits 2 when --component-name is missing', async () => {
    const { deps, stderr } = createDeps();

    expect(await run(['get'], deps)).toBe(2);
    expect(stderr()).toContain('--component-name is required');
  });

  it('prints suggestions and exits 1 for an unknown name', async () => {
    const { deps, stderr } = createDeps();

    expect(await run(['get', '--component-name', 'cardlayut'], deps)).toBe(1);
    expect(stderr()).toContain('CardLayoutComponent');
  });

  it('prints the missing-story note for an entry with no story file', async () => {
    const { deps, stdout } = createDeps();

    expect(await run(['get', '--component-name', 'tooltip'], deps)).toBe(0);
    expect(stdout()).toContain('> No story file found — narrative unavailable.');
  });
});

describe('run coverage', () => {
  it('reports the gated percentage alongside the global figure and exits non-zero below threshold', async () => {
    const { deps, stdout } = createDeps();

    expect(await run(['coverage'], deps)).toBe(1);
    const output = stdout();
    expect(output).toContain('60%');
    expect(output).toContain('47%');
  });

  it('exits 0 when every gated file meets a lowered --min', async () => {
    const { deps } = createDeps();

    expect(await run(['coverage', '--min', '50'], deps)).toBe(0);
  });

  it('exits 2 on a non-numeric --min', async () => {
    const { deps, stderr } = createDeps();

    expect(await run(['coverage', '--min', 'high'], deps)).toBe(2);
    expect(stderr()).toContain('--min must be a number');
  });
});

describe('run — tool failures', () => {
  it('exits 2 when the compodoc binary is unavailable', async () => {
    const { deps, stderr } = createDeps({
      loadCompodocJson: async () => {
        throw new CompodocUnavailableError('compodoc could not run: bin is not installed.');
      },
    });

    expect(await run(['coverage'], deps)).toBe(2);
    expect(stderr()).toContain('compodoc could not run');
  });
});

describe('filterBySearch', () => {
  it('matches case-insensitively against name, selector, and summary', () => {
    expect(filterBySearch(catalogFixture, 'TOOLTIP').map((entry) => entry.name)).toEqual(['TooltipDirective']);
    expect(filterBySearch(catalogFixture, 'libtooltip').map((entry) => entry.name)).toEqual(['TooltipDirective']);
    expect(filterBySearch(catalogFixture, 'glassy').map((entry) => entry.name)).toEqual(['CardLayoutComponent']);
  });
});
