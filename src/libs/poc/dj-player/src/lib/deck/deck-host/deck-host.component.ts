import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  type OnDestroy,
  type OnInit,
} from '@angular/core';
import { clamp, createSidPlayer, createWorkerReplayRunner, VOICE_COUNT } from '@sidablist/core';
import { createAsidSink } from '@sidablist/asid';
import { TransportPanelComponent } from '@teensyrom-nx/ui/components';
import type {
  ScrubBarState,
  StatusLedState,
  TransportPanelModel,
} from '@teensyrom-nx/ui/components';
import { ScriptProcessorFrameClock } from '../../clock/frame-clock';
import { ANALYSIS_SCANNER } from '../../analysis/scan-runner';
import { WorkerAnalysisScanner } from '../../analysis/worker-analysis-scanner';
import { TuneIndexService } from '../../analysis/tune-index.service';
import { positionBasisFor, timelineBasisFor } from '../../analysis/tune-length';
import type { DetectedLoopFrames } from '../../analysis/tune-length';
import { DeckMidiBinding } from '../../midi/deck-midi-binding';
import { MixerService } from '../../mixer/mixer.service';
import { DeckContext } from '../deck-context';
import {
  ASID_SINK,
  createDeckPlayerView,
  DECK_PLAYER_VIEW,
  FRAME_CLOCK,
  REPLAY_RUNNER,
  scrubToPercent,
  SID_PLAYER,
} from '../deck-player';
import { DeckRegistry } from '../deck-registry';
import { DeckTuneLoader } from '../deck-tune-loader';
import type { DeckDescriptor } from '../deck.config';
import { MarkerCollection } from '../marker-collection';
import { loadRepeatTrackPreference, saveRepeatTrackPreference } from '../repeat-track';
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

/** Text for the state LED's adjacent label — the colour reinforces this, it never replaces it.
 *  `analyzing` is spliced in here, in the deck, over the player's own four-plus-one — core never
 *  learns about scanning. */
