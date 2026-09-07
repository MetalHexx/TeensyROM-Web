import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  type OnDestroy,
  type OnInit,
} from '@angular/core';
import { createSidPlayer, createWorkerReplayRunner, VOICE_COUNT } from '@sidablist/core';
import { createAsidSink } from '@sidablist/asid';
import { ScriptProcessorFrameClock } from '../../clock/frame-clock';
import { ANALYSIS_SCANNER } from '../../analysis/scan-runner';
import { WorkerAnalysisScanner } from '../../analysis/worker-analysis-scanner';
import { TuneIndexService } from '../../analysis/tune-index.service';
import { DeckMidiBinding } from '../../midi/deck-midi-binding';
import { MixerService } from '../../mixer/mixer.service';
import { DeckContext } from '../deck-context';
import {
  ASID_SINK,
  createDeckPlayerView,
  DECK_PLAYER_VIEW,
  FRAME_CLOCK,
  REPLAY_RUNNER,
  SID_PLAYER,
} from '../deck-player';
import { DeckRegistry } from '../deck-registry';
import { DeckTuneLoader } from '../deck-tune-loader';
import type { DeckDescriptor } from '../deck.config';
import { MarkerCollection } from '../marker-collection';
import { loadRepeatTrackPreference } from '../repeat-track';
import { TransportPanelComponent } from '../transport-panel/transport-panel.component';
import { VoiceSpeedColumnComponent } from '../voice-speed-column/voice-speed-column.component';
import { LoopsCuesPanelComponent } from '../loops-cues-panel/loops-cues-panel.component';
import { BindingCardComponent } from '../binding-card/binding-card.component';

/** The `grid-area` name each of this deck's four panels claims in the page's own `.grid` — computed
 *  page-level, from `DECKS`' own order, and handed down whole. Nothing in this file decides what any
 *  of these strings are; it only applies whichever it is given. */
export interface DeckPanelAreas {
  readonly transport: string;
  readonly voiceSpeed: string;
  readonly loopsCues: string;
  readonly binding: string;
}

/**
 * Starts core's replay worker from first-party code, which is the only place this build will rewrite
 * a worker URL — see `core-replay.worker.ts` for why the package cannot start its own.
 */
const createReplayWorker = (): Worker =>
  new Worker(new URL('../../diagnostics/core-replay.worker', import.meta.url), { type: 'module' });

/**
 * One deck: the whole of what "a deck owns" — its own player, ASID sink, clock, replay worker,
 * analysis scanner, tune index, marker collection and MIDI binding — behind a `providers` array that
 * *is* the deck's injector. `DeckRegistry` is how a page-level surface reaches any of it; nothing
 * here is looked up by any sibling deck.
 *
 * `:host { display: contents }` — this component renders no box of its own. Its whole template is
 * the four performance-surface panels (`TransportPanelComponent`, `VoiceSpeedColumnComponent`,
 * `LoopsCuesPanelComponent`, `BindingCardComponent`), each reaching this deck's collaborators
 * straight from this component's own injector with no inputs threaded down, and each carrying its
 * own `grid-area` from the `areas` input — so they render as direct items of the page's own `.grid`
 * (see `dj-poc-view.component.scss`) rather than of a box this component would otherwise draw. No
 * deck-owned code decides what those area names are: the page computes them from `DECKS`' own order
 * and this component only applies whichever it is handed.
 *
 * Everything that used to sit in this component's own sidebar — Timing, the loaded tune's own
 * read-only fields, Tune Index and Diagnostics — and the Track Analysis panel beside it, are gone
 * from here: neither has a grid area of its own to land in yet. P03-T03 gives both a home in the
 * page's own drawers.
 */
@Component({
  selector: 'lib-deck-host',
  templateUrl: './deck-host.component.html',
  styleUrl: './deck-host.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TransportPanelComponent,
    VoiceSpeedColumnComponent,
    LoopsCuesPanelComponent,
    BindingCardComponent,
  ],
  // Provided here, one level down from where the POC's audio graph and permission-holding services
  // used to stay out of the app injector: two frame clocks, two replay workers and two scan workers
  // is the design, not something to hoist "for efficiency". Do not move a player into a worker —
  // Web MIDI is not exposed to workers, so every packet would hop back to the main thread anyway.
  providers: [
    DeckContext,
    DeckMidiBinding,
    // Built over the binding's own port façade, which re-resolves the deck's selection on every
    // send — so a port swap never needs the sink (or the player above it) rebuilt.
    { provide: ASID_SINK, useFactory: () => createAsidSink(inject(DeckMidiBinding).outputPort) },
    { provide: FRAME_CLOCK, useFactory: () => new ScriptProcessorFrameClock() },
    { provide: REPLAY_RUNNER, useFactory: () => createWorkerReplayRunner(createReplayWorker) },
    {
      provide: SID_PLAYER,
      useFactory: () =>
        createSidPlayer({
          sink: inject(ASID_SINK),
          clock: inject(FRAME_CLOCK),
          replayRunner: inject(REPLAY_RUNNER),
        }),
    },
    { provide: DECK_PLAYER_VIEW, useFactory: () => createDeckPlayerView(inject(SID_PLAYER)) },
    { provide: MarkerCollection, useFactory: () => new MarkerCollection(inject(SID_PLAYER)) },
    DeckTuneLoader,
    TuneIndexService,
    { provide: ANALYSIS_SCANNER, useFactory: () => new WorkerAnalysisScanner() },
  ],
})
export class DeckHostComponent implements OnInit, OnDestroy {
  readonly deck = input.required<DeckDescriptor>();
  readonly areas = input.required<DeckPanelAreas>();

