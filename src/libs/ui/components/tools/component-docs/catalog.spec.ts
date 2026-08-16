import { CatalogOptions, loadCatalog } from './catalog';
import { DocEntry } from './model';
import { SYSTEMS_DIRECTORY } from './story-source';
import { compodocPayload } from './__fixtures__/compodoc-payload';
import {
  animationChainingSystemMeta,
  annotatedCardLayoutMeta,
  cardLayoutMeta,
  storyModule,
  tooltipMeta,
} from './__fixtures__/story-metas';

const SYSTEM_STORY = `${SYSTEMS_DIRECTORY}/animation-chaining.stories.ts`;

const metaByStoryPath: Record<string, Record<string, unknown>> = {
  './src/lib/card-layout/card-layout.component.stories.ts': storyModule(annotatedCardLayoutMeta),
  './src/lib/tooltip/tooltip.directive.stories.ts': storyModule(tooltipMeta),
  './src/lib/systems/animation-chaining.stories.ts': storyModule(animationChainingSystemMeta),
};

/** Every story file in the fixture payload except the one for LoadingTextComponent. */
const presentStories = new Set([
  'libs/ui/components/src/lib/card-layout/card-layout.component.stories.ts',
  'libs/ui/components/src/lib/tooltip/tooltip.directive.stories.ts',
]);

function catalogOptions(overrides: Partial<CatalogOptions> = {}): CatalogOptions {
  return {
    includeComponentNarrative: true,
    loadStoryModule: async (path) => {
      const module = metaByStoryPath[path];
      if (module === undefined) {
        throw new Error(`unexpected story path ${path}`);
      }
      return module;
    },
    loadPayload: async () => compodocPayload,
    storyExists: async (storyPath) => presentStories.has(storyPath),
    findSystemStoryPaths: async () => [SYSTEM_STORY],
    warn: () => undefined,
    ...overrides,
  };
}

function byName(entries: DocEntry[], name: string): DocEntry | undefined {
  return entries.find((entry) => entry.name === name);
}

describe('loadCatalog', () => {
  it('emits one entry per documented unit plus the discovered systems', async () => {
    const entries = await loadCatalog(catalogOptions());

    expect(entries.map((entry) => entry.name)).toEqual([
      'CardLayoutComponent',
      'LoadingTextComponent',
      'TooltipDirective',
      'Animation Chaining',
    ]);
  });

  it('layers the story narrative and title over the compodoc entry', async () => {
    const cardLayout = byName(await loadCatalog(catalogOptions()), 'CardLayoutComponent');

    expect(cardLayout?.storyTitle).toBe('Layout/Card Layout');
    expect(cardLayout?.narrative).toBe('Wraps content in the glassy card chrome. Use it for panels.');
    expect(cardLayout?.storyPath).toBe(
      'libs/ui/components/src/lib/card-layout/card-layout.component.stories.ts',
    );
    expect(cardLayout?.missing).toEqual([]);
  });

  it('prefers an argTypes description, falls back to the compodoc one, then to empty', async () => {
    const props = byName(await loadCatalog(catalogOptions()), 'CardLayoutComponent')?.props ?? [];

    expect(props.find((prop) => prop.name === 'glassyIntensity')?.description).toBe(
      'Story-authored intensity guidance.',
    );
    expect(props.find((prop) => prop.name === 'cardClass')?.description).toBe('');
  });

  it('keeps the compodoc description when the story leaves the argType blank', async () => {
    const tooltip = byName(await loadCatalog(catalogOptions()), 'TooltipDirective');

    expect(tooltip?.props.find((prop) => prop.name === 'libTooltip')?.description).toBe(
      'Tooltip configuration (optional - no tooltip shown if undefined)',
    );
  });

  it('marks a unit with no story file as missing its story but keeps its compodoc data', async () => {
    const loadingText = byName(await loadCatalog(catalogOptions()), 'LoadingTextComponent');

    expect(loadingText?.missing).toEqual(['story']);
    expect(loadingText?.sourcePath).toBe('libs/ui/components/src/lib/loading-text/loading-text.component.ts');
    expect(loadingText?.storyPath).toBeUndefined();
  });

  it('warns and keeps going when one story module fails to evaluate', async () => {
    const warnings: string[] = [];
    const entries = await loadCatalog(
      catalogOptions({
        warn: (message) => void warnings.push(message),
        loadStoryModule: async (path) => {
          if (path.includes('card-layout')) {
            throw new Error('transform failed');
          }
          const module = metaByStoryPath[path];
          if (module === undefined) {
            throw new Error(`unexpected story path ${path}`);
          }
          return module;
        },
      }),
    );

    const cardLayout = byName(entries, 'CardLayoutComponent');
    expect(cardLayout?.missing).toEqual(['story']);
    expect(cardLayout?.props).toHaveLength(4);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('transform failed');
    expect(byName(entries, 'TooltipDirective')?.storyTitle).toBe('Overlay & Interaction/Tooltip');
  });

  it('skips component stories entirely when narrative is not requested', async () => {
    const requested: string[] = [];
    const entries = await loadCatalog(
      catalogOptions({
        includeComponentNarrative: false,
        loadStoryModule: async (path) => {
          requested.push(path);
          return metaByStoryPath[path] ?? {};
        },
      }),
    );

    expect(requested).toEqual(['./src/lib/systems/animation-chaining.stories.ts']);
    for (const entry of entries.filter((candidate) => candidate.kind !== 'system')) {
      expect(entry.narrative).toBeUndefined();
      expect(entry.missing).toEqual([]);
    }
    expect(byName(entries, 'Animation Chaining')?.narrative).toContain('Sequences container animations.');
  });

  it('does not consult the filesystem for stories it was told to skip', async () => {
    const storyExists = vi.fn(async () => true);

    await loadCatalog(catalogOptions({ includeComponentNarrative: false, storyExists }));

    expect(storyExists).not.toHaveBeenCalled();
  });

  it('yields no system entries when the systems directory is empty', async () => {
    const entries = await loadCatalog(catalogOptions({ findSystemStoryPaths: async () => [] }));

    expect(entries.some((entry) => entry.kind === 'system')).toBe(false);
  });

  it('leaves narrative undefined without flagging the story when the meta sets no parameters', async () => {
    const entries = await loadCatalog(
      catalogOptions({
        findSystemStoryPaths: async () => [],
        loadStoryModule: async () => storyModule(cardLayoutMeta),
      }),
    );

    expect(byName(entries, 'CardLayoutComponent')?.narrative).toBeUndefined();
    expect(byName(entries, 'CardLayoutComponent')?.missing).toEqual([]);
  });
});
