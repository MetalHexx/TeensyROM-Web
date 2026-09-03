import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, type WritableSignal } from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DeckHostComponent } from './deck-host.component';
import type { DeckPanelAreas } from './deck-host.component';
import { DeckContext } from '../deck-context';
import { DeckRegistry } from '../deck-registry';
import { DeckTuneLoader } from '../deck-tune-loader';
import type { TuneSource } from '../deck-tune-loader';
import { DECKS } from '../deck.config';
import { DjPlayerEngine } from '../../engine/dj-player-engine';
import type {
  CapturedPoint,
  EngineState,
  EngineStats,
  Marker,
} from '../../engine/dj-player-engine';
import type { PlayRate } from '../../engine/play-rate';
import { DeckMidiBinding } from '../../midi/deck-midi-binding';
import { MidiAccessService } from '../../midi/midi-access.service';
import { TuneIndexService } from '../../analysis/tune-index.service';
import { SharedTuneIndex } from '../../analysis/shared-tune-index';
import {
  TUNE_INDEX_STORAGE,
  LocalStorageTuneIndexStorage,
} from '../../analysis/tune-index-storage';
import type { TuneIndexRecord } from '../../analysis/tune-index.model';
import type { SidFile } from '../../sid/sid-file.model';
import { MixerService } from '../../mixer/mixer.service';

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

function fakeSidFile(overrides: Partial<SidFile> = {}): SidFile {
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
    ...overrides,
  };
}

function startPoint(frame: number): CapturedPoint {
  return { frame, offset: 0, machine: {}, registers: {}, anchor: {} } as unknown as CapturedPoint;
}

function markerWithStart(frame: number): Marker {
  return { start: startPoint(frame), end: null };
}

/** Deck-host under test carries no ancestor `.grid` for these to actually position anything against
 *  — only that the component accepts and applies whatever it is handed. */
const FAKE_AREAS: DeckPanelAreas = {
  transport: 't0',
  voiceSpeed: 'vs0',
  loopsCues: 'c0',
  binding: 'b0',
};

