import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { InlineEditTitleComponent } from '../inline-edit-title/inline-edit-title.component';
import {
  LoopBoundaryComponent,
  type LoopBoundaryAction,
  type LoopBoundaryModel,
} from '../loop-boundary/loop-boundary.component';
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
  readonly playNowDisabled: boolean;
  readonly playNowAccessibleName: string;
  /** GBL lit: the marker shares the main track's settings. */
  readonly sharesGlobal: boolean;
  readonly globalDisabled: boolean;
  readonly globalAccessibleName: string;
  /** WRAP lit: a scrubbed record wraps from the loop's start to its end instead of stopping. */
  readonly wraps: boolean;
  /** True with nothing selected and on a cue. */
  readonly wrapDisabled: boolean;
  readonly wrapAccessibleName: string;
  /** The name cannot be edited, e.g. while the marker is not yet saved. */
  readonly renameDisabled: boolean;
  /** Names the rename button and field, e.g. 'Rename Item 5'. */
  readonly renameLabel: string;
  /** The name field's maximum length, e.g. 48. */
  readonly nameMaxLength: number;
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
const OWN_SETTINGS = 'own settings';
const WRAPS = 'wraps';
const SET_END_LABEL = 'Set End';
const SET_END_ICON = 'last_page';
const SET_END_CONTROL = 'loop-set-end';
const LAMP_ON = 'radio_button_checked';
const LAMP_OFF = 'radio_button_unchecked';

/**
 * The selected loop or cue, across both columns of the plate: a trigger key, a small display of the
 * name, kind and span, a play-now key, the GBL and WRAP switches, the Clear End and Delete keys, and
 * beneath them the Start and End boundaries side by side. On a cue the End boundary holds the Set End key.
 * The GBL switch draws a lamp beside its label, a ringed dot while the marker shares the main
 * track's settings and an empty ring while it has its own, and is a plain disabled key (no pressed
 * state) with nothing selected. WRAP draws the same lamp, lit while a scrubbed record wraps from the
 * loop's start to its end, and is disabled on a cue as well. Purely presentational: it computes no time or snap target and holds
 * no drag value. The caller supplies every label and the drag offsets.
 *
 * The name is renamed in place — click it, type, Enter; an empty name is allowed. With
 * `model.empty` the display is blank and every key and boundary is disabled. The display's
 * accessible text carries the running, queued, not-ready, own-settings and wraps state in words.
 *
 * @example
 * ```html
 * <lib-loop-selected-row
 *   [model]="row()"
 *   [startDragOffset]="startDrag()"
 *   [endDragOffset]="endDrag()"
 *   (trigger)="onTrigger()"
 *   (playNow)="onPlayNow()"
 *   (toggleGlobal)="onToggleGlobal()"
 *   (toggleWrap)="onToggleWrap()"
 *   (setEnd)="onSetEnd()"
 *   (clearEnd)="onClearEnd()"
 *   (deleteMarker)="onDelete()"
 *   (nudgeInput)="onNudgeInput($event)"
 *   (nudgeCommit)="onNudgeCommit($event)"
 *   (snap)="onSnap($event)"
 *   (rename)="onRename($event)"
 * />
 * ```
 */
@Component({
  selector: 'lib-loop-selected-row',
  imports: [InlineEditTitleComponent, LoopBoundaryComponent, SynthKeyComponent],
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
  /** Emits when the play-now key is pressed. */
  readonly playNow = output<void>();
  /** Emits when the GBL switch is pressed. */
  readonly toggleGlobal = output<void>();
  /** Emits when the WRAP switch is pressed. */
  readonly toggleWrap = output<void>();
  /** Emits when Set End, in a cue's End slot, is pressed. */
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
  /** Emits the new name when the name is committed; an empty name returns the marker to its place name. */
  readonly rename = output<string>();

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

  /** GBL's pressed state: `null` with nothing selected, as no setting is in play to report. */
  protected readonly globalLatched = computed(() => {
    const model = this.model();
    return model.empty ? null : model.sharesGlobal;
  });

  /** GBL's lamp icon; its shape, not only its colour, tells shared from own settings. */
  protected readonly globalLamp = computed(() =>
    this.globalLatched() === true ? LAMP_ON : LAMP_OFF
  );

  /** WRAP's pressed state: `null` with nothing selected. */
  protected readonly wrapLatched = computed(() => {
    const model = this.model();
    return model.empty ? null : model.wraps;
  });

  /** WRAP's lamp icon, the same pair GBL draws. */
  protected readonly wrapLamp = computed(() => (this.wrapLatched() === true ? LAMP_ON : LAMP_OFF));

  /** The display read aloud: the name and kind, then the state in words, then the span. */
  protected readonly displayText = computed(() => {
    const model = this.model();
    if (model.empty) return NOTHING_SELECTED;
    const state = [
      ACTIVITY_WORDS[model.activity],
      model.ready ? '' : NOT_READY,
      model.sharesGlobal ? '' : OWN_SETTINGS,
      model.wraps ? WRAPS : '',
    ]
      .filter((word) => word !== '')
      .join(', ');
    return [model.name, model.kindLabel.toLowerCase(), state, model.spanText]
      .filter((part) => part !== '')
      .join(', ');
  });

  protected readonly startBoundary = computed(() => this.boundary('start'));
  protected readonly endBoundary = computed(() => this.boundary('end'));

  /** Set End, in the End slot of a selected cue; a loop and an empty row show the boundary. */
  protected readonly endAction = computed<LoopBoundaryAction | null>(() => {
    const model = this.model();
    if (model.empty || !model.end.empty) return null;
    return {
      label: SET_END_LABEL,
      icon: SET_END_ICON,
      accessibleName: model.setEndAccessibleName,
      disabled: model.setEndDisabled,
      control: SET_END_CONTROL,
    };
  });

  private boundary(name: LoopBoundaryName): LoopBoundaryModel {
    const model = this.model();
    const boundary = model[name];
    return model.empty ? { ...boundary, disabled: true } : boundary;
  }
}
