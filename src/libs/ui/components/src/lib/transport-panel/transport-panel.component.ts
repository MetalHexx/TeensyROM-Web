import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ScrubPositionBarComponent } from '../scrub-position-bar/scrub-position-bar.component';
import type { ScrubBarState } from '../scrub-position-bar/scrub-position-bar.component';
import { StatusLedComponent } from '../status-led/status-led.component';
import type { StatusLedState } from '../status-led/status-led.component';
import { StepperComponent } from '../stepper/stepper.component';

/** One tune the panel offers as a button. `id` is opaque here — round-tripped verbatim into
 *  `tuneSelect` for the caller to resolve back to whatever it actually loads. */
export interface TransportTuneSourceModel {
  /** The caller's own identifier, echoed back on `tuneSelect`. */
  readonly id: string;
  /** The button's text, e.g. 'Amiga Tune'. */
  readonly label: string;
  /** This button's own accessible name, e.g. 'Amiga Tune deck A'. */
  readonly accessibleName: string;
}

/** Everything the transport draws except the two values that move per animation frame — see
 *  `TransportPanelComponent.positionPercent` for why those stay out of here. */
export interface TransportPanelModel {
  /** The panel section's own aria-label, e.g. 'Transport deck A'. */
  readonly accessibleName: string;
  /** What the position bar draws: which regions render, and whether a loop tick appears. */
  readonly bar: ScrubBarState;
  /** The position bar's accessible name, e.g. 'Position deck A'. */
  readonly scrubAccessibleName: string;
  /** The state readout: the LED's colour and the text beside it, both caller-composed. */
  readonly transport: { readonly state: StatusLedState; readonly label: string };
  /** Enables the Play button. */
  readonly canPlay: boolean;
  /** Enables the Pause button. */
  readonly canPause: boolean;
  /** Enables the Stop button. */
  readonly canStop: boolean;
  /** The repeat toggle's checked state. */
  readonly repeatTrack: boolean;
  /** Rendered in this array's order, one button each. Optional — absent or empty hides the tune
   *  line entirely unless `showFilePicker` is set. */
  readonly tuneSources?: readonly TransportTuneSourceModel[];
  /** The subtune stepper's caption, disabled state and both accessible names. */
  readonly subtune: {
    /** The caption between the two buttons, e.g. 'Subtune 1 of 3'. */
    readonly text: string;
    /** Disables both stepper buttons together — there is no case for stepping one way only. */
    readonly disabled: boolean;
    /** The previous button's accessible name, e.g. 'Previous subtune deck A'. */
    readonly previousAccessibleName: string;
    /** The next button's accessible name, e.g. 'Next subtune deck A'. */
    readonly nextAccessibleName: string;
  };
  /** Accessible names for the five controls that are not composed from anything else on the panel. */
  readonly actionAccessibleNames: {
    /** e.g. 'Play deck A'. */
    readonly play: string;
    /** e.g. 'Pause deck A'. */
    readonly pause: string;
    /** e.g. 'Stop deck A'. */
    readonly stop: string;
    /** e.g. 'Repeat track deck A'. */
    readonly repeat: string;
    /** e.g. 'Choose file deck A'. Required only when `showFilePicker` is set. */
    readonly chooseFile?: string;
  };
  /** Rendered in order as `role="alert"` paragraphs. Empty renders nothing. */
  readonly errors: readonly string[];
}

/**
 * One deck's transport, in two lines, three with POC affordances: position bar and frame readout;
 * transport buttons, repeat toggle, subtune stepper and state LED; and, only when `showFilePicker`
 * is set or the model carries `tuneSources`, a third line of tune-source buttons and the file
 * picker. Purely presentational — it composes `ScrubPositionBarComponent`, `StatusLedComponent` and
 * `StepperComponent`, holds no state of its own beyond resetting its file input, and leaves every
 * gate, label and accessible name to the caller that builds the model.
 *
 * @example
 * ```html
 * <lib-transport-panel
 *   [model]="transportModel()"
 *   [positionPercent]="transportPositionPercent()"
 *   [frameLabel]="transportFrameLabel()"
 *   [showFilePicker]="true"
 *   (playClick)="onPlay()"
 *   (repeatTrackChange)="onRepeatTrackChange($event)"
 *   (fileSelect)="onFileSelect($event)"
 *   (scrubCommit)="onScrubCommit($event)"
 * />
 * ```
 */
@Component({
  selector: 'lib-transport-panel',
  templateUrl: './transport-panel.component.html',
  styleUrl: './transport-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ScrubPositionBarComponent, StatusLedComponent, StepperComponent],
})
export class TransportPanelComponent {
  /** Everything the panel draws that does not move per animation frame. */
  readonly model = input.required<TransportPanelModel>();
  /** 0–100. Deliberately not a field of `model`: the playhead is polled per animation frame, and a
   *  single monolithic model would rebuild every `tuneSources` entry and every accessible-name
   *  string sixty times a second and push a fresh object identity into each `OnPush` child. This and
   *  `frameLabel` are the only per-frame values the transport has. */
  readonly positionPercent = input.required<number>();
  /** The frame readout beside the position bar, e.g. 'frame 1234' — per-frame, like
   *  `positionPercent`, and caller-composed. */
  readonly frameLabel = input.required<string>();
  /** Renders the tune-source line's file picker, and forces that whole line to render even when
   *  `model().tuneSources` is empty. The POC is the one caller that sets this; a model-driven
   *  caller with its own `tuneSources` needs it only if it also wants a file picker. */
  readonly showFilePicker = input<boolean>(false);
  /** The Play button was pressed. Named for the click rather than the transport verb: `play` and
   *  `pause` are standard DOM media events, which an output may not shadow. */
  readonly playClick = output<void>();
  /** The Pause button was pressed. */
  readonly pauseClick = output<void>();
  /** The Stop button was pressed. */
  readonly stopClick = output<void>();
  /** The repeat toggle was flipped, carrying its new checked state. */
  readonly repeatTrackChange = output<boolean>();
  /** A tune source button was pressed, carrying that source's own `id`. */
  readonly tuneSelect = output<string>();
  /** A file was picked, carrying the `File` itself — never the raw DOM event. */
  readonly fileSelect = output<File>();
  /** The stepper's previous button was pressed. */
  readonly previousSubtune = output<void>();
  /** The stepper's next button was pressed. */
  readonly nextSubtune = output<void>();
  /** Forwards the position bar's every drag tick — a live readout, not a seek. */
  readonly scrubInput = output<number>();
  /** Forwards the position bar's release value — the one that should seek. */
  readonly scrubCommit = output<number>();

  /** Emits the toggle's new checked state rather than the event that carried it. */
  protected onRepeatToggle(event: Event): void {
    this.repeatTrackChange.emit((event.target as HTMLInputElement).checked);
  }

  /**
   * Unwraps the picked `File` and clears the input so the same file can be re-picked later in the
   * session — a change event only fires on a value that actually changed. Both belong here rather
   * than in the caller: an emitted DOM event would push the reset outward, to the one place it
   * would quietly rot. A change with no file (the operator cancelled the dialog) emits nothing.
   */
  protected onFilePicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';
    if (file) {
      this.fileSelect.emit(file);
    }
  }
}
