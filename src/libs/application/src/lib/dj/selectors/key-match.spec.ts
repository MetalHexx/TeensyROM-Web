import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { DjStore, type DeckDetectedKey } from '../dj-store';

const A_MINOR: DeckDetectedKey = { tonic: 9, mode: 'minor', camelot: '8A' };
const A_FLAT_MAJOR: DeckDetectedKey = { tonic: 8, mode: 'major', camelot: '4B' };

describe('keyMatch', () => {
  let store: InstanceType<typeof DjStore>;

  beforeEach(() => {
    store = TestBed.inject(DjStore);
    store.setDeckDetectedKey({ slot: 'A', detectedKey: A_MINOR });
    store.setDeckDetectedKey({ slot: 'B', detectedKey: A_FLAT_MAJOR });
  });

  function turnKey(slot: 'A' | 'B', keySemitones: number): void {
    store.setDeckPanel({ slot, patch: { keySemitones } });
  }

  it('is clash for two unrelated keys at home', () => {
    expect(store.keyMatch()()).toBe('clash');
  });

  it('is full once deck B is turned to the key that shares all seven notes', () => {
    turnKey('B', 4);

    expect(store.keyMatch()()).toBe('full');
  });

  it('is possible five shared notes away', () => {
    turnKey('B', 2);

    expect(store.keyMatch()()).toBe('possible');
  });

  it('is close at six shared notes', () => {
    // A minor shares six notes with E minor (one step round the wheel is the neighbour).
    store.setDeckDetectedKey({ slot: 'B', detectedKey: { tonic: 4, mode: 'minor', camelot: '9A' } });

    expect(store.keyMatch()()).toBe('close');
  });

  it("follows deck A's knob as well as deck B's", () => {
    turnKey('B', 4);
    turnKey('A', 1);

    expect(store.keyMatch()()).not.toBe('full');
  });

  it.each(['A', 'B'] as const)('is none while deck %s has no detected key', (slot) => {
    store.setDeckDetectedKey({ slot, detectedKey: null });

    expect(store.keyMatch()()).toBe('none');
  });

  it('is unchanged by the readout format', () => {
    turnKey('B', 4);
    store.setKeyDisplayFormat({ format: 'note' });
    expect(store.keyMatch()()).toBe('full');

    store.setKeyDisplayFormat({ format: 'camelot' });
    expect(store.keyMatch()()).toBe('full');
  });

  it('updates as a key is detected after a load and goes to none on eject', () => {
    store.setDeckDetectedKey({ slot: 'B', detectedKey: null });
    expect(store.keyMatch()()).toBe('none');

    store.setDeckDetectedKey({ slot: 'B', detectedKey: A_MINOR });
    expect(store.keyMatch()()).toBe('full');
  });
});
