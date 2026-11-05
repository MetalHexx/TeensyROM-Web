import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { DropdownMenuItemComponent } from '../dropdown-menu/dropdown-menu-item.component';
import { DropdownMenuComponent } from '../dropdown-menu/dropdown-menu.component';
import { SynthKeyComponent } from '../synth-key/synth-key.component';
import { WheelClicks } from '../shared/wheel-clicks';

/** One size the size picker offers. */
export interface LoopLengthOptionModel {
  readonly beats: number;
  readonly label: string;
  readonly selected: boolean;
}

/** The length row: halve and double keys, and optionally whole-beat step keys, around a readout
 *  that opens a picker of lengths. */
export interface LoopLengthModel {
  /** '16 BEATS' | '7.8s' | 'NO END'. */
  readonly text: string;
  /** Empty when there is no grid: the readout is then plain text unless `noEnd` makes it a picker. */
  readonly options: readonly LoopLengthOptionModel[];
  readonly halveAccessibleName: string;
  readonly doubleAccessibleName: string;
  readonly pickAccessibleName: string;
  /** The whole-beat keys either side of the readout. Absent: the control draws none. */
  readonly steps?: {
    readonly disabled: boolean;
    readonly downAccessibleName: string;
    readonly upAccessibleName: string;
  };
  /** The picker's first item, which takes the end away. Absent: no such item. Its presence alone
   *  makes the readout a picker, even with no sizes (no grid). */
  readonly noEnd?: { readonly label: string; readonly selected: boolean };
}

/**
 * A length control: a LENGTH tag, a 1/2 key, optionally − and + keys, a readout that opens a picker of
 * lengths, and a 2× key. It is the one length control of the mixer's loop rows (the selected loop's and
 * the live loop's). Purely presentational: the caller supplies every label, the options and which end
 * of the ladder is reached. The − and + keys draw only with `model.steps`, and the picker offers No
 * End first only with `model.noEnd`. With neither options nor No End (no grid) the readout is plain
 * text.
 *
 * The readout takes the mouse wheel only while `wheel()` is true, reported as whole clicks upward
 * positive; only then does it stop the page from scrolling. The readout and the keys carry the
 * `data-control` ids the caller gives them, so the mapping overlay can resolve each.
 *
 * @example
 * ```html
 * <lib-loop-size-control
 *   [model]="size()"
 *   [halveDisabled]="!canHalve()"
 *   [doubleDisabled]="!canDouble()"
 *   [wheel]="true"
 *   readoutControl="live-loop-size"
 *   (halve)="onHalve()"
 *   (double)="onDouble()"
 *   (pickLength)="onPick($event)"
 *   (wheelTurn)="onWheel($event)"
 * />
 * ```
 */
@Component({
  selector: 'lib-loop-size-control',
  imports: [DropdownMenuComponent, DropdownMenuItemComponent, SynthKeyComponent],
  templateUrl: './loop-size-control.component.html',
  styleUrl: './loop-size-control.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.data-disabled]': 'disabled() ? "" : null',
    '[attr.data-steps]': 'model().steps ? "" : null',
  },
})
export class LoopSizeControlComponent {
  /** The readout, the options and the accessible names. */
  readonly model = input.required<LoopLengthModel>();
  /** Disables both keys and the picker, and dims the readout. Defaults to false. */
  readonly disabled = input<boolean>(false);
  /** Disables the 1/2 key alone, e.g. at the ladder's shortest rung. Defaults to false. */
  readonly halveDisabled = input<boolean>(false);
  /** Disables the 2× key alone, e.g. at the ladder's longest rung. Defaults to false. */
  readonly doubleDisabled = input<boolean>(false);
  /** Whether the readout takes the mouse wheel. Defaults to false. */
  readonly wheel = input<boolean>(false);
  /** The `data-control` id on the readout, e.g. 'loop-length'. */
  readonly readoutControl = input<string | null>(null);
  /** The `data-control` id on the 1/2 key. */
  readonly halveControl = input<string | null>(null);
  /** The `data-control` id on the 2× key. */
  readonly doubleControl = input<string | null>(null);
  /** The `data-control` id on the − key. */
  readonly stepDownControl = input<string | null>(null);
  /** The `data-control` id on the + key. */
  readonly stepUpControl = input<string | null>(null);
  /** Emits when the 1/2 key is pressed. */
  readonly halve = output<void>();
  /** Emits when the 2× key is pressed. */
  readonly double = output<void>();
  /** Emits -1 when the − key is pressed and 1 for the + key. */
  readonly stepLength = output<-1 | 1>();
  /** Emits when the picker's No End item is picked. */
  readonly pickNoEnd = output<void>();
  /** Emits the picked size in beats. */
  readonly pickLength = output<number>();
  /** Emits whole wheel clicks over the readout, upward positive, with the event's `timeStamp`. Only
   *  while `wheel()` is true. */
  readonly wheelTurn = output<{ clicks: number; timeStampMs: number }>();

  private readonly wheelClicks = new WheelClicks();

  protected readonly halveOff = computed(() => this.disabled() || this.halveDisabled());
  protected readonly doubleOff = computed(() => this.disabled() || this.doubleDisabled());
  protected readonly stepOff = computed(
    () => this.disabled() || (this.model().steps?.disabled ?? true)
  );
  protected readonly picks = computed(() => {
    const { options, noEnd } = this.model();
    return options.length > 0 || noEnd !== undefined;
  });

  /** Reports the wheel as whole clicks and keeps the page from scrolling; does nothing unless
   *  `wheel()` is true, so an unbound readout never swallows page scroll. */
  protected onWheel(event: WheelEvent): void {
    if (!this.wheel()) {
      this.wheelClicks.reset();
      return;
    }
    event.preventDefault();
    const clicks = this.wheelClicks.read(event);
    if (clicks !== 0) {
      this.wheelTurn.emit({ clicks, timeStampMs: event.timeStamp });
    }
  }
}
