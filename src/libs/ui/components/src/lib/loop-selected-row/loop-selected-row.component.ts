import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { LoopBoundaryComponent, type LoopBoundaryModel } from '../loop-boundary/loop-boundary.component';
import type { LoopTileActivity } from '../loop-tile/loop-tile.component';
import { SynthKeyComponent } from '../synth-key/synth-key.component';

/** Which end of the selected loop a boundary output is about. */
export type LoopBoundaryName = 'start' | 'end';

/** The selected loop or cue's caller-composed state. */
export interface LoopSelectedRowModel {
  /** Nothing selected: blank display, every control disabled. */
  readonly empty: boolean;
  readonly name: string;
  readonly kindLabel: 'LOOP' | 'CUE' | '';
  /** e.g. '02:39.4–02:47.5', or '02:43.2' for a cue. */
  readonly spanText: string;
  readonly activity: LoopTileActivity;
  readonly ready: boolean;
  readonly triggerDisabled: boolean;
  readonly setEndDisabled: boolean;
  /** True on a cue. */
  readonly clearEndDisabled: boolean;
  readonly deleteDisabled: boolean;
  readonly start: LoopBoundaryModel;
  /** `empty` on a cue. */
  readonly end: LoopBoundaryModel;
  readonly triggerAccessibleName: string;
  readonly setEndAccessibleName: string;
  readonly clearEndAccessibleName: string;
  readonly deleteAccessibleName: string;
}

/** A boundary nudge, tagged with the boundary it belongs to. */
export interface LoopBoundaryNudge {
  readonly boundary: LoopBoundaryName;
  readonly offsetFrames: number;
}

/** A boundary snap, tagged with the boundary and the direction. */
export interface LoopBoundarySnap {
  readonly boundary: LoopBoundaryName;
  readonly direction: 'previous' | 'next';
}

const ACTIVITY_WORDS: Record<LoopTileActivity, string> = {
  idle: '',
  queued: 'queued',
  running: 'running',
};

const NOTHING_SELECTED = 'nothing selected';
const NOT_READY = 'not ready';

/**
 * The selected loop or cue, across both columns of the plate: a trigger key, a small display of the
 * name, kind and span, the Set End, Clear End and Delete keys, and beneath them the Start and End
 * boundaries side by side. Purely presentational: it computes no time or snap target and holds no
 * drag value. The caller supplies every label and the drag offsets.
 *
 * With `model.empty` the display is blank and every key and boundary is disabled. The display's
 * accessible text carries the running, queued or not-ready state in words.
 *
 * @example
 * ```html
 * <lib-loop-selected-row
 *   [model]="row()"
 *   [startDragOffset]="startDrag()"
 *   [endDragOffset]="endDrag()"
 *   (trigger)="onTrigger()"
 *   (setEnd)="onSetEnd()"
 *   (clearEnd)="onClearEnd()"
 *   (deleteMarker)="onDelete()"
 *   (nudgeInput)="onNudgeInput($event)"
 *   (nudgeCommit)="onNudgeCommit($event)"
 *   (snap)="onSnap($event)"
 * />
 * ```
 */
@Component({
  selector: 'lib-loop-selected-row',
  imports: [LoopBoundaryComponent, SynthKeyComponent],
  templateUrl: './loop-selected-row.component.html',
  styleUrl: './loop-selected-row.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.data-empty]': 'model().empty ? "" : null',
  },
})
export class LoopSelectedRowComponent {
  /** The row's state. */
  readonly model = input.required<LoopSelectedRowModel>();
  /** While non-null, the Start boundary's readout and bar follow it. */
  readonly startDragOffset = input<number | null>(null);
  /** While non-null, the End boundary's readout and bar follow it. */
  readonly endDragOffset = input<number | null>(null);
  /** Emits when the trigger key is pressed. */
  readonly trigger = output<void>();
  /** Emits when Set End is pressed. */
  readonly setEnd = output<void>();
  /** Emits when Clear End is pressed. */
  readonly clearEnd = output<void>();
  /** Emits when Delete is pressed. */
  readonly deleteMarker = output<void>();
  /** Fires on every nudge drag tick, tagged with the boundary — readout only. */
  readonly nudgeInput = output<LoopBoundaryNudge>();
  /** Fires when a nudge is released, tagged with the boundary. */
  readonly nudgeCommit = output<LoopBoundaryNudge>();
  /** Emits when a boundary's snap key is pressed, tagged with the boundary and direction. */
  readonly snap = output<LoopBoundarySnap>();

  protected readonly stateLight = computed(() => {
    switch (this.model().activity) {
      case 'running':
        return 'playing';
      case 'queued':
        return 'paused';
      default:
        return 'off';
    }
  });

  /** The display read aloud: the name and kind, then the state in words, then the span. */
  protected readonly displayText = computed(() => {
    const model = this.model();
    if (model.empty) return NOTHING_SELECTED;
    const state = [ACTIVITY_WORDS[model.activity], model.ready ? '' : NOT_READY]
      .filter((word) => word !== '')
      .join(', ');
    return [model.name, model.kindLabel.toLowerCase(), state, model.spanText]
      .filter((part) => part !== '')
      .join(', ');
  });

  protected readonly startBoundary = computed(() => this.boundary('start'));
  protected readonly endBoundary = computed(() => this.boundary('end'));

  private boundary(name: LoopBoundaryName): LoopBoundaryModel {
    const model = this.model();
    const boundary = model[name];
    return model.empty ? { ...boundary, disabled: true } : boundary;
  }
}
