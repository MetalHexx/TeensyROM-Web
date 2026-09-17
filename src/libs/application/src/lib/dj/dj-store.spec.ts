import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import type { TuneReference } from '@sidablist/tunes';
import { StorageType } from '@teensyrom-nx/domain';
import { DjStore, DeckBindingState, DeckStatus, MidiState } from './dj-store';
import { DjFileKeyUtil } from './dj-file-key.util';

function tuneReference(overrides: Partial<TuneReference> = {}): TuneReference {
  return {
    identity: { sidHash: 'hash-1', subtune: 1 },
    title: 'Test Tune',
    author: 'Test Author',
    released: '2024 Test',
    subtuneCount: 3,
    byteLength: 1234,
    ...overrides,
  };
}

const emptyBinding = (): DeckBindingState => ({
  port: null,
  portPresent: false,
  error: null,
});

describe('DjStore', () => {
  let store: InstanceType<typeof DjStore>;

  function setup(): void {
    TestBed.configureTestingModule({ providers: [DjStore] });
    store = TestBed.inject(DjStore);
  }

  describe('initial state', () => {
    beforeEach(() => setup());

    it('starts with two empty decks, unbound slots, idle MIDI, and no seen tunes', () => {
      expect(store.decks().A.status).toBe('empty');
      expect(store.decks().A.loaded).toBeNull();
      expect(store.decks().A.busy).toBe(false);
      expect(store.decks().A.repeat).toBe(true);
      expect(store.decks().B).toEqual(store.decks().A);

      expect(store.bindings().A).toEqual(emptyBinding());
      expect(store.bindings().B).toEqual(emptyBinding());

      expect(store.midi()).toEqual({ accessState: 'idle', ports: [], lastError: null });
      expect(store.seen()).toEqual({});
    });
  });

  describe('actions', () => {
    beforeEach(() => setup());

    it('setDeckStatus sets the status and clears error unless one is given', () => {
      store.setDeckStatus({ slot: 'A', status: 'failed', error: 'boom' });
      expect(store.decks().A.status).toBe('failed');
      expect(store.decks().A.error).toBe('boom');

      store.setDeckStatus({ slot: 'A', status: 'stopped' });
      expect(store.decks().A.status).toBe('stopped');
      expect(store.decks().A.error).toBeNull();
    });

    it('setDeckStatus leaves the other slot untouched', () => {
      store.setDeckStatus({ slot: 'A', status: 'playing' });
      expect(store.decks().B.status).toBe('empty');
    });

    it('setDeckLoaded sets loaded and the reference-derived subtune fields, and resets position/length/structure/error', () => {
      store.samplePosition({ slot: 'A', positionFrames: 500 });
      store.setDeckStructure({
        slot: 'A',
        structure: { loopStartFrame: 10, loopPeriodFrames: 20, endedAtFrame: null },
        lengthFrames: 999,
      });
      store.setDeckStatus({ slot: 'A', status: 'failed', error: 'previous failure' });

      const reference = tuneReference({ identity: { sidHash: 'abc', subtune: 2 }, subtuneCount: 5 });
      store.setDeckLoaded({ slot: 'A', reference });

      const deck = store.decks().A;
      expect(deck.loaded).toBe(reference);
      expect(deck.subtune).toBe(2);
      expect(deck.subtuneCount).toBe(5);
      expect(deck.positionFrames).toBe(0);
      expect(deck.lengthFrames).toBeNull();
      expect(deck.structure).toBeNull();
      expect(deck.error).toBeNull();
      expect(deck.status).toBe('failed'); // status is a separate action; setDeckLoaded doesn't touch it
    });

    it('setDeckStructure sets structure and length', () => {
      const structure = { loopStartFrame: 100, loopPeriodFrames: 200, endedAtFrame: null };
      store.setDeckStructure({ slot: 'B', structure, lengthFrames: 300 });

      expect(store.decks().B.structure).toEqual(structure);
      expect(store.decks().B.lengthFrames).toBe(300);
    });

    it('samplePosition sets only positionFrames', () => {
      store.setDeckStatus({ slot: 'A', status: 'playing' });
      store.samplePosition({ slot: 'A', positionFrames: 42 });

      expect(store.decks().A.positionFrames).toBe(42);
      expect(store.decks().A.status).toBe('playing');
    });

    it('setDeckSubtune sets subtune', () => {
      store.setDeckSubtune({ slot: 'A', subtune: 3 });
      expect(store.decks().A.subtune).toBe(3);
    });

    it('setDeckRepeat sets repeat', () => {
      store.setDeckRepeat({ slot: 'A', repeat: false });
      expect(store.decks().A.repeat).toBe(false);
    });

    it('setDeckBusy sets busy, leaving the other slot untouched', () => {
      store.setDeckBusy({ slot: 'A', busy: true });
      expect(store.decks().A.busy).toBe(true);
      expect(store.decks().B.busy).toBe(false);

      store.setDeckBusy({ slot: 'A', busy: false });
      expect(store.decks().A.busy).toBe(false);
    });

    it('setBinding replaces the slot binding wholesale, leaving the other slot untouched', () => {
      const binding: DeckBindingState = {
        port: { id: 'port-1', name: 'Port One' },
        portPresent: true,
        error: null,
      };
      store.setBinding({ slot: 'A', binding });

      expect(store.bindings().A).toEqual(binding);
      expect(store.bindings().B).toEqual(emptyBinding());
    });

    it('setMidi replaces the whole MIDI slice', () => {
      const midi: MidiState = {
        accessState: 'granted',
        ports: [{ id: 'p1', name: 'Port', manufacturer: 'Acme' }],
        lastError: null,
      };
      store.setMidi(midi);

      expect(store.midi()).toEqual(midi);
    });

    it('markSeen accumulates entries keyed by file key', () => {
      const keyA = DjFileKeyUtil.create('device-1', StorageType.Sd, '/a.sid');
      const keyB = DjFileKeyUtil.create('device-1', StorageType.Sd, '/b.sid');
      const refA = tuneReference({ title: 'A' });
      const refB = tuneReference({ title: 'B' });

      store.markSeen({ key: keyA, reference: refA });
      store.markSeen({ key: keyB, reference: refB });

      expect(store.seen()).toEqual({ [keyA]: refA, [keyB]: refB });
    });
  });

  describe('transportSummary', () => {
    beforeEach(() => setup());

    // `busy` here mirrors what `DeckService` actually sets alongside each status in real usage —
    // `loading`/`indexing` never occur without it — so the matrix stays a realistic scenario, not
    // just an isolated formula check.
    const statusCases: Array<{
      status: DeckStatus;
      busy: boolean;
      led: string;
      label: string;
      showing: 'play' | 'pause';
      controlsDisabled: boolean;
      canStop: boolean;
    }> = [
      {
        status: 'empty',
        busy: false,
        led: 'stopped',
        label: 'Stopped',
        showing: 'play',
        controlsDisabled: true,
        canStop: false,
      },
      {
        status: 'loading',
        busy: true,
        led: 'analyzing',
        label: 'Analyzing…',
        showing: 'play',
        controlsDisabled: true,
        canStop: false,
      },
      {
        status: 'indexing',
        busy: true,
        led: 'analyzing',
        label: 'Analyzing…',
        showing: 'play',
        controlsDisabled: true,
        canStop: false,
      },
      {
        status: 'playing',
        busy: false,
        led: 'playing',
        label: 'Playing',
        showing: 'pause',
        controlsDisabled: false,
        canStop: true,
      },
      {
        status: 'paused',
        busy: false,
        led: 'paused',
        label: 'Paused',
        showing: 'play',
        controlsDisabled: false,
        canStop: true,
      },
      {
        status: 'stopped',
        busy: false,
        led: 'stopped',
        label: 'Stopped',
        showing: 'play',
        controlsDisabled: false,
        canStop: false,
      },
    ];

    it.each(statusCases)(
      'derives led/label/showing/gates for status $status (busy=$busy)',
      ({ status, busy, led, label, showing, controlsDisabled, canStop }) => {
        store.setDeckStatus({ slot: 'A', status });
        store.setDeckBusy({ slot: 'A', busy });
        const summary = store.transportSummary('A')();

        expect(summary.led).toBe(led);
        expect(summary.label).toBe(label);
        expect(summary.showing).toBe(showing);
        expect(summary.controlsDisabled).toBe(controlsDisabled);
        expect(summary.canStop).toBe(canStop);
      }
    );

    it('busy disables controls and blocks canStop even while playing or paused — the cache-hit seam', () => {
      store.setDeckStatus({ slot: 'A', status: 'playing' });
      store.setDeckBusy({ slot: 'A', busy: true });
      let summary = store.transportSummary('A')();
      expect(summary.led).toBe('playing');
      expect(summary.controlsDisabled).toBe(true);
      expect(summary.canStop).toBe(false);

      store.setDeckStatus({ slot: 'A', status: 'paused' });
      summary = store.transportSummary('A')();
      expect(summary.controlsDisabled).toBe(true);
      expect(summary.canStop).toBe(false);

      store.setDeckBusy({ slot: 'A', busy: false });
      summary = store.transportSummary('A')();
      expect(summary.controlsDisabled).toBe(false);
      expect(summary.canStop).toBe(true);
    });

    it('failed status reports the error reason as its label, under the error led', () => {
      store.setDeckStatus({ slot: 'A', status: 'failed', error: 'Device disconnected' });
      const summary = store.transportSummary('A')();

      expect(summary.led).toBe('error');
      expect(summary.label).toBe('Device disconnected');
    });

    // DeckService.togglePlayPause() is a deliberate no-op while failed (deck.service.spec.ts's
    // "is a no-op while %s" matrix covers 'failed'), so the toggle must render disabled here too —
    // an enabled Play button that does nothing on click is the bug this guards against.
    it('failed status disables the transport controls, matching togglePlayPause() being a no-op', () => {
      store.setDeckStatus({ slot: 'A', status: 'failed', error: 'Device disconnected' });
      const summary = store.transportSummary('A')();

      expect(summary.controlsDisabled).toBe(true);
      expect(summary.canStop).toBe(false);
    });

    it('the bar is analyzing while indexing, even with structure already present', () => {
      store.setDeckStructure({
        slot: 'A',
        structure: { loopStartFrame: 0, loopPeriodFrames: 100, endedAtFrame: null },
        lengthFrames: 100,
      });
      store.setDeckStatus({ slot: 'A', status: 'indexing' });

      expect(store.transportSummary('A')().bar).toEqual({ kind: 'analyzing' });
    });

    it('the bar is unknown with no structure', () => {
      store.setDeckStatus({ slot: 'A', status: 'stopped' });
      expect(store.transportSummary('A')().bar).toEqual({ kind: 'unknown' });
    });

    it('the bar is unknown when structure carries no usable span', () => {
      store.setDeckStatus({ slot: 'A', status: 'stopped' });
      store.setDeckStructure({
        slot: 'A',
        structure: { loopStartFrame: null, loopPeriodFrames: null, endedAtFrame: null },
        lengthFrames: null,
      });

      expect(store.transportSummary('A')().bar).toEqual({ kind: 'unknown' });
    });

    it('the bar is a loop with introPercent when a usable period exists', () => {
      store.setDeckStatus({ slot: 'A', status: 'playing' });
      store.setDeckStructure({
        slot: 'A',
        structure: { loopStartFrame: 100, loopPeriodFrames: 300, endedAtFrame: null },
        lengthFrames: 400,
      });

      expect(store.transportSummary('A')().bar).toEqual({ kind: 'loop', introPercent: 25 });
    });

    it('the bar is ended with the fixed 80% music share when no loop period exists', () => {
      store.setDeckStatus({ slot: 'A', status: 'playing' });
      store.setDeckStructure({
        slot: 'A',
        structure: { loopStartFrame: null, loopPeriodFrames: null, endedAtFrame: 500 },
        lengthFrames: 500,
      });

      expect(store.transportSummary('A')().bar).toEqual({ kind: 'ended', musicPercent: 80 });
    });

    it('clamps scrubPercent to [0, 100] and reports 0 with no length', () => {
      store.setDeckStatus({ slot: 'A', status: 'playing' });
      expect(store.transportSummary('A')().scrubPercent).toBe(0);

      store.setDeckStructure({
        slot: 'A',
        structure: { loopStartFrame: null, loopPeriodFrames: null, endedAtFrame: null },
        lengthFrames: 1000,
      });
      store.samplePosition({ slot: 'A', positionFrames: 250 });
      expect(store.transportSummary('A')().scrubPercent).toBe(25);

      store.samplePosition({ slot: 'A', positionFrames: 5000 });
      expect(store.transportSummary('A')().scrubPercent).toBe(100);
    });

    it('gates subtuneDisabled on controlsDisabled and a single subtune', () => {
      store.setDeckStatus({ slot: 'A', status: 'playing' });
      store.setDeckLoaded({
        slot: 'A',
        reference: tuneReference({ subtuneCount: 1, identity: { sidHash: 'x', subtune: 1 } }),
      });
      expect(store.transportSummary('A')().subtuneDisabled).toBe(true);

      store.setDeckLoaded({
        slot: 'A',
        reference: tuneReference({ subtuneCount: 3, identity: { sidHash: 'x', subtune: 1 } }),
      });
      expect(store.transportSummary('A')().subtuneDisabled).toBe(false);

      store.setDeckBusy({ slot: 'A', busy: true });
      expect(store.transportSummary('A')().subtuneDisabled).toBe(true);
    });

    it('formats frameLabel and subtuneText', () => {
      store.setDeckLoaded({
        slot: 'A',
        reference: tuneReference({ subtuneCount: 4, identity: { sidHash: 'x', subtune: 1 } }),
      });
      store.samplePosition({ slot: 'A', positionFrames: 777 });
      store.setDeckSubtune({ slot: 'A', subtune: 2 });

      const summary = store.transportSummary('A')();
      expect(summary.frameLabel).toBe('frame 777');
      expect(summary.subtuneText).toBe('Subtune 2 of 4');
    });
  });

  describe('bindingSummary', () => {
    beforeEach(() => setup());

    it('flags ports already taken by the other slot', () => {
      store.setMidi({
        accessState: 'granted',
        ports: [
          { id: 'port-1', name: 'Port One', manufacturer: 'Acme' },
          { id: 'port-2', name: 'Port Two', manufacturer: 'Acme' },
        ],
        lastError: null,
      });
      store.setBinding({
        slot: 'B',
        binding: { port: { id: 'port-1', name: 'Port One' }, portPresent: true, error: null },
      });

      const summary = store.bindingSummary('A')();

      expect(summary.portOptions).toEqual([
        { id: 'port-1', label: 'Port One (Acme)', takenBy: 'B' },
        { id: 'port-2', label: 'Port Two (Acme)', takenBy: null },
      ]);
    });

    it('flags taken in the other direction too', () => {
      store.setMidi({
        accessState: 'granted',
        ports: [{ id: 'port-1', name: 'Port One', manufacturer: 'Acme' }],
        lastError: null,
      });
      store.setBinding({
        slot: 'A',
        binding: { port: { id: 'port-1', name: 'Port One' }, portPresent: true, error: null },
      });

      expect(store.bindingSummary('B')().portOptions).toEqual([
        { id: 'port-1', label: 'Port One (Acme)', takenBy: 'A' },
      ]);
    });

    it('reports the selected id only while present, and null while stored-but-absent', () => {
      store.setBinding({
        slot: 'A',
        binding: { port: { id: 'port-1', name: 'Port One' }, portPresent: true, error: null },
      });
      expect(store.bindingSummary('A')().selectedPortId).toBe('port-1');

      store.setBinding({
        slot: 'A',
        binding: { port: { id: 'port-1', name: 'Port One' }, portPresent: false, error: null },
      });
      expect(store.bindingSummary('A')().selectedPortId).toBeNull();
    });

    it('portPlaceholder shows the last-saw name whenever a port is bound but absent, whatever the access state', () => {
      store.setBinding({
        slot: 'A',
        binding: { port: { id: 'port-1', name: 'Port One' }, portPresent: false, error: null },
      });

      expect(store.bindingSummary('A')().portPlaceholder).toBe('— last saw Port One —');

      store.setMidi({ accessState: 'granted', ports: [], lastError: null });
      expect(store.bindingSummary('A')().portPlaceholder).toBe('— last saw Port One —');
    });

    it('portPlaceholder is "MIDI not enabled" with nothing stored, and "select a port" once granted', () => {
      expect(store.bindingSummary('A')().portPlaceholder).toBe('— MIDI not enabled —');

      store.setMidi({ accessState: 'granted', ports: [], lastError: null });
      expect(store.bindingSummary('A')().portPlaceholder).toBe('— select a port —');
    });

    it('portsEnabled and enableDisabled follow accessState', () => {
      expect(store.bindingSummary('A')().portsEnabled).toBe(false);
      expect(store.bindingSummary('A')().enableDisabled).toBe(false);

      store.setMidi({ accessState: 'requesting', ports: [], lastError: null });
      expect(store.bindingSummary('A')().enableDisabled).toBe(true);

      store.setMidi({ accessState: 'granted', ports: [], lastError: null });
      expect(store.bindingSummary('A')().portsEnabled).toBe(true);
    });

    it('enableVisible is true for every access state except granted', () => {
      for (const accessState of ['idle', 'requesting', 'denied', 'unsupported'] as const) {
        store.setMidi({ accessState, ports: [], lastError: null });
        expect(store.bindingSummary('A')().enableVisible).toBe(true);
      }

      store.setMidi({ accessState: 'granted', ports: [], lastError: null });
      expect(store.bindingSummary('A')().enableVisible).toBe(false);
    });

    it('identifyDisabled unless granted, a present port is bound, and the deck is not playing', () => {
      expect(store.bindingSummary('A')().identifyDisabled).toBe(true);

      store.setMidi({
        accessState: 'granted',
        ports: [{ id: 'port-1', name: 'Port One', manufacturer: 'Acme' }],
        lastError: null,
      });
      store.setBinding({
        slot: 'A',
        binding: { port: { id: 'port-1', name: 'Port One' }, portPresent: true, error: null },
      });
      expect(store.bindingSummary('A')().identifyDisabled).toBe(false);

      store.setDeckStatus({ slot: 'A', status: 'playing' });
      expect(store.bindingSummary('A')().identifyDisabled).toBe(true);
    });

    it('collects midi, no-ports-found, and binding errors, filtering out the absent ones', () => {
      expect(store.bindingSummary('A')().errors).toEqual([]);

      store.setMidi({ accessState: 'granted', ports: [], lastError: null });
      const noPortsErrors = store.bindingSummary('A')().errors;
      expect(noPortsErrors).toHaveLength(1);
      expect(noPortsErrors[0]).not.toContain('re-enable');

      store.setMidi({ accessState: 'idle', ports: [], lastError: 'Web MIDI unavailable' });
      store.setBinding({
        slot: 'A',
        binding: { port: null, portPresent: false, error: 'port missing' },
      });
      expect(store.bindingSummary('A')().errors).toEqual(['Web MIDI unavailable', 'port missing']);
    });
  });
});
