import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconLabelComponent } from '../icon-label/icon-label.component';
import { StyledIconColor } from '../styled-icon/styled-icon.component';

/**
 * A pure presentation component that renders an icon next to a text label. It composes
 * `IconLabelComponent` for the icon + text rendering and exists to be the shared visual base for
 * link-like components — it does not itself navigate or emit any interaction event.
 *
 * Do not use `LinkComponent` directly in feature code: use `ExternalLinkComponent` for navigation
 * to a URL, or `ActionLinkComponent` for a link-styled control that triggers an action. Reach for
 * `LinkComponent` only when building a new link-shaped component that needs the same icon + label
 * rendering.
 *
 * @example
 * ```html
 * <lib-link label="Learn More" icon="help"></lib-link>
 * ```
 */
@Component({
  selector: 'lib-link',
  standalone: true,
  imports: [CommonModule, IconLabelComponent],
  templateUrl: './link.component.html',
  styleUrl: './link.component.scss',
})
export class LinkComponent {
  /** Text displayed next to the icon. */
  label = input.required<string>();

  /** Material Design icon name displayed before the label — defaults to `'link'`. */
  icon = input<string>('link');

  /**
   * Semantic icon color from the design system — defaults to `'primary'`.
   * - `'normal'` — default Material icon color, no tint
   * - `'primary'` — `--color-primary-bright`, the standard accent for interactive elements
   * - `'highlight'` — `--color-highlight`, used to draw extra attention
   * - `'success'` — `--color-success`, positive/confirmed state
   * - `'error'` — `--color-error`, destructive or failure state
   * - `'dimmed'` — `--color-dimmed`, de-emphasized/secondary
   * - `'directory'` — `--color-directory`, folder/directory affordance
   *
   * See the `style-guide` skill for the full design token reference.
   */
  iconColor = input<StyledIconColor>('primary');
}
