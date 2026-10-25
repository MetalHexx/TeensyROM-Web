import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { SynthKeyComponent } from '../synth-key/synth-key.component';

/** One loop or cue boundary's caller-composed state. */
export interface LoopBoundaryModel {
  /** 'Start' | 'End'. */
  readonly tag: string;
  /** A cue's End: drawn empty, readout '—', every control disabled. */
  readonly empty: boolean;
  readonly disabled: boolean;
  /** Committed nudge, −`rangeFrames`..+`rangeFrames`. */
  readonly offsetFrames: number;
  /** One second, in play calls; 0 disables the strip. */
  readonly rangeFrames: number;
  /** Detected moments in reach, 0–100 across the strip. */
  readonly tickPercents: readonly number[];
  readonly previousDisabled: boolean;
  readonly nextDisabled: boolean;
  readonly nudgeAccessibleName: string;
  readonly previousAccessibleName: string;
  readonly nextAccessibleName: string;
}

const MINUS = '−';
const EMPTY_READOUT = '—';

/**
 * One boundary of the selected loop or cue: the tag, a previous-snap key, a bipolar nudge strip, a
 * next-snap key and the offset readout. Purely presentational: it holds no drag value, so the
 * caller feeds `dragOffsetFrames` while a drag is live and the committed offset is shown otherwise.
 *
 * The strip is a native range input under a drawn strip (centre line, magenta moment ticks, a bar
 * from the centre to the value), so it stays keyboard-operable and visible to assistive tech.
 * `nudgeInput` fires on every tick and is for the readout only; `nudgeCommit` fires on release.
 *
 * @example
 * ```html
 * <lib-loop-boundary
 *   [model]="startBoundary()"
 *   [dragOffsetFrames]="startDrag()"
 *   (nudgeInput)="onNudgeInput($event)"
 *   (nudgeCommit)="onNudgeCommit($event)"
 *   (snapPrevious)="onSnap('previous')"
 *   (snapNext)="onSnap('next')"
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
  /** Emits when the snap-to-previous-moment key is pressed. */
  readonly snapPrevious = output<void>();
  /** Emits when the snap-to-next-moment key is pressed. */
  readonly snapNext = output<void>();

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
