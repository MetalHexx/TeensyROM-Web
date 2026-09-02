import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MidiAccessService } from './midi-access.service';
import { DeckMidiBinding } from './deck-midi-binding';
import { buildDisplayCharsPacket } from '../asid/asid-encoder';

interface FakeMidiOutput {
  readonly id: string;
  readonly name: string | null;
  readonly manufacturer: string | null;
  readonly send: (data: Uint8Array, timestamp?: number) => void;
  readonly clear?: () => void;
}

interface FakeMidiAccess {
  outputs: Map<string, FakeMidiOutput>;
  onstatechange: ((e: unknown) => void) | null;
}

function makeOutput(
  id: string,
  name: string | null,
  manufacturer: string | null,
  withClear = false
): FakeMidiOutput {
  const output: FakeMidiOutput = { id, name, manufacturer, send: vi.fn() };
  return withClear ? { ...output, clear: vi.fn() } : output;
}

function makeAccess(outputs: FakeMidiOutput[]): FakeMidiAccess {
  return { outputs: new Map(outputs.map((output) => [output.id, output])), onstatechange: null };
}

function stubRequestMidiAccess(
  impl: undefined | ((options?: { sysex?: boolean }) => Promise<FakeMidiAccess>)
): void {
  Object.defineProperty(navigator, 'requestMIDIAccess', {
    configurable: true,
    writable: true,
    value: impl,
  });
}

