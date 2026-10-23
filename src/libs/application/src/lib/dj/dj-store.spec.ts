import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import type { TuneReference } from '@sidablist/tunes';
import { StorageType } from '@teensyrom-nx/domain';
import { logInfo } from '@teensyrom-nx/utils';
import {
  DjStore,
  DeckBindingState,
  DeckDetectedKey,
  DeckStatus,
  HOME_DECK_PANEL,
  HOME_VOICE_STRIP,
  MidiState,
} from './dj-store';
import { DjFileKeyUtil } from './dj-file-key.util';

vi.mock('@teensyrom-nx/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@teensyrom-nx/utils')>();
  return { ...actual, logInfo: vi.fn(actual.logInfo) };
});

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
  device: null,
  portId: null,
  present: false,
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

    it('starts both decks with home speed, three unmuted unheld voices, no key and not switching', () => {
      for (const slot of ['A', 'B'] as const) {
        const deck = store.decks()[slot];
        expect(deck.speed).toBe(1);
        expect(deck.voices).toEqual([
          { muted: false, held: false },
          { muted: false, held: false },
          { muted: false, held: false },
        ]);
        expect(deck.detectedKey).toBeNull();
        expect(deck.switching).toBe(false);
      }
    });

    it('starts both panels at home and the key format Camelot', () => {
      expect(store.panel().A).toEqual(HOME_DECK_PANEL);
      expect(store.panel().B).toEqual(HOME_DECK_PANEL);
      expect(HOME_DECK_PANEL.voices).toEqual([HOME_VOICE_STRIP, HOME_VOICE_STRIP, HOME_VOICE_STRIP]);
      expect(store.keyDisplayFormat()).toBe('camelot');
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
        device: { id: '1234', name: 'TR-1' },
        portId: 'port-1',
        present: true,
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

    it('setVoiceStrip merges the patch into one voice and leaves the other voices, fields and slot alone', () => {
      store.setVoiceStrip({
        slot: 'A',
        voice: 1,
        patch: { coarse: 7, fine: 12.5, waveformLock: 'pulse', ringLock: false },
      });

      const panel = store.panel().A;
      expect(panel.voices[1]).toEqual({
        ...HOME_VOICE_STRIP,
        coarse: 7,
        fine: 12.5,
        waveformLock: 'pulse',
        ringLock: false,
      });
      expect(panel.voices[0]).toEqual(HOME_VOICE_STRIP);
      expect(panel.voices[2]).toEqual(HOME_VOICE_STRIP);
      expect(panel.cutoff).toBe(0);
      expect(store.panel().B).toEqual(HOME_DECK_PANEL);
    });

    it('setVoiceStrip changes nothing for a voice that is not 0…2', () => {
      store.setVoiceStrip({ slot: 'A', voice: 3, patch: { coarse: 7 } });
      store.setVoiceStrip({ slot: 'A', voice: -1, patch: { coarse: 7 } });

      expect(store.panel().A).toEqual(HOME_DECK_PANEL);
    });

    it('setDeckPanel merges the patch and leaves the voice strips and the other slot alone', () => {
      store.setVoiceStrip({ slot: 'A', voice: 0, patch: { attack: 4 } });

      store.setDeckPanel({
        slot: 'A',
        patch: { cutoff: -300, filterModeLock: 'band-pass', keySemitones: 5 },
      });

      expect(store.panel().A).toMatchObject({
        cutoff: -300,
        resonance: 0,
        filterModeLock: 'band-pass',
        keySemitones: 5,
      });
      expect(store.panel().A.voices[0].attack).toBe(4);
      expect(store.panel().B).toEqual(HOME_DECK_PANEL);
    });

    it('setKeyDisplayFormat sets the format', () => {
      store.setKeyDisplayFormat({ format: 'note' });
      expect(store.keyDisplayFormat()).toBe('note');
    });

    it('resetDeckPanel on a panic homes the whole panel and leaves the detected key and the rest alone', () => {
      store.setVoiceStrip({ slot: 'A', voice: 2, patch: { coarse: 9, syncLock: true } });
      store.setDeckPanel({ slot: 'A', patch: { cutoff: 600, keySemitones: 5 } });
      store.setDeckPanel({ slot: 'B', patch: { cutoff: 300 } });
      store.setDeckDetectedKey({
        slot: 'A',
        detectedKey: { tonic: 1, mode: 'minor', camelot: '8A' },
      });
      store.setDeckEngineControls({
        slot: 'A',
        speed: 1.2,
        faderSpeed: 1.2,
        nudging: false,
        voices: store.decks().A.voices,
      });
      store.setKeyDisplayFormat({ format: 'note' });
      vi.mocked(logInfo).mockClear();

      store.resetDeckPanel({ slot: 'A', reason: 'panic' });

      expect(store.panel().A).toEqual(HOME_DECK_PANEL);
      expect(store.panel().B.cutoff).toBe(300);
      expect(store.decks().A.detectedKey).not.toBeNull();
      expect(store.decks().A.speed).toBe(1.2);
      expect(store.keyDisplayFormat()).toBe('note');
      expect(logInfo).toHaveBeenCalledTimes(1);
      expect(vi.mocked(logInfo).mock.calls[0][1]).toBe('Deck A panel reset (panic)');
    });

    it('resetDeckPanel on a tune change also clears the detected key', () => {
      store.setDeckPanel({ slot: 'B', patch: { keySemitones: -3 } });
      store.setDeckDetectedKey({
        slot: 'B',
        detectedKey: { tonic: 1, mode: 'minor', camelot: '8A' },
      });
      vi.mocked(logInfo).mockClear();

      store.resetDeckPanel({ slot: 'B', reason: 'tune-change' });

      expect(store.panel().B).toEqual(HOME_DECK_PANEL);
      expect(store.decks().B.detectedKey).toBeNull();
      expect(logInfo).toHaveBeenCalledTimes(1);
      expect(vi.mocked(logInfo).mock.calls[0][1]).toBe('Deck B panel reset (tune change)');
    });

    it('setDeckEngineControls sets speed, fader value, nudge flag and voices only, leaving the other slot untouched', () => {
      const voices = [
        { muted: true, held: false },
        { muted: false, held: true },
        { muted: false, held: false },
      ];
      store.setDeckStatus({ slot: 'A', status: 'playing' });

      store.setDeckEngineControls({ slot: 'A', speed: 1.37, faderSpeed: 1.32, nudging: true, voices });

      expect(store.decks().A.speed).toBe(1.37);
      expect(store.decks().A.faderSpeed).toBe(1.32);
      expect(store.decks().A.nudging).toBe(true);
      expect(store.decks().A.voices).toEqual(voices);
      expect(store.decks().A.status).toBe('playing');
      expect(store.decks().B.speed).toBe(1);
      expect(store.decks().B.faderSpeed).toBe(1);
      expect(store.decks().B.nudging).toBe(false);
    });

    it('setDeckTiming sets the play-call interval only, leaving the other slot untouched', () => {
      store.setDeckTiming({ slot: 'A', playCallIntervalUs: 19_950 });

      expect(store.decks().A.playCallIntervalUs).toBe(19_950);
      expect(store.decks().B.playCallIntervalUs).toBeNull();
    });

    it('setDeckSwitching sets switching, leaving busy and the other slot untouched', () => {
      store.setDeckSwitching({ slot: 'A', switching: true });
      expect(store.decks().A.switching).toBe(true);
      expect(store.decks().A.busy).toBe(false);
      expect(store.decks().B.switching).toBe(false);

      store.setDeckSwitching({ slot: 'A', switching: false });
      expect(store.decks().A.switching).toBe(false);
    });

    it('setDeckDetectedKey sets and clears the detected key', () => {
      const detectedKey: DeckDetectedKey = { tonic: 9, mode: 'minor', camelot: '8A' };

      store.setDeckDetectedKey({ slot: 'B', detectedKey });
      expect(store.decks().B.detectedKey).toEqual(detectedKey);
      expect(store.decks().A.detectedKey).toBeNull();

      store.setDeckDetectedKey({ slot: 'B', detectedKey: null });
      expect(store.decks().B.detectedKey).toBeNull();
    });
  });

  describe('deckPanel', () => {
    beforeEach(() => setup());

    it('reads the slot panel', () => {
      const panel = store.deckPanel('B');
      expect(panel().cutoff).toBe(0);

      store.setDeckPanel({ slot: 'B', patch: { cutoff: -500 } });
      expect(panel().cutoff).toBe(-500);
    });
  });

  describe('canShape', () => {
    beforeEach(() => setup());

    function load(): void {
      store.setDeckLoaded({ slot: 'A', reference: tuneReference() });
    }

    it('is false for an empty deck, even at a settled status', () => {
      store.setDeckStatus({ slot: 'A', status: 'stopped' });
      expect(store.canShape('A')()).toBe(false);
    });

    it.each(['empty', 'loading', 'indexing', 'failed'] as const)(
      'is false for a loaded deck that is %s',
      (status) => {
        load();
        store.setDeckStatus({ slot: 'A', status });
        expect(store.canShape('A')()).toBe(false);
      }
    );

    it.each(['playing', 'paused', 'stopped'] as const)(
      'is true for a loaded deck that is %s',
      (status) => {
        load();
        store.setDeckStatus({ slot: 'A', status });
        expect(store.canShape('A')()).toBe(true);
      }
    );

    it('is false while switching, and true again once it clears', () => {
      load();
      store.setDeckStatus({ slot: 'A', status: 'playing' });

      store.setDeckSwitching({ slot: 'A', switching: true });
      expect(store.canShape('A')()).toBe(false);

      store.setDeckSwitching({ slot: 'A', switching: false });
      expect(store.canShape('A')()).toBe(true);
    });

    it('stays true while busy is set by a Play press', () => {
      load();
      store.setDeckStatus({ slot: 'A', status: 'paused' });
      store.setDeckBusy({ slot: 'A', busy: true });

      expect(store.canShape('A')()).toBe(true);
    });
  });

  describe('keyReadout', () => {
    beforeEach(() => setup());

    const cSharpMinor: DeckDetectedKey = { tonic: 1, mode: 'minor', camelot: '8B' };

    it('shows the detected key in Camelot by default', () => {
      store.setDeckDetectedKey({ slot: 'A', detectedKey: cSharpMinor });
      expect(store.keyReadout('A')()).toBe('8B');
    });

    it('shows the detected key as a note name once the format is note', () => {
      store.setDeckDetectedKey({ slot: 'A', detectedKey: cSharpMinor });
      store.setKeyDisplayFormat({ format: 'note' });
      expect(store.keyReadout('A')()).toBe('C#m');
    });

    it('shifts the detected key by keySemitones in both formats', () => {
      store.setDeckDetectedKey({ slot: 'A', detectedKey: cSharpMinor });
      store.setDeckPanel({ slot: 'A', patch: { keySemitones: 3 } });

      expect(store.keyReadout('A')()).toBe('9A');
      store.setKeyDisplayFormat({ format: 'note' });
      expect(store.keyReadout('A')()).toBe('Em');
    });

    it('wraps a shifted note past B back to C', () => {
      store.setDeckDetectedKey({
        slot: 'A',
        detectedKey: { tonic: 11, mode: 'major', camelot: '1B' },
      });
      store.setKeyDisplayFormat({ format: 'note' });
      store.setDeckPanel({ slot: 'A', patch: { keySemitones: 1 } });

      expect(store.keyReadout('A')()).toBe('C');
    });

    it('falls back to the signed offset with no detected key, using U+2212 for negatives', () => {
      expect(store.keyReadout('A')()).toBe('0');

      store.setDeckPanel({ slot: 'A', patch: { keySemitones: 3 } });
      expect(store.keyReadout('A')()).toBe('+3');

      store.setDeckPanel({ slot: 'A', patch: { keySemitones: -5 } });
      expect(store.keyReadout('A')()).toBe('−5');
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

    describe('title, author, time and compact subtune', () => {
      const loadTune = (): void =>
        store.setDeckLoaded({
          slot: 'A',
          reference: tuneReference({ title: 'Commando', author: 'Rob Hubbard', subtuneCount: 4 }),
        });

      it('reports nothing known for an empty deck', () => {
        const summary = store.transportSummary('A')();

        expect(summary.title).toBeNull();
        expect(summary.author).toBeNull();
        expect(summary.elapsedText).toBe('00:00.0');
        expect(summary.totalText).toBe('--:--');
        expect(summary.subtuneCompact).toBe('–/–');
      });

      it('reports title and author from the loaded tune, and the compact subtune', () => {
        loadTune();
        store.setDeckSubtune({ slot: 'A', subtune: 2 });

        const summary = store.transportSummary('A')();
        expect(summary.title).toBe('Commando');
        expect(summary.author).toBe('Rob Hubbard');
        expect(summary.subtuneCompact).toBe('2/4');
      });

      it('derives elapsed and total from the play-call interval, and follows the playhead', () => {
        loadTune();
        store.setDeckTiming({ slot: 'A', playCallIntervalUs: 20_000 });
        store.setDeckStructure({
          slot: 'A',
          structure: { loopStartFrame: null, loopPeriodFrames: null, endedAtFrame: null },
          lengthFrames: 9_000,
        });
        store.samplePosition({ slot: 'A', positionFrames: 3_001 });

        const summary = store.transportSummary('A')();
        expect(summary.elapsedText).toBe('01:00.0');
        expect(summary.totalText).toBe('03:00');

        store.samplePosition({ slot: 'A', positionFrames: 2_999 });
        expect(store.transportSummary('A')().elapsedText).toBe('00:59.9');
      });

      it('keeps the total unknown until both the length and the interval are known', () => {
        loadTune();
        store.setDeckStructure({
          slot: 'A',
          structure: { loopStartFrame: null, loopPeriodFrames: null, endedAtFrame: null },
          lengthFrames: 9_000,
        });
        expect(store.transportSummary('A')().totalText).toBe('--:--');

        store.setDeckTiming({ slot: 'A', playCallIntervalUs: 20_000 });
        expect(store.transportSummary('A')().totalText).toBe('03:00');
      });

      it('keeps the failure reason as the label of a failed deck', () => {
        loadTune();
        store.setDeckStatus({ slot: 'A', status: 'failed', error: 'Tune would not parse' });

        expect(store.transportSummary('A')().label).toBe('Tune would not parse');
      });
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

    const presentBinding = (): DeckBindingState => ({
      device: { id: '1234', name: 'TR-1' },
      portId: 'port-1',
      present: true,
      error: null,
    });

    it('reports the bound cartridge as selected whether it is present or absent', () => {
      store.setBinding({ slot: 'A', binding: presentBinding() });
      expect(store.bindingSummary('A')().selectedDeviceId).toBe('1234');
      expect(store.bindingSummary('A')().present).toBe(true);

      store.setBinding({
        slot: 'A',
        binding: { ...presentBinding(), portId: null, present: false },
      });
      expect(store.bindingSummary('A')().selectedDeviceId).toBe('1234');
      expect(store.bindingSummary('A')().present).toBe(false);
    });

    it('selects nothing for an unbound slot, with the cartridge placeholder', () => {
      const summary = store.bindingSummary('A')();

      expect(summary.selectedDeviceId).toBeNull();
      expect(summary.placeholder).toBe('— select a cartridge —');
    });

    it('enableDisabled follows accessState', () => {
      expect(store.bindingSummary('A')().enableDisabled).toBe(false);

      store.setMidi({ accessState: 'requesting', ports: [], lastError: null });
      expect(store.bindingSummary('A')().enableDisabled).toBe(true);
    });

    it('enableVisible is true for every access state except granted', () => {
      for (const accessState of ['idle', 'requesting', 'denied', 'unsupported'] as const) {
        store.setMidi({ accessState, ports: [], lastError: null });
        expect(store.bindingSummary('A')().enableVisible).toBe(true);
      }

      store.setMidi({ accessState: 'granted', ports: [], lastError: null });
      expect(store.bindingSummary('A')().enableVisible).toBe(false);
    });

    it('identifyDisabled unless granted, the cartridge is present, and the deck is not playing', () => {
      expect(store.bindingSummary('A')().identifyDisabled).toBe(true);

      store.setMidi({
        accessState: 'granted',
        ports: [{ id: 'port-1', name: 'TeensyROM-1234', manufacturer: 'Acme' }],
        lastError: null,
      });
      store.setBinding({ slot: 'A', binding: presentBinding() });
      expect(store.bindingSummary('A')().identifyDisabled).toBe(false);

      store.setDeckStatus({ slot: 'A', status: 'playing' });
      expect(store.bindingSummary('A')().identifyDisabled).toBe(true);
    });

    it('identifyDisabled while the bound cartridge is absent, even with MIDI granted', () => {
      store.setMidi({ accessState: 'granted', ports: [], lastError: null });
      store.setBinding({
        slot: 'A',
        binding: { ...presentBinding(), portId: null, present: false },
      });

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
        binding: { ...emptyBinding(), error: 'cartridge missing' },
      });
      expect(store.bindingSummary('A')().errors).toEqual([
        'Web MIDI unavailable',
        'cartridge missing',
      ]);
    });
  });
});
