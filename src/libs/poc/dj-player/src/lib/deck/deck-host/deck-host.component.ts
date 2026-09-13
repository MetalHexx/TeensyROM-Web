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
import {
  clamp,
  createSidPlayer,
  createWorkerReplayRunner,
  milliseconds,
  msToPlayCalls,
  playCallIntervalUs,
  VOICE_COUNT,
} from '@sidablist/core';
import { createAsidSink } from '@sidablist/asid';
import {
  BindingCardComponent,
  LoopsCuesPanelComponent,
  SpeedPanelComponent,
  TransportPanelComponent,
  VoicePanelComponent,
} from '@teensyrom-nx/ui/components';
import type {
  BindingCardModel,
  BindingPortModel,
  JumpButtonModel,
  LoopsCuesPanelModel,
  MarkerRowAction,
  MarkerRowModel,
  MarkerSlotModel,
  ScrubBarState,
  SpeedPanelModel,
  StatusLedState,
  TransportPanelModel,
  VoicePanelModel,
  VoiceRowModel,
} from '@teensyrom-nx/ui/components';
import { ScriptProcessorFrameClock } from '../../clock/frame-clock';
import { ANALYSIS_SCANNER } from '../../analysis/scan-runner';
import { WorkerAnalysisScanner } from '../../analysis/worker-analysis-scanner';
import { nextMomentOffset, reachableMomentOffsets } from '../../analysis/marker-moments';
import { TuneIndexService } from '../../analysis/tune-index.service';
import type { DetectedMoment } from '../../analysis/tune-index.model';
import { positionBasisFor, timelineBasisFor } from '../../analysis/tune-length';
import type { DetectedLoopFrames } from '../../analysis/tune-length';
import { DeckMidiBinding } from '../../midi/deck-midi-binding';
import { MidiAccessService } from '../../midi/midi-access.service';
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
import { MarkerCollection, NUDGE_RANGE_MS } from '../marker-collection';
import { loadRepeatTrackPreference, saveRepeatTrackPreference } from '../repeat-track';
import { createSpeedExcursion, SPEED_HARD_SPAN, SPEED_INPUT_SPAN } from '../speed-excursion';

/** The `grid-area` name each of this deck's four panels claims in the page's own `.grid` — computed
 *  page-level, from `DECKS`' own order, and handed down whole. Nothing in this file decides what any
 *  of these strings are; it only applies whichever it is given. */
export interface DeckPanelAreas {
  readonly transport: string;
  readonly voiceSpeed: string;
  readonly loopsCues: string;
  readonly binding: string;
}

const MICROSECONDS_PER_MILLISECOND = 1000;

