import { mkdtemp, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  CompodocSourceOptions,
  CompodocUnavailableError,
  loadCompodocJson,
  newestSourceMtime,
  parseCompodocJson,
  toDocEntries,
} from './compodoc-source';
import { compodocPayload } from './__fixtures__/compodoc-payload';

function sourceOptions(overrides: Partial<CompodocSourceOptions>): CompodocSourceOptions {
  return {
    regenerate: vi.fn(async () => undefined),
    documentationMtime: async () => 2_000,
    sourcesMtime: async () => 1_000,
    readPayload: async () => compodocPayload,
    ...overrides,
  };
}

describe('loadCompodocJson staleness', () => {
  it('regenerates once when documentation.json is absent', async () => {
    const regenerate = vi.fn(async () => undefined);
    const options = sourceOptions({ regenerate, documentationMtime: async () => undefined });

    await loadCompodocJson(options);

    expect(regenerate).toHaveBeenCalledTimes(1);
  });

  it('does not regenerate when documentation.json is newer than the sources', async () => {
    const regenerate = vi.fn(async () => undefined);

    await loadCompodocJson(sourceOptions({ regenerate, documentationMtime: async () => 5_000 }));

    expect(regenerate).not.toHaveBeenCalled();
  });

  it('regenerates when documentation.json is older than the newest source', async () => {
    const regenerate = vi.fn(async () => undefined);

    await loadCompodocJson(
      sourceOptions({ regenerate, documentationMtime: async () => 1_000, sourcesMtime: async () => 9_000 }),
    );

    expect(regenerate).toHaveBeenCalledTimes(1);
  });

  it('reads the payload after regenerating rather than the pre-regeneration copy', async () => {
    const order: string[] = [];
    const payload = await loadCompodocJson(
      sourceOptions({
        documentationMtime: async () => undefined,
        regenerate: async () => void order.push('regenerate'),
        readPayload: async () => {
          order.push('read');
          return compodocPayload;
        },
      }),
    );

    expect(order).toEqual(['regenerate', 'read']);
    expect(payload.components).toHaveLength(2);
  });
});

describe('newestSourceMtime', () => {
  it('ignores specs and stories, which are outside compodoc\'s scope', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'component-docs-'));
    const documented = join(directory, 'widget.component.ts');
    await writeFile(documented, '');
    await utimes(documented, new Date(1_000_000), new Date(1_000_000));
    for (const excluded of ['widget.component.spec.ts', 'widget.component.stories.ts']) {
      const path = join(directory, excluded);
      await writeFile(path, '');
      await utimes(path, new Date(9_000_000), new Date(9_000_000));
    }

    expect(await newestSourceMtime(directory)).toBe(1_000_000);
  });

  it('is undefined when the source directory does not exist', async () => {
    expect(await newestSourceMtime(join(tmpdir(), 'component-docs-absent-source-root'))).toBeUndefined();
  });
});

describe('regeneration without the compodoc binary', () => {
  it('fails as "could not run" and names pnpm install', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'component-docs-workspace-'));

    await expect(
      loadCompodocJson({ workspaceRoot, documentationMtime: async () => undefined }),
    ).rejects.toThrow(CompodocUnavailableError);
    await expect(
      loadCompodocJson({ workspaceRoot, documentationMtime: async () => undefined }),
    ).rejects.toThrow(/pnpm install/);
  });
});

describe('parseCompodocJson', () => {
  it('rejects a payload that is not compodoc output', () => {
    expect(() => parseCompodocJson('{"foo":1}')).toThrow(/compodoc payload/);
  });

  it('accepts a payload carrying the documented collections', () => {
    expect(parseCompodocJson(JSON.stringify(compodocPayload)).directives).toHaveLength(1);
  });
});

describe('toDocEntries', () => {
  const entries = toDocEntries(compodocPayload);
  const cardLayout = entries.find((entry) => entry.name === 'CardLayoutComponent');
  const tooltip = entries.find((entry) => entry.name === 'TooltipDirective');

  it('projects components and directives with their own kind', () => {
    expect(entries.map((entry) => entry.kind)).toEqual(['component', 'component', 'directive']);
  });

  it('keeps the workspace-relative source path and selector', () => {
    expect(cardLayout?.sourcePath).toBe('libs/ui/components/src/lib/card-layout/card-layout.component.ts');
    expect(cardLayout?.selector).toBe('lib-card-layout');
  });

  it('summarizes the raw description and lifts the example out of it', () => {
    expect(cardLayout?.summary).toBe(
      'Card layout component with support for title, subtitle, corner slot, and header slot.',
    );
    expect(cardLayout?.description).not.toContain('```');
    expect(cardLayout?.example).toMatch(/^```html/);
  });

  it('leaves example undefined when no example tag was authored', () => {
    expect(entries.find((entry) => entry.name === 'LoadingTextComponent')?.example).toBeUndefined();
  });

  it('projects inputs and outputs with defaults, requiredness and raw descriptions', () => {
    expect(cardLayout?.props.map((prop) => [prop.name, prop.kind])).toEqual([
      ['cardClass', 'input'],
      ['glassyIntensity', 'input'],
      ['metadataSource', 'input'],
      ['cardClosed', 'output'],
    ]);

    const intensity = cardLayout?.props.find((prop) => prop.name === 'glassyIntensity');
    expect(intensity?.type).toBe('GlassyIntensity');
    expect(intensity?.default).toBe("'dark'");
    expect(intensity?.required).toBe(false);
    expect(intensity?.description).not.toContain('<p>');

    expect(cardLayout?.props.find((prop) => prop.name === 'metadataSource')?.required).toBe(true);
  });

  it('starts every entry with nothing missing', () => {
    expect(tooltip?.missing).toEqual([]);
  });
});
