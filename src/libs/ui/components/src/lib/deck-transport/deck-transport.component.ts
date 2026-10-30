import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  input,
  output,
  viewChild,
} from '@angular/core';
import { DeckSetRowComponent, type DeckSetRowModel } from '../deck-set-row/deck-set-row.component';
import {
  PositionStripComponent,
  type PositionMark,
} from '../position-strip/position-strip.component';
import type { ScrubBarState } from '../scrub-position-bar/scrub-position-bar.component';
import type { LivePlayheadIndicator } from '../shared/live-indicator';
import { SynthKeyComponent } from '../synth-key/synth-key.component';
import { SynthPanelComponent } from '../synth-panel/synth-panel.component';

/** What the deck is doing, as the display's state light and the Play/Pause key's light read it. */
export type DeckTransportState = 'playing' | 'paused' | 'stopped' | 'analyzing' | 'error' | 'empty';

/** Everything the transport draws except the playhead readouts, which move per animation frame —
 *  see `DeckTransportComponent.setLivePosition` for why those stay out of here. */
export interface DeckTransportModel {
  /** The section's own aria-label, e.g. 'Transport deck A'. */
  readonly accessibleName: string;
  readonly state: DeckTransportState;
  /** The state word on the display, caller-composed: 'Play' | 'Pause' | 'Stop' | 'Analyzing…';
   *  'Error' for `error`, 'Stop' for `empty`. */
  readonly stateLabel: string;
  /** A finger is on the deck's record: the state word shows the caller's `stateLabel` ('Held') and
   *  the state light is the warning amber, steady. The Play key's light keeps the deck's own state. */
  readonly held: boolean;
  /** The loaded tune's title. `null`: nothing is loaded and `emptyText` shows instead. */
  readonly title: string | null;
  readonly author: string | null;
  /** Shown in place of the title when nothing is loaded, e.g. 'No tune — drop a SID here'. */
  readonly emptyText: string;
  /** The tune's length, e.g. '03:12', or '--:--' when it has none. */
  readonly totalText: string;
  /** What the position strip draws: how the bar is coloured and whether a loop mark appears. */
  readonly bar: ScrubBarState;
  /** Loop brackets and cue ticks the position strip draws above its bar. A list that changes
   *  rarely — not a per-frame value; the playhead stays `setLivePosition`'s. Empty reserves the
   *  strip's marks lane with nothing in it. */
  readonly marks: readonly PositionMark[];
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
  /** The row under the keys that walks the deck through the set. */
  readonly set: DeckSetRowModel;
}

/**
 * One deck's transport on its own faceplate: a display showing what is loaded and where it is, the
 * continuous position bar (still a working scrubber), and the Play/Pause, Stop, Repeat and subtune
 * keys, with the set row beneath them. Purely presentational — it holds no state and leaves every gate, label and accessible name
 * to the caller that builds the model.
 *
 * It lays itself out by its own width, not the viewport's. Play/Pause, Stop and Repeat are three
 * identical keys at the start of the row, the stepper at the end: labelled keys from about 436px,
 * icon-only keys from about 336px, and below that the same icon-only keys with the stepper on its
 * own row beneath them and the frame number hidden. The set row follows the same breakpoints, its
 * keys losing their labels with the others. It shrinks or clips rather than overflowing at
 * any width.
 *
 * The playhead readouts — the bar's position, the elapsed time, the frame and the strip's value
 * text — are not inputs: a painter sets them through `setLivePosition`, `setLiveElapsed` and
 * `setLiveFrame`, straight on the DOM, outside change detection.
 *
 * @example
 * ```html
 * <lib-deck-transport
 *   [model]="transportModel()"
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
  imports: [SynthPanelComponent, SynthKeyComponent, PositionStripComponent, DeckSetRowComponent],
})
export class DeckTransportComponent implements LivePlayheadIndicator {
  /** Everything the transport draws that does not move per animation frame. */
  readonly model = input.required<DeckTransportModel>();
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
  /** The set row's previous key was pressed. */
  readonly previousInSet = output<void>();
  /** The set row's next key was pressed. */
  readonly nextInSet = output<void>();
  /** Forwards the strip's every drag tick — a live preview, not a seek. */
  readonly scrubInput = output<number>();
  /** Forwards the strip's release value — the one that should seek. */
  readonly scrubCommit = output<number>();

  /** The error display replaces the tune display when the deck has failed or carries a reason. */
  protected readonly showsError = computed<boolean>(() => {
    const { state, errors } = this.model();
    return state === 'error' || errors.length > 0;
  });

  /** The light along the Play/Pause key's top follows the deck's state. */
  protected readonly playLight = computed<'playing' | 'paused' | 'off'>(() => {
    const { state } = this.model();
    return state === 'playing' || state === 'paused' ? state : 'off';
  });

  private readonly totalText = computed(() => this.model().totalText);
  private readonly strip = viewChild.required(PositionStripComponent);
  /** Inside the tune display, which the error display replaces: absent while that shows. */
  private readonly elapsed = viewChild<ElementRef<HTMLElement>>('elapsed');
  private readonly frame = viewChild<ElementRef<HTMLElement>>('frame');
  /** The readouts as last set; null until a painter sets them. */
  private liveElapsed: string | null = null;
  private liveFrame: string | null = null;

  /** The error display swaps the time line out and back, so whichever readouts render take the
   *  last live values; the strip's value text follows the total as well as the elapsed time. */
  constructor() {
    afterRenderEffect({
      write: () => {
        this.writeText(this.elapsed(), this.liveElapsed);
        this.writeText(this.frame(), this.liveFrame);
        this.writeValueText(this.totalText());
      },
    });
  }

  /** Sets the bar's position, 0–100. Deliberately not an input or a field of `model`: the
   *  playhead moves per animation frame, and a binding would put change detection on every one.
   *  This, `setLiveElapsed` and `setLiveFrame` write straight to the DOM. Valid once the view has
   *  rendered. */
  setLivePosition(percent: number): void {
    this.strip().setLivePosition(percent);
  }

  /** Sets the elapsed time on the display, e.g. '01:23.4', and the strip's value text with it —
   *  the position as time, e.g. '01:23.4 of 03:12'. Only a changed text is written. */
  setLiveElapsed(text: string): void {
    if (text === this.liveElapsed) {
      return;
    }
    this.liveElapsed = text;
    this.writeText(this.elapsed(), text);
    this.writeValueText(this.totalText());
  }

  /** Sets the frame readout, e.g. 'frame 1234'. Only a changed label is written. */
  setLiveFrame(label: string): void {
    if (label === this.liveFrame) {
      return;
    }
    this.liveFrame = label;
    this.writeText(this.frame(), label);
  }

  private writeText(element: ElementRef<HTMLElement> | undefined, text: string | null): void {
    if (element !== undefined && text !== null) {
      element.nativeElement.textContent = text;
    }
  }

  /** The strip says the position as time once the elapsed time is known. */
  private writeValueText(totalText: string): void {
    if (this.liveElapsed !== null) {
      this.strip().setLiveValueText(`${this.liveElapsed} of ${totalText}`);
    }
  }
}
