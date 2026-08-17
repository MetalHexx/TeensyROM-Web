import { Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import type { GlassyIntensity } from '../shared/glassy.types';

/**
 * Minimal card layout with a body slot and glassy backdrop styling — no header, no
 * title/subtitle, no corner slot, no animation. Built for forms and toolbars where the
 * full `CardLayoutComponent` header chrome would be unwanted overhead.
 *
 * Reach for this component when a compact surface needs to render without an entry/exit
 * animation. Use `ScalingCompactCardComponent` instead when the same compact surface
 * should animate in and out — it composes this component with `ScalingContainerComponent`.
 * For cards that need a header (title, subtitle, corner slot) use `CardLayoutComponent` or
 * its animated counterpart, `ScalingCardComponent`.
 *
 * The glassy backdrop effect (enabled by default) is built from design tokens documented
 * in the `style-guide` skill — see `glassyIntensity` below for what each level means.
 *
 * @example
 * ```html
 * <lib-compact-card-layout glassyIntensity="light">
 *   <mat-form-field><input matInput /></mat-form-field>
 * </lib-compact-card-layout>
 * ```
 */
@Component({
  selector: 'lib-compact-card-layout',
  imports: [CommonModule, MatCardModule],
  templateUrl: './compact-card-layout.component.html',
  styleUrl: './compact-card-layout.component.scss',
  host: {
    '[class.no-overflow]': 'enableOverflow() === false',
  },
})
export class CompactCardLayoutComponent {
  /** Whether the card content area shows scrollbars when its content overflows (default: `true`). Set to `false` to clip overflow instead. */
  enableOverflow = input<boolean>(true);

  /** Additional CSS class name(s) applied to the underlying `mat-card`, alongside the computed glassy classes. */
  cardClass = input<string>('');

  /**
   * Enable/disable the glassy backdrop effect (default: `true`).
   * Set to `false` to disable glassy styling entirely.
   */
  glassy = input<boolean>(true);

  /**
   * Glassy effect intensity (default: `'dark'`). Only applies when `glassy` is `true`.
   * See the `style-guide` skill for the full design-token reference.
   * - `'subtle'`: 5% white opacity — barely visible tint
   * - `'light'`: 7.5% white opacity — gentle glassy effect
   * - `'medium'`: 15% white opacity — balanced glassy effect
   * - `'strong'`: 20% white opacity — prominent glassy effect
   * - `'dark'`: 40% black opacity — dark semi-transparent glass (recommended default)
   * - `'default'`: uses the `.glassy-card` utility class (40% black opacity + Material tokens)
   */
  glassyIntensity = input<GlassyIntensity>('dark');

  /**
   * Computed CSS classes for the mat-card
   */
  protected computedCardClass = computed(() => {
    const classes: string[] = [];
    
    // Add custom cardClass if provided
    if (this.cardClass()) {
      classes.push(this.cardClass());
    }
    
    // Add glassy classes if enabled
    if (this.glassy()) {
      const intensity = this.glassyIntensity();
      if (intensity === 'default') {
        classes.push('glassy-card');
      } else {
        classes.push(`glassy-${intensity}`);
        classes.push('elevated-card');
      }
    }
    
    return classes.join(' ');
  });
}
