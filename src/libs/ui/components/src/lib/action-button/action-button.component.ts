import { Component, input, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { IconLabelComponent } from '../icon-label/icon-label.component';
import { TooltipDirective, TooltipConfig } from '../tooltip/tooltip.directive';

export type ActionButtonVariant = 'stroked' | 'flat' | 'raised' | 'fab';
export type ActionButtonColor = 'primary' | 'success' | 'error' | 'highlight' | 'normal';

/**
 * Icon-and-text button that combines a Material button variant with a
 * {@link IconLabelComponent}, giving toolbar and dialog actions ("Refresh",
 * "Index All", "Reset Devices") a consistent labeled-button pattern with
 * semantic coloring.
 *
 * Reach for `lib-action-button` when the action needs a visible text label
 * next to its icon — toolbars, dialog footers, empty-state calls to action.
 * Reach for `lib-icon-button` instead when space is tight and the icon alone
 * (plus `ariaLabel`/tooltip) is enough to convey the action, such as a dense
 * row of controls in a card header or player toolbar.
 *
 * Color is a text-color overlay only: `success`/`error`/`highlight` recolor
 * the label and icon while `primary`/`normal` fall back to Material's native
 * button styling, so borders, elevation, and spacing stay untouched. See the
 * `style-guide` skill for the underlying `--color-*` design tokens and the
 * `action-button-*` utility classes this component applies.
 *
 * @example
 * ```html
 * <lib-action-button
 *   icon="download"
 *   label="Index All"
 *   color="success"
 *   (buttonClick)="indexAll()"
 * ></lib-action-button>
 * ```
 */
@Component({
  selector: 'lib-action-button',
  imports: [CommonModule, MatButtonModule, TooltipDirective, IconLabelComponent],
  templateUrl: './action-button.component.html',
  styleUrl: './action-button.component.scss',
  host: {
    '[class.fit-content]': '!fullWidth()',
  },
})
export class ActionButtonComponent {
  // Required inputs
  /** Material icon ligature name rendered before the label. */
  icon = input.required<string>();
  /** Visible button text, rendered next to the icon. Also used as the default `ariaLabel`. */
  label = input.required<string>();

  // Optional inputs
  /**
   * Material button style. Defaults to `'stroked'`.
   * - `'stroked'` — outlined button (default, lowest visual weight)
   * - `'flat'` — text button with no border
   * - `'raised'` — elevated, filled button for primary/standout actions
   * - `'fab'` — floating action button (circular, icon+label content)
   */
  variant = input<ActionButtonVariant>('stroked');
  /**
   * Semantic color applied to the icon and label text. Defaults to `'primary'`.
   * - `'primary'` — Material's natural primary color, no override
   * - `'normal'` — Material's default (unthemed) styling, no override
   * - `'success'` — positive/confirming actions (`--color-success`)
   * - `'error'` — destructive actions (`--color-error`)
   * - `'highlight'` — draws attention without implying success/failure (`--color-highlight`)
   */
  color = input<ActionButtonColor>('primary');
  /** Disables the button and suppresses `buttonClick` emission when true. Defaults to `false`. */
  disabled = input<boolean>(false);
  /** Stretches the button to fill its container's width when true. Defaults to `true`. */
  fullWidth = input<boolean>(true);
  /** Accessible label override. Defaults to `label()` when not provided. */
  ariaLabel = input<string>();
  /** Optional tooltip shown on hover/focus. See {@link TooltipDirective} for `TooltipConfig` shape. */
  tooltip = input<TooltipConfig | undefined>();

  // Events
  /** Emits when the button is activated while not disabled. */
  buttonClick = output<void>();

  // Computed properties
  /** CSS class list applied to the button host, adding a semantic color class for non-`'primary'`/`'normal'` colors. */
  buttonClasses = computed(() => {
    const classes: string[] = [];

    // Only add color class for non-primary colors that need custom styling
    const color = this.color();
    if (color !== 'primary' && color !== 'normal') {
      classes.push(`action-button-${color}`);
    }

    return classes.join(' ');
  });

  /** Material `color` input passed through to the underlying `mat-button`, derived from `color()`. */
  materialColor = computed(() => {
    // Use Material's natural color system for primary and normal
    // Only override for semantic colors that need custom styling
    switch (this.color()) {
      case 'primary':
        return 'primary'; // Use Material's primary color
      case 'normal':
        return undefined; // Use Material's default styling
      case 'success':
      case 'error':
      case 'highlight':
        return 'primary'; // Use primary as base, let CSS override the colors
      default:
        return 'primary';
    }
  });

  /** Accessible label used on the host element: `ariaLabel()` when set, otherwise `label()`. */
  effectiveAriaLabel = computed(() => this.ariaLabel() || this.label());

  /** Emits `buttonClick` when the button is activated and not disabled. */
  onButtonClick(): void {
    if (!this.disabled()) {
      this.buttonClick.emit();
    }
  }
}
