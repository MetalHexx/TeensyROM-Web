import { summarize, toViteRootRelative } from './model';

describe('toViteRootRelative', () => {
  it('rebases a workspace-relative path onto the vite root', () => {
    expect(toViteRootRelative('libs/ui/components/src/lib/card-layout/card-layout.component.stories.ts')).toBe(
      './src/lib/card-layout/card-layout.component.stories.ts',
    );
  });

  it('does not double the library prefix when the path is already vite-root-relative', () => {
    expect(toViteRootRelative('./src/lib/tooltip/tooltip.directive.stories.ts')).toBe(
      './src/lib/tooltip/tooltip.directive.stories.ts',
    );
  });

  it('normalizes windows separators', () => {
    expect(toViteRootRelative('libs\\ui\\components\\src\\lib\\link\\link.component.ts')).toBe(
      './src/lib/link/link.component.ts',
    );
  });
});

describe('summarize', () => {
  it('takes the first sentence of a multi-sentence description', () => {
    expect(summarize('Renders a pane. It also traps focus. And more.')).toBe('Renders a pane.');
  });

  it('stops at the first line break', () => {
    expect(summarize('A one-line lead\n\nFollowed by detail. Which is dropped.')).toBe('A one-line lead');
  });

  it('keeps markdown link syntax intact', () => {
    expect(summarize('See [the guide](./guide.md) first. Then read on.')).toBe('See [the guide](./guide.md) first.');
  });

  it('returns the whole description when it has no sentence boundary', () => {
    expect(summarize('  A single clause  ')).toBe('A single clause');
  });

  it('is empty when the description is unknown', () => {
    expect(summarize(undefined)).toBe('');
  });
});
