import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  type OnDestroy,
  type OnInit,
} from '@angular/core';
import { DjPlayerEngine, FRAME_CLOCK, NOMINAL_INTERVAL_OPTIONS_US } from '../../engine/dj-player-engine';
import { ScriptProcessorFrameClock } from '../../clock/frame-clock';
import { REPLAY_RUNNER } from '../../replay/replay-runner';
import { WorkerReplayRunner } from '../../replay/worker-replay-runner';
import { ANALYSIS_SCANNER } from '../../analysis/scan-runner';
import { WorkerAnalysisScanner } from '../../analysis/worker-analysis-scanner';
import { TuneIndexService } from '../../analysis/tune-index.service';
import { TrackAnalysisPanelComponent } from '../../analysis/track-analysis-panel/track-analysis-panel.component';
import { TuneIndexPanelComponent } from '../../analysis/tune-index-panel/tune-index-panel.component';
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

const MICROSECONDS_PER_SECOND = 1_000_000;

/**
 * Off, two sub-frame probes, then a ceiling that reaches well past a single PAL frame (~19.95 ms).
 * `R5` needs a stall shorter than the window to be demonstrably inaudible, which a ceiling of one
 * frame cannot show — `setScheduleAhead()` still clamps the selectable depth to
 * `UNCANCELLABLE_SCHEDULE_AHEAD_CEILING_MS` whenever the selected port cannot cancel a pending send;
 * this list is the shipping-depth question the clamp does not answer on its own.
 */
const SCHEDULE_AHEAD_OPTIONS_MS: readonly number[] = [0, 5, 20, 40, 80, 160];

/**
 * One deck: the whole of what "a deck owns" — its own engine, clock, replay worker, analysis
 * scanner, tune index and MIDI binding — behind a `providers` array that *is* the deck's injector.
 * `DeckRegistry` is how a page-level surface reaches any of it; nothing here is looked up by any
 * sibling deck.
 *
 * The performance surface itself — transport, voice/speed, loops/cues, and the MIDI binding card —
 * is four presentational panels (`TransportPanelComponent`, `VoiceSpeedColumnComponent`,
 * `LoopsCuesPanelComponent`, `BindingCardComponent`) rendered flat here with no wrapper around any
 * two of them: each reaches this deck's collaborators straight from this component's own injector,
 * with no inputs threaded down. What stays here instead is the sidebar (Timing, the loaded tune's own
 * read-only fields, and Diagnostics) and the collaborator wiring `ngOnInit`/`ngOnDestroy` perform.
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
    TrackAnalysisPanelComponent,
    TuneIndexPanelComponent,
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

  protected readonly engineStats = this.engine.stats;
  protected readonly engineError = this.engine.lastError;
  protected readonly trackEndFrame = this.engine.trackEndFrame;
  protected readonly nominalIntervalUs = this.engine.nominalIntervalUs;
  protected readonly scheduleAheadMs = this.engine.scheduleAheadMs;
  protected readonly scheduleAheadOptionsMs = SCHEDULE_AHEAD_OPTIONS_MS;

  protected readonly currentTune = this.tuneLoader.currentTune;

  /** An NTSC tune loads an interval of its own, so the selector has to be able to show it. */
  protected readonly intervalOptions = computed<readonly number[]>(() => {
    const current = this.nominalIntervalUs();
    return NOMINAL_INTERVAL_OPTIONS_US.includes(current)
      ? NOMINAL_INTERVAL_OPTIONS_US
      : [current, ...NOMINAL_INTERVAL_OPTIONS_US];
  });

  // One SID-data packet goes out per clock tick, so the clock's own measured tick rate is the
  // frame-packet rate; the occasional Start/Stop/Identify control packet is noise against it.
  protected readonly packetsPerSecond = computed(() => {
    const intervalUs = this.engineStats().measuredMeanIntervalUs;
    return intervalUs > 0 ? MICROSECONDS_PER_SECOND / intervalUs : 0;
  });
  protected readonly bytesPerSecond = computed(() => {
    const stats = this.engineStats();
    return stats.packetsSent > 0
      ? this.packetsPerSecond() * (stats.bytesSent / stats.packetsSent)
      : 0;
  });

  protected onNominalIntervalChange(event: Event): void {
    this.engine.setNominalIntervalUs(Number((event.target as HTMLSelectElement).value));
  }

  protected onScheduleAheadChange(event: Event): void {
    this.engine.setScheduleAhead(Number((event.target as HTMLSelectElement).value));
  }

  protected frameRateHz(intervalUs: number): string {
    return (MICROSECONDS_PER_SECOND / intervalUs).toFixed(3);
  }
}
