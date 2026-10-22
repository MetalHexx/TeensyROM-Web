import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import { SID_REGISTER_COUNT } from '@sidablist/core';
import { logWarn } from '@teensyrom-nx/utils';
import { DeckRuntime } from './deck-runtime';
import { DjStore } from './dj-store';
import { SidPanelPainter } from './sid-panel-painter';
import type { DeckPanelTargets, PanelLevelTarget, PanelLightTarget, VoiceStripTargets } from './sid-panel-targets';
import type { Slot } from './slot';

vi.mock('@teensyrom-nx/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@teensyrom-nx/utils')>();
  return { ...actual, logWarn: vi.fn() };
});

const TRIANGLE = 0x10;
const SAWTOOTH = 0x20;

interface RecordingTargets {
  readonly targets: DeckPanelTargets;
  readonly levels: ReturnType<typeof vi.fn>[];
  readonly lights: ReturnType<typeof vi.fn>[];
}

function recordingTargets(): RecordingTargets {
  const levels: ReturnType<typeof vi.fn>[] = [];
  const lights: ReturnType<typeof vi.fn>[] = [];
  const level = (): PanelLevelTarget => {
    const setLiveLevel = vi.fn();
    levels.push(setLiveLevel);
    return { setLiveLevel };
  };
  const light = (): PanelLightTarget => {
    const setLiveLight = vi.fn();
    lights.push(setLiveLight);
    return { setLiveLight };
  };
  const strip = (): VoiceStripTargets => ({
    waveforms: [light(), light(), light(), light()],
    coarse: level(),
    fine: level(),
    pulseWidth: level(),
    attack: level(),
    decay: level(),
    sustain: level(),
    release: level(),
    ring: light(),
    sync: light(),
    filter: light(),
  });
  const targets: DeckPanelTargets = {
    voices: [strip(), strip(), strip()],
    cutoff: level(),
    resonance: level(),
    filterModes: [light(), light(), light()],
  };
  return { targets, levels, lights };
}

