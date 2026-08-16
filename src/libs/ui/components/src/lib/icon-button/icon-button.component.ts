import { Component, input, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TooltipDirective, TooltipConfig, TooltipPosition } from '../tooltip/tooltip.directive';

export type IconButtonSize = 'small' | 'medium' | 'large';
export type IconButtonVariant = 'standard' | 'rounded-primary' | 'rounded-transparent';
export type IconButtonColor = 'normal' | 'highlight' | 'success' | 'error' | 'dimmed' | 'dimmed-light';

/**
 * Icon-only button that provides consistent Material Design button styling
 * with configurable size, variant, and semantic color. Displays either a
 * Material icon ligature via `icon` or a projected custom icon component
 * (e.g. {@link JoystickIconComponent}, {@link ImageIconComponent}) via
 * content projection — the two are mutually exclusive per instance.
 *
 * Reach for `lib-icon-button` when space is constrained and the icon alone
 * conveys the action — dense toolbars, card corner controls, filter rows —
 * as long as a meaningful `ariaLabel` is supplied for accessibility. Reach
 * for `lib-action-button` instead when the action needs a visible text label
 * alongside its icon, such as a dialog footer or empty-state call to action.
 *
 * Size and variant map to CSS utility classes (`icon-button-*`); see the
 * `style-guide` skill for their pixel values and the `--color-*` tokens
 * behind each `color` option.
 *
 * @example
 * ```html
 * <!-- Material icon -->
 * <lib-icon-button
 *   icon="power_settings_new"
 *   ariaLabel="Power"
 *   [color]="connectionStatus() ? 'highlight' : 'normal'"
 *   (buttonClick)="onTogglePower()"
 * ></lib-icon-button>
 *
 * <!-- Projected custom icon -->
 * <lib-icon-button ariaLabel="Games Filter" size="large" (buttonClick)="onGamesClick()">
 *   <lib-joystick-icon></lib-joystick-icon>
 * </lib-icon-button>
 * ```
 */
@Component({
  selector: 'lib-icon-button',
  imports: [CommonModule, MatButtonModule, MatIconModule, TooltipDirective],
  templateUrl: './icon-button.component.html',
  styleUrl: './icon-button.component.scss',
})
export class IconButtonComponent {
  // Input properties
  /**
   * Material icon ligature name to render. Leave unset and project a custom
   * icon component via `ng-content` instead (the two are mutually exclusive).
   */
  icon = input<string>();
  /** Accessible label announced to assistive technology for this button. Always required, even for icon-only buttons. */
  ariaLabel = input.required<string>();
  /** Optional tooltip configuration shown when hovering or focusing the button. */
  tooltip = input<TooltipConfig | undefined>();
  /**
   * Semantic color treatment applied to the icon. Defaults to `'normal'`.
   * - `'normal'` — inherits the surrounding text color
   * - `'highlight'` — cyan accent (`--color-highlight`), for active/selected state
   * - `'success'` — green (`--color-success`), for positive actions (e.g. start)
   * - `'error'` — red (`--color-error`), for destructive actions (e.g. stop, delete)
   * - `'dimmed'` — muted gray (`--color-dimmed`), for de-emphasized actions
   * - `'dimmed-light'` — lighter muted variant, for de-emphasized actions on dark surfaces
   */
  color = input<IconButtonColor>('normal');
  /**
   * Button size, controlling padding and icon dimensions. Defaults to `'medium'`.
   * - `'small'` — compact, for dense rows
   * - `'medium'` — standard toolbar size
   * - `'large'` — emphasized, for primary filter/action rows
   */
  size = input<IconButtonSize>('medium');
  /**
   * Visual style variant of the button. Defaults to `'standard'`.
   * - `'standard'` — default Material icon button, no background
   * - `'rounded-primary'` — filled rounded background using the primary color
   * - `'rounded-transparent'` — rounded outline with transparent background
   */
  variant = input<IconButtonVariant>('standard');
  /** Disables the button and suppresses `buttonClick` emission when true. Defaults to `false`. */
  disabled = input<boolean>(false);

  // Events
  /** Emits when the button is activated while not disabled. */
  buttonClick = output<void>();

  // Computed properties
  hasIcon = computed(() => !!this.icon());

  // Computed classes
  buttonClasses = computed(() => {
    const classes: string[] = [];

    // Size classes
    switch (this.size()) {
      case 'small':
        classes.push('icon-button-small');
        break;
      case 'medium':
        classes.push('icon-button-medium');
        break;
      case 'large':
        classes.push('icon-button-large');
        break;
    }

    // Variant classes
    switch (this.variant()) {
      case 'rounded-primary':
        classes.push('icon-button-rounded-primary');
        break;
      case 'rounded-transparent':
        classes.push('icon-button-rounded-transparent');
        break;
      case 'standard':
        // Default Material Design styling
        break;
    }

    return classes.join(' ');
  });

  iconClasses = computed(() => {
    return this.color();
  });

  onButtonClick(): void {
    if (!this.disabled()) {
      this.buttonClick.emit();
    }
  }
}
