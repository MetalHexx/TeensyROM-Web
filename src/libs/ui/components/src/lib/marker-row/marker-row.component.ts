import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MarkerSlotComponent } from '../marker-slot/marker-slot.component';
import type { MarkerSlotModel } from '../marker-slot/marker-slot.component';

/** One marker row's caller-composed state: its header, both boundary slots, and every accessible
 *  name the row's own controls need. */
export interface MarkerRowModel {
  /** '1' — the caller decides it is 1-based. */
  readonly number: string;
  /** Rendered as `data-marker-state`. */
  readonly state: 'active' | 'queued' | 'idle';
  readonly triggerDisabled: boolean;
  readonly deleteDisabled: boolean;
  /** 'Loop Length: 320 fr'; `null` hides it. */
  readonly loopLengthLabel: string | null;
  readonly start: MarkerSlotModel;
  /** `null` renders the slot's empty state. */
  readonly end: MarkerSlotModel | null;
  readonly triggerAccessibleName: string;
  readonly setEndAccessibleName: string;
  readonly revertAccessibleName: string;
  readonly deleteAccessibleName: string;
}

/**
 * One marker's whole row: the number/trigger/loop-length header with its Set End / Revert / Delete
 * actions, the Start and End `MarkerSlotComponent`s, and the progress strip that fills while this
 * row is looping. Purely presentational — every field comes from `model()`, and it composes
 * `MarkerSlotComponent` rather than duplicating its markup.
 *
 * When a marker has no end, a disabled, `aria-hidden`, `tabindex="-1"` Revert button renders in
 * place of the real one rather than being omitted, so the row's action cluster does not reflow
 * between a cue and a loop.
 *
 * @example
 * ```html
 * <lib-marker-row
 *   [model]="markerRowModel()"
 *   [progressPercent]="markerProgressPercent()"
 *   (trigger)="onTrigger()"
 *   (setEnd)="onSetEnd()"
 *   (clearEnd)="onClearEnd()"
 *   (delete)="onDelete()"
 *   (startNudgeInput)="onStartNudgeInput($event)"
 *   (startNudgeCommit)="onStartNudgeCommit($event)"
 *   (startSnapPrevious)="onStartSnapPrevious()"
 *   (startSnapNext)="onStartSnapNext()"
 *   (endNudgeInput)="onEndNudgeInput($event)"
 *   (endNudgeCommit)="onEndNudgeCommit($event)"
 *   (endSnapPrevious)="onEndSnapPrevious()"
 *   (endSnapNext)="onEndSnapNext()"
 * />
 * ```
 */
@Component({
  selector: 'lib-marker-row',
  templateUrl: './marker-row.component.html',
  styleUrl: './marker-row.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MarkerSlotComponent],
  host: {
    '[attr.data-marker-state]': 'model().state',
  },
})
export class MarkerRowComponent {
  /** The marker row's display model and state. */
  readonly model = input.required<MarkerRowModel>();
  /** 0–100; non-zero only while this row is looping. Its own input, not a model field: it is read
   *  off the polled playhead and changes every animation frame, and folding it into the row model
   *  would rebuild both `MarkerSlotModel`s — and re-run the caller's reachable-moment lookups — at
   *  60 Hz for every row on screen. */
  readonly progressPercent = input<number>(0);
  /** Emits when the trigger button is pressed. */
  readonly trigger = output<void>();
  /** Emits when the Set End button is pressed. */
  readonly setEnd = output<void>();
  /** Emits when the Revert/Clear End button is pressed. */
  readonly clearEnd = output<void>();
  /** Emits when the Delete button is pressed. */
  readonly delete = output<void>();
  /** Emits the new nudge value while the start marker's nudge slider is being dragged. */
  readonly startNudgeInput = output<number>();
  /** Emits the final nudge value when the start marker's nudge slider drag completes. */
  readonly startNudgeCommit = output<number>();
  /** Emits when the start marker's snap to previous moment button is pressed. */
  readonly startSnapPrevious = output<void>();
  /** Emits when the start marker's snap to next moment button is pressed. */
  readonly startSnapNext = output<void>();
  /** Emits the new nudge value while the end marker's nudge slider is being dragged. */
  readonly endNudgeInput = output<number>();
  /** Emits the final nudge value when the end marker's nudge slider drag completes. */
  readonly endNudgeCommit = output<number>();
  /** Emits when the end marker's snap to previous moment button is pressed. */
  readonly endSnapPrevious = output<void>();
  /** Emits when the end marker's snap to next moment button is pressed. */
  readonly endSnapNext = output<void>();
}