/** Signed and unit-suffixed, as a nudge row reads it: `+0 fr`, `−7 fr`. */
function offsetLabel(offset: number): string {
  return `${offset < 0 ? '−' : '+'}${Math.abs(offset)} fr`;
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
 * the deck's four performance-surface panels (`TransportPanelComponent`; `VoicePanelComponent` and
 * `SpeedPanelComponent`, sharing the `voiceSpeed` grid area in one wrapper; `LoopsCuesPanelComponent`;
 * `BindingCardComponent`), each carrying its own `grid-area` from the `areas` input — so they render
 * as direct items of the page's own `.grid` (see `dj-poc-view.component.scss`) rather than of a box
 * this component would otherwise draw. No deck-owned code decides what those area names are: the
 * page computes them from `DECKS`' own order and this component only applies whichever it is handed.
 *
 * It is also the adapter for every one of those panels: Transport, Voice, Speed, Loops/Cues and
 * Binding are all presentational and inject nothing, so this component composes each one's whole
 * model from this deck's collaborators and turns its outputs back into player, tune-loader,
 * marker-collection, MIDI-binding and preference writes. Everything an adapted panel needs lives in
 * that panel's own commented section below, in the order the sections arrive — model, per-frame
 * computeds and output handlers together, never interleaved.
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
    VoicePanelComponent,
    SpeedPanelComponent,
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
  // Page-level, one level up (`DjPocViewComponent`) — the SysEx permission grant and the enumerated
  // port list are facts about the page's one Web MIDI session, not about this deck, so both decks'
  // own binding cards read and drive the same instance rather than each holding its own.
  private readonly midiAccess = inject(MidiAccessService);
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

  // ── Voice ──────────────────────────────────────────────────────────────────────────────────────

  /** One row per voice, in playback order. `checkboxId` keeps the POC's own
   *  `voice-mute-<index>-<label>` shape so two decks on the page never collide. */
  protected readonly voiceModel = computed<VoicePanelModel>(() => {
    const label = this.context.label();
    const rows: readonly VoiceRowModel[] = this.snapshot().voices.map((voice, index) => ({
      label: `V${index + 1}`,
      muted: voice.muted,
      holdLabel: voice.muted ? 'Punch' : 'Kill',
      checkboxId: `voice-mute-${index}-${label}`,
      muteAccessibleName: `Mute voice ${index + 1} deck ${label}`,
      holdAccessibleName: `${voice.muted ? 'Punch' : 'Kill'} voice ${index + 1} deck ${label}`,
    }));
    return {
      accessibleName: `Voice deck ${label}`,
      rows,
      clearAccessibleName: `Clear all voice mutes deck ${label}`,
    };
  });

  /** `index` is the row's position in `voiceModel().rows`, which is also the voice number. */
  protected onVoiceMutedChange(event: { index: number; muted: boolean }): void {
    this.player.setVoiceMuted(event.index, event.muted);
  }

  /** `index` is the row's position in `voiceModel().rows`, which is also the voice number. */
  protected onVoiceHeldChange(event: { index: number; held: boolean }): void {
    this.player.setVoiceHeld(event.index, event.held);
  }

  protected onClearVoiceMutes(): void {
    this.player.clearVoiceMutes();
  }

  // ── Speed ──────────────────────────────────────────────────────────────────────────────────────

  private readonly speedMultiplier = computed(() => this.snapshot().tempo.multiplier);
  private readonly minSpeed = 1 - SPEED_INPUT_SPAN;
  private readonly maxSpeed = 1 + SPEED_INPUT_SPAN;

  /** The excursion state machine — see `speed-excursion.ts`. Wired straight to the player's
   *  `setTempo`, which rejects only what it cannot divide by, so the excursion's hard-span clamp is
   *  the only one in force on this path. */
  private readonly speedExcursion = createSpeedExcursion({
    setTempo: (multiplier) => this.player.setTempo(multiplier),
    getMultiplier: () => this.speedMultiplier(),
    slowest: 1 - SPEED_HARD_SPAN,
    fastest: 1 + SPEED_HARD_SPAN,
  });

  /** `faderValue` is the live multiplier pinned into `[min, max]` — display only, never written back
   *  to the player, so a jump that carries the multiplier past the fader's own (narrower) span pins
   *  the thumb instead of dragging the tempo back. */
  protected readonly speedModel = computed<SpeedPanelModel>(() => {
    const label = this.context.label();
    const multiplier = this.speedMultiplier();
    const jumpButtons: readonly JumpButtonModel[] = [
      { id: 'up', label: '+50%', accessibleName: `Speed up 50% deck ${label}` },
      { id: 'home', label: 'Home', accessibleName: `Speed home deck ${label}` },
      { id: 'down', label: '−50%', accessibleName: `Speed down 50% deck ${label}` },
    ];
    return {
      accessibleName: `Speed deck ${label}`,
      valueText: `${multiplier.toFixed(3)}x`,
      faderValue: clamp(multiplier, this.minSpeed, this.maxSpeed),
      faderAccessibleName: `Speed multiplier deck ${label}`,
      min: this.minSpeed,
      max: this.maxSpeed,
      step: 0.001,
      jumpButtons,
    };
  });

  /** The fader's own narrower span is applied here, not in core: how far a control may reach is the
   *  application's to decide. */
  protected onSpeedFaderChange(multiplier: number): void {
    if (!Number.isFinite(multiplier)) {
      return;
    }
    this.player.setTempo(clamp(multiplier, this.minSpeed, this.maxSpeed));
  }

  /** Routes the jump group's pressed id to the excursion machine — see `speed-excursion.ts`. */
  protected onSpeedJump(id: string): void {
    switch (id) {
      case 'up':
        this.speedExcursion.jumpUp();
        return;
      case 'home':
        this.speedExcursion.home();
        return;
      case 'down':
        this.speedExcursion.jumpDown();
        return;
    }
  }

  // ── Loops/Cues ─────────────────────────────────────────────────────────────────────────────────

  // Marker index → the start offset being dragged right now. Absent means "not dragging that
  // marker's start". Re-entering a point seeks and re-arms, so the commit has to wait for the
  // release rather than following every drag tick.
  private readonly startDragOffsets = signal<ReadonlyMap<number, number>>(new Map());

  // Marker index → the end offset being dragged right now. Kept purely so the readout tracks the
  // thumb; the commit itself waits for release, because it also auditions the seam.
  private readonly endDragOffsets = signal<ReadonlyMap<number, number>>(new Map());

  /** The nudge range in the slider's own frames. Derived from the stored real-time range at the
   *  tune's own rate, so the felt window is the same on a 1x tune and a 2x-multispeed one. */
  private readonly nudgeRange = computed<number>(() => this.msToFrames(NUDGE_RANGE_MS));

  /** Empty between loads and for a tune with no stored moments. */
  private readonly moments = computed<readonly DetectedMoment[]>(
    () => this.tuneIndex.record()?.detectedMoments ?? []
  );

  /**
   * The whole marker list except its per-frame progress strips.
   *
   * Nudges are drawn in frames and stored in real time. Each slot's slider, ticks and readout are
   * all frame counts, because a stored moment is a frame number and a tick has to land on one;
   * `MarkerCollection` holds the committed offset in milliseconds so a row's felt range is the same
   * on a 1x tune and a 2x-multispeed one. This adapter is the one place the two meet — see
   * `msToFrames`/`framesToMs`.
   */
  protected readonly loopsCuesModel = computed<LoopsCuesPanelModel>(() => {
    const label = this.context.label();
    const moments = this.moments();
    const nudgeRange = this.nudgeRange();
    const launchPending = this.markers.markerLaunchPending();
    const looping = this.markers.loopingMarker();
    const queued = this.markers.queuedMarker();

    const rows: readonly MarkerRowModel[] = this.markers.markers().map((marker, index) => {
      const number = index + 1;
      const startOffset = this.displayedMarkerStartOffset(index);
      const startFrame = marker.startFrame + startOffset;
      const start: MarkerSlotModel = {
        frameLabel: `frame ${startFrame}`,
        offsetLabel: offsetLabel(startOffset),
        nudgeValue: startOffset,
        nudgeRange,
        tickOffsets: reachableMomentOffsets(moments, marker.startFrame, nudgeRange),
        previousDisabled:
          nextMomentOffset(moments, marker.startFrame, startOffset, nudgeRange, -1) === null,
        nextDisabled:
          nextMomentOffset(moments, marker.startFrame, startOffset, nudgeRange, 1) === null,
        nudgeAccessibleName: `Nudge marker ${number} start deck ${label}`,
        previousAccessibleName: `Snap marker ${number} start to previous moment deck ${label}`,
        nextAccessibleName: `Snap marker ${number} start to next moment deck ${label}`,
      };

      const savedEnd = marker.end;
      let end: MarkerSlotModel | null = null;
      let loopLengthLabel: string | null = null;
      if (savedEnd !== null) {
        const endOffset = this.displayedMarkerEndOffset(index);
        const endFrame = savedEnd.frame + endOffset;
        end = {
          frameLabel: `frame ${endFrame}`,
          offsetLabel: offsetLabel(endOffset),
          nudgeValue: endOffset,
          nudgeRange,
          tickOffsets: reachableMomentOffsets(moments, savedEnd.frame, nudgeRange),
          previousDisabled:
            nextMomentOffset(moments, savedEnd.frame, endOffset, nudgeRange, -1) === null,
          nextDisabled:
            nextMomentOffset(moments, savedEnd.frame, endOffset, nudgeRange, 1) === null,
          nudgeAccessibleName: `Nudge marker ${number} end deck ${label}`,
          previousAccessibleName: `Snap marker ${number} end to previous moment deck ${label}`,
          nextAccessibleName: `Snap marker ${number} end to next moment deck ${label}`,
        };
        loopLengthLabel = `Loop Length: ${endFrame - startFrame} fr`;
      }

      return {
        number: String(number),
        state: looping === index ? 'active' : queued === index ? 'queued' : 'idle',
        // A delete racing an in-flight trigger would reindex the collection out from under it, so
        // both go out of reach on every row for the span of a launch.
        triggerDisabled: launchPending,
        deleteDisabled: launchPending,
        loopLengthLabel,
        start,
        end,
        triggerAccessibleName: `Trigger marker ${number} deck ${label}`,
        setEndAccessibleName: `Set end for marker ${number} deck ${label}`,
        revertAccessibleName: `Revert marker ${number} to cue deck ${label}`,
        deleteAccessibleName: `Delete marker ${number} deck ${label}`,
      };
    });

    return {
      accessibleName: `Loops/Cues deck ${label}`,
      addAccessibleName: `Add marker deck ${label}`,
      stopAccessibleName: `Stop loop deck ${label}`,
      rows,
    };
  });

  /** 0–100 per row, non-zero only for the marker currently looping. Its own computed rather than a
   *  field of `loopsCuesModel`: reading the polled playhead is what makes the strip re-render as the
   *  lap advances, and folding that into the model would rebuild every marker slot — and re-run
   *  every reachable-moment lookup — sixty times a second. The position read has to come before
   *  `progressPercentFor`, which pulls the position again for the arithmetic itself. */
  protected readonly loopsCuesRowProgressPercents = computed<readonly number[]>(() =>
    this.markers.markers().map((_, index) => {
      this.view.position();
      return this.markers.progressPercentFor(index);
    })
  );

  /** A real-time nudge in frames — the same conversion `MarkerCollection` applies when it resolves a
   *  row, so what a readout draws and the frame actually played agree. */
  private msToFrames(ms: number): number {
    const { nominalIntervalUs, rate } = this.view.snapshot().tempo;
    return msToPlayCalls(milliseconds(ms), nominalIntervalUs, rate);
  }

  /** The inverse, applied once at the commit: the collection stores real time, the slider works in
   *  frames. */
  private framesToMs(frameCount: number): number {
    const { nominalIntervalUs, rate } = this.view.snapshot().tempo;
    return Math.round(
      (frameCount * playCallIntervalUs(nominalIntervalUs, rate)) / MICROSECONDS_PER_MILLISECOND
    );
  }

  /** The start offset a marker's row shows, in frames: the live drag while one is in flight, the
   *  committed value otherwise. */
  private displayedMarkerStartOffset(index: number): number {
    const committed = this.markers.markers()[index]?.startOffsetMs ?? 0;
    return this.startDragOffsets().get(index) ?? this.msToFrames(committed);
  }

  /** The end offset a marker's row shows — mirrors `displayedMarkerStartOffset`. */
  private displayedMarkerEndOffset(index: number): number {
    const committed = this.markers.markers()[index]?.end?.offsetMs ?? 0;
    return this.endDragOffsets().get(index) ?? this.msToFrames(committed);
  }

  /** Captures a marker at this deck's playhead. */
  protected onAddMarker(): void {
    this.markers.addMarker();
  }

  /** Ends whichever marker is looping — one panel-level control, not a per-row stop. */
  protected onStopLoop(): void {
    this.markers.stopMarkerLoop();
  }

  /** Routes one row's control back to this deck's collection. `index` is the row's position in
   *  `loopsCuesModel().rows`, which is also its index in the collection. Nudge drags move the
   *  readout only — committing seeks and re-arms the loop, so running one per drag tick would put a
   *  steady stream of jumps beside the audio callback. */
  protected onMarkerRowAction(event: {
    index: number;
    action: MarkerRowAction;
    value?: number;
  }): void {
    const { index, action } = event;
    const value = event.value ?? 0;
    switch (action) {
      case 'trigger':
        void this.markers.triggerMarker(index);
        return;
      case 'setEnd':
        this.markers.setMarkerEnd(index);
        return;
      case 'clearEnd':
        this.markers.clearMarkerEnd(index);
        return;
      case 'delete':
        this.markers.deleteMarker(index);
        return;
      case 'startNudgeInput':
        this.startDragOffsets.update((offsets) => new Map(offsets).set(index, value));
        return;
      case 'startNudgeCommit':
        this.commitStartOffset(index, value);
        return;
      case 'startSnapPrevious':
        this.snapMarkerStart(index, -1);
        return;
      case 'startSnapNext':
        this.snapMarkerStart(index, 1);
        return;
      case 'endNudgeInput':
        this.endDragOffsets.update((offsets) => new Map(offsets).set(index, value));
        return;
      case 'endNudgeCommit':
        this.commitEndOffset(index, value);
        return;
      case 'endSnapPrevious':
        this.snapMarkerEnd(index, -1);
        return;
      case 'endSnapNext':
        this.snapMarkerEnd(index, 1);
        return;
    }
  }

  // Routes through the same commit a slider release makes: clearing the drag-offset entry matters
  // just as much as the offset itself — a stale entry there would otherwise win over the committed
  // value in `displayedMarkerStartOffset`.
  private snapMarkerStart(index: number, direction: -1 | 1): void {
    const next = this.nextStartMomentOffset(index, direction);
    if (next === null) return;
    this.commitStartOffset(index, next);
  }

  // Mirrors `snapMarkerStart`.
  private snapMarkerEnd(index: number, direction: -1 | 1): void {
    const next = this.nextEndMomentOffset(index, direction);
    if (next === null) return;
    this.commitEndOffset(index, next);
  }

  /** Commits a frame offset as the real time the collection stores, then auditions so the operator
   *  hears where the point now lands. Auditions bypass the queue by design — a setup gesture, not a
   *  performance trigger. Clearing the drag entry matters as much as the commit: a stale entry there
   *  would otherwise win over the committed value in `displayedMarkerStartOffset`. */
  private commitStartOffset(index: number, offsetFrames: number): void {
    this.markers.setMarkerStartOffset(index, this.framesToMs(offsetFrames));
    void this.markers.auditionMarkerStart(index);
    this.startDragOffsets.update((offsets) => {
      const next = new Map(offsets);
      next.delete(index);
      return next;
    });
  }

  /** Mirrors `commitStartOffset`. */
  private commitEndOffset(index: number, offsetFrames: number): void {
    this.markers.setMarkerEndOffset(index, this.framesToMs(offsetFrames));
    void this.markers.auditionMarkerEnd(index);
    this.endDragOffsets.update((offsets) => {
      const next = new Map(offsets);
      next.delete(index);
      return next;
    });
  }

  private nextStartMomentOffset(index: number, direction: -1 | 1): number | null {
    const marker = this.markers.markers()[index] ?? null;
    if (marker === null) return null;
    return nextMomentOffset(
      this.moments(),
      marker.startFrame,
      this.displayedMarkerStartOffset(index),
      this.nudgeRange(),
      direction
    );
  }

  private nextEndMomentOffset(index: number, direction: -1 | 1): number | null {
    const end = this.markers.markers()[index]?.end ?? null;
    if (end === null) return null;
    return nextMomentOffset(
      this.moments(),
      end.frame,
      this.displayedMarkerEndOffset(index),
      this.nudgeRange(),
      direction
    );
  }

  // ── Binding ────────────────────────────────────────────────────────────────────────────────────

  // Web MIDI enumerates zero ports for a granted-but-empty session (no cartridge attached, or the OS
  // hasn't surfaced it yet) without the service itself treating that as an error.
  private readonly noPortsFoundError = computed<string | null>(() =>
    this.midiAccess.accessState() === 'granted' && this.midiAccess.ports().length === 0
      ? 'MIDI access was granted, but no output ports were found. Connect the cartridge and re-enable MIDI.'
      : null
  );

  /** The whole binding card. `portsEnabled`/`enableDisabled` fall through `'unsupported'` the same
   *  as `'idle'` and `'denied'` — neither is `'granted'` nor `'requesting'`. Identify stays out of
   *  reach while this deck plays: it interrupts the cartridge's stream. */
  protected readonly bindingModel = computed<BindingCardModel>(() => {
    const label = this.context.label();
    const accessState = this.midiAccess.accessState();
    const portsEnabled = accessState === 'granted';
    const selectedPortId = this.binding.selectedPortId();
    const ports: readonly BindingPortModel[] = this.midiAccess
      .ports()
      .map((port) => ({ id: port.id, label: `${port.name} (${port.manufacturer})` }));

    return {
      accessibleName: `MIDI binding deck ${label}`,
      heading: `Deck ${label}`,
      ports,
      selectedPortId,
      portsEnabled,
      enableDisabled: accessState === 'requesting',
      identifyDisabled: !(
        portsEnabled &&
        selectedPortId !== null &&
        this.snapshot().transport !== 'playing'
      ),
      selectAccessibleName: `Output port deck ${label}`,
      enableAccessibleName: `Enable MIDI deck ${label}`,
      identifyAccessibleName: `Identify deck ${label}`,
      errors: [
        this.midiAccess.lastError(),
        this.noPortsFoundError(),
        this.binding.lastError(),
      ].filter((error): error is string => error !== null),
    };
  });

  /** Requests the page-level grant, then restores this deck's own persisted selection. Idempotent: a
   *  second press while already granted just re-enumerates and restores again, which is itself a
   *  no-op once a selection already stands. */
  protected onEnableMidi(): void {
    void this.midiAccess.requestAccess().then(() => this.binding.restore());
  }

  /** '' names the placeholder option, not a port — routed to `clearSelection` so it can never reach
   *  `selectPort`, which would otherwise let this deck "hold" a nonexistent port and read as
   *  selected with nothing behind it. */
  protected onPortSelect(portId: string): void {
    if (portId === '') {
      this.binding.clearSelection();
      return;
    }
    this.binding.selectPort(portId);
  }

  /** Names the port by its enumerated position, since Web MIDI exposes nothing else that
   *  distinguishes two identical cartridges. */
  protected onIdentify(): void {
    const ports = this.midiAccess.ports();
    const index = ports.findIndex((port) => port.id === this.binding.selectedPortId());
    const label = index === -1 ? 'ASID-DJ-0 PORT ?' : `ASID-DJ-0 PORT ${index + 1}`;
    this.binding.identify(label);
  }
}
