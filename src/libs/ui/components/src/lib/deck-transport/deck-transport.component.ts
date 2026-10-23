import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { PositionStripComponent } from '../position-strip/position-strip.component';
import type { ScrubBarState } from '../scrub-position-bar/scrub-position-bar.component';
import { SynthKeyComponent } from '../synth-key/synth-key.component';
import { SynthPanelComponent } from '../synth-panel/synth-panel.component';

/** What the deck is doing, as the display's state light and the Play/Pause key's light read it. */
export type DeckTransportState = 'playing' | 'paused' | 'stopped' | 'analyzing' | 'error' | 'empty';

/** Everything the transport draws except the values that move per animation frame — see
 *  `DeckTransportComponent.positionPercent` for why those stay out of here. */
export interface DeckTransportModel {
  /** The section's own aria-label, e.g. 'Transport deck A'. */
  readonly accessibleName: string;
  readonly state: DeckTransportState;
  /** The state word on the display, caller-composed: 'Play' | 'Pause' | 'Stop' | 'Analyzing…';
   *  'Error' for `error`, 'Stop' for `empty`. */
  readonly stateLabel: string;
  /** The loaded tune's title. `null`: nothing is loaded and `emptyText` shows instead. */
  readonly title: string | null;
  readonly author: string | null;
  /** Shown in place of the title when nothing is loaded, e.g. 'No tune — drop a SID here'. */
  readonly emptyText: string;
  /** The tune's length, e.g. '03:12', or '--:--' when it has none. */
  readonly totalText: string;
  /** What the position strip draws: how the segments are coloured and whether a loop mark appears. */
  readonly bar: ScrubBarState;
  /** The position strip's accessible name, e.g. 'Position deck A'. */
  readonly scrubAccessibleName: string;
  /** The merged Play/Pause key: which label it shows, and whether it is reachable. */
  readonly playPause: { readonly showing: 'play' | 'pause'; readonly disabled: boolean };
  /** Enables the Stop key. */
  readonly canStop: boolean;
  /** The Repeat key's latched state. */
  readonly repeatTrack: boolean;
  /** The subtune stepper's readout, disabled state and both accessible names. */
  readonly subtune: {
    /** The readout between the two keys, e.g. '1/3'. */
    readonly text: string;
    /** Disables both stepper keys together. */
    readonly disabled: boolean;
    /** e.g. 'Previous subtune deck A'. */
    readonly previousAccessibleName: string;
    /** e.g. 'Next subtune deck A'. */
    readonly nextAccessibleName: string;
  };
  /** Accessible names for the four keys not composed from anything else. `play` and `pause` are
   *  both carried — the Play/Pause key's name is whichever matches `playPause.showing`. */
  readonly actionAccessibleNames: {
    readonly play: string;
    readonly pause: string;
    readonly stop: string;
    readonly repeat: string;
  };
  /** Each rendered as a `role="alert"` line in the display's place; a failed deck's reason
   *  arrives here. Empty renders nothing. */
  readonly errors: readonly string[];
}

/**
 * One deck's transport on its own faceplate: a display showing what is loaded and where it is, the
 * segmented position strip (still a working scrubber), and the Play/Pause, Stop, Repeat and subtune
 * keys. Purely presentational — it holds no state and leaves every gate, label and accessible name
 * to the caller that builds the model.
 *
 * It lays itself out by its own width, not the viewport's: one labelled row from about 420px, one
 * row with icon-only keys (Play keeps its label) from about 320px, and below that Play full width,
 * then Stop beside Repeat, then the stepper, with the frame number hidden. It shrinks or clips
 * rather than overflowing at any width.
 *
 * @example
 * ```html
 * <lib-deck-transport
 *   [model]="transportModel()"
 *   [positionPercent]="scrubDisplayPercent()"
 *   [elapsedText]="elapsedText()"
 *   [frameLabel]="frameLabel()"
 *   (playPauseClick)="onPlayPause()"
 *   (scrubCommit)="onScrubCommit($event)"
 * />
 * ```
 */
@Component({
  selector: 'lib-deck-transport',
  templateUrl: './deck-transport.component.html',
  styleUrl: './deck-transport.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SynthPanelComponent, SynthKeyComponent, PositionStripComponent],
})
export class DeckTransportComponent {
  /** Everything the transport draws that does not move per animation frame. */
  readonly model = input.required<DeckTransportModel>();
  /** 0–100. Deliberately not a field of `model`: the playhead is polled per animation frame, and a
   *  single monolithic model would push a fresh object identity into every `OnPush` child sixty
   *  times a second. This, `elapsedText` and `frameLabel` are the only per-frame values the
   *  transport has. */
  readonly positionPercent = input.required<number>();
  /** The elapsed time on the display, e.g. '01:23.4' — per-frame, like `positionPercent`. */
  readonly elapsedText = input.required<string>();
  /** The frame readout, e.g. 'frame 1234' — per-frame, and caller-composed. */
  readonly frameLabel = input.required<string>();
  /** The merged Play/Pause key was pressed — whichever it was showing at the time. Named for the
   *  click rather than the verb: `play` and `pause` are standard DOM media events, which an output
   *  may not shadow. */
  readonly playPauseClick = output<void>();
  /** The Stop key was pressed. */
  readonly stopClick = output<void>();
  /** The Repeat key was pressed, carrying the latch it should now have. */
  readonly repeatTrackChange = output<boolean>();
  /** The stepper's previous key was pressed. */
  readonly previousSubtune = output<void>();
  /** The stepper's next key was pressed. */
  readonly nextSubtune = output<void>();
  /** Forwards the strip's every drag tick — a live preview, not a seek. */
  readonly scrubInput = output<number>();
  /** Forwards the strip's release value — the one that should seek. */
  readonly scrubCommit = output<number>();

  /** The error display replaces the tune display when the deck has failed or carries a reason. */
  protected readonly showsError = computed<boolean>(() => {
    const { state, errors } = this.model();
    return state === 'error' || errors.length > 0;
  });

  /** The strip's aria-valuetext: the position as time, e.g. '01:23.4 of 03:12'. */
  protected readonly valueText = computed<string>(
    () => `${this.elapsedText()} of ${this.model().totalText}`
  );

  /** The light along the Play/Pause key's top follows the deck's state. */
  protected readonly playLight = computed<'playing' | 'paused' | 'off'>(() => {
    const { state } = this.model();
    return state === 'playing' || state === 'paused' ? state : 'off';
  });
}
