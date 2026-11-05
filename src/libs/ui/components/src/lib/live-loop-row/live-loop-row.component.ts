import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { HoldPressDirective } from '../hold-press/hold-press.directive';
import {
  LoopSizeControlComponent,
  type LoopLengthModel,
} from '../loop-size-control/loop-size-control.component';
import { SynthKeyComponent } from '../synth-key/synth-key.component';

/** A press on the Live loop key held at least this long ends the loop it started on release. */
export const LIVE_LOOP_HOLD_MS = 300;

const LAMP_ON = 'radio_button_checked';
const LAMP_OFF = 'radio_button_unchecked';

/** The live loop row's caller-composed state. */
export interface LiveLoopRowModel {
  readonly running: boolean;
  /** No grid / no ladder: every control is inert. */
  readonly disabled: boolean;
  /** e.g. 'Live loop deck A'. */
  readonly liveLoopAccessibleName: string;
  /** The size readout, its picker and the names of 1/2, 2× and the picker. */
  readonly size: LoopLengthModel;
  /** False at the ladder's shortest rung. */
  readonly canHalve: boolean;
  /** False at the ladder's longest rung. */
  readonly canDouble: boolean;
  readonly slip: boolean;
  /** e.g. 'Slip deck A'. */
  readonly slipAccessibleName: string;
}

/**
 * The live loop row at the top of a deck's loops/cues plate, in a bordered tray that lights green
 * (`data-running` on the host) while the loop runs: the Live loop key, the LENGTH control
 * (1/2, a length picker, 2×) and the latching SLIP key. Purely presentational: the caller owns the loop,
 * the size and the slip, and supplies every label.
 *
 * The Live loop key acts on press, not release. A quick click leaves the loop running; a press held
 * for `LIVE_LOOP_HOLD_MS` or longer ends the loop it started when it is released. Enter and Space
 * behave the same. Pressing while the loop already runs only toggles it off. The size readout takes
 * the mouse wheel, and 1/2 and 2× disable at the ends of the ladder. The keys carry the `data-control`
 * ids `live-loop`, `live-loop-size`, `live-loop-halve`, `live-loop-double` and `slip`.
 *
 * @example
 * ```html
 * <lib-live-loop-row
 *   [model]="row()"
 *   (toggleLiveLoop)="onToggle()"
 *   (endLiveLoop)="onEnd()"
 *   (halve)="onHalve()"
 *   (double)="onDouble()"
 *   (pickSize)="onPick($event)"
 *   (sizeWheel)="onWheel($event)"
 *   (toggleSlip)="onSlip()"
 * />
 * ```
 */
@Component({
  selector: 'lib-live-loop-row',
  imports: [HoldPressDirective, LoopSizeControlComponent, SynthKeyComponent],
  templateUrl: './live-loop-row.component.html',
  styleUrl: './live-loop-row.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.data-running]': 'model().running ? "" : null',
  },
})
export class LiveLoopRowComponent {
  /** The row's state. */
  readonly model = input.required<LiveLoopRowModel>();
  /** Emits when the Live loop key goes down (or Enter/Space): push the loop, or end the running one. */
  readonly toggleLiveLoop = output<void>();
  /** Emits when a press that started the loop is released after `LIVE_LOOP_HOLD_MS` or more. */
  readonly endLiveLoop = output<void>();
  /** Emits when the 1/2 key is pressed. */
  readonly halve = output<void>();
  /** Emits when the 2× key is pressed. */
  readonly double = output<void>();
  /** Emits the size picked in the picker, in beats. */
  readonly pickSize = output<number>();
  /** Emits whole wheel clicks over the size readout, upward positive, with the event's `timeStamp`. */
  readonly sizeWheel = output<{ clicks: number; timeStampMs: number }>();
  /** Emits when the SLIP key is pressed. */
  readonly toggleSlip = output<void>();

  /** When the press that started the loop went down; null when the current press did not start one. */
  private startedAtMs: number | null = null;

  protected readonly stateLight = computed(() => (this.model().running ? 'playing' : 'off'));
  protected readonly slipLamp = computed(() => (this.model().slip ? LAMP_ON : LAMP_OFF));

  /** The key's down and up edges from the hold directive. */
  protected onHold(down: boolean): void {
    if (down) {
      this.startedAtMs = this.model().running ? null : performance.now();
      this.toggleLiveLoop.emit();
      return;
    }
    const startedAtMs = this.startedAtMs;
    this.startedAtMs = null;
    if (startedAtMs !== null && performance.now() - startedAtMs >= LIVE_LOOP_HOLD_MS) {
      this.endLiveLoop.emit();
    }
  }
}
