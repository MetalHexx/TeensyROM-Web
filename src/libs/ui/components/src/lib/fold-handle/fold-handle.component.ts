import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IconButtonComponent } from '../icon-button/icon-button.component';

/**
 * The fold control of a card that can collapse into a vertical strip. Open, it is a close button
 * in the card's top-right corner; folded, the same button becomes a chevron on the strip, with the
 * card's `label` rotated beneath it so it reads bottom to top.
 *
 * It fills its positioned parent (the card) and does not intercept pointer events outside the
 * button, so the card must be `position: relative`, and the caller sets the strip's width through
 * `--fold-strip-width` (default `44px`). The caller owns the state and every word: `foldedChange`
 * is a request, answered by flipping `folded`. The button is one element in both states, so
 * keyboard focus stays on it across a fold.
 *
 * @example
 * ```html
 * <section class="card" [style.--fold-strip-width]="'44px'">
 *   <lib-fold-handle
 *     [folded]="folded()"
 *     label="File listing"
 *     foldAccessibleName="Collapse the file listing"
 *     unfoldAccessibleName="Expand the file listing"
 *     (foldedChange)="folded.set($event)"
 *   />
 * </section>
 * ```
 */
@Component({
  selector: 'lib-fold-handle',
  imports: [IconButtonComponent],
  templateUrl: './fold-handle.component.html',
  styleUrl: './fold-handle.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FoldHandleComponent {
  /** Whether the card it sits on is folded into its strip. */
  readonly folded = input.required<boolean>();
  /** The vertical label shown on the strip while folded, e.g. 'File listing'. */
  readonly label = input.required<string>();
  /** The button's accessible name while the card is open ('Collapse the file listing'). */
  readonly foldAccessibleName = input.required<string>();
  /** The button's accessible name while the card is folded ('Expand the file listing'). */
  readonly unfoldAccessibleName = input.required<string>();
  /** The label's fade-in, in ms; 0 for reduced motion. Defaults to `400`. */
  readonly animationDuration = input<number>(400);
  /** The request to fold (true) or to unfold (false); the caller owns the state. */
  readonly foldedChange = output<boolean>();

  protected onPress(): void {
    this.foldedChange.emit(!this.folded());
  }
}
