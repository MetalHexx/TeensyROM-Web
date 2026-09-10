import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * Previous/next buttons with a caption between them. Generic — nothing about subtunes, tracks, or
 * any other caller concept appears in it; the caption and both accessible names are entirely
 * caller-composed.
 *
 * @example
 * ```html
 * <lib-stepper
 *   [text]="'Subtune ' + currentSubtune() + ' of ' + subtuneCount()"
 *   [previousDisabled]="!canStepSubtune()"
 *   [nextDisabled]="!canStepSubtune()"
 *   previousAccessibleName="Previous subtune deck A"
 *   nextAccessibleName="Next subtune deck A"
 *   (previous)="onPreviousSubtune()"
 *   (next)="onNextSubtune()"
 * />
 * ```
 */
@Component({
  selector: 'lib-stepper',
  templateUrl: './stepper.component.html',
  styleUrl: './stepper.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StepperComponent {
  /** The caption rendered between the two buttons, e.g. 'Subtune 1 of 3' — caller-composed. */
  readonly text = input.required<string>();
  /** Disables the previous button. Defaults to `false`. */
  readonly previousDisabled = input<boolean>(false);
  /** Disables the next button. Defaults to `false`. */
  readonly nextDisabled = input<boolean>(false);
  /** Accessible label for the previous button, e.g. 'Previous subtune deck A'. */
  readonly previousAccessibleName = input.required<string>();
  /** Accessible label for the next button, e.g. 'Next subtune deck A'. */
  readonly nextAccessibleName = input.required<string>();
  /** Emits when the previous button is clicked. */
  readonly previous = output<void>();
  /** Emits when the next button is clicked. */
  readonly next = output<void>();
}
