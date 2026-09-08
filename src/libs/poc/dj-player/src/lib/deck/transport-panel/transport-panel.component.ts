import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { clamp } from '@sidablist/core';
import type { PlayerSnapshot } from '@sidablist/core';
import { positionBasisFor, timelineBasisFor } from '../../analysis/tune-length';
import type { DetectedLoopFrames } from '../../analysis/tune-length';
import { TuneIndexService } from '../../analysis/tune-index.service';
import { DeckContext } from '../deck-context';
import { DECK_PLAYER_VIEW, SID_PLAYER, scrubToPercent } from '../deck-player';
import { DeckTuneLoader } from '../deck-tune-loader';
import { MarkerCollection } from '../marker-collection';
import type { TuneSource } from '../deck-tune-loader';
import { saveRepeatTrackPreference } from '../repeat-track';
import { DeckMidiBinding } from '../../midi/deck-midi-binding';

/** What the position bar draws. `unknown` is a verdict, not a waiting room — a record that answered
 *  nothing renders hatched and never falls back to another state. `analyzing` is a transient that
 *  looks different on purpose: hatched means "we looked and verified nothing", dimmed means "nothing
 *  has been looked for yet". Neither `analyzing` nor `unknown` carries a tick or a playhead. */
type BarState =
  | { kind: 'analyzing' }
  | { kind: 'unknown' }
  | { kind: 'loop'; introPercent: number } // 0 for loop-from-top; the tick sits at introPercent
  | { kind: 'ended'; musicPercent: number }; // no tick — there is no loop point

/** The transport's own six-state readout. `analyzing` is spliced in here, in the deck, over the
 *  player's own four-plus-one — core never learns about scanning. */
type TransportState = PlayerSnapshot['transport'] | 'analyzing';

/** Text for the LED's adjacent label — the colour reinforces this, it never replaces it. */
const TRANSPORT_STATE_LABELS: Record<TransportState, string> = {
  stopped: 'Stopped',
  playing: 'Playing',
  paused: 'Paused',
  ended: 'Ended',
  error: 'Error',
  analyzing: 'Analyzing…',
};

/**
 * Line 1: the position bar and its frame readout. Line 2: transport buttons, the repeat toggle, and
 * the state indicator. Line 3: this deck's tune load controls and the subtune stepper. Nothing more —
 * the wireframe draws exactly three lines and this component is the whole of what "the transport"
 * means for a deck.
 *
 * Reads every collaborator from the deck injector it renders inside (`DeckHostComponent`'s
 * `providers`) — no inputs, because the injector already resolves per deck.
 */
