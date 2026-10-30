import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { c64Color } from '../c64-color/c64-palette';

/**
 * A small square showing one of the C64's sixteen colors, optionally with the color's name beside
 * it. A 1px translucent border keeps Black and Blue visible on the dark surface. An index outside
 * 0..15 renders an empty outlined square named "Unknown color".
 *
 * On its own the swatch is an image named after its color. Inside a control that already carries
 * the color's name, set `decorative` so it is hidden from assistive technology instead of being
 * announced twice.
 *
 * @example
 * ```html
 * <lib-c64-color-swatch [colorIndex]="6" size="large" [showName]="true" />
 * ```
 */
@Component({
  selector: 'lib-c64-color-swatch',
  templateUrl: './c64-color-swatch.component.html',
  styleUrl: './c64-color-swatch.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.data-size]': 'size()',
    '[attr.role]': 'isImage() ? "img" : null',
    '[attr.aria-label]': 'isImage() ? name() : null',
    '[attr.aria-hidden]': 'decorative() ? "true" : null',
  },
})
export class C64ColorSwatchComponent {
  /** Palette index 0..15 of the color to show. */
  readonly colorIndex = input.required<number>();
  /** Square size: 12px, 18px or 24px. Defaults to `'medium'`. */
  readonly size = input<'small' | 'medium' | 'large'>('medium');
  /** Renders the color's name as text beside the square. Defaults to false. */
  readonly showName = input<boolean>(false);
  /** Hides the swatch from assistive technology; set it inside a control that is already labelled. Defaults to false. */
  readonly decorative = input<boolean>(false);

  /** The palette entry for `colorIndex`, or `undefined` when the index is out of range. */
  protected readonly color = computed(() => c64Color(this.colorIndex()));
  /** The color's name, or 'Unknown color' for an out-of-range index. */
  protected readonly name = computed(() => this.color()?.name ?? 'Unknown color');
  /** Whether the host stands alone as an image named after its color (neither decorative nor showing its name). */
  protected readonly isImage = computed(() => !this.decorative() && !this.showName());
}
