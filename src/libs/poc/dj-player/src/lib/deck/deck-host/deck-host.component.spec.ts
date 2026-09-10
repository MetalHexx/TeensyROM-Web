import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Injector, signal, type WritableSignal } from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { frames } from '@sidablist/core';
import type { SidFile, SidPlayer } from '@sidablist/core';
import { DeckHostComponent } from './deck-host.component';
import type { DeckPanelAreas } from './deck-host.component';
import { DeckContext } from '../deck-context';
import {
  ASID_SINK,
  DECK_PLAYER_VIEW,
  FRAME_CLOCK,
  REPLAY_RUNNER,
  SID_PLAYER,
} from '../deck-player';
import { DeckRegistry } from '../deck-registry';
import { DeckTuneLoader } from '../deck-tune-loader';
import type { TuneSource } from '../deck-tune-loader';
import { MarkerCollection } from '../marker-collection';
import type { SavedMarker } from '../marker-collection';
import { DECKS } from '../deck.config';
import { DeckMidiBinding } from '../../midi/deck-midi-binding';
import { MidiAccessService } from '../../midi/midi-access.service';
import { TuneIndexService } from '../../analysis/tune-index.service';
import { SharedTuneIndex } from '../../analysis/shared-tune-index';
import {
  TUNE_INDEX_STORAGE,
  LocalStorageTuneIndexStorage,
} from '../../analysis/tune-index-storage';
import type { TuneIndexRecord } from '../../analysis/tune-index.model';
import { MixerService } from '../../mixer/mixer.service';
import {
  createFakeAsidSink,
  createFakeDeckPlayer,
  fakeSidFile,
} from '../../../testing/player-doubles';
import type { FakeAsidSink, FakeDeckPlayer } from '../../../testing/player-doubles';

const RTS = 0x60;

/** init and play both return at once and touch no register — enough for a real player to load and
 *  start it without emulating anything worth asserting on. */
function silentTune(): SidFile {
  const data = new Uint8Array(4);
  data[0] = RTS;
  data[3] = RTS;
  return fakeSidFile({ loadAddress: 0x1000, initAddress: 0x1000, playAddress: 0x1003, data });
}

