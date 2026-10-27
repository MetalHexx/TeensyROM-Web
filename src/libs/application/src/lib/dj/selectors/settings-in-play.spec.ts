import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { DjStore, EMPTY_DECK_LOOPS, HOME_DECK_PANEL, type DeckLoopMarker } from '../dj-store';

function marker(id: string): DeckLoopMarker {
  return {
    id,
    name: null,
    start: { frame: 100, offsetFrames: 0 },
    end: null,
    voices: [0, 1, 2],
    settings: null,
    ownSettings: false,
    ready: true,
  };
}

describe('settingsInPlay', () => {
  let store: InstanceType<typeof DjStore>;

  beforeEach(() => {
    store = TestBed.inject(DjStore);
  });

  it('names the main track while no marker has its own settings in play', () => {
    store.setDeckLoops({
      slot: 'A',
      loops: { ...EMPTY_DECK_LOOPS, markers: [marker('a'), marker('b')] },
    });

    expect(store.settingsInPlay('A')()).toEqual({ markerId: null, name: 'Main' });
  });

  it('names the marker in play by its list position', () => {
    const main = { panel: HOME_DECK_PANEL, mutes: [false, false, false] } as const;
    store.setDeckLoops({
      slot: 'A',
      loops: {
        ...EMPTY_DECK_LOOPS,
        markers: [marker('a'), marker('b')],
        settingsInPlayId: 'b',
        mainSettings: main,
      },
    });

    expect(store.settingsInPlay('A')()).toEqual({ markerId: 'b', name: 'Item 2' });
  });

  it('names the marker in play by its own name when it has one', () => {
    const main = { panel: HOME_DECK_PANEL, mutes: [false, false, false] } as const;
    store.setDeckLoops({
      slot: 'A',
      loops: {
        ...EMPTY_DECK_LOOPS,
        markers: [marker('a'), { ...marker('b'), name: 'Bridge' }],
        settingsInPlayId: 'b',
        mainSettings: main,
      },
    });

    expect(store.settingsInPlay('A')()).toEqual({ markerId: 'b', name: 'Bridge' });
  });

  it('follows the swap, and is per deck', () => {
    const main = { panel: HOME_DECK_PANEL, mutes: [false, false, false] } as const;
    store.setDeckLoops({ slot: 'A', loops: { ...EMPTY_DECK_LOOPS, markers: [marker('a')] } });
    const summary = store.settingsInPlay('A');

    store.setSettingsInPlay({
      slot: 'A',
      panel: HOME_DECK_PANEL,
      settingsInPlayId: 'a',
      mainSettings: main,
    });
    expect(summary()).toEqual({ markerId: 'a', name: 'Item 1' });
    expect(store.settingsInPlay('B')()).toEqual({ markerId: null, name: 'Main' });

    store.setSettingsInPlay({
      slot: 'A',
      panel: HOME_DECK_PANEL,
      settingsInPlayId: null,
      mainSettings: null,
    });
    expect(summary()).toEqual({ markerId: null, name: 'Main' });
  });

  it('falls back to the main track for a marker that is no longer in the list', () => {
    store.setDeckLoops({
      slot: 'A',
      loops: { ...EMPTY_DECK_LOOPS, markers: [], settingsInPlayId: 'gone' },
    });

    expect(store.settingsInPlay('A')()).toEqual({ markerId: null, name: 'Main' });
  });

  it('does not change for an edit that leaves the marker in play as it was, or for the position', () => {
    store.setDeckLoops({
      slot: 'A',
      loops: { ...EMPTY_DECK_LOOPS, markers: [marker('a')], settingsInPlayId: 'a' },
    });
    const summary = store.settingsInPlay('A');
    const before = summary();

    store.setLoopMarkers({ slot: 'A', markers: [{ ...marker('a'), ready: false }] });
    store.samplePosition({ slot: 'A', positionFrames: 250 });

    expect(summary()).toBe(before);
  });
});