const TRANSPORT_STATE_LABELS: Record<StatusLedState, string> = {
  stopped: 'Stopped',
  playing: 'Playing',
  paused: 'Paused',
  ended: 'Ended',
  error: 'Error',
  analyzing: 'Analyzing…',
};

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
 * `LoopsCuesPanelComponent`, `BindingCardComponent`), each carrying its own `grid-area` from the
 * `areas` input — so they render as direct items of the page's own `.grid` (see
 * `dj-poc-view.component.scss`) rather than of a box this component would otherwise draw. No
 * deck-owned code decides what those area names are: the page computes them from `DECKS`' own order
 * and this component only applies whichever it is handed.
 *
 * It is also the adapter for whichever of those panels the shared library owns: the transport panel
 * is presentational and injects nothing, so this component composes its whole model from this deck's
 * collaborators and turns its outputs back into player, tune-loader and preference writes. The other
 * three still reach this component's own injector directly, until their own lift lands. Everything
 * an adapted panel needs lives in that panel's own commented section below, in the order the
 * sections arrive — model, per-frame computeds and output handlers together, never interleaved.
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
    // The other half of that hand-off: the transport's own Stop and a fresh tune load both disarm
    // core's loop without passing through `MarkerCollection`, and a collection still claiming a row
    // is looping queues the next trigger behind a lap that is not running. Fed from the published
    // snapshot, so whatever cleared the loop is noticed the same way.
    effect(() => {
      this.markers.noticeActiveLoop(this.view.snapshot().loop);
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

  // ── Transport ──────────────────────────────────────────────────────────────────────────────────

  /** The player's published state, read straight through — every transport derivation reads the
   *  transport field from here, raw, and only the LED sees `analyzing` spliced over it. */
  private readonly snapshot = this.view.snapshot;

  // Non-null only mid-drag: while dragging, the pointer's own value pins the thumb so the polled
  // position updates can't fight it and snap the thumb out from under the operator. Cleared back to
  // null on release, at which point the live position takes back over.
  private readonly scrubDragValue = signal<number | null>(null);

  /** What the position bar draws, over the index record and the pending signal — the one place that
   *  decides loop vs. ended vs. unknown vs. analyzing, so the regions, the tick and the disabled
   *  state can never disagree about it. `timelineBasisFor` gates whether the record answered
   *  anything at all; `positionBasisFor` supplies the ended case's music length, exactly as it does
   *  for both analysis panels' Length rows. */
  private readonly transportBar = computed<ScrubBarState>(() => {
    if (this.tuneIndex.pending()) {
      return { kind: 'analyzing' };
    }
    const record = this.tuneIndex.record();
    if (record === null) {
      return { kind: 'unknown' };
    }
    const detected: DetectedLoopFrames = record;
    const timeline = timelineBasisFor(detected);
    if (timeline === null) {
      return { kind: 'unknown' };
    }
    if (detected.loopStartFrame !== null && detected.loopPeriodFrames !== null) {
      return { kind: 'loop', introPercent: (detected.loopStartFrame / timeline) * 100 };
    }
    return { kind: 'ended', musicPercent: ((positionBasisFor(detected) ?? 0) / timeline) * 100 };
  });

  /**
   * The whole transport panel except its two per-frame values.
   *
   * The spliced `analyzing` state drives the LED and nothing else: all three gates read
   * `snapshot().transport` raw. Reusing the spliced value would make `=== 'stopped'` unreachable
   * whenever a scan is running — collapsing `canStop` to "a tune is loaded" and losing the
   * deliberate "Stop stays out of reach while a freshly loaded tune scans" behaviour — while
   * `canPause` would go false during a mid-playback subtune scan, stranding a playing deck with no
   * Pause. Play stays out of reach for the whole of a scan, whichever load started it: a manual
   * start would put the frame clock beside the analysis worker on the same tune, which is the
   * contention the awaited load exists to avoid. Stop goes out of reach only while a freshly loaded
   * tune scans — the deck is stopped where the load just left it, and the load starts it itself once
   * the scan settles. A scan a subtune step raised mid-playback leaves Stop reachable: that deck is
   * running, and taking Stop from it would strand it with no way to silence the cartridge.
   */
  protected readonly transportModel = computed<TransportPanelModel>(() => {
    const label = this.context.label();
    const snapshot = this.snapshot();
    const analyzing = this.tuneIndex.pending();
    const state: StatusLedState = analyzing ? 'analyzing' : snapshot.transport;
    const hasTune = this.tuneLoader.currentTune() !== null;
    const subtuneCount = snapshot.tune?.subtuneCount ?? 0;

    return {
      accessibleName: `Transport deck ${label}`,
      bar: this.transportBar(),
      scrubAccessibleName: `Position deck ${label}`,
      transport: { state, label: TRANSPORT_STATE_LABELS[state] },
      canPlay:
        hasTune &&
        this.binding.selectedPortId() !== null &&
        snapshot.transport !== 'playing' &&
        !analyzing,
      canPause: snapshot.transport === 'playing',
      canStop: hasTune && !(analyzing && snapshot.transport === 'stopped'),
      repeatTrack: snapshot.repeatTrack,
      tuneSources: this.tuneLoader.availableTunes().map((source) => ({
        id: source.id,
        label: source.label,
        accessibleName: `${source.label} deck ${label}`,
      })),
      subtune: {
        text: `Subtune ${snapshot.tune?.subtune ?? 0} of ${subtuneCount}`,
        disabled: !(hasTune && subtuneCount > 1),
        previousAccessibleName: `Previous subtune deck ${label}`,
        nextAccessibleName: `Next subtune deck ${label}`,
      },
      actionAccessibleNames: {
        play: `Play deck ${label}`,
        pause: `Pause deck ${label}`,
        stop: `Stop deck ${label}`,
        repeat: `Repeat track deck ${label}`,
        chooseFile: `Choose file deck ${label}`,
      },
      errors: [snapshot.error, this.tuneLoader.tuneError()].filter(
        (error): error is string => error !== null
      ),
    };
  });

  /** The playhead as a percentage of what the player measures it against, or the drag pin while one
   *  is held. Clamped to 0–100 because a tune played past its basis — a loop with looping disarmed,
   *  or the fixed ceiling standing in when no length was found — must still pin the thumb rather
   *  than overflow it. Its own computed rather than a field of `transportModel`: see the panel's own
   *  `positionPercent` input for why the per-frame values are kept out of the model. */
  protected readonly transportPositionPercent = computed<number>(() => {
    const pinned = this.scrubDragValue();
    if (pinned !== null) {
      return pinned;
    }
    const basis = this.snapshot().basis.positionBasisFrames;
    return basis === 0 ? 0 : clamp((this.view.position() / basis) * 100, 0, 100);
  });

  /** The playhead's own frame number, polled rather than notified — see `animationFrameSignal`.
   *  Narrow and per-frame, for the same reason as `transportPositionPercent`. */
  protected readonly transportFrameLabel = computed<string>(() => `frame ${this.view.position()}`);

  /** Starts this deck. */
  protected onPlay(): void {
    void this.player.play();
  }

  /** Pauses this deck. */
  protected onPause(): void {
    this.player.pause();
  }

  /** Stops this deck. */
  protected onStop(): void {
    this.player.stop();
  }

  /** Core holds the preference as a value and persists nothing, so this deck's own key is written
   *  here, beside the call that makes the change take effect. */
  protected onRepeatTrackChange(enabled: boolean): void {
    this.player.setRepeatTrack(enabled);
    saveRepeatTrackPreference(this.context.id(), enabled);
  }

  /** Resolves the panel's emitted source id back to the loader's own `TuneSource` — the panel round-
   *  trips the id verbatim and knows nothing of what backs it. */
  protected onTuneSelect(id: string): void {
    const source = this.tuneLoader.availableTunes().find((candidate) => candidate.id === id);
    if (source) {
      this.tuneLoader.selectTune(source);
    }
  }

  /** Hands the picked file straight to the loader; the panel has already unwrapped it from its own
   *  input and reset that input for the next pick. */
  protected onFileSelect(file: File): void {
    void this.tuneLoader.loadPickedFile(file);
  }

  /** Steps to the previous subtune. */
  protected onPreviousSubtune(): void {
    this.player.previousSubtune();
  }

  /** Steps to the next subtune. */
  protected onNextSubtune(): void {
    this.player.nextSubtune();
  }

  /** Pins the thumb at the dragged value for as long as the drag lasts. */
  protected onScrubInput(value: number): void {
    this.scrubDragValue.set(value);
  }

  /**
   * The release, not every drag tick — the seam that makes this "drag anywhere, release, and it
   * jumps" rather than a continuous scrub. The pin stays set — holding the thumb at the released
   * spot — until the async seek actually lands; releasing it early snapped the thumb back to the
   * stale position and then forward again once the worker's replay landed. Guarded on the pin still
   * being this call's own value so a superseded scrub settling late cannot clear a newer one's pin
   * out from under it.
   */
  protected async onScrubCommit(value: number): Promise<void> {
    this.scrubDragValue.set(value);
    await scrubToPercent(this.player, this.markers, value);
    if (this.scrubDragValue() === value) {
      this.scrubDragValue.set(null);
    }
  }
}