function markerWithStart(frame: number): SavedMarker {
  return { startFrame: frame as SavedMarker['startFrame'], startOffsetMs: 0, end: null };
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
      injector: Injector;
      context: DeckContext;
      binding: DeckMidiBinding;
      player: SidPlayer;
      registry: DeckRegistry;
    } {
      const fixture = TestBed.createComponent(DeckHostComponent);
      fixture.componentRef.setInput('deck', descriptor);
      fixture.componentRef.setInput('areas', FAKE_AREAS);

      const injector = fixture.debugElement.injector;
      return {
        fixture,
        injector,
        context: injector.get(DeckContext),
        binding: injector.get(DeckMidiBinding),
        player: injector.get(SID_PLAYER),
        registry: TestBed.inject(DeckRegistry),
      };
    }

    beforeEach(() => {
      localStorage.clear();
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
          { provide: MixerService, useFactory: () => new MixerService(DECKS) },
        ],
      });
    });

    it('adopts its own descriptor, restores its MIDI and repeat-track preferences under its own id, then registers — in that order', () => {
      const { fixture, context, binding, player, registry } = build(DECKS[0]);
      localStorage.setItem(`asid-dj-0.deck-${DECKS[0].id}.repeat-track`, 'false');

      const adoptSpy = vi.spyOn(context, 'adopt');
      let deckIdAtRestore = '';
      const restoreSpy = vi.spyOn(binding, 'restore').mockImplementation(() => {
        deckIdAtRestore = binding.deckId;
      });
      const repeatSpy = vi.spyOn(player, 'setRepeatTrack');
      const registerSpy = vi.spyOn(registry, 'register');

      fixture.detectChanges(); // runs ngOnInit

      expect(adoptSpy).toHaveBeenCalledWith(DECKS[0]);
      expect(deckIdAtRestore).toBe(DECKS[0].id);
      expect(binding.deckId).toBe(DECKS[0].id);
      // The persisted preference under this deck's own key, applied to the player core holds it on.
      expect(repeatSpy).toHaveBeenCalledWith(false);
      expect(registerSpy).toHaveBeenCalledTimes(1);
      expect(registerSpy.mock.calls[0][0].descriptor).toEqual(DECKS[0]);
      expect(registerSpy.mock.calls[0][0].player).toBe(player);

      const orderOf = (spy: { mock: { invocationCallOrder: number[] } }) =>
        spy.mock.invocationCallOrder[0];
      expect(orderOf(adoptSpy)).toBeLessThan(orderOf(restoreSpy));
      expect(orderOf(restoreSpy)).toBeLessThan(orderOf(registerSpy));
    });

    it("hands this deck's own sink to its binding, so identify never encodes anything here", () => {
      const { fixture, binding, injector } = build(DECKS[0]);
      fixture.detectChanges();

      expect(binding.sink).toBe(injector.get(ASID_SINK));
    });

    it("builds its player over this deck's own sink and clock", async () => {
      const { fixture, injector, player } = build(DECKS[0]);
      fixture.detectChanges();

      const sink = injector.get(ASID_SINK);
      const clock = injector.get(FRAME_CLOCK);
      const beginSpy = vi.spyOn(sink, 'begin');
      const startSpy = vi.spyOn(clock, 'start').mockResolvedValue(undefined);

      player.loadTune(silentTune());
      await player.play();

      expect(beginSpy).toHaveBeenCalledWith({ chipModel: 'mos6581' });
      expect(startSpy).toHaveBeenCalledTimes(1);
    });

    it("releases this deck's own replay thread when the host is destroyed", () => {
      const { fixture, injector } = build(DECKS[0]);
      fixture.detectChanges();
      const disposeSpy = vi.spyOn(injector.get(REPLAY_RUNNER), 'dispose');

      fixture.destroy();

      expect(disposeSpy).toHaveBeenCalledTimes(1);
    });

    it('unregisters its own descriptor id on destroy', () => {
      const { fixture, registry } = build(DECKS[0]);
      fixture.detectChanges();
      expect(registry.decks()).toHaveLength(1);

      fixture.destroy();

      expect(registry.decks()).toHaveLength(0);
    });

    it('gives each deck host its own player, sink, clock and replay runner, registered under its own descriptor', () => {
      const first = build(DECKS[0]);
      first.fixture.detectChanges();

      const second = build(DECKS[1]);
      second.fixture.detectChanges();

      expect(first.player).not.toBe(second.player);
      // Two frame clocks and two replay workers per two decks is the design, not something to hoist.
      expect(first.injector.get(ASID_SINK)).not.toBe(second.injector.get(ASID_SINK));
      expect(first.injector.get(FRAME_CLOCK)).not.toBe(second.injector.get(FRAME_CLOCK));
      expect(first.injector.get(REPLAY_RUNNER)).not.toBe(second.injector.get(REPLAY_RUNNER));

      const decks = TestBed.inject(DeckRegistry).decks();
      expect(decks.map((deck) => deck.descriptor.id)).toEqual([DECKS[0].id, DECKS[1].id]);
      expect(decks[0].player).toBe(first.player);
      expect(decks[1].player).toBe(second.player);
    });

    it("pushes each deck's own mixer gain to that deck's own player, and only that deck's own player — over the single shared MixerService instance DjPocViewComponent provides page-level", () => {
      const first = build(DECKS[0]);
      const second = build(DECKS[1]);
      first.fixture.detectChanges(); // runs ngOnInit, adopting DECKS[0].id
      second.fixture.detectChanges(); // runs ngOnInit, adopting DECKS[1].id
      TestBed.flushEffects();

      // Both build()s resolve MixerService from this describe block's shared TestBed module (it is
      // not among DeckHostComponent's own component-level providers) — the same one-instance-across-
      // decks topology DjPocViewComponent wires in production.
      const mixer = TestBed.inject(MixerService);
      const firstGainSpy = vi.spyOn(first.player, 'setOutputGain');
      const secondGainSpy = vi.spyOn(second.player, 'setOutputGain');

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

    it("pushes each deck's own mixer scale controls, key and filter mode to that deck's own player, and only that deck's own player", () => {
      const first = build(DECKS[0]);
      const second = build(DECKS[1]);
      first.fixture.detectChanges(); // runs ngOnInit, adopting DECKS[0].id
      second.fixture.detectChanges(); // runs ngOnInit, adopting DECKS[1].id
      TestBed.flushEffects();

      const mixer = TestBed.inject(MixerService);
      const firstScaleSpy = vi.spyOn(first.player, 'setRegisterScale');
      const secondScaleSpy = vi.spyOn(second.player, 'setRegisterScale');
      const firstPitchSpy = vi.spyOn(first.player, 'setVoicePitch');
      const secondPitchSpy = vi.spyOn(second.player, 'setVoicePitch');
      const firstFilterSpy = vi.spyOn(first.player, 'setFilterMode');
      const secondFilterSpy = vi.spyOn(second.player, 'setFilterMode');

      mixer.setScalePosition(DECKS[0].id, 'cutoff', 1);
      mixer.setKeySemitones(DECKS[0].id, 12);
      mixer.setFilterMode(DECKS[0].id, 'lowPass');
      first.fixture.detectChanges();
      second.fixture.detectChanges();

      expect(firstScaleSpy).toHaveBeenCalledWith('cutoff', 16);
      expect(firstFilterSpy).toHaveBeenCalledWith('lowPass');
      expect(secondScaleSpy).not.toHaveBeenCalledWith('cutoff', 16);
      expect(secondFilterSpy).not.toHaveBeenCalledWith('lowPass');

      // The Key knob is one control ganged to all three voices — the application is where ganging
      // is defined, and core carries no frequency-scale group to do it for us.
      expect(firstPitchSpy).toHaveBeenCalledWith(0, 2);
      expect(firstPitchSpy).toHaveBeenCalledWith(1, 2);
      expect(firstPitchSpy).toHaveBeenCalledWith(2, 2);
      expect(secondPitchSpy).not.toHaveBeenCalledWith(0, 2);
    });

    it("gives each deck's transport its own accessible names, so two decks on the page never collide", () => {
      const first = build(DECKS[0]);
      first.fixture.detectChanges();
      const second = build(DECKS[1]);
      second.fixture.detectChanges();

      const playLabel = (fixture: ComponentFixture<DeckHostComponent>) =>
        (fixture.nativeElement as HTMLElement)
          .querySelector('button[aria-label^="Play deck "]')
          ?.getAttribute('aria-label');
      const positionLabel = (fixture: ComponentFixture<DeckHostComponent>) =>
        (fixture.nativeElement as HTMLElement)
          .querySelector('input[type="range"]')
          ?.getAttribute('aria-label');

      expect(playLabel(first.fixture)).toBe(`Play deck ${DECKS[0].label}`);
      expect(playLabel(second.fixture)).toBe(`Play deck ${DECKS[1].label}`);
      expect(playLabel(first.fixture)).not.toBe(playLabel(second.fixture));

      expect(positionLabel(first.fixture)).toBe(`Position deck ${DECKS[0].label}`);
      expect(positionLabel(second.fixture)).toBe(`Position deck ${DECKS[1].label}`);
      expect(positionLabel(first.fixture)).not.toBe(positionLabel(second.fixture));
    });
  });

  describe('template wiring, over mocked collaborators', () => {
    let fixture: ComponentFixture<DeckHostComponent>;
    let player: FakeDeckPlayer;
    let sink: FakeAsidSink;
    let collection: {
      markers: WritableSignal<readonly SavedMarker[]>;
      loopingMarker: WritableSignal<number | null>;
      queuedMarker: WritableSignal<number | null>;
      markerLaunchPending: WritableSignal<boolean>;
      addMarker: ReturnType<typeof vi.fn>;
      progressPercentFor: ReturnType<typeof vi.fn>;
      stopMarkerLoop: ReturnType<typeof vi.fn>;
      noticeLoopPosition: ReturnType<typeof vi.fn>;
      noticeActiveLoop: ReturnType<typeof vi.fn>;
    };
    let binding: {
      sink: FakeAsidSink | null;
      selectedPortId: WritableSignal<string | null>;
      lastError: WritableSignal<string | null>;
      restore: ReturnType<typeof vi.fn>;
    };
    let tuneLoader: {
      availableTunes: WritableSignal<readonly TuneSource[]>;
      currentTune: WritableSignal<SidFile | null>;
      tuneError: WritableSignal<string | null>;
      selectTune: ReturnType<typeof vi.fn>;
      loadPickedFile: ReturnType<typeof vi.fn>;
    };
    let tuneIndexService: {
      pending: WritableSignal<boolean>;
      record: WritableSignal<TuneIndexRecord | null>;
    };

    beforeEach(async () => {
      player = createFakeDeckPlayer();
      player.snapshot.update((snapshot) => ({ ...snapshot, repeatTrack: true }));
      sink = createFakeAsidSink();
      collection = {
        markers: signal<readonly SavedMarker[]>([]),
        loopingMarker: signal<number | null>(null),
        queuedMarker: signal<number | null>(null),
        markerLaunchPending: signal<boolean>(false),
        addMarker: vi.fn(),
        progressPercentFor: vi.fn(() => 0),
        stopMarkerLoop: vi.fn(),
        noticeLoopPosition: vi.fn(),
        noticeActiveLoop: vi.fn(),
      };
      binding = {
        sink: null,
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
        loadPickedFile: vi.fn(),
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
        providers: [
          DeckRegistry,
          { provide: MixerService, useFactory: () => new MixerService(DECKS) },
          MidiAccessService,
        ],
      })
        .overrideComponent(DeckHostComponent, {
          set: {
            providers: [
              DeckContext,
              { provide: DeckMidiBinding, useValue: binding as unknown as DeckMidiBinding },
              { provide: ASID_SINK, useValue: sink },
              { provide: SID_PLAYER, useValue: player.player },
              { provide: DECK_PLAYER_VIEW, useValue: player.view },
              { provide: MarkerCollection, useValue: collection as unknown as MarkerCollection },
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

    it("feeds this deck's own polled position into the marker collection, for the lap hand-off", () => {
      player.position.set(frames(42));
      fixture.detectChanges();

      expect(collection.noticeLoopPosition).toHaveBeenCalledWith(frames(42));
    });

    it("feeds the loop this deck's player publishes into the marker collection, so one disarmed outside it is noticed", () => {
      const loop = { startFrame: frames(10), endFrame: frames(20) };
      player.snapshot.update((snapshot) => ({ ...snapshot, loop }));
      fixture.detectChanges();
      expect(collection.noticeActiveLoop).toHaveBeenLastCalledWith(loop);

      // What a transport stop leaves behind: core has dropped the loop with nothing routed through
      // the collection.
      player.snapshot.update((snapshot) => ({ ...snapshot, loop: null }));
      fixture.detectChanges();

      expect(collection.noticeActiveLoop).toHaveBeenLastCalledWith(null);
    });

    it("applies each of this deck's four grid-area names, from the areas input, onto that panel and no other", () => {
      const panelSelectors: Record<keyof DeckPanelAreas, string> = {
        transport: 'lib-transport-panel',
        voiceSpeed: '.voice-speed-column',
        loopsCues: 'lib-loops-cues-panel',
        binding: 'lib-binding-card',
      };

      for (const [areaKey, selector] of Object.entries(panelSelectors) as [
        keyof DeckPanelAreas,
        string
      ][]) {
        const panelEl: HTMLElement = fixture.nativeElement.querySelector(selector);
        expect(panelEl.style.gridArea).toBe(FAKE_AREAS[areaKey]);
      }
    });

    it('calls play, pause and stop on the player from the transport buttons', () => {
      binding.selectedPortId.set('port-1');
      tuneLoader.currentTune.set(fakeSidFile());
      fixture.detectChanges();

      const buttons: HTMLButtonElement[] = Array.from(
        fixture.nativeElement.querySelectorAll('button')
      );
      buttons.find((button) => button.textContent?.trim() === 'Play')?.click();
      expect(player.player.play).toHaveBeenCalled();

      player.snapshot.update((snapshot) => ({ ...snapshot, transport: 'playing' }));
      fixture.detectChanges();
      buttons.find((button) => button.textContent?.trim() === 'Pause')?.click();
      expect(player.player.pause).toHaveBeenCalled();

      buttons.find((button) => button.textContent?.trim() === 'Stop')?.click();
      expect(player.player.stop).toHaveBeenCalled();
    });

    function transportButton(text: string): HTMLButtonElement {
      const root = fixture.nativeElement as HTMLElement;
      return Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(
        (button) => button.textContent?.trim() === text
      ) as HTMLButtonElement;
    }

    it('gates Play on a loaded tune, a selected MIDI port, an idle deck and no scan in flight', () => {
      expect(transportButton('Play').disabled).toBe(true);

      tuneLoader.currentTune.set(fakeSidFile());
      binding.selectedPortId.set('port-1');
      fixture.detectChanges();

      expect(transportButton('Play').disabled).toBe(false);

      tuneIndexService.pending.set(true);
      fixture.detectChanges();

      expect(transportButton('Play').disabled).toBe(true);
    });

    it('keeps Stop and Pause reachable during a scan the deck is playing through, unlike a freshly loaded one', () => {
      tuneLoader.currentTune.set(fakeSidFile());
      fixture.detectChanges();
      expect(transportButton('Stop').disabled).toBe(false);

      // A freshly loaded tune scanning: the deck sits stopped where the load left it, and the load
      // starts it itself once the scan settles — there is nothing there to stop.
      tuneIndexService.pending.set(true);
      fixture.detectChanges();
      expect(transportButton('Stop').disabled).toBe(true);

      // The same scan raised by a subtune step mid-playback. Both gates read the raw transport, so
      // neither is fooled by the `analyzing` state spliced in for the LED.
      player.snapshot.update((snapshot) => ({ ...snapshot, transport: 'playing' }));
      fixture.detectChanges();
      expect(transportButton('Stop').disabled).toBe(false);
      expect(transportButton('Pause').disabled).toBe(false);
    });

    it('gates the subtune stepper on a loaded tune with more than one subtune', () => {
      tuneLoader.currentTune.set(fakeSidFile());
      player.snapshot.update((snapshot) => ({
        ...snapshot,
        tune: { subtune: 1, subtuneCount: 1, lengthFrames: null },
      }));
      fixture.detectChanges();

      const previousButton = fixture.nativeElement.querySelector(
        `[aria-label="Previous subtune deck ${DECKS[0].label}"]`
      ) as HTMLButtonElement;
      const nextButton = fixture.nativeElement.querySelector(
        `[aria-label="Next subtune deck ${DECKS[0].label}"]`
      ) as HTMLButtonElement;
      expect(previousButton.disabled).toBe(true);
      expect(nextButton.disabled).toBe(true);

      player.snapshot.update((snapshot) => ({
        ...snapshot,
        tune: { subtune: 1, subtuneCount: 3, lengthFrames: null },
      }));
      fixture.detectChanges();

      expect(previousButton.disabled).toBe(false);
      expect(nextButton.disabled).toBe(false);
    });

    it("renders both the player's own error and the tune loader's parse error as alerts, together", () => {
      function alertTexts(): (string | null | undefined)[] {
        return Array.from(fixture.nativeElement.querySelectorAll('[role="alert"]')).map((element) =>
          (element as HTMLElement).textContent?.trim()
        );
      }

      expect(alertTexts()).toEqual([]);

      player.snapshot.update((snapshot) => ({ ...snapshot, error: 'player blew up' }));
      fixture.detectChanges();
      expect(alertTexts()).toEqual(['player blew up']);

      tuneLoader.tuneError.set('not a valid SID file');
      fixture.detectChanges();
      expect(alertTexts()).toEqual(['player blew up', 'not a valid SID file']);
    });

    it("reflects and writes the player's repeatTrack from the repeat toggle, persisting it under this deck's own key", () => {
      function repeatToggle(): HTMLInputElement {
        return fixture.nativeElement.querySelector(
          `[aria-label="Repeat track deck ${DECKS[0].label}"]`
        );
      }

      expect(repeatToggle().checked).toBe(true);

      repeatToggle().checked = false;
      repeatToggle().dispatchEvent(new Event('change'));

      expect(player.player.setRepeatTrack).toHaveBeenCalledWith(false);
      expect(localStorage.getItem(`asid-dj-0.deck-${DECKS[0].id}.repeat-track`)).toBe('false');
    });

    it('delegates a tune-source click to the tune loader', () => {
      const button = Array.from(
        fixture.nativeElement.querySelectorAll<HTMLButtonElement>('.tune-sources button')
      ).find((candidate) => candidate.textContent?.trim() === 'Auto tune');

      button?.click();

      // The panel emits the source's id only; resolving it back to the loader's own TuneSource is
      // this component's job.
      expect(tuneLoader.selectTune).toHaveBeenCalledWith(tuneLoader.availableTunes()[0]);
    });

    it('hands a picked file straight to the tune loader', () => {
      const file = new File([new Uint8Array([1])], 'mytune.sid');
      const input = fixture.nativeElement.querySelector('input[type="file"]') as HTMLInputElement;
      // jsdom refuses a `files` assignment, so the picked list is defined over the real element.
      Object.defineProperty(input, 'files', { value: [file], configurable: true });

      input.dispatchEvent(new Event('change'));

      expect(tuneLoader.loadPickedFile).toHaveBeenCalledWith(file);
    });

    it('pins the speed fader at its own bound once the multiplier is carried past it, while the readout keeps showing the real multiplier', () => {
      function faderValue(): number {
        const fader = fixture.nativeElement.querySelector(
          `[aria-label="Speed multiplier deck ${DECKS[0].label}"]`
        ) as HTMLInputElement;
        return Number(fader.value);
      }
      function readoutText(): string | undefined {
        return (
          fixture.nativeElement.querySelector('.speed-value') as HTMLElement
        ).textContent?.trim();
      }

      // A jump past the fader's own [0.5, 1.5] span (still inside the jump buttons' wider hard
      // span) pins the thumb at the boundary rather than snapping the tempo display back.
      player.snapshot.update((snapshot) => ({
        ...snapshot,
        tempo: { ...snapshot.tempo, multiplier: 1.65 },
      }));
      fixture.detectChanges();
      expect(faderValue()).toBe(1.5);
      expect(readoutText()).toBe('1.650x');

      player.snapshot.update((snapshot) => ({
        ...snapshot,
        tempo: { ...snapshot.tempo, multiplier: 0.35 },
      }));
      fixture.detectChanges();
      expect(faderValue()).toBe(0.5);
      expect(readoutText()).toBe('0.350x');
    });

    describe('scrubbing', () => {
      // An 80-second tune at 50 Hz — the basis a released scrub is resolved against.
      const POSITION_BASIS_FRAMES = 4_000;

      beforeEach(() => {
        player.snapshot.update((snapshot) => ({
          ...snapshot,
          basis: { ...snapshot.basis, positionBasisFrames: frames(POSITION_BASIS_FRAMES) },
        }));
        fixture.detectChanges();
      });

      function scrubTrack(): HTMLInputElement {
        return fixture.nativeElement.querySelector('input[type="range"]') as HTMLInputElement;
      }

      /** Drags the thumb to `percent` and releases it. */
      function dragTo(percent: number): void {
        const track = scrubTrack();
        track.value = String(percent);
        track.dispatchEvent(new Event('input'));
        track.dispatchEvent(new Event('change'));
        fixture.detectChanges();
      }

      it('seeks to the released percentage of the basis the playhead is read against', async () => {
        dragTo(25);
        await Promise.resolve();

        expect(collection.stopMarkerLoop).toHaveBeenCalled();
        expect(player.player.seek).toHaveBeenCalledWith(frames(1_000));
      });

      it('holds the thumb where it was released until the seek lands, then follows the playhead again', async () => {
        let landSeek = (): void => undefined;
        vi.mocked(player.player.seek).mockImplementationOnce(
          () => new Promise<void>((resolve) => (landSeek = resolve))
        );

        dragTo(25);

        // The stale playhead the seek has not moved yet — without the pin the thumb snaps back here
        // and then forward again once the jump lands.
        player.position.set(frames(0));
        fixture.detectChanges();
        expect(Number(scrubTrack().value)).toBe(25);

        landSeek();
        await Promise.resolve();
        await Promise.resolve();
        player.position.set(frames(2_000));
        fixture.detectChanges();

        expect(Number(scrubTrack().value)).toBe(50);
      });
    });

    it('adds a marker to the collection from the Loops/Cues panel Add control', () => {
      collection.addMarker.mockImplementation(() => {
        collection.markers.set([markerWithStart(0)]);
        return 0;
      });

      const addButton = fixture.nativeElement.querySelector(
        `[aria-label="Loops/Cues deck ${DECKS[0].label}"] .panel-header-actions button`
      ) as HTMLButtonElement;
      addButton.click();

      expect(collection.addMarker).toHaveBeenCalled();
    });
  });
});
