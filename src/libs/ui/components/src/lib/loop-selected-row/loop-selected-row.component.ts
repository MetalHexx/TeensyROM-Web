import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  untracked,
  viewChild,
} from '@angular/core';
import { InlineEditTitleComponent } from '../inline-edit-title/inline-edit-title.component';
import { DropdownMenuItemComponent } from '../dropdown-menu/dropdown-menu-item.component';
import { DropdownMenuComponent } from '../dropdown-menu/dropdown-menu.component';
import { LoopBoundaryComponent, type LoopBoundaryModel } from '../loop-boundary/loop-boundary.component';
import type { LoopTileActivity } from '../loop-tile/loop-tile.component';
import { SynthKeyComponent } from '../synth-key/synth-key.component';

/** Which end of the selected loop a boundary output is about. */
export type LoopBoundaryName = 'start' | 'end';

/** One size the Length picker offers. */
export interface LoopLengthOptionModel {
  readonly beats: number;
  readonly label: string;
  readonly selected: boolean;
}

/** One distance the Move step picker offers: beats, or `'frame'` for one play call. */
export interface LoopMoveStepOptionModel {
  readonly beats: 'frame' | 1 | 2 | 4 | 8 | 16;
  readonly label: string;
  readonly selected: boolean;
}

/** The Length row: halve and double keys around a readout that opens a picker of sizes. */
export interface LoopLengthModel {
  /** '16 BEATS' | '7.8s' | 'NO END'. */
  readonly text: string;
  /** Empty when there is no grid: the readout is then plain text with no list. */
  readonly options: readonly LoopLengthOptionModel[];
  readonly halveAccessibleName: string;
  readonly doubleAccessibleName: string;
  readonly pickAccessibleName: string;
}

/** The Move row: move-earlier and move-later keys around a readout that opens a picker of steps. */
export interface LoopMoveModel {
  /** '1 BEAT' | '4 BEATS'. */
  readonly stepText: string;
  /** The deck's step, so it is offered whatever is selected. */
  readonly options: readonly LoopMoveStepOptionModel[];
  readonly earlierAccessibleName: string;
  readonly laterAccessibleName: string;
  readonly pickAccessibleName: string;
}

/** The selected loop or cue's caller-composed state. */
export interface LoopSelectedRowModel {
  /** The selected marker's id, or null with nothing selected. A rename commits to the id it opened on. */
  readonly id: string | null;
  /** Nothing selected: blank display, every control disabled. */
  readonly empty: boolean;
  readonly name: string;
  readonly kindLabel: 'LOOP' | 'CUE' | '';
  /** e.g. '02:39.4–02:47.5', or '02:43.2' for a cue. */
  readonly spanText: string;
  readonly activity: LoopTileActivity;
  readonly ready: boolean;
  readonly triggerDisabled: boolean;
  /** True on a cue. */
  readonly clearEndDisabled: boolean;
  readonly deleteDisabled: boolean;
  readonly start: LoopBoundaryModel;
  /** `empty` on a cue. */
  readonly end: LoopBoundaryModel;
  readonly length: LoopLengthModel;
  /** Per deck: drawn and enabled whatever is selected, even nothing. */
  readonly move: LoopMoveModel;
  readonly triggerAccessibleName: string;
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
  /** Names the rename button and field, e.g. 'Rename Loop 5'. */
  readonly renameLabel: string;
  /** The name field's maximum length, e.g. 48. */
  readonly nameMaxLength: number;
}

/** A boundary nudge, tagged with the boundary it belongs to. */
export interface LoopBoundaryNudge {
  readonly boundary: LoopBoundaryName;
  readonly offsetFrames: number;
}

