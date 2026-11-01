import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { SynthKeyComponent } from '../synth-key/synth-key.component';

/** The In or Out key that heads a boundary. */
export interface LoopBoundaryKey {
  readonly label: 'In' | 'Out';
  readonly accessibleName: string;
  /** Rendered as the key's `data-control`, so a learn overlay can find it. */
  readonly control: 'loop-in' | 'loop-set-end';
  readonly disabled: boolean;
}

/** One loop or cue boundary's caller-composed state. */
export interface LoopBoundaryModel {
  /** The In or Out key at the row's head. Enabled on a cue's End row: Out makes the cue a loop. */
  readonly key: LoopBoundaryKey;
  /** A cue's End: drawn empty, readout '—', the strip and edge arrows disabled. */
  readonly empty: boolean;
  readonly disabled: boolean;
  /** Committed nudge, −`rangeFrames`..+`rangeFrames`. */
  readonly offsetFrames: number;
  /** One second, in play calls; 0 disables the strip. */
  readonly rangeFrames: number;
  /** Beats of the grid in reach, 0–100 across the strip. */
  readonly tickPercents: readonly number[];
  readonly nudgeAccessibleName: string;
  readonly earlierAccessibleName: string;
  readonly laterAccessibleName: string;
}

const MINUS = '−';
const EMPTY_READOUT = '—';

/**
 * One boundary of the selected loop or cue: the In or Out key, an edge-move arrow either way, a
 * bipolar nudge strip between them, and the offset readout. Purely presentational: it holds no
 * drag value, so the caller feeds `dragOffsetFrames` while a drag is live and the committed offset
 * is shown otherwise.
 *
 * The key reports `keyPress` and is disabled by its own flag alone, so a cue's End row draws an
 * empty strip and `—` beside an enabled Out key. The arrows report `moveEarlier` and `moveLater`
 * and are disabled with the boundary (`empty` or `disabled`), never for want of a grid.
 *
 * The strip is a native range input under a drawn strip (centre line, magenta beat ticks, a bar
 * from the centre to the value), so it stays keyboard-operable and visible to assistive tech.
 * `nudgeInput` fires on every tick and is for the readout only; `nudgeCommit` fires on release.
 *
 * @example
 * ```html
 * <lib-loop-boundary
 *   [model]="startBoundary()"
 *   [dragOffsetFrames]="startDrag()"
 *   (keyPress)="onSetIn()"
 *   (moveEarlier)="onMoveEdge('start', -1)"
 *   (moveLater)="onMoveEdge('start', 1)"
 *   (nudgeInput)="onNudgeInput($event)"
 *   (nudgeCommit)="onNudgeCommit($event)"
 * />
 * ```
 */
@Component({
  selector: 'lib-loop-boundary',
  imports: [SynthKeyComponent],
  templateUrl: './loop-boundary.component.html',
  styleUrl: './loop-boundary.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.data-empty]': 'model().empty ? "" : null',
  },
})
export class LoopBoundaryComponent {
  /** The boundary's state. */
  readonly model = input.required<LoopBoundaryModel>();
  /** While non-null, the readout and bar follow it instead of the committed offset. */
  readonly dragOffsetFrames = input<number | null>(null);
  /** Fires on every drag tick with the live offset in frames — readout only. */
  readonly nudgeInput = output<number>();
  /** Fires on release with the offset in frames — the value to apply. */
  readonly nudgeCommit = output<number>();
  /** Emits when the In or Out key is pressed. */
  readonly keyPress = output<void>();
  /** Emits when the move-edge-earlier arrow is pressed. */
  readonly moveEarlier = output<void>();
  /** Emits when the move-edge-later arrow is pressed. */
  readonly moveLater = output<void>();

  protected readonly controlsDisabled = computed(() => {
    const model = this.model();
    return model.empty || model.disabled;
  });

  protected readonly stripDisabled = computed(
    () => this.controlsDisabled() || this.model().rangeFrames === 0
  );

  protected readonly shownOffset = computed(() => {
    const { offsetFrames, rangeFrames } = this.model();
    const offset = this.dragOffsetFrames() ?? offsetFrames;
    return Math.min(rangeFrames, Math.max(-rangeFrames, offset));
  });

  protected readonly readout = computed(() => {
    if (this.model().empty) return EMPTY_READOUT;
    const offset = this.shownOffset();
    if (offset === 0) return '0 fr';
    return `${offset > 0 ? '+' : MINUS}${Math.abs(offset)} fr`;
  });

  /** Where the value sits across the strip, 0–100; a zero range sits at the centre. */
  protected readonly valuePercent = computed(() => {
    const range = this.model().rangeFrames;
    return range === 0 ? 50 : ((this.shownOffset() + range) / (2 * range)) * 100;
  });

  protected readonly barLeftPercent = computed(() => Math.min(50, this.valuePercent()));
  protected readonly barWidthPercent = computed(() => Math.abs(this.valuePercent() - 50));

  protected onInput(event: Event): void {
    this.nudgeInput.emit(Number((event.target as HTMLInputElement).value));
  }

  protected onChange(event: Event): void {
    this.nudgeCommit.emit(Number((event.target as HTMLInputElement).value));
  }
}
