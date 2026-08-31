import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, type WritableSignal } from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TransportPanelComponent } from './transport-panel.component';
import { DeckContext } from '../deck-context';
import { DeckTuneLoader } from '../deck-tune-loader';
import type { TuneSource } from '../deck-tune-loader';
import { DeckMidiBinding } from '../../midi/deck-midi-binding';
import { DjPlayerEngine } from '../../engine/dj-player-engine';
import type { EngineState, EngineStats } from '../../engine/dj-player-engine';
import { TuneIndexService } from '../../analysis/tune-index.service';
import type { TuneIndexRecord } from '../../analysis/tune-index.model';
import type { SidFile } from '../../sid/sid-file.model';

const EMPTY_STATS: EngineStats = {
  framesRendered: 0,
  packetsSent: 0,
  bytesSent: 0,
  suppressedWrites: 0,
  illegalOpcodeCount: 0,
  callsPerFrame: 1,
  effectiveIntervalUs: 0,
  measuredMeanIntervalUs: 0,
  driftMs: 0,
  jitterMs: 0,
  worstGapMs: 0,
  lateCallbacks: 0,
  scheduledFrames: 0,
  lateFrames: 0,
  meanLagMs: 0,
  worstLagMs: 0,
  reorderedFrames: 0,
  clampedFrames: 0,
  cancelSupported: false,
  lastCancelLatencyMs: -1,
};

function fakeSidFile(): SidFile {
  return {
    format: 'PSID',
    version: 2,
    loadAddress: 0x1000,
    initAddress: 0x1000,
    playAddress: 0x1003,
    songs: 1,
    startSong: 1,
    speedFlags: 0,
    name: 'Test Tune',
    author: 'Test Author',
    released: '2026',
    clock: 'pal',
    model: 'mos6581',
    secondSidAddress: null,
    thirdSidAddress: null,
    data: new Uint8Array([0]),
  };
}

interface MockEngine {
  state: WritableSignal<EngineState>;
  lastError: WritableSignal<string | null>;
  stats: WritableSignal<EngineStats>;
  repeatTrack: WritableSignal<boolean>;
  currentSubtune: WritableSignal<number>;
  subtuneCount: WritableSignal<number>;
  positionPercent: WritableSignal<number>;
  tuneIndex: WritableSignal<TuneIndexRecord | null>;
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  setRepeatTrack: ReturnType<typeof vi.fn>;
  nextSubtune: ReturnType<typeof vi.fn>;
  previousSubtune: ReturnType<typeof vi.fn>;
  scrubTo: ReturnType<typeof vi.fn>;
}

function makeEngine(): MockEngine {
  return {
    state: signal<EngineState>('stopped'),
    lastError: signal<string | null>(null),
    stats: signal<EngineStats>(EMPTY_STATS),
    repeatTrack: signal<boolean>(false),
    currentSubtune: signal(1),
    subtuneCount: signal(1),
    positionPercent: signal(0),
    tuneIndex: signal<TuneIndexRecord | null>(null),
    play: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn(),
    setRepeatTrack: vi.fn(),
    nextSubtune: vi.fn(),
    previousSubtune: vi.fn(),
    scrubTo: vi.fn().mockResolvedValue(undefined),
  };
}

