import { describe, it, expect } from 'vitest';
import type {
  DeckStripModel,
  LoopsCuesPanelModel,
  SpeedPanelModel,
  VoicePanelModel,
} from '@teensyrom-nx/ui/components';
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

  it('labels the strip fader with the bare deck letter', () => {
    const models = createDeckPlaceholders({ slot: 'B', letter: 'B', index: 1 });
    expect(models.strip.fader.label).toBe('B');
  });

  it('scopes every voice checkboxId to the deck letter and keeps them unique', () => {
    const models = createDeckPlaceholders({ slot: 'B', letter: 'B', index: 1 });
    const checkboxIds = models.voice.rows.map((row) => row.checkboxId);

    expect(checkboxIds.length).toBe(3);
    checkboxIds.forEach((id) => expect(id).toContain('B'));
    expect(new Set(checkboxIds).size).toBe(checkboxIds.length);
  });

  it('type-checks against the model-shaped component inputs', () => {
    const models = createDeckPlaceholders({ slot: 'B', letter: 'B', index: 1 });

    const voice: VoicePanelModel = models.voice;
    const speed: SpeedPanelModel = models.speed;
    const loopsCues: LoopsCuesPanelModel = models.loopsCues;
    const strip: DeckStripModel = models.strip;

    expect([voice, speed, loopsCues, strip].every((value) => value !== undefined)).toBe(true);
  });
});
