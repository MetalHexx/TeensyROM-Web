import { Component, input, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TooltipDirective, TooltipConfig, TooltipPosition } from '../tooltip/tooltip.directive';

export type IconButtonSize = 'small' | 'medium' | 'large';
export type IconButtonVariant = 'standard' | 'rounded-primary' | 'rounded-transparent';
export type IconButtonColor = 'normal' | 'highlight' | 'success' | 'error' | 'dimmed' | 'dimmed-light';

@Component({
  selector: 'lib-icon-button',
  imports: [CommonModule, MatButtonModule, MatIconModule, TooltipDirective],
  templateUrl: './icon-button.component.html',
  styleUrl: './icon-button.component.scss',
})
export class IconButtonComponent {
  // Input properties
  /** Material icon ligature name to render. Optional when consumers project their own icon via ng-content. */
  icon = input<string>();
  /** Accessible label announced to assistive technology for this button. */
  ariaLabel = input.required<string>();
  /** Optional tooltip configuration shown when hovering or focusing the button. */
  tooltip = input<TooltipConfig | undefined>();
  /** Color treatment applied to the icon. */
  color = input<IconButtonColor>('normal');
  /** Button size, controlling padding and icon dimensions. */
  size = input<IconButtonSize>('medium');
  /** Visual style variant of the button (standard, rounded-primary, or rounded-transparent). */
  variant = input<IconButtonVariant>('standard');
  /** Disables the button and suppresses click emission when true. */
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
