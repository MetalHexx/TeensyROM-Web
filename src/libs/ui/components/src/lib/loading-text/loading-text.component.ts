import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LeetTextContainerComponent } from '../leet-text-container/leet-text-container.component';

/**
 * A pre-packaged loading indicator: wraps `LeetTextContainerComponent` with a 200ms fade in/out
 * transition driven by the `visible` input, so callers get a complete show/hide loading state
 * without having to wire animation triggers themselves. Displays "Loading..." by default; pass
 * `text` for context-specific messages like "Autosaving..." or "Processing...".
 *
 * Reach for `LoadingTextComponent` whenever you need a self-contained loading indicator — corner
 * slots, toolbars, status messages. Use `LeetTextContainerComponent` directly instead only when you
 * need the raw leet-speak animation without the fade lifecycle (e.g. always-visible text, or a
 * custom show/hide transition of your own).
 *
 * @example
 * ```html
 * <!-- Default "Loading..." text -->
 * <lib-loading-text [visible]="isLoading()"></lib-loading-text>
 *
 * <!-- In a corner slot with default text -->
 * <lib-scaling-card title="Data">
 *   <lib-loading-text slot="corner" [visible]="isLoading()"></lib-loading-text>
 * </lib-scaling-card>
 *
 * <!-- Custom text via input -->
 * <lib-loading-text [visible]="isLoading()" [text]="'Processing...'"></lib-loading-text>
 *
 * <!-- With custom animation speed -->
 * <lib-loading-text [visible]="isLoading()" [text]="'Saving...'" [showSpinner]="true" [animationDuration]="500"></lib-loading-text>
 * ```
 */
@Component({
  selector: 'lib-loading-text',
  imports: [CommonModule, LeetTextContainerComponent],
  templateUrl: './loading-text.component.html',
  styleUrl: './loading-text.component.scss',
  host: {
    '[class.visible]': 'visible()',
  },
})
export class LoadingTextComponent {
  /**
   * Controls visibility with fade animation
   * - true: Fade in and show
   * - false: Fade out and hide
   */
  visible = input<boolean>(false);

  /**
   * Custom text to display (default: "Loading...")
   * Use this for context-specific loading messages like "Autosaving...", "Processing...", etc.
   */
  text = input<string>('Loading...');

  /**
   * Show animated spinner before the text (default: true)
   */
  showSpinner = input<boolean>(true);

  /**
   * Duration of the leet cycling animation in milliseconds (default: 1000)
   */
  animationDuration = input<number>(1000);
}