  private readonly context = inject(DeckContext);
  private readonly registry = inject(DeckRegistry);
  private readonly binding = inject(DeckMidiBinding);
  private readonly sink = inject(ASID_SINK);
  private readonly player = inject(SID_PLAYER);
  private readonly view = inject(DECK_PLAYER_VIEW);
  private readonly markers = inject(MarkerCollection);
  private readonly tuneIndex = inject(TuneIndexService);
  private readonly tuneLoader = inject(DeckTuneLoader);
  // Page-level, one level up (`DjPocViewComponent`) — every deck reads the same composed model
  // rather than holding its own, so the crossfader moves both decks' gain from one instance.
  private readonly mixer = inject(MixerService);

  constructor() {
    // Set here rather than injected: the sink is built over this binding's own port, so a
    // constructor injection the other way would close a cycle. See `DeckMidiBinding.sink`.
    this.binding.sink = this.sink;

    // Pushed at the packet boundary, never at the write — see `RegisterFrame.setOutputGain`. Fires
    // once at construction against `context.id()`'s pre-adoption `''` (a no-op gain of 1, since the
    // mixer knows no such deck) and again once `ngOnInit` adopts the real id.
    effect(() => {
      this.player.setOutputGain(this.mixer.gainFor(this.context.id())());
    });
    // One effect per control, same fire-twice pattern as the gain effect above: once at construction
    // against the pre-adoption '' id (a no-op, since the mixer knows no such deck) and again once
    // ngOnInit adopts the real id.
    effect(() => {
      this.player.setRegisterScale(
        'cutoff',
        this.mixer.scaleCoefficient(this.context.id(), 'cutoff')()
      );
    });
    effect(() => {
      this.player.setRegisterScale(
        'resonance',
        this.mixer.scaleCoefficient(this.context.id(), 'resonance')()
      );
    });
    effect(() => {
      this.player.setRegisterScale(
        'pulseWidth',
        this.mixer.scaleCoefficient(this.context.id(), 'pulseWidth')()
      );
    });
    // Key is one knob over three voices: ganging is the application's to define, and ganging all
    // three to one coefficient is what the single frequency-scale group used to do for it.
    effect(() => {
      const coefficient = this.mixer.keyCoefficient(this.context.id())();
      for (let voice = 0; voice < VOICE_COUNT; voice++) {
        this.player.setVoicePitch(voice, coefficient);
      }
    });
    effect(() => {
      this.player.setFilterMode(this.mixer.filterMode(this.context.id())());
    });
    // The lap hand-off: `SidPlayer` notifies on no wrap of its own, so `MarkerCollection` infers one
    // from the polled playhead going backward — see `noticeLoopPosition`. Fed from this deck's own
    // per-frame position signal, the same one every panel already reads.
    effect(() => {
      this.markers.noticeLoopPosition(this.view.position());
    });
  }

  ngOnInit(): void {
    const descriptor = this.deck();
    this.context.adopt(descriptor);
    // DeckMidiBinding's own identity field, not something DeckContext writes for it — see its own
    // doc for why it stays a constructor-free field.
    this.binding.deckId = this.context.id();
    this.binding.restore();
    // This deck's id is not known any earlier, so the persisted preference cannot be read from a
    // provider factory the way a page-level one could.
    this.player.setRepeatTrack(loadRepeatTrackPreference(this.context.id()));
    this.registry.register({
      descriptor,
      player: this.player,
      sink: this.sink,
      view: this.view,
      markers: this.markers,
      binding: this.binding,
      tuneIndex: this.tuneIndex,
      tuneLoader: this.tuneLoader,
    });
  }

  ngOnDestroy(): void {
    this.registry.unregister(this.deck().id);
    // Nothing else holds the clock's audio graph, the cartridge's ASID session or the replay thread:
    // a player left running keeps streaming frames with no UI left to reach `stop()`.
    this.player.dispose();
  }
}