describe('SidPanelPainter', () => {
  let painter: SidPanelPainter;
  let store: InstanceType<typeof DjStore>;
  let written: Uint8Array;
  let sent: Uint8Array;
  let readRegisters: ReturnType<typeof vi.fn>;
  let frameCallbacks: FrameRequestCallback[];

  function runFrames(): void {
    const due = frameCallbacks;
    frameCallbacks = [];
    for (const callback of due) {
      callback(0);
    }
  }

  function clearCalls(recording: RecordingTargets): void {
    for (const fn of [...recording.levels, ...recording.lights]) {
      fn.mockClear();
    }
  }

  function totalCalls(recording: RecordingTargets): number {
    return [...recording.levels, ...recording.lights].reduce((sum, fn) => sum + fn.mock.calls.length, 0);
  }

  beforeEach(() => {
    written = new Uint8Array(SID_REGISTER_COUNT);
    sent = new Uint8Array(SID_REGISTER_COUNT);
    readRegisters = vi.fn((_slot: Slot, writtenOut: Uint8Array, sentOut: Uint8Array) => {
      writtenOut.set(written);
      sentOut.set(sent);
    });
    frameCallbacks = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback): number => frameCallbacks.push(callback));
    vi.mocked(logWarn).mockClear();

    TestBed.configureTestingModule({
      providers: [{ provide: DeckRuntime, useValue: { readRegisters } }],
    });
    painter = TestBed.inject(SidPanelPainter);
    store = TestBed.inject(DjStore);
    TestBed.flushEffects();
    runFrames();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('paints every indicator on attach, and the second identical paint touches none', () => {
    const recording = recordingTargets();

    painter.attach('A', recording.targets);

    expect(recording.levels.every((fn) => fn.mock.calls.length === 1)).toBe(true);
    expect(recording.lights.every((fn) => fn.mock.calls.length === 1)).toBe(true);

    clearCalls(recording);
    painter.paint('A');

    expect(totalCalls(recording)).toBe(0);
  });

  it('a changed field reaches only its own target', () => {
    const recording = recordingTargets();
    painter.attach('A', recording.targets);
    clearCalls(recording);

    sent[5 + 7] = 0xf0; // voice 1 attack 15
    painter.paint('A');

    expect(recording.targets.voices[1].attack.setLiveLevel).toHaveBeenCalledExactlyOnceWith(1);
    expect(totalCalls(recording)).toBe(1);
  });

  it('paints pitch on an octave scale, to both coarse and fine', () => {
    const recording = recordingTargets();
    painter.attach('A', recording.targets);

    sent[0] = 0x00;
    sent[1] = 0x10; // 4096
    painter.paint('A');
    const strip = recording.targets.voices[0];
    expect(strip.coarse.setLiveLevel).toHaveBeenLastCalledWith(0.75);
    expect(strip.fine.setLiveLevel).toHaveBeenLastCalledWith(0.75);

    sent[1] = 0x20; // 8192, one octave up
    painter.paint('A');
    expect(strip.coarse.setLiveLevel).toHaveBeenLastCalledWith(0.813);

    sent[0] = 0;
    sent[1] = 0;
    painter.paint('A');
    expect(strip.coarse.setLiveLevel).toHaveBeenLastCalledWith(0);
  });

  it('shows a ghost on a waveform the tune wrote but a lock replaced', () => {
    const recording = recordingTargets();
    painter.attach('A', recording.targets);

    written[4] = SAWTOOTH;
    sent[4] = TRIANGLE;
    painter.paint('A');

    const [triangle, sawtooth, pulse, noise] = recording.targets.voices[0].waveforms;
    expect(triangle.setLiveLight).toHaveBeenLastCalledWith(true, false);
    expect(sawtooth.setLiveLight).toHaveBeenLastCalledWith(false, true);
    expect(pulse.setLiveLight).toHaveBeenLastCalledWith(false, false);
    expect(noise.setLiveLight).toHaveBeenLastCalledWith(false, false);
  });

  it('decodes the filter modes, routing switches, cutoff and resonance from the sent registers', () => {
    const recording = recordingTargets();
    painter.attach('A', recording.targets);

    sent[4 + 14] = 0x06; // voice 2 sync + ring
    sent[23] = 0xf4; // resonance 15, voice 2 filtered
    sent[21] = 0x07;
    sent[22] = 0xff; // cutoff 2047
    sent[24] = 0x20; // band-pass
    written[24] = 0x10; // low-pass written by the tune
    painter.paint('A');

    const { voices, cutoff, resonance, filterModes } = recording.targets;
    expect(voices[2].sync.setLiveLight).toHaveBeenLastCalledWith(true, false);
    expect(voices[2].ring.setLiveLight).toHaveBeenLastCalledWith(true, false);
    expect(voices[2].filter.setLiveLight).toHaveBeenLastCalledWith(true, false);
    expect(voices[0].filter.setLiveLight).toHaveBeenCalledTimes(1);
    expect(resonance.setLiveLevel).toHaveBeenLastCalledWith(1);
    expect(cutoff.setLiveLevel).toHaveBeenLastCalledWith(1);
    expect(filterModes[0].setLiveLight).toHaveBeenLastCalledWith(false, true);
    expect(filterModes[1].setLiveLight).toHaveBeenLastCalledWith(true, false);
    expect(filterModes[2].setLiveLight).toHaveBeenLastCalledWith(false, false);
  });

  it('reads through the same two buffers on every call', () => {
    painter.attach('A', recordingTargets().targets);
    painter.paint('A');
    painter.paint('A');

    const [first, second, third] = readRegisters.mock.calls;
    expect(second[1]).toBe(first[1]);
    expect(second[2]).toBe(first[2]);
    expect(third[1]).toBe(first[1]);
    expect(third[2]).toBe(first[2]);
    expect(first[1]).not.toBe(first[2]);
  });

  it('is a no-op with nothing attached, and after detach', () => {
    painter.paint('A');
    expect(readRegisters).not.toHaveBeenCalled();

    const recording = recordingTargets();
    const detach = painter.attach('A', recording.targets);
    clearCalls(recording);
    readRegisters.mockClear();
    detach();
    sent[5] = 0xf0;
    painter.paint('A');

    expect(readRegisters).not.toHaveBeenCalled();
    expect(totalCalls(recording)).toBe(0);
  });

  it('a stale detach does not remove a replacement target set', () => {
    const first = recordingTargets();
    const second = recordingTargets();
    const detachFirst = painter.attach('A', first.targets);
    painter.attach('A', second.targets);
    clearCalls(second);

    detachFirst();
    sent[5] = 0xf0;
    painter.paint('A');

    expect(second.targets.voices[0].attack.setLiveLevel).toHaveBeenCalledTimes(1);
  });

  it('repaints everything after a re-attach', () => {
    const recording = recordingTargets();
    painter.attach('A', recording.targets);
    clearCalls(recording);

    painter.attach('A', recording.targets);

    expect(recording.levels.every((fn) => fn.mock.calls.length === 1)).toBe(true);
  });

  it('keeps the decks apart', () => {
    const a = recordingTargets();
    const b = recordingTargets();
    painter.attach('A', a.targets);
    painter.attach('B', b.targets);
    clearCalls(a);
    clearCalls(b);

    painter.paint('A');

    expect(readRegisters).toHaveBeenLastCalledWith('A', expect.any(Uint8Array), expect.any(Uint8Array));
    expect(totalCalls(b)).toBe(0);
  });

  describe('a read that throws', () => {
    it('skips the paint and warns once per deck, never per frame', () => {
      const recording = recordingTargets();
      readRegisters.mockImplementation(() => {
        throw new Error('DeckRuntime: slot A has not been built');
      });

      expect(() => painter.attach('A', recording.targets)).not.toThrow();
      painter.paint('A');
      painter.paint('A');

      expect(totalCalls(recording)).toBe(0);
      expect(vi.mocked(logWarn)).toHaveBeenCalledTimes(1);
      expect(vi.mocked(logWarn).mock.calls[0][0]).toBe(
        'SidPanelPainter: deck A could not be painted — DeckRuntime: slot A has not been built'
      );
    });
  });

  describe('holding still', () => {
    // Angular's own scheduler also asks for animation frames, so the scheduled paints are counted
    // at `paint` rather than at the frame queue.
    let paintSpy: MockInstance<SidPanelPainter['paint']>;

    beforeEach(() => {
      paintSpy = vi.spyOn(painter, 'paint');
    });

    it('paints once on the next frame when a lock changes on a paused deck', () => {
      const recording = recordingTargets();
      store.setDeckStatus({ slot: 'A', status: 'paused' });
      TestBed.flushEffects();
      painter.attach('A', recording.targets);
      runFrames();
      clearCalls(recording);
      paintSpy.mockClear();

      sent[4] = TRIANGLE;
      store.setVoiceStrip({ slot: 'A', voice: 0, patch: { waveformLock: 'triangle' } });
      TestBed.flushEffects();
      expect(paintSpy).not.toHaveBeenCalled();
      expect(totalCalls(recording)).toBe(0);

      runFrames();
      expect(paintSpy).toHaveBeenCalledExactlyOnceWith('A');
      expect(recording.targets.voices[0].waveforms[0].setLiveLight).toHaveBeenCalledExactlyOnceWith(true, false);
    });

    it('de-duplicates the scheduled paint per deck', () => {
      store.setDeckStatus({ slot: 'A', status: 'paused' });
      TestBed.flushEffects();
      store.setVoiceStrip({ slot: 'A', voice: 0, patch: { waveformLock: 'pulse' } });
      TestBed.flushEffects();
      store.setVoiceStrip({ slot: 'A', voice: 1, patch: { waveformLock: 'noise' } });
      TestBed.flushEffects();
      runFrames();

      expect(paintSpy).toHaveBeenCalledExactlyOnceWith('A');
    });

    it('a playing deck schedules nothing, and its per-frame position samples do not rerun the effect', () => {
      store.setDeckStatus({ slot: 'A', status: 'playing' });
      TestBed.flushEffects();
      runFrames();
      paintSpy.mockClear();

      for (let frame = 1; frame <= 5; frame++) {
        store.samplePosition({ slot: 'A', positionFrames: frame });
        TestBed.flushEffects();
      }
      runFrames();

      expect(paintSpy).not.toHaveBeenCalled();
    });
  });
});