/** A boundary's edge moved a step, tagged with the boundary and the direction. */
export interface LoopEdgeMove {
  readonly boundary: LoopBoundaryName;
  readonly direction: -1 | 1;
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
const LAMP_ON = 'radio_button_checked';
const LAMP_OFF = 'radio_button_unchecked';

/**
 * The selected loop or cue, across both columns of the plate: a trigger key, a small display of the
 * name, kind and span, a play-now key, the GBL and WRAP switches, the Clear End and Delete keys, and
 * beneath them the Start and End boundaries side by side, each headed by its In or Out key, and under
 * those the Length row (½, a size picker, 2×) and the Move row (move earlier, a step picker, move later).
 * A cue's End boundary keeps an enabled Out key, which makes the cue a loop.
 * The GBL switch draws a lamp beside its label, a ringed dot while the marker shares the main
 * track's settings and an empty ring while it has its own, and is a plain disabled key (no pressed
 * state) with nothing selected. WRAP draws the same lamp, lit while a scrubbed record wraps from the
 * loop's start to its end, and is disabled on a cue as well. Purely presentational: it computes no time, beat or target and holds
 * no drag value. The caller supplies every label and the drag offsets.
 *
 * The name is renamed in place — click it, type, Enter; an empty name is allowed. With
 * `model.empty` the display is blank and every key and boundary is disabled, as are ½ and 2×; the
 * Move row stays live, as the Move step belongs to the deck. A picker opens a list of its `options`
 * and emits the picked beats; with no options (no grid) its readout is plain text. The display's
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
 *   (setIn)="onSetIn()"
 *   (setOut)="onSetOut()"
 *   (halve)="onHalve()"
 *   (double)="onDouble()"
 *   (pickLength)="onPickLength($event)"
 *   (moveEarlier)="onMoveEarlier()"
 *   (moveLater)="onMoveLater()"
 *   (pickMoveStep)="onPickMoveStep($event)"
 *   (moveEdge)="onMoveEdge($event)"
 *   (clearEnd)="onClearEnd()"
 *   (deleteMarker)="onDelete()"
 *   (nudgeInput)="onNudgeInput($event)"
 *   (nudgeCommit)="onNudgeCommit($event)"
 *   (rename)="onRename($event)"
 * />
 * ```
 */
@Component({
  selector: 'lib-loop-selected-row',
  imports: [
    DropdownMenuComponent,
    DropdownMenuItemComponent,
    InlineEditTitleComponent,
    LoopBoundaryComponent,
    SynthKeyComponent,
  ],
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
  /** Emits when the In key is pressed. */
  readonly setIn = output<void>();
  /** Emits when the Out key is pressed. */
  readonly setOut = output<void>();
  /** Emits when the ½ key is pressed. */
  readonly halve = output<void>();
  /** Emits when the 2× key is pressed. */
  readonly double = output<void>();
  /** Emits the picked size in beats. */
  readonly pickLength = output<number>();
  /** Emits when the Move earlier key is pressed. */
  readonly moveEarlier = output<void>();
  /** Emits when the Move later key is pressed. */
  readonly moveLater = output<void>();
  /** Emits the picked Move step: beats, or `'frame'`. */
  readonly pickMoveStep = output<LoopMoveStepOptionModel['beats']>();
  /** Emits when Clear End is pressed. */
  readonly clearEnd = output<void>();
  /** Emits when Delete is pressed. */
  readonly deleteMarker = output<void>();
  /** Fires on every nudge drag tick, tagged with the boundary — readout only. */
  readonly nudgeInput = output<LoopBoundaryNudge>();
  /** Fires when a nudge is released, tagged with the boundary. */
  readonly nudgeCommit = output<LoopBoundaryNudge>();
  /** Emits when a boundary's edge-move arrow is pressed, tagged with the boundary and direction. */
  readonly moveEdge = output<LoopEdgeMove>();
  /** Emits the new name with the id of the marker the edit was opened on, even if the selection has
   *  since moved; an empty name returns the marker to its place name. */
  readonly rename = output<{ id: string; name: string }>();

  private readonly editor = viewChild(InlineEditTitleComponent);

  /** Whether the name editor is open; derived from the editor so it cannot drift from it. */
  protected readonly renaming = computed(() => this.editor()?.isEditing() ?? false);

  private renameTargetId: string | null = null;

  constructor() {
    effect(() => {
      this.renameTargetId = this.renaming() ? untracked(() => this.model().id) : null;
    });
  }

  protected onCommit(name: string): void {
    const id = this.renameTargetId ?? this.model().id;
    if (id !== null) {
      this.rename.emit({ id, name });
    }
  }

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

  private boundary(name: LoopBoundaryName): LoopBoundaryModel {
    const model = this.model();
    const boundary = model[name];
    return model.empty
      ? { ...boundary, disabled: true, key: { ...boundary.key, disabled: true } }
      : boundary;
  }
}