describe('TransportPanelComponent', () => {
  let fixture: ComponentFixture<TransportPanelComponent>;
  let engine: MockEngine;
  let tuneLoader: {
    availableTunes: WritableSignal<readonly TuneSource[]>;
    currentTune: WritableSignal<SidFile | null>;
    tuneError: WritableSignal<string | null>;
    selectTune: ReturnType<typeof vi.fn>;
    onFilePicked: ReturnType<typeof vi.fn>;
  };
  let binding: { selectedPortId: WritableSignal<string | null> };
  let tuneIndexService: { pending: WritableSignal<boolean> };
  let context: DeckContext;

  function build(deckLabel: string): void {
    // Lets a single test build two decks in sequence (to compare their accessible names) without
    // TestBed refusing a second `configureTestingModule` call against an already-instantiated module.
    TestBed.resetTestingModule();
    engine = makeEngine();
    tuneLoader = {
      availableTunes: signal<readonly TuneSource[]>([]),
      currentTune: signal<SidFile | null>(null),
      tuneError: signal<string | null>(null),
      selectTune: vi.fn(),
      onFilePicked: vi.fn(),
    };
    binding = { selectedPortId: signal<string | null>(null) };
    tuneIndexService = { pending: signal<boolean>(false) };

    TestBed.configureTestingModule({
      imports: [TransportPanelComponent],
      providers: [
        DeckContext,
        { provide: DeckTuneLoader, useValue: tuneLoader as unknown as DeckTuneLoader },
        { provide: DeckMidiBinding, useValue: binding as unknown as DeckMidiBinding },
        { provide: DjPlayerEngine, useValue: engine as unknown as DjPlayerEngine },
        { provide: TuneIndexService, useValue: tuneIndexService as unknown as TuneIndexService },
      ],
    });

    context = TestBed.inject(DeckContext);
    context.adopt({ id: 'test', label: deckLabel });

    fixture = TestBed.createComponent(TransportPanelComponent);
    fixture.detectChanges();
  }

  function button(label: string): HTMLButtonElement {
    return Array.from(fixture.nativeElement.querySelectorAll<HTMLButtonElement>('button')).find(
      (candidate) => candidate.textContent?.trim() === label
    ) as HTMLButtonElement;
  }

  describe('disabled/enabled logic', () => {
    beforeEach(() => build('A'));

    it('gates Play on a loaded tune, a selected MIDI port, an idle engine and no scan in flight', () => {
      expect(button('Play').disabled).toBe(true);

      tuneLoader.currentTune.set(fakeSidFile());
      binding.selectedPortId.set('port-1');
      fixture.detectChanges();
      expect(button('Play').disabled).toBe(false);

      tuneIndexService.pending.set(true);
      fixture.detectChanges();
      expect(button('Play').disabled).toBe(true);
    });

    it('gates Stop on a loaded tune, refusing only the freshly-loaded/still-scanning case', () => {
      expect(button('Stop').disabled).toBe(true);

      tuneLoader.currentTune.set(fakeSidFile());
      fixture.detectChanges();
      expect(button('Stop').disabled).toBe(false);

      tuneIndexService.pending.set(true);
      fixture.detectChanges();
      expect(button('Stop').disabled).toBe(true);

      engine.state.set('playing');
      fixture.detectChanges();
      expect(button('Stop').disabled).toBe(false);
    });

    it('gates the subtune stepper on a loaded tune with more than one subtune', () => {
      expect(button('◀').disabled).toBe(true);
      expect(button('▶').disabled).toBe(true);

      tuneLoader.currentTune.set(fakeSidFile());
      engine.subtuneCount.set(3);
      fixture.detectChanges();

      expect(button('◀').disabled).toBe(false);
      expect(button('▶').disabled).toBe(false);
    });
  });

  describe('accessible names', () => {
    it("suffix every control's accessible name with its own deck, distinct from the other deck", () => {
      build('A');
      const aName = button('Play').getAttribute('aria-label');
      fixture.destroy();

      build('B');
      const bName = button('Play').getAttribute('aria-label');

      expect(aName).toBe('Play deck A');
      expect(bName).toBe('Play deck B');
      expect(aName).not.toBe(bName);
    });
  });

  describe('error surfaces', () => {
    beforeEach(() => build('A'));

    it("renders the engine's last error as an alert", () => {
      engine.lastError.set('Delivery stalled.');
      fixture.detectChanges();

      const alert = fixture.nativeElement.querySelector('[role="alert"]');
      expect(alert?.textContent).toContain('Delivery stalled.');
    });

    it('renders the tune parse error as an alert', () => {
      tuneLoader.tuneError.set('Not a valid SID file.');
      fixture.detectChanges();

      const alerts: HTMLElement[] = Array.from(
        fixture.nativeElement.querySelectorAll('[role="alert"]')
      );
      expect(alerts.some((el) => el.textContent?.includes('Not a valid SID file.'))).toBe(true);
    });
  });
});
