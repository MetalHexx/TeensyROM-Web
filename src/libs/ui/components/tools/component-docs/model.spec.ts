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

  it('stops at a paragraph break', () => {
    expect(summarize('A one-line lead\n\nFollowed by detail. Which is dropped.')).toBe('A one-line lead');
  });

  it('joins a soft-wrapped paragraph before extracting the sentence, not at the first physical line break', () => {
    // Lifted verbatim (line breaks included) from action-button.component.ts's class JSDoc.
    const wrapped =
      'Icon-and-text button that combines a Material button variant with a\n' +
      '{@link IconLabelComponent}, giving toolbar and dialog actions ("Refresh",\n' +
      '"Index All", "Reset Devices") a consistent labeled-button pattern with\n' +
      'semantic coloring.\n' +
      '\n' +
      'Reach for `lib-action-button` when the action needs a visible text label\n' +
      'next to its icon.';

    expect(summarize(wrapped)).toBe(
      'Icon-and-text button that combines a Material button variant with a {@link IconLabelComponent}, giving toolbar and dialog actions ("Refresh", "Index All", "Reset Devices") a consistent labeled-button pattern with semantic coloring.',
    );
  });

  it('does not cut mid-word when the wrap point falls inside a hyphenated compound', () => {
    // Lifted verbatim from leet-text-container.component.ts's class JSDoc.
    const wrapped =
      'Animates projected text with a continuous "leet speak" character-cycling effect — a demoscene-\n' +
      'style wave that substitutes individual characters as it sweeps forward then backward through the text.\n' +
      '\n' +
      'Optional `/ - \\ |` spinner glyphs render before and/or after the text.';

    expect(summarize(wrapped)).toBe(
      'Animates projected text with a continuous "leet speak" character-cycling effect — a demoscene-style wave that substitutes individual characters as it sweeps forward then backward through the text.',
    );
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

  it('does not treat an abbreviation like "e.g." as the sentence boundary', () => {
    // Lifted verbatim from storage-device-item.component.ts's class JSDoc.
    const wrapped =
      'A top-level storage device row (e.g. "SD Storage", "USB Storage"). Wraps\n' +
      '`StorageItemComponent` with the highlight icon color already fixed.';

    expect(summarize(wrapped)).toBe('A top-level storage device row (e.g. "SD Storage", "USB Storage").');
  });
});
