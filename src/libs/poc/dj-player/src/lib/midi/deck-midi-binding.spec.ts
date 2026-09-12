import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MidiAccessService } from './midi-access.service';
import { DeckMidiBinding } from './deck-midi-binding';
import { ASID_SYSEX_END, ASID_SYSEX_START, createAsidSink } from '@sidablist/asid';
import { createFakeAsidSink } from '../../testing/player-doubles';

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

  describe('clearSelection', () => {
    it("releases this deck's claim, forgets the persisted choice, and never claims the empty id as a port", async () => {
      await grant([makeOutput('port-1', 'TeensyROM Cart', 'Acme')]);
      deckA.selectPort('port-1');

      deckA.clearSelection();

      expect(deckA.selectedPortId()).toBeNull();
      expect(deckA.lastError()).toBeNull();
      expect(access.deckHolding('port-1')).toBeNull();
      expect(access.deckHolding('')).toBeNull();
      expect(localStorage.getItem('asid-dj-0.deck-A.selected-midi-port')).toBeNull();
    });

    it('lets a second deck claim the port this deck just released', async () => {
      await grant([makeOutput('port-1', 'TeensyROM Cart', 'Acme')]);
      const deckB = makeDeck('B');
      TestBed.flushEffects();
      deckA.selectPort('port-1');

      deckA.clearSelection();
      deckB.selectPort('port-1');

      expect(deckB.selectedPortId()).toBe('port-1');
      expect(deckB.lastError()).toBeNull();
    });
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
    it("round-trips a deck's selection through its own namespaced localStorage key", async () => {
      await grant([makeOutput('port-1', 'TeensyROM Cart', 'Acme')]);
      deckA.selectPort('port-1');
      expect(localStorage.getItem('asid-dj-0.deck-A.selected-midi-port')).toBe('port-1');

      // Simulate a reload: a fresh access grant and a fresh binding for the same deck id read the
      // same key.
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ providers: [MidiAccessService] });
      const reloadedAccess = TestBed.inject(MidiAccessService);
      const reloadedDeck = TestBed.runInInjectionContext(() => new DeckMidiBinding(reloadedAccess));
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
      const reloadedDeck = TestBed.runInInjectionContext(() => new DeckMidiBinding(reloadedAccess));
      reloadedDeck.deckId = 'A';
      stubRequestMidiAccess(() =>
        Promise.resolve(makeAccess([makeOutput('port-2', 'Different Cart', 'Acme')]))
      );
      await reloadedAccess.requestAccess();

      reloadedDeck.restore();

      expect(reloadedDeck.selectedPortId()).toBeNull();
    });

    it("two decks persist under independent keys — one never overwrites the other's", async () => {
      await grant([makeOutput('port-1', 'Cart A', 'Acme'), makeOutput('port-2', 'Cart B', 'Acme')]);
      const deckB = makeDeck('B');
      TestBed.flushEffects();

      deckA.selectPort('port-1');
      deckB.selectPort('port-2');

      expect(localStorage.getItem('asid-dj-0.deck-A.selected-midi-port')).toBe('port-1');
      expect(localStorage.getItem('asid-dj-0.deck-B.selected-midi-port')).toBe('port-2');
    });
  });

  it("port loss stays local: a statechange that drops one deck's port leaves the other deck's selection and error untouched", async () => {
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

  it("outputPort.supportsCancel resolves against this deck's own port, not whichever port is selected elsewhere", async () => {
    await grant([
      makeOutput('port-1', 'Cart A', 'Acme', true),
      makeOutput('port-2', 'Cart B', 'Acme', false),
    ]);
    const deckB = makeDeck('B');
    TestBed.flushEffects();
    deckA.selectPort('port-1');
    deckB.selectPort('port-2');

    expect(deckA.outputPort.supportsCancel).toBe(true);
    expect(deckB.outputPort.supportsCancel).toBe(false);
  });

  describe('outputPort', () => {
    it("routes bytes to this deck's own selected output, timestamp and all", async () => {
      const output = makeOutput('port-1', 'Cart A', 'Acme');
      await grant([output]);
      deckA.selectPort('port-1');

      const bytes = Uint8Array.from([0xf0, 0x2d, 0x4f, 0x41, 0xf7]);
      deckA.outputPort.send(bytes, 123);

      expect(output.send).toHaveBeenCalledWith(bytes, 123);
    });

    it('warns and does not throw when this deck has no port selected', () => {
      expect(() => deckA.outputPort.send(Uint8Array.from([0xf0, 0x2d, 0xf7]))).not.toThrow();
      expect(console.warn).toHaveBeenCalled();
    });

    it('reports no port id and no cancel support until this deck selects one', () => {
      expect(deckA.outputPort.portId).toBeNull();
      expect(deckA.outputPort.supportsCancel).toBe(false);
      expect(deckA.outputPort.cancelPending()).toBe(false);
    });

    it('cancels through the selected output when that output can cancel', async () => {
      const output = makeOutput('port-1', 'Cart A', 'Acme', true);
      await grant([output]);
      deckA.selectPort('port-1');

      expect(deckA.outputPort.supportsCancel).toBe(true);
      expect(deckA.outputPort.cancelPending()).toBe(true);
      expect(output.clear).toHaveBeenCalledTimes(1);
    });

    it('follows a port swap without being rebuilt, so the sink over it never has to be', async () => {
      const first = makeOutput('port-1', 'Cart A', 'Acme');
      const second = makeOutput('port-2', 'Cart B', 'Acme');
      await grant([first, second]);
      const port = deckA.outputPort;

      deckA.selectPort('port-1');
      port.send(Uint8Array.from([0x01]));
      deckA.selectPort('port-2');
      port.send(Uint8Array.from([0x02]));

      expect(first.send).toHaveBeenCalledTimes(1);
      expect(second.send).toHaveBeenCalledTimes(1);
      expect(port.portId).toBe('port-2');
    });
  });

  describe("the sink built over this deck's port", () => {
    it("puts the ASID sink's own bytes on the selected browser output", async () => {
      const output = makeOutput('port-1', 'Cart A', 'Acme');
      await grant([output]);
      deckA.selectPort('port-1');

      createAsidSink(deckA.outputPort).showText('TEST');

      expect(output.send).toHaveBeenCalledTimes(1);
      const [bytes] = vi.mocked(output.send).mock.calls[0];
      expect(bytes[0]).toBe(ASID_SYSEX_START);
      expect(bytes[bytes.length - 1]).toBe(ASID_SYSEX_END);
    });
  });

  describe('identify', () => {
    it("shows the text through this deck's sink rather than encoding it here", async () => {
      const output = makeOutput('port-1', 'Cart A', 'Acme');
      await grant([output]);
      deckA.selectPort('port-1');
      const sink = createFakeAsidSink();
      deckA.sink = sink;

      deckA.identify('TEST');

      expect(sink.showText).toHaveBeenCalledWith('TEST');
      expect(output.send).not.toHaveBeenCalled();
    });

    it('warns and does not throw before a sink has been set', () => {
      expect(() => deckA.identify('TEST')).not.toThrow();
      expect(console.warn).toHaveBeenCalled();
    });
  });
});
