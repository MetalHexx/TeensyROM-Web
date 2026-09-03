import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  type OnDestroy,
  type OnInit,
} from '@angular/core';
import { DjPlayerEngine, FRAME_CLOCK } from '../../engine/dj-player-engine';
import { ScriptProcessorFrameClock } from '../../clock/frame-clock';
import { REPLAY_RUNNER } from '../../replay/replay-runner';
import { WorkerReplayRunner } from '../../replay/worker-replay-runner';
import { ANALYSIS_SCANNER } from '../../analysis/scan-runner';
import { WorkerAnalysisScanner } from '../../analysis/worker-analysis-scanner';
import { TuneIndexService } from '../../analysis/tune-index.service';
import { DeckMidiBinding } from '../../midi/deck-midi-binding';
import { MixerService } from '../../mixer/mixer.service';
import { DeckContext } from '../deck-context';
import { DeckRegistry } from '../deck-registry';
import { DeckTuneLoader } from '../deck-tune-loader';
import type { DeckDescriptor } from '../deck.config';
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
 * One deck: the whole of what "a deck owns" — its own engine, clock, replay worker, analysis
 * scanner, tune index and MIDI binding — behind a `providers` array that *is* the deck's injector.
 * `DeckRegistry` is how a page-level surface reaches any of it; nothing here is looked up by any
 * sibling deck.
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
  // is the design, not something to hoist "for efficiency". Do not move an engine into a worker —
  // Web MIDI is not exposed to workers, so every packet would hop back to the main thread anyway.
  providers: [
    DeckContext,
    DeckMidiBinding,
    DjPlayerEngine,
    DeckTuneLoader,
    TuneIndexService,
    { provide: FRAME_CLOCK, useFactory: () => new ScriptProcessorFrameClock() },
    { provide: REPLAY_RUNNER, useFactory: () => new WorkerReplayRunner() },
    { provide: ANALYSIS_SCANNER, useFactory: () => new WorkerAnalysisScanner() },
  ],
})
export class DeckHostComponent implements OnInit, OnDestroy {
  readonly deck = input.required<DeckDescriptor>();
  readonly areas = input.required<DeckPanelAreas>();

  private readonly context = inject(DeckContext);
  private readonly registry = inject(DeckRegistry);
  private readonly binding = inject(DeckMidiBinding);
  private readonly engine = inject(DjPlayerEngine);
  private readonly tuneIndex = inject(TuneIndexService);
  private readonly tuneLoader = inject(DeckTuneLoader);
  // Page-level, one level up (`DjPocViewComponent`) — every deck reads the same composed model
  // rather than holding its own, so the crossfader moves both decks' gain from one instance.
  private readonly mixer = inject(MixerService);

  constructor() {
    // Pushed at the packet boundary, never at the write — see `RegisterFrame.setOutputGain`. Fires
    // once at construction against `context.id()`'s pre-adoption `''` (a no-op gain of 1, since the
    // mixer knows no such deck) and again once `ngOnInit` adopts the real id.
    effect(() => {
      this.engine.setOutputGain(this.mixer.gainFor(this.context.id())());
    });
    // One effect per control, same fire-twice pattern as the gain effect above: once at construction
    // against the pre-adoption '' id (a no-op, since the mixer knows no such deck) and again once
    // ngOnInit adopts the real id.
    effect(() => {
      this.engine.setRegisterScale('cutoff', this.mixer.scaleCoefficient(this.context.id(), 'cutoff')());
    });
    effect(() => {
      this.engine.setRegisterScale(
        'resonance',
        this.mixer.scaleCoefficient(this.context.id(), 'resonance')()
      );
    });
    effect(() => {
      this.engine.setRegisterScale(
        'pulseWidth',
        this.mixer.scaleCoefficient(this.context.id(), 'pulseWidth')()
      );
    });
    // Key is the one place the control name and the register group differ — 'key' is the UI's word
    // for it, 'frequency' is the register group it drives. There is no 'key' group.
    effect(() => {
      this.engine.setRegisterScale('frequency', this.mixer.keyCoefficient(this.context.id())());
    });
    effect(() => {
      this.engine.setFilterMode(this.mixer.filterMode(this.context.id())());
    });
  }

  ngOnInit(): void {
    const descriptor = this.deck();
    this.context.adopt(descriptor);
    // DeckMidiBinding's own identity field, not something DeckContext writes for it — see its own
    // doc for why it stays a constructor-free field.
    this.binding.deckId = this.context.id();
    this.binding.restore();
    this.engine.restoreRepeatTrackPreference();
    this.registry.register({
      descriptor,
      engine: this.engine,
      binding: this.binding,
      tuneIndex: this.tuneIndex,
      tuneLoader: this.tuneLoader,
    });
  }

  ngOnDestroy(): void {
    this.registry.unregister(this.deck().id);
  }
}
