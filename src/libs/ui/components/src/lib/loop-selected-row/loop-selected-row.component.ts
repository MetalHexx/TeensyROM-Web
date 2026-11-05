import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import type { LoopLengthModel } from '../loop-size-control/loop-size-control.component';
import { InlineEditTitleComponent } from '../inline-edit-title/inline-edit-title.component';
import { DropdownMenuItemComponent } from '../dropdown-menu/dropdown-menu-item.component';
import { DropdownMenuComponent } from '../dropdown-menu/dropdown-menu.component';
import type { LoopTileActivity } from '../loop-tile/loop-tile.component';
import { LoopSizeControlComponent } from '../loop-size-control/loop-size-control.component';
import { SynthKeyComponent } from '../synth-key/synth-key.component';

export type { LoopLengthModel, LoopLengthOptionModel } from '../loop-size-control/loop-size-control.component';

/** One distance the Move step picker offers: beats, or `'frame'` for one play call. */
export interface LoopMoveStepOptionModel {
  readonly beats: 'frame' | 1 | 2 | 4 | 8 | 16;
  readonly label: string;
  readonly selected: boolean;
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
  readonly deleteDisabled: boolean;
  readonly length: LoopLengthModel;
  /** Per deck: drawn and enabled whatever is selected, even nothing. */
  readonly move: LoopMoveModel;
  readonly triggerAccessibleName: string;
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
 * name, kind and span, a play-now key, the GBL and WRAP switches and the Delete key, and beneath
 * them the Length row (1/2, − and +, a length picker, 2×) and the Move row (move earlier, a step
 * picker, move later). The length picker's first item, No End, turns a loop into a cue.
 * The GBL switch draws a lamp beside its label, a ringed dot while the marker shares the main
 * track's settings and an empty ring while it has its own, and is a plain disabled key (no pressed
 * state) with nothing selected. WRAP draws the same lamp, lit while a scrubbed record wraps from the
 * loop's start to its end, and is disabled on a cue as well. Purely presentational: it computes no
 * time, beat or target. The caller supplies every label.
 *
 * The name is renamed in place — click it, type, Enter; an empty name is allowed. With
 * `model.empty` the display is blank and every key is disabled, as are 1/2, 2×, − and +; the Move
 * row stays live, as the Move step belongs to the deck. A picker opens a list of its `options` and
 * emits the picked beats; with no options (no grid) the Length readout is a picker only when it
 * offers No End, else plain text. The display's accessible text carries the running, queued,
 * not-ready, own-settings and wraps state in words.
 *
 * @example
 * ```html
 * <lib-loop-selected-row
 *   [model]="row()"
 *   (trigger)="onTrigger()"
 *   (playNow)="onPlayNow()"
 *   (toggleGlobal)="onToggleGlobal()"
 *   (toggleWrap)="onToggleWrap()"
 *   (halve)="onHalve()"
 *   (double)="onDouble()"
 *   (stepLength)="onStepLength($event)"
 *   (pickLength)="onPickLength($event)"
 *   (moveEarlier)="onMoveEarlier()"
 *   (moveLater)="onMoveLater()"
 *   (pickMoveStep)="onPickMoveStep($event)"
 *   (clearEnd)="onClearEnd()"
 *   (deleteMarker)="onDelete()"
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
    LoopSizeControlComponent,
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
  /** Emits when the trigger key is pressed. */
  readonly trigger = output<void>();
  /** Emits when the play-now key is pressed. */
  readonly playNow = output<void>();
  /** Emits when the GBL switch is pressed. */
  readonly toggleGlobal = output<void>();
  /** Emits when the WRAP switch is pressed. */
  readonly toggleWrap = output<void>();
  /** Emits when the 1/2 key is pressed. */
  readonly halve = output<void>();
  /** Emits when the 2× key is pressed. */
  readonly double = output<void>();
  /** Emits -1 for the − key and 1 for the + key, one whole beat each. */
  readonly stepLength = output<-1 | 1>();
  /** Emits the picked size in beats. */
  readonly pickLength = output<number>();
  /** Emits when the Move earlier key is pressed. */
  readonly moveEarlier = output<void>();
  /** Emits when the Move later key is pressed. */
  readonly moveLater = output<void>();
  /** Emits the picked Move step: beats, or `'frame'`. */
  readonly pickMoveStep = output<LoopMoveStepOptionModel['beats']>();
  /** Emits when the length picker's No End item is picked. */
  readonly clearEnd = output<void>();
  /** Emits when Delete is pressed. */
  readonly deleteMarker = output<void>();
  /** Emits the new name with the id of the marker the edit was opened on, even if the selection has
   *  since moved; an empty name returns the marker to its place name. Emits nothing when the name is
   *  the one the edit opened with. */
  readonly rename = output<{ id: string; name: string }>();

  private readonly editor = viewChild(InlineEditTitleComponent);

  /** Whether the name editor is open; derived from the editor so it cannot drift from it. */
  protected readonly renaming = computed(() => this.editor()?.isEditing() ?? false);

  /** The marker and name the open editor was seeded with; null while the editor is closed. */
  private readonly renameTarget = signal<{ id: string; name: string } | null>(null);

  /** The name the editor judges "changed" against. While the field is open it stays the name the
   *  edit opened with, so a selection move under the open field cannot change what counts as an
   *  edit: a draft equal to the newly selected marker's name must still commit to the marker the
   *  edit was opened on. With the editor closed it follows the model. */
  protected readonly editorValue = computed(() => this.renameTarget()?.name ?? this.model().name);

  constructor() {
    effect(() => {
      this.renameTarget.set(this.renaming() ? untracked(() => this.openedOn()) : null);
    });
  }

  private openedOn(): { id: string; name: string } | null {
    const { id, name } = this.model();
    return id === null ? null : { id, name };
  }

  protected onCommit(name: string): void {
    const target = this.renameTarget() ?? this.openedOn();
    if (target !== null && name !== target.name) {
      this.rename.emit({ id: target.id, name });
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
}
