import { describe, it, expect } from 'vitest';
import type {
  BindingCardModel,
  DeckStripModel,
  LoopsCuesPanelModel,
  SpeedPanelModel,
  TransportPanelModel,
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
    const models = createDeckPlaceholders({ letter: 'B', index: 1 });
    const names = collectAccessibleNames(models);

    expect(names.length).toBeGreaterThan(0);
    names.forEach((name) => expect(name.endsWith('deck B')).toBe(true));
  });

  it('headers the binding card with the deck letter', () => {
    const models = createDeckPlaceholders({ letter: 'B', index: 1 });
    expect(models.binding.heading).toBe('Deck B');
  });

  it('labels the strip fader with the bare deck letter', () => {
    const models = createDeckPlaceholders({ letter: 'B', index: 1 });
    expect(models.strip.fader.label).toBe('B');
  });

  it('scopes every voice checkboxId to the deck letter and keeps them unique', () => {
    const models = createDeckPlaceholders({ letter: 'B', index: 1 });
    const checkboxIds = models.voice.rows.map((row) => row.checkboxId);

    expect(checkboxIds.length).toBe(3);
    checkboxIds.forEach((id) => expect(id).toContain('B'));
    expect(new Set(checkboxIds).size).toBe(checkboxIds.length);
  });

  it('type-checks against the model-shaped component inputs', () => {
    const models = createDeckPlaceholders({ letter: 'B', index: 1 });

    const transport: TransportPanelModel = models.transport;
    const positionPercent: number = models.positionPercent;
    const frameLabel: string = models.frameLabel;
    const voice: VoicePanelModel = models.voice;
    const speed: SpeedPanelModel = models.speed;
    const loopsCues: LoopsCuesPanelModel = models.loopsCues;
    const binding: BindingCardModel = models.binding;
    const strip: DeckStripModel = models.strip;

    expect(
      [transport, positionPercent, frameLabel, voice, speed, loopsCues, binding, strip].every(
        (value) => value !== undefined
      )
    ).toBe(true);
  });
});
