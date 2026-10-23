import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { HoldPressDirective } from '../hold-press/hold-press.directive';

/** One voice's caller-composed state within a voice panel. */
export interface VoiceRowModel {
  /** e.g. 'V1' — this row's own label, rendered beside the checkbox. */
  readonly label: string;
  /** The latched mute — drives the checkbox and the hold button's verb. */
  readonly muted: boolean;
  /** 'Kill' | 'Punch' — the hold button's own text. */
  readonly holdLabel: string;
  /** Unique per rendered row; the caller composes it. */
  readonly checkboxId: string;
  /** e.g. 'Mute voice 1 deck A' — the checkbox's own accessible name. */
  readonly muteAccessibleName: string;
  /** e.g. 'Kill voice 1 deck A' / 'Punch in voice 1 deck A' — the hold button's own accessible name. */
  readonly holdAccessibleName: string;
}

/**
 * One voice's mute/kill controls: a checkbox for the latched mute, checkbox and label on one line,
 * and beneath them a momentary hold button whose press and release are both meaningful — held down
 * it inverts the latched mute for as long as it's held, by pointer or by Enter/Space, which is the
 * only way a keyboard user can express "while held".
 *
 * Purely presentational: it holds no state of its own and never resolves latched-XOR-held itself —
 * `model().holdLabel` already carries whatever the caller decided that means. While `disabled()`,
 * both controls are inert and dimmed; a row disabled or removed mid-hold releases it so no voice is
 * left held.
 *
 * @example
 * ```html
 * <lib-voice-row
 *   [model]="rowModel()"
 *   (mutedChange)="onMutedChange($event)"
 *   (heldChange)="onHeldChange($event)"
 * />
 * ```
 */
@Component({
  selector: 'lib-voice-row',
  imports: [HoldPressDirective],
  templateUrl: './voice-row.component.html',
  styleUrl: './voice-row.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.data-disabled]': "disabled() ? '' : null",
  },
})
export class VoiceRowComponent {
  /** The voice row's display model and state. */
  readonly model = input.required<VoiceRowModel>();
  /** Disables the mute checkbox and the hold button and dims the row. Defaults to `false`, so every
   *  existing use is unchanged. Becoming disabled while a hold is in progress emits
   *  `heldChange(false)` once. */
  readonly disabled = input<boolean>(false);
  /** Emits when the mute checkbox is toggled. */
  readonly mutedChange = output<boolean>();
  /** Emits on hold button press (`true`) and release/cancel (`false`). Momentary; both press and release are meaningful. */
  readonly heldChange = output<boolean>();

  /** Forwards the mute checkbox's toggled state. */
  protected onMutedChange(event: Event): void {
    this.mutedChange.emit((event.target as HTMLInputElement).checked);
  }
}