describe('DeckHostComponent', () => {
  describe('ngOnInit wiring, over real collaborators', () => {
    function build(descriptor = DECKS[0]): {
      fixture: ComponentFixture<DeckHostComponent>;
      context: DeckContext;
      binding: DeckMidiBinding;
      engine: DjPlayerEngine;
      registry: DeckRegistry;
    } {
      const fixture = TestBed.createComponent(DeckHostComponent);
      fixture.componentRef.setInput('deck', descriptor);
      fixture.componentRef.setInput('areas', FAKE_AREAS);

      const injector = fixture.debugElement.injector;
      return {
        fixture,
        context: injector.get(DeckContext),
        binding: injector.get(DeckMidiBinding),
        engine: injector.get(DjPlayerEngine),
        registry: TestBed.inject(DeckRegistry),
      };
    }

    beforeEach(() => {
      TestBed.configureTestingModule({
        imports: [DeckHostComponent],
        providers: [
          MidiAccessService,
          DeckRegistry,
          // TUNE_INDEX_STORAGE, SharedTuneIndex and MixerService are page-level in production
          // (`DjPocViewComponent` provides them) — a deck host under test has no page above it, so
          // they have to come from here instead.
          { provide: TUNE_INDEX_STORAGE, useFactory: () => new LocalStorageTuneIndexStorage() },
          SharedTuneIndex,
          MixerService,
        ],
      });
    });

    it('adopts its own descriptor, restores its MIDI and repeat-track preferences under its own id, then registers — in that order', () => {
      const { fixture, context, binding, engine, registry } = build(DECKS[0]);

      const adoptSpy = vi.spyOn(context, 'adopt');
      let deckIdAtRestore = '';
      const restoreSpy = vi.spyOn(binding, 'restore').mockImplementation(() => {
        deckIdAtRestore = binding.deckId;
      });
      const restoreRepeatSpy = vi.spyOn(engine, 'restoreRepeatTrackPreference');
      const registerSpy = vi.spyOn(registry, 'register');

      fixture.detectChanges(); // runs ngOnInit

      expect(adoptSpy).toHaveBeenCalledWith(DECKS[0]);
      expect(deckIdAtRestore).toBe(DECKS[0].id);
      expect(binding.deckId).toBe(DECKS[0].id);
      expect(restoreRepeatSpy).toHaveBeenCalledTimes(1);
      expect(registerSpy).toHaveBeenCalledTimes(1);
      expect(registerSpy.mock.calls[0][0].descriptor).toEqual(DECKS[0]);
      expect(registerSpy.mock.calls[0][0].engine).toBe(engine);

      const orderOf = (spy: { mock: { invocationCallOrder: number[] } }) =>
        spy.mock.invocationCallOrder[0];
      expect(orderOf(adoptSpy)).toBeLessThan(orderOf(restoreSpy));
      expect(orderOf(restoreSpy)).toBeLessThan(orderOf(registerSpy));
    });

    it('unregisters its own descriptor id on destroy', () => {
      const { fixture, registry } = build(DECKS[0]);
      fixture.detectChanges();
      expect(registry.decks()).toHaveLength(1);

      fixture.destroy();

      expect(registry.decks()).toHaveLength(0);
    });

    it('gives each deck host its own DjPlayerEngine instance, registered under its own descriptor', () => {
      const first = build(DECKS[0]);
      first.fixture.detectChanges();

      const second = build(DECKS[1]);
      second.fixture.detectChanges();

      expect(first.engine).not.toBe(second.engine);

      const decks = TestBed.inject(DeckRegistry).decks();
      expect(decks.map((deck) => deck.descriptor.id)).toEqual([DECKS[0].id, DECKS[1].id]);
      expect(decks[0].engine).toBe(first.engine);
      expect(decks[1].engine).toBe(second.engine);
    });

    it("pushes each deck's own mixer gain to that deck's own engine, and only that deck's own engine — over the single shared MixerService instance DjPocViewComponent provides page-level", () => {
      const first = build(DECKS[0]);
      const second = build(DECKS[1]);
      first.fixture.detectChanges(); // runs ngOnInit, adopting DECKS[0].id
      second.fixture.detectChanges(); // runs ngOnInit, adopting DECKS[1].id
      TestBed.flushEffects();

      // Both build()s resolve MixerService from this describe block's shared TestBed module (it is
      // not among DeckHostComponent's own component-level providers) — the same one-instance-across-
      // decks topology DjPocViewComponent wires in production.
      const mixer = TestBed.inject(MixerService);
      const firstGainSpy = vi.spyOn(first.engine, 'setOutputGain');
      const secondGainSpy = vi.spyOn(second.engine, 'setOutputGain');

      mixer.setCrossfaderPosition(1); // hard over to DECKS[1]'s side: fades DECKS[0] to silence
      mixer.setDeckFader(DECKS[1].id, 0.25); // DECKS[1]'s own fader, independent of the crossfader
      // This effect is created inside a component constructor, so it is tied to that component's own
      // view rather than the environment injector — it flushes on that view's change detection, not
      // on TestBed's global effect flush.
      first.fixture.detectChanges();
      second.fixture.detectChanges();

      expect(firstGainSpy).toHaveBeenCalledWith(0);
      expect(firstGainSpy).not.toHaveBeenCalledWith(0.25);
      expect(secondGainSpy).toHaveBeenCalledWith(0.25);
      expect(secondGainSpy).not.toHaveBeenCalledWith(0);
    });

    it("pushes each deck's own mixer scale controls, key and filter mode to that deck's own engine, and only that deck's own engine", () => {
      const first = build(DECKS[0]);
      const second = build(DECKS[1]);
      first.fixture.detectChanges(); // runs ngOnInit, adopting DECKS[0].id
      second.fixture.detectChanges(); // runs ngOnInit, adopting DECKS[1].id
      TestBed.flushEffects();

      const mixer = TestBed.inject(MixerService);
      const firstScaleSpy = vi.spyOn(first.engine, 'setRegisterScale');
      const secondScaleSpy = vi.spyOn(second.engine, 'setRegisterScale');
      const firstFilterSpy = vi.spyOn(first.engine, 'setFilterMode');
      const secondFilterSpy = vi.spyOn(second.engine, 'setFilterMode');

      mixer.setScalePosition(DECKS[0].id, 'cutoff', 1);
      mixer.setKeySemitones(DECKS[0].id, 12);
      mixer.setFilterMode(DECKS[0].id, 'lowPass');
      first.fixture.detectChanges();
      second.fixture.detectChanges();

      expect(firstScaleSpy).toHaveBeenCalledWith('cutoff', 16);
      expect(firstScaleSpy).toHaveBeenCalledWith('frequency', 2);
      expect(firstFilterSpy).toHaveBeenCalledWith('lowPass');
      expect(secondScaleSpy).not.toHaveBeenCalledWith('cutoff', 16);
      expect(secondScaleSpy).not.toHaveBeenCalledWith('frequency', 2);
      expect(secondFilterSpy).not.toHaveBeenCalledWith('lowPass');
    });
  });

  describe('template wiring, over mocked collaborators', () => {
    interface MockEngine {
      state: WritableSignal<EngineState>;
      lastError: WritableSignal<string | null>;
      stats: WritableSignal<EngineStats>;
      repeatTrack: WritableSignal<boolean>;
      trackEndFrame: WritableSignal<number | null>;
      currentSubtune: WritableSignal<number>;
      subtuneCount: WritableSignal<number>;
      speedMultiplier: WritableSignal<number>;
      nominalIntervalUs: WritableSignal<number>;
      playRate: WritableSignal<PlayRate>;
      scheduleAheadMs: WritableSignal<number>;
      ceilingFrames: WritableSignal<number>;
      positionBasisFrames: WritableSignal<number>;
      mutedVoices: WritableSignal<readonly boolean[]>;
      heldVoices: WritableSignal<readonly boolean[]>;
      effectiveMutes: WritableSignal<readonly boolean[]>;
      markers: WritableSignal<readonly Marker[]>;
      loopingMarker: WritableSignal<number | null>;
      queuedMarker: WritableSignal<number | null>;
      markerLaunchPending: WritableSignal<boolean>;
      nudgeRangeFrames: WritableSignal<number>;
      positionPercent: WritableSignal<number>;
      tuneIndex: WritableSignal<null>;
      play: ReturnType<typeof vi.fn>;
      pause: ReturnType<typeof vi.fn>;
      stop: ReturnType<typeof vi.fn>;
      setOutputGain: ReturnType<typeof vi.fn>;
      setRegisterScale: ReturnType<typeof vi.fn>;
      setFilterMode: ReturnType<typeof vi.fn>;
      setRepeatTrack: ReturnType<typeof vi.fn>;
      restoreRepeatTrackPreference: ReturnType<typeof vi.fn>;
      addMarker: ReturnType<typeof vi.fn>;
      progressPercentFor: ReturnType<typeof vi.fn>;
    }

    function makeEngine(): MockEngine {
      return {
        state: signal<EngineState>('stopped'),
        lastError: signal<string | null>(null),
        stats: signal<EngineStats>(EMPTY_STATS),
        repeatTrack: signal<boolean>(true),
        trackEndFrame: signal<number | null>(null),
        currentSubtune: signal(1),
        subtuneCount: signal(1),
        speedMultiplier: signal(1),
        nominalIntervalUs: signal(19950),
        playRate: signal<PlayRate>({
          callsPerFrame: 1,
          exactCallsPerFrame: 1,
          roundedCallsPerFrame: 1,
          mode: 'exact',
        }),
        scheduleAheadMs: signal(0),
        ceilingFrames: signal(10_000),
        positionBasisFrames: signal(10_000),
        mutedVoices: signal<readonly boolean[]>([false, false, false]),
        heldVoices: signal<readonly boolean[]>([false, false, false]),
        effectiveMutes: signal<readonly boolean[]>([false, false, false]),
        markers: signal<readonly Marker[]>([]),
        loopingMarker: signal<number | null>(null),
        queuedMarker: signal<number | null>(null),
        markerLaunchPending: signal<boolean>(false),
        nudgeRangeFrames: signal(50),
        positionPercent: signal(0),
        tuneIndex: signal(null),
        play: vi.fn(),
        pause: vi.fn(),
        stop: vi.fn(),
        setOutputGain: vi.fn(),
        setRegisterScale: vi.fn(),
        setFilterMode: vi.fn(),
        setRepeatTrack: vi.fn(),
        restoreRepeatTrackPreference: vi.fn(),
        addMarker: vi.fn(),
        progressPercentFor: vi.fn(() => 0),
      };
    }

    let fixture: ComponentFixture<DeckHostComponent>;
    let engine: MockEngine;
    let binding: {
      selectedPortId: WritableSignal<string | null>;
      lastError: WritableSignal<string | null>;
      restore: ReturnType<typeof vi.fn>;
    };
    let tuneLoader: {
      availableTunes: WritableSignal<readonly TuneSource[]>;
      currentTune: WritableSignal<SidFile | null>;
      tuneError: WritableSignal<string | null>;
      selectTune: ReturnType<typeof vi.fn>;
      onFilePicked: ReturnType<typeof vi.fn>;
    };
    let tuneIndexService: {
      pending: WritableSignal<boolean>;
      record: WritableSignal<TuneIndexRecord | null>;
    };

    beforeEach(async () => {
      engine = makeEngine();
      binding = {
        selectedPortId: signal<string | null>(null),
        lastError: signal<string | null>(null),
        restore: vi.fn(),
      };
      tuneLoader = {
        availableTunes: signal<readonly TuneSource[]>([
          { id: 'auto', label: 'Auto tune', getBytes: () => new Uint8Array() },
        ]),
        currentTune: signal<SidFile | null>(null),
        tuneError: signal<string | null>(null),
        selectTune: vi.fn(),
        onFilePicked: vi.fn(),
      };
      tuneIndexService = {
        pending: signal<boolean>(false),
        record: signal<TuneIndexRecord | null>(null),
      };

      await TestBed.configureTestingModule({
        imports: [DeckHostComponent],
        // Page-level in production; stands in here the same way DeckRegistry does, since this suite
        // has no page above the component under test. `MidiAccessService` is real (not mocked) —
        // `BindingCardComponent` reaches it directly for the shared port list, and it has no browser
        // API dependency until `requestAccess()` is actually invoked, which none of these tests do.
        providers: [DeckRegistry, MixerService, MidiAccessService],
      })
        .overrideComponent(DeckHostComponent, {
          set: {
            providers: [
              DeckContext,
              { provide: DeckMidiBinding, useValue: binding as unknown as DeckMidiBinding },
              { provide: DjPlayerEngine, useValue: engine as unknown as DjPlayerEngine },
              { provide: DeckTuneLoader, useValue: tuneLoader as unknown as DeckTuneLoader },
              {
                provide: TuneIndexService,
                useValue: tuneIndexService as unknown as TuneIndexService,
              },
            ],
          },
        })
        .compileComponents();

      fixture = TestBed.createComponent(DeckHostComponent);
      fixture.componentRef.setInput('deck', DECKS[0]);
      fixture.componentRef.setInput('areas', FAKE_AREAS);
      fixture.detectChanges();
    });

    it('creates', () => {
      expect(fixture.componentInstance).toBeTruthy();
    });

    it("applies each of this deck's four grid-area names, from the areas input, onto that panel and no other", () => {
      const panelSelectors: Record<keyof DeckPanelAreas, string> = {
        transport: 'lib-transport-panel',
        voiceSpeed: 'lib-voice-speed-column',
        loopsCues: 'lib-loops-cues-panel',
        binding: 'lib-binding-card',
      };

      for (const [areaKey, selector] of Object.entries(panelSelectors) as [
        keyof DeckPanelAreas,
        string,
      ][]) {
        const panelEl: HTMLElement = fixture.nativeElement.querySelector(selector);
        expect(panelEl.style.gridArea).toBe(FAKE_AREAS[areaKey]);
      }
    });

    it('calls engine.play, pause and stop from the transport buttons', () => {
      binding.selectedPortId.set('port-1');
      tuneLoader.currentTune.set(fakeSidFile());
      fixture.detectChanges();

      const buttons: HTMLButtonElement[] = Array.from(
        fixture.nativeElement.querySelectorAll('button')
      );
      buttons.find((button) => button.textContent?.trim() === 'Play')?.click();
      expect(engine.play).toHaveBeenCalled();

      engine.state.set('playing');
      fixture.detectChanges();
      buttons.find((button) => button.textContent?.trim() === 'Pause')?.click();
      expect(engine.pause).toHaveBeenCalled();

      buttons.find((button) => button.textContent?.trim() === 'Stop')?.click();
      expect(engine.stop).toHaveBeenCalled();
    });

    it('gates Play on a loaded tune, a selected MIDI port and an idle engine', () => {
      function playButton(): HTMLButtonElement {
        return Array.from(fixture.nativeElement.querySelectorAll<HTMLButtonElement>('button')).find(
          (button) => button.textContent?.trim() === 'Play'
        ) as HTMLButtonElement;
      }

      expect(playButton().disabled).toBe(true);

      tuneLoader.currentTune.set(fakeSidFile());
      binding.selectedPortId.set('port-1');
      fixture.detectChanges();

      expect(playButton().disabled).toBe(false);
    });

    it("reflects and writes the engine's repeatTrack signal from the repeat toggle", () => {
      function repeatToggle(): HTMLInputElement {
        return fixture.nativeElement.querySelector(
          `[aria-label="Repeat track deck ${DECKS[0].label}"]`
        );
      }

      expect(repeatToggle().checked).toBe(true);

      repeatToggle().checked = false;
      repeatToggle().dispatchEvent(new Event('change'));

      expect(engine.setRepeatTrack).toHaveBeenCalledWith(false);
    });

    it('delegates a tune-source click to the tune loader', () => {
      const button = Array.from(
        fixture.nativeElement.querySelectorAll<HTMLButtonElement>('.tune-sources button')
      ).find((candidate) => candidate.textContent?.trim() === 'Auto tune');

      button?.click();

      expect(tuneLoader.selectTune).toHaveBeenCalledWith(tuneLoader.availableTunes()[0]);
    });

    it('calls engine.addMarker from the Loops/Cues panel Add control', () => {
      engine.addMarker.mockImplementation(() => {
        engine.markers.set([markerWithStart(0)]);
        return 0;
      });

      const addButton = fixture.nativeElement.querySelector(
        `[aria-label="Loops/Cues deck ${DECKS[0].label}"] .panel-header-actions button`
      ) as HTMLButtonElement;
      addButton.click();

      expect(engine.addMarker).toHaveBeenCalled();
    });
  });
});