describe('DeckMidiBinding', () => {
  let access: MidiAccessService;
  let deckA: DeckMidiBinding;

  /** A second (or replacement) binding over the *same* `MidiAccessService` — the two-deck shape the
   *  handoff asks every two-deck criterion to be proven against, since only one deck is composed on
   *  screen until P01-T02 lands. */
  function makeDeck(deckId: string): DeckMidiBinding {
    const deck = TestBed.runInInjectionContext(() => new DeckMidiBinding(access));
    deck.deckId = deckId;
    return deck;
  }

  /** Grants access with the given outputs and returns the underlying fake so a test can mutate its
   *  `outputs` map and fire `onstatechange` to simulate a hot-plug. */
  async function grant(outputs: FakeMidiOutput[]): Promise<FakeMidiAccess> {
    const fakeAccess = makeAccess(outputs);
    stubRequestMidiAccess(() => Promise.resolve(fakeAccess));
    await access.requestAccess();
    return fakeAccess;
  }

  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    TestBed.configureTestingModule({ providers: [MidiAccessService] });
    access = TestBed.inject(MidiAccessService);
    deckA = makeDeck('A');
    TestBed.flushEffects();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    stubRequestMidiAccess(undefined);
  });

  it('selectPort claims the port, clears any previous error and persists the choice', async () => {
    await grant([makeOutput('port-1', 'TeensyROM Cart', 'Acme')]);

    deckA.selectPort('port-1');

    expect(deckA.selectedPortId()).toBe('port-1');
    expect(deckA.lastError()).toBeNull();
    expect(access.deckHolding('port-1')).toBe('A');
  });

  describe('claim refusal, in both directions', () => {
    it('refuses deck B a port deck A already holds, leaving deck A untouched', async () => {
      await grant([makeOutput('port-1', 'TeensyROM Cart', 'Acme')]);
      const deckB = makeDeck('B');
      TestBed.flushEffects();

      deckA.selectPort('port-1');
      deckB.selectPort('port-1');

      expect(deckB.selectedPortId()).toBeNull();
      expect(deckB.lastError()).toBe('Deck A is already bound to that port. Pick a different one.');
      expect(deckA.selectedPortId()).toBe('port-1');
      expect(deckA.lastError()).toBeNull();
    });

    it('refuses deck A a port deck B already holds — the same rule from the other side', async () => {
      await grant([makeOutput('port-1', 'TeensyROM Cart', 'Acme')]);
      const deckB = makeDeck('B');
      TestBed.flushEffects();

      deckB.selectPort('port-1');
      deckA.selectPort('port-1');

      expect(deckA.selectedPortId()).toBeNull();
      expect(deckA.lastError()).toBe('Deck B is already bound to that port. Pick a different one.');
      expect(deckB.selectedPortId()).toBe('port-1');
      expect(deckB.lastError()).toBeNull();
    });
  });

  describe('per-deck persistence', () => {
    it('round-trips a deck\'s selection through its own namespaced localStorage key', async () => {
      await grant([makeOutput('port-1', 'TeensyROM Cart', 'Acme')]);
      deckA.selectPort('port-1');
      expect(localStorage.getItem('asid-dj-0.deck-A.selected-midi-port')).toBe('port-1');

      // Simulate a reload: a fresh access grant and a fresh binding for the same deck id read the
      // same key.
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ providers: [MidiAccessService] });
      const reloadedAccess = TestBed.inject(MidiAccessService);
      const reloadedDeck = TestBed.runInInjectionContext(
        () => new DeckMidiBinding(reloadedAccess)
      );
      reloadedDeck.deckId = 'A';
      stubRequestMidiAccess(() =>
        Promise.resolve(makeAccess([makeOutput('port-1', 'TeensyROM Cart', 'Acme')]))
      );
      await reloadedAccess.requestAccess();

      reloadedDeck.restore();

      expect(reloadedDeck.selectedPortId()).toBe('port-1');
    });

    it('does not restore a persisted selection when that port is no longer enumerated', async () => {
      await grant([makeOutput('port-1', 'TeensyROM Cart', 'Acme')]);
      deckA.selectPort('port-1');

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ providers: [MidiAccessService] });
      const reloadedAccess = TestBed.inject(MidiAccessService);
      const reloadedDeck = TestBed.runInInjectionContext(
        () => new DeckMidiBinding(reloadedAccess)
      );
      reloadedDeck.deckId = 'A';
      stubRequestMidiAccess(() =>
        Promise.resolve(makeAccess([makeOutput('port-2', 'Different Cart', 'Acme')]))
      );
      await reloadedAccess.requestAccess();

      reloadedDeck.restore();

      expect(reloadedDeck.selectedPortId()).toBeNull();
    });

    it('two decks persist under independent keys — one never overwrites the other\'s', async () => {
      await grant([
        makeOutput('port-1', 'Cart A', 'Acme'),
        makeOutput('port-2', 'Cart B', 'Acme'),
      ]);
      const deckB = makeDeck('B');
      TestBed.flushEffects();

      deckA.selectPort('port-1');
      deckB.selectPort('port-2');

      expect(localStorage.getItem('asid-dj-0.deck-A.selected-midi-port')).toBe('port-1');
      expect(localStorage.getItem('asid-dj-0.deck-B.selected-midi-port')).toBe('port-2');
    });
  });

  it('port loss stays local: a statechange that drops one deck\'s port leaves the other deck\'s selection and error untouched', async () => {
    const fakeAccess = await grant([
      makeOutput('port-1', 'Cart A', 'Acme'),
      makeOutput('port-2', 'Cart B', 'Acme'),
    ]);
    const deckB = makeDeck('B');
    TestBed.flushEffects();
    deckA.selectPort('port-1');
    deckB.selectPort('port-2');

    fakeAccess.outputs.delete('port-1');
    fakeAccess.onstatechange?.({});
    TestBed.flushEffects();

    expect(deckA.selectedPortId()).toBeNull();
    expect(deckA.lastError()).toBeTruthy();
    expect(access.deckHolding('port-1')).toBeNull();
    expect(deckB.selectedPortId()).toBe('port-2');
    expect(deckB.lastError()).toBeNull();
    expect(access.deckHolding('port-2')).toBe('B');
  });

  it('supportsCancel resolves against this deck\'s own port, not whichever port is selected elsewhere', async () => {
    await grant([
      makeOutput('port-1', 'Cart A', 'Acme', true),
      makeOutput('port-2', 'Cart B', 'Acme', false),
    ]);
    const deckB = makeDeck('B');
    TestBed.flushEffects();
    deckA.selectPort('port-1');
    deckB.selectPort('port-2');

    expect(deckA.supportsCancel()).toBe(true);
    expect(deckB.supportsCancel()).toBe(false);
  });

  describe('send / cancelPending / identify', () => {
    it('send() routes bytes to this deck\'s own selected port', async () => {
      const output = makeOutput('port-1', 'Cart A', 'Acme');
      await grant([output]);
      deckA.selectPort('port-1');

      const bytes = Uint8Array.from([0xf0, 0x2d, 0x4f, 0x41, 0xf7]);
      deckA.send(bytes, 123);

      expect(output.send).toHaveBeenCalledWith(bytes, 123);
    });

    it('send() warns and does not throw when this deck has no port selected', () => {
      expect(() => deckA.send(Uint8Array.from([0xf0, 0x2d, 0xf7]))).not.toThrow();
      expect(console.warn).toHaveBeenCalled();
    });

    it('cancelPending() reports false without throwing when this deck has no port selected', () => {
      expect(deckA.cancelPending()).toBe(false);
    });

    it('cancelPending() delegates to the access service for this deck\'s own port', async () => {
      const output = makeOutput('port-1', 'Cart A', 'Acme', true);
      await grant([output]);
      deckA.selectPort('port-1');

      expect(deckA.cancelPending()).toBe(true);
      expect(output.clear).toHaveBeenCalledTimes(1);
    });

    it('identify() sends the encoded display-chars packet to this deck\'s port', async () => {
      const output = makeOutput('port-1', 'Cart A', 'Acme');
      await grant([output]);
      deckA.selectPort('port-1');

      deckA.identify('TEST');

      expect(output.send).toHaveBeenCalledWith(buildDisplayCharsPacket('TEST'));
    });
  });
});
