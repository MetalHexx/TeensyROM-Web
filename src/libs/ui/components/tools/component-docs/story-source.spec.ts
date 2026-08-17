import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  SYSTEMS_DIRECTORY,
  findSystemStories,
  loadStoryMeta,
  narrativeOf,
  propDescriptionsOf,
  readStoryMeta,
  storyPathFor,
  toSystemEntry,
} from './story-source';
import {
  animationChainingSystemMeta,
  annotatedCardLayoutMeta,
  cardLayoutMeta,
  storyModule,
} from './__fixtures__/story-metas';

describe('storyPathFor', () => {
  it('names the sibling story file of a component source', () => {
    expect(storyPathFor('libs/ui/components/src/lib/card-layout/card-layout.component.ts')).toBe(
      'libs/ui/components/src/lib/card-layout/card-layout.component.stories.ts',
    );
  });

  it('names the sibling story file of a directive source', () => {
    expect(storyPathFor('libs/ui/components/src/lib/tooltip/tooltip.directive.ts')).toBe(
      'libs/ui/components/src/lib/tooltip/tooltip.directive.stories.ts',
    );
  });
});

describe('loadStoryMeta', () => {
  it('asks the loader for a vite-root-relative path and returns the default export', async () => {
    const seen: string[] = [];
    const meta = await loadStoryMeta(
      'libs/ui/components/src/lib/card-layout/card-layout.component.stories.ts',
      async (path) => {
        seen.push(path);
        return storyModule(cardLayoutMeta);
      },
    );

    expect(seen).toEqual(['./src/lib/card-layout/card-layout.component.stories.ts']);
    expect(meta?.title).toBe('Layout/Card Layout');
  });

  it('propagates a loader rejection to the caller', async () => {
    await expect(
      loadStoryMeta('libs/ui/components/src/lib/broken/broken.component.stories.ts', async () => {
        throw new Error('transform failed');
      }),
    ).rejects.toThrow('transform failed');
  });
});

describe('readStoryMeta', () => {
  it('is undefined when the module has no default export', () => {
    expect(readStoryMeta({ Primary: {} })).toBeUndefined();
  });
});

describe('narrativeOf', () => {
  it('reads the component narrative off the story parameters', () => {
    expect(narrativeOf(annotatedCardLayoutMeta)).toBe(
      'Wraps content in the glassy card chrome. Use it for panels.',
    );
  });

  it('tolerates a meta with no parameters at all', () => {
    expect(narrativeOf(cardLayoutMeta)).toBeUndefined();
    expect(narrativeOf(undefined)).toBeUndefined();
  });
});

describe('propDescriptionsOf', () => {
  it('collects only argTypes that carry a non-blank description', () => {
    expect(propDescriptionsOf(annotatedCardLayoutMeta)).toEqual({
      glassyIntensity: 'Story-authored intensity guidance.',
    });
  });

  it('is empty for the argTypes shape the library authors today', () => {
    expect(propDescriptionsOf(cardLayoutMeta)).toEqual({});
  });
});

describe('toSystemEntry', () => {
  const storyPath = `${SYSTEMS_DIRECTORY}/animation-chaining.stories.ts`;

  it('names the entry after the last title segment', () => {
    expect(toSystemEntry(animationChainingSystemMeta, storyPath)?.name).toBe('Animation Chaining');
  });

  it('carries the narrative, its summary and no props or selector', () => {
    const entry = toSystemEntry(animationChainingSystemMeta, storyPath);

    expect(entry?.kind).toBe('system');
    expect(entry?.summary).toBe('Sequences container animations.');
    expect(entry?.narrative).toContain('Sequences container animations.');
    expect(entry?.props).toEqual([]);
    expect(entry?.selector).toBeUndefined();
    expect(entry?.storyPath).toBe(storyPath);
  });

  it('yields nothing for a meta with no title', () => {
    expect(toSystemEntry({}, storyPath)).toBeUndefined();
  });
});

describe('findSystemStories', () => {
  it('is empty when the systems directory does not exist yet', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'component-docs-no-systems-'));

    expect(await findSystemStories(workspaceRoot)).toEqual([]);
  });

  it('discovers story files by directory convention and ignores anything else', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'component-docs-systems-'));
    const systems = join(workspaceRoot, SYSTEMS_DIRECTORY);
    await mkdir(systems, { recursive: true });
    for (const name of ['theming.stories.ts', 'animation-chaining.stories.ts', 'README.md']) {
      await writeFile(join(systems, name), '');
    }

    expect(await findSystemStories(workspaceRoot)).toEqual([
      `${SYSTEMS_DIRECTORY}/animation-chaining.stories.ts`,
      `${SYSTEMS_DIRECTORY}/theming.stories.ts`,
    ]);
  });
});