@Component({
  selector: 'lib-transport-panel',
  templateUrl: './transport-panel.component.html',
  styleUrl: './transport-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransportPanelComponent {
  private readonly player = inject(SID_PLAYER);
  private readonly view = inject(DECK_PLAYER_VIEW);
  private readonly context = inject(DeckContext);
  private readonly tuneLoader = inject(DeckTuneLoader);
  private readonly binding = inject(DeckMidiBinding);
  private readonly markers = inject(MarkerCollection);
  // The in-flight scan flag lives nowhere else: the published record is the settled answer, and
  // `analyzing`/`canPlay`/`canStop` and the position bar all need to know one is still running.
  private readonly tuneIndex = inject(TuneIndexService);

  protected readonly label = this.context.label;

  private readonly snapshot = this.view.snapshot;
  protected readonly playerState = computed(() => this.snapshot().transport);
  protected readonly playerError = computed(() => this.snapshot().error);
  protected readonly repeatTrack = computed(() => this.snapshot().repeatTrack);

  private readonly selectedMidiPortId = this.binding.selectedPortId;

  /** True while the tune-index service is scanning a genuinely new tune — never true for a cache
   *  hit, which publishes its record without ever setting this. */
  protected readonly analyzing = this.tuneIndex.pending;

  /** The composed transport readout the LED and its label draw from. Keeps the dependency running
   *  one way — the tune-index service already depends on the player, and the player never on it. */
  protected readonly transportState = computed<TransportState>(() =>
    this.analyzing() ? 'analyzing' : this.playerState()
  );

  protected readonly transportStateLabel = computed<string>(
    () => TRANSPORT_STATE_LABELS[this.transportState()]
  );

  /** The playhead's own frame number, polled rather than notified — see `animationFrameSignal`. */
  protected readonly framesRendered = this.view.position;

  protected readonly currentSubtune = computed(() => this.snapshot().tune?.subtune ?? 0);
  protected readonly subtuneCount = computed(() => this.snapshot().tune?.subtuneCount ?? 0);

  protected readonly availableTunes = this.tuneLoader.availableTunes;
  protected readonly currentTune = this.tuneLoader.currentTune;
  protected readonly tuneError = this.tuneLoader.tuneError;

  /** Play stays out of reach for the whole of a scan, whichever load started it: a manual start would
   *  put the frame clock beside the analysis worker on the same tune, which is the contention the
   *  awaited load exists to avoid. */
  protected readonly canPlay = computed(
    () =>
      this.currentTune() !== null &&
      this.selectedMidiPortId() !== null &&
      this.playerState() !== 'playing' &&
      !this.analyzing()
  );

  /** Stop goes out of reach only while a freshly loaded tune scans — the deck is stopped at the
   *  position the load just established, and the load starts it itself once the scan settles, so
   *  there is nothing there to stop. A scan a subtune step raised mid-playback leaves Stop reachable:
   *  that deck is running, and taking Stop from it would strand it with no way to silence the
   *  cartridge. */
  protected readonly canStop = computed(
    () => this.currentTune() !== null && !(this.analyzing() && this.playerState() === 'stopped')
  );

  protected readonly canStepSubtune = computed(
    () => this.currentTune() !== null && this.subtuneCount() > 1
  );

  protected selectTune(source: TuneSource): void {
    this.tuneLoader.selectTune(source);
  }

  protected onFilePicked(event: Event): void {
    void this.tuneLoader.onFilePicked(event);
  }

  protected onPlay(): void {
    void this.player.play();
  }

  protected onPause(): void {
    this.player.pause();
  }

  protected onStop(): void {
    this.player.stop();
  }

  /** Core holds the preference as a value and persists nothing, so this deck's own key is written
   *  here, beside the call that makes the change take effect. */
  protected onRepeatToggle(event: Event): void {
    const enabled = (event.target as HTMLInputElement).checked;
    this.player.setRepeatTrack(enabled);
    saveRepeatTrackPreference(this.context.id(), enabled);
  }

  protected onPreviousSubtune(): void {
    this.player.previousSubtune();
  }

  protected onNextSubtune(): void {
    this.player.nextSubtune();
  }

  // Non-null only mid-drag: while dragging, the pointer's own value pins the thumb so the polled
  // position updates can't fight it and snap the thumb out from under the operator. Cleared back to
  // null on release, at which point the live position takes back over.
  private readonly scrubDragValue = signal<number | null>(null);

  /** The playhead as a percentage of what the player measures it against. Clamped to 0–100 because a
   *  tune played past its basis — a loop with looping disarmed, or the fixed ceiling standing in when
   *  no length was found — must still pin the thumb rather than overflow it. */
  private readonly positionPercent = computed<number>(() => {
    const basis = this.snapshot().basis.positionBasisFrames;
    return basis === 0 ? 0 : clamp((this.view.position() / basis) * 100, 0, 100);
  });

  protected readonly scrubDisplayPercent = computed<number>(
    () => this.scrubDragValue() ?? this.positionPercent()
  );

  /** What the position bar draws, over the index record and the pending signal — the one place that
   *  decides loop vs. ended vs. unknown vs. analyzing, so the regions, the tick and the disabled state
   *  can never disagree about it. `timelineBasisFor` gates whether the record answered anything at
   *  all; `positionBasisFor` supplies the ended case's music length, exactly as it does for both
   *  analysis panels' Length rows. */
  protected readonly barState = computed<BarState>(() => {
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

  /** The intro region's share of the bar, and the tick's left offset — 0 for a loop that repeats from
   *  the top. Zero outside the 'loop' state, where the template never reads it. */
  protected readonly introRegionPercent = computed<number>(() => {
    const state = this.barState();
    return state.kind === 'loop' ? state.introPercent : 0;
  });

  /** The music region's share of the bar: the loop case's remainder after the intro, or the ended
   *  case's own share. Zero outside those two states. */
  protected readonly musicRegionPercent = computed<number>(() => {
    const state = this.barState();
    if (state.kind === 'loop') return 100 - state.introPercent;
    if (state.kind === 'ended') return state.musicPercent;
    return 0;
  });

  /** The dead-tail region's share for an ended tune — the remainder after the music. Zero outside
   *  'ended', where the template never reads it. */
  protected readonly deadRegionPercent = computed<number>(() => {
    const state = this.barState();
    return state.kind === 'ended' ? 100 - state.musicPercent : 0;
  });

  protected onScrubInput(event: Event): void {
    this.scrubDragValue.set(Number((event.target as HTMLInputElement).value));
  }

  // (change) fires on release, not on every drag tick — the seam that makes this "drag anywhere,
  // release, and it jumps" rather than a continuous scrub. The pin stays set — holding the thumb at
  // the clicked spot — until the async seek actually lands; releasing it early snapped the
  // thumb back to the stale position and then forward again once the worker's replay landed. Guarded
  // on the pin still being this call's own value so a superseded scrub settling late cannot clear a
  // newer one's pin out from under it.
  protected async onScrubChange(event: Event): Promise<void> {
    const value = Number((event.target as HTMLInputElement).value);
    this.scrubDragValue.set(value);
    await scrubToPercent(this.player, this.markers, value);
    if (this.scrubDragValue() === value) {
      this.scrubDragValue.set(null);
    }
  }
}
