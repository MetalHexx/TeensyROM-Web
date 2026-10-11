import { describe, it, expect } from 'vitest';
import type { LoopsCuesPanelModel } from '@teensyrom-nx/ui/components';
import { createDeckPlaceholders } from './deck-placeholders';

/** Recursively collects every string value keyed by (or ending with) `accessibleName`. */
function collectAccessibleNames(value: unknown, results: string[] = []): string[] {
  if (Array.isArray(value)) {
    value.forEach((item) => collectAccessibleNames(item, results));
  } else if (value !== null && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (/accessiblename$/i.test(key) && typeof entry === 'string') {
        results.push(entry);
      } else {
        collectAccessibleNames(entry, results);
      }
    }
  }
  return results;
}

describe('createDeckPlaceholders', () => {
  it('builds every accessible name from the deck letter', () => {
    const models = createDeckPlaceholders({ slot: 'B', letter: 'B', index: 1 });
    const names = collectAccessibleNames(models);

    expect(names.length).toBeGreaterThan(0);
    names.forEach((name) => expect(name.endsWith('deck B')).toBe(true));
  });

  it('type-checks against the model-shaped component inputs', () => {
    const models = createDeckPlaceholders({ slot: 'B', letter: 'B', index: 1 });

    const loopsCues: LoopsCuesPanelModel = models.loopsCues;

    expect(loopsCues).toBeDefined();
  });
});
