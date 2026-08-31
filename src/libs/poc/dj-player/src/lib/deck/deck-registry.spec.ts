import { describe, it, expect } from 'vitest';
import { DeckRegistry } from './deck-registry';
import type { DeckHandle } from './deck-registry';
import { DECKS } from './deck.config';

/** A handle distinguishable only by its own descriptor — `DeckRegistry` never reads the other
 *  fields, only carries them through for its callers. */
function fakeHandle(id: string, label: string): DeckHandle {
  return {
    descriptor: { id, label },
    engine: {} as DeckHandle['engine'],
    binding: {} as DeckHandle['binding'],
    tuneIndex: {} as DeckHandle['tuneIndex'],
    tuneLoader: {} as DeckHandle['tuneLoader'],
  };
}

function idsOf(handles: readonly DeckHandle[]): string[] {
  return handles.map((handle) => handle.descriptor.id);
}

describe('DeckRegistry', () => {
  it('starts empty', () => {
    const registry = new DeckRegistry();

    expect(registry.decks()).toEqual([]);
  });

  it('registers a deck and publishes it', () => {
    const registry = new DeckRegistry();
    const handleA = fakeHandle(DECKS[0].id, DECKS[0].label);

    registry.register(handleA);

    expect(registry.decks()).toEqual([handleA]);
  });

  it('publishes registered decks in DECKS order, regardless of registration order', () => {
    const registry = new DeckRegistry();
    const handleB = fakeHandle(DECKS[1].id, DECKS[1].label);
    const handleA = fakeHandle(DECKS[0].id, DECKS[0].label);

    // Registered deliberately out of DECKS order.
    registry.register(handleB);
    registry.register(handleA);

    expect(idsOf(registry.decks())).toEqual([DECKS[0].id, DECKS[1].id]);
  });

  it('replaces an existing entry for the same deck id rather than duplicating it', () => {
    const registry = new DeckRegistry();
    const first = fakeHandle(DECKS[0].id, DECKS[0].label);
    const second = fakeHandle(DECKS[0].id, DECKS[0].label);

    registry.register(first);
    registry.register(second);

    expect(registry.decks()).toEqual([second]);
  });

  it('unregisters by id, leaving every other registered deck untouched', () => {
    const registry = new DeckRegistry();
    const handleA = fakeHandle(DECKS[0].id, DECKS[0].label);
    const handleB = fakeHandle(DECKS[1].id, DECKS[1].label);
    registry.register(handleA);
    registry.register(handleB);

    registry.unregister(DECKS[0].id);

    expect(registry.decks()).toEqual([handleB]);
  });

  it('unregistering an id that was never registered is a no-op', () => {
    const registry = new DeckRegistry();
    const handleA = fakeHandle(DECKS[0].id, DECKS[0].label);
    registry.register(handleA);

    registry.unregister('never-registered');

    expect(registry.decks()).toEqual([handleA]);
  });
});
