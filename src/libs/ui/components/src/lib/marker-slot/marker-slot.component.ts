import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** One nudge control's caller-composed state: a frame label, an offset readout, the live nudge
 *  value, its range, and the reachable moments to render as ticks. */
export interface MarkerSlotModel {
  /** e.g. 'frame 460' — caller-composed, already nudged. */
  readonly frameLabel: string;
  /** e.g. '+12 fr' / '−7 fr' (U+2212 for negatives). */
  readonly offsetLabel: string;
  /** Frames; the live drag value while dragging, the committed one otherwise. */
  readonly nudgeValue: number;
  /** The slider spans [-nudgeRange, +nudgeRange], step 1. */
  readonly nudgeRange: number;
  /** Frame offsets of reachable detected moments; each renders one tick. */
  readonly tickOffsets: readonly number[];
  readonly previousDisabled: boolean;
  readonly nextDisabled: boolean;
  /** e.g. 'Nudge marker 1 start deck A'. */
  readonly nudgeAccessibleName: string;
  /** e.g. 'Snap marker 1 start to previous moment deck A'. */
  readonly previousAccessibleName: string;
  readonly nextAccessibleName: string;
}

/**
 * One marker boundary's frame label, two snap buttons, a bipolar nudge slider with tick marks for
 * reachable moments, and an offset readout. Purely presentational: it holds no drag state of its
 * own, so `nudgeValue` is whatever the caller decides to show — the live drag value or the
 * committed one, same as `ScrubPositionBarComponent`'s `positionPercent`.
 *
 * `model() === null` renders the empty placeholder in its place: the tag, a dimmed 'empty' caption,
 * two disabled `aria-hidden` snap buttons, an inert nudge track and an em-dash offset — same box,
 * same height, so a row does not shift when an end is added to or reverted from a marker.
 *
 * @example
 * ```html
 * <lib-marker-slot
 *   [model]="startModel()"
 *   tag="Start"
 *   (nudgeInput)="onStartNudgeInput($event)"
 *   (nudgeCommit)="onStartNudgeCommit($event)"
 *   (snapPrevious)="onStartSnapPrevious()"
 *   (snapNext)="onStartSnapNext()"
 * />
 * ```
 */
@Component({
  selector: 'lib-marker-slot',
  templateUrl: './marker-slot.component.html',
  styleUrl: './marker-slot.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MarkerSlotComponent {
  /** `null` renders the empty placeholder. */
  readonly model = input.required<MarkerSlotModel | null>();
  /** 'Start' | 'End'. Outside the model on purpose: `model` is nullable and the tag still renders
   *  in the empty state, so it cannot live inside the thing that goes away. */
  readonly tag = input.required<string>();
  /** Fires on every drag tick — readout only. */
  readonly nudgeInput = output<number>();
  /** Fires on release only — the caller seeks and auditions. */
  readonly nudgeCommit = output<number>();
  readonly snapPrevious = output<void>();
  readonly snapNext = output<void>();

  /** Offset 0 sits at 50%, ±`nudgeRange` at the edges; a zero range collapses every tick to centre
   *  rather than dividing by zero. Only called while `model()` is non-null — the empty variant
   *  renders no ticks. */
  protected tickLeftPercent(offset: number): number {
    const range = this.model()?.nudgeRange ?? 0;
    return range === 0 ? 50 : ((offset + range) / (2 * range)) * 100;
  }

  /** Forwards every drag tick as a live readout — never a seek. */
  protected onNudgeInput(event: Event): void {
    this.nudgeInput.emit(Number((event.target as HTMLInputElement).value));
  }

  /** Forwards the release value only — the one the caller should seek to. */
  protected onNudgeCommit(event: Event): void {
    this.nudgeCommit.emit(Number((event.target as HTMLInputElement).value));
  }
}
