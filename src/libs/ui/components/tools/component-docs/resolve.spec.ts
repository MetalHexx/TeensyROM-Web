import { DocEntry } from './model';
import { MAX_SUGGESTIONS, normalizeName, resolveEntry } from './resolve';

function entry(name: string, kind: DocEntry['kind'] = 'component'): DocEntry {
  return { kind, name, summary: '', props: [], missing: [] };
}

const entries: DocEntry[] = [
  entry('CardLayoutComponent'),
  entry('CompactCardLayoutComponent'),
  entry('ScalingCardComponent'),
  entry('TooltipDirective', 'directive'),
  entry('IconButtonComponent'),
  entry('NavRailComponent'),
  entry('Animation Chaining', 'system'),
];

describe('normalizeName', () => {
  it('collapses every way a user might name one component', () => {
    const keys = ['CardLayoutComponent', 'card-layout', 'lib-card-layout', 'CardLayout', 'card-layout.component'].map(
      normalizeName,
    );

    expect(new Set(keys)).toEqual(new Set(['cardlayout']));
  });

  it('collapses directive spellings the same way', () => {
    expect(normalizeName('TooltipDirective')).toBe(normalizeName('tooltip'));
  });

  it('keeps distinct components distinct', () => {
    expect(normalizeName('CompactCardLayoutComponent')).not.toBe(normalizeName('CardLayoutComponent'));
  });
});

describe('resolveEntry', () => {
  it('resolves every spelling of a component to the same entry', () => {
    for (const candidate of ['CardLayoutComponent', 'card-layout', 'lib-card-layout', 'CardLayout']) {
      const resolution = resolveEntry(entries, candidate);

      expect(resolution.matched).toBe(true);
      expect(resolution.matched && resolution.entry.name).toBe('CardLayoutComponent');
    }
  });

  it('resolves a system by its display name', () => {
    const resolution = resolveEntry(entries, 'animation chaining');

    expect(resolution.matched && resolution.entry.kind).toBe('system');
  });

  it('suggests near misses instead of throwing', () => {
    const resolution = resolveEntry(entries, 'cardlayut');

    expect(resolution.matched).toBe(false);
    expect(!resolution.matched && resolution.suggestions).toContain('CardLayoutComponent');
  });

  it('ranks the closest name first', () => {
    const resolution = resolveEntry(entries, 'navrai');

    expect(!resolution.matched && resolution.suggestions[0]).toBe('NavRailComponent');
  });

  it('offers containing names for a partial candidate', () => {
    const resolution = resolveEntry(entries, 'cardlay');

    expect(!resolution.matched && resolution.suggestions.slice(0, 2)).toEqual([
      'CardLayoutComponent',
      'CompactCardLayoutComponent',
    ]);
  });

  it('caps the shortlist', () => {
    const resolution = resolveEntry(entries, 'zzzzzzzz');

    expect(!resolution.matched && resolution.suggestions.length).toBe(MAX_SUGGESTIONS);
  });
});
