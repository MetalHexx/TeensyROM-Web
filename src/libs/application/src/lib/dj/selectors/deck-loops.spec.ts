import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { DjStore, EMPTY_DECK_LOOPS } from '../dj-store';

describe('deckLoops', () => {
  it("is each slot's own loop state", () => {
    const store = TestBed.inject(DjStore);
    expect(store.deckLoops('A')()).toBe(EMPTY_DECK_LOOPS);

    store.setDeckLoops({ slot: 'B', loops: { ...EMPTY_DECK_LOOPS, selectedId: 'b-marker' } });

    expect(store.deckLoops('B')().selectedId).toBe('b-marker');
    expect(store.deckLoops('A')()).toBe(EMPTY_DECK_LOOPS);
  });
});
