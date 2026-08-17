import { Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  StyledIconComponent,
  StyledIconColor,
  StyledIconSize,
} from '../styled-icon/styled-icon.component';

export type IconLabelSize = 'small' | 'medium' | 'large' | 'extra-large';

interface IconLabelSizePreset {
  iconSize: StyledIconSize;
  textClass: string;
  gapClass: string;
}

const SIZE_PRESETS: Record<IconLabelSize, IconLabelSizePreset> = {
  small: {
    iconSize: 'small',
    textClass: 'text-small',
    gapClass: 'gap-small',
  },
  medium: {
    iconSize: 'medium',
    textClass: 'text-medium',
    gapClass: 'gap-medium',
  },
  large: {
    iconSize: 'large',
    textClass: 'text-large',
    gapClass: 'gap-large',
  },
  'extra-large': {
    iconSize: 'extra-large',
    textClass: 'text-extra-large',
    gapClass: 'gap-extra-large',
  },
};

/**
 * Displays a `StyledIconComponent` icon alongside one or two lines of text, with a preset `size`
 * that coordinates icon size, font size, font weight, and gap spacing so the pairing reads as a
 * single cohesive unit rather than icon and text drifting out of visual sync.
 *
 * Reach for `IconLabelComponent` for any icon + text pairing that needs consistent sizing across
 * the app — directory tree nodes, file listings, device names, section headers. Use
 * `StatusIconLabelComponent` instead when the row also needs a success/error status indicator, and
 * use `LinkComponent` (or its wrappers, `ExternalLinkComponent`/`ActionLinkComponent`) instead when
 * the row is interactive.
 *
 * @example
 * ```html
 * <lib-icon-label
 *   icon="usb"
 *   label="USB Stick"
 *   secondaryLabel="Available"
 *   secondaryLabelClass="success"
 *   size="large"
 * ></lib-icon-label>
 * ```
 */
@Component({
  selector: 'lib-icon-label',
  standalone: true,
  imports: [CommonModule, StyledIconComponent],
  templateUrl: './icon-label.component.html',
  styleUrl: './icon-label.component.scss',
})
export class IconLabelComponent {
  /** Material Design icon name — defaults to `''` (no icon rendered). */
  icon = input<string>('');

  /** Primary text label — defaults to `''`. */
  label = input<string>('');

  /**
   * Semantic icon color from the design system — defaults to `'normal'`.
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
  color = input<StyledIconColor>('normal');

  /**
   * Size preset that scales icon size, primary/secondary text size, font weight, and gap spacing
   * together — defaults to `'medium'`.
   * - `'small'` — compact lists and secondary info
   * - `'medium'` — default, body content
   * - `'large'` — section headers, emphasis
   * - `'extra-large'` — page titles, headings (adds `--font-weight-medium`)
   *
   * See the `style-guide` skill for the underlying typography and spacing tokens.
   */
  size = input<IconLabelSize>('medium');

  /** Truncates the label with an ellipsis at a max width of 20ch when it overflows — defaults to `true`. Set `false` for content that must show in full, like file names in a table column. */
  truncate = input<boolean>(true);

  /** Optional second line of text rendered below `label`, sized proportionally to `size` — defaults to `''` (not rendered). */
  secondaryLabel = input<string>('');

  /** Optional CSS class applied to the `secondaryLabel` element, e.g. `'success'` or `'error'` for status coloring — defaults to `''`. */
  secondaryLabelClass = input<string>('');

  /** Optional CSS class applied to the primary `label` element — defaults to `''`. */
  labelClass = input<string>('');

  // Computed signals for preset-based styling
  /** `StyledIconComponent` size for the current `size()` preset. */
  iconSize = computed(() => SIZE_PRESETS[this.size()].iconSize);
  /** Primary label CSS text-size class for the current `size()` preset. */
  textClass = computed(() => SIZE_PRESETS[this.size()].textClass);
  /** Icon-to-text gap CSS class for the current `size()` preset. */
  gapClass = computed(() => SIZE_PRESETS[this.size()].gapClass);

  /** Secondary label CSS text-size class, scaled down from the primary `textClass` for the current `size()`. */
  secondaryTextClass = computed(() => {
    const sizeMap: Record<IconLabelSize, string> = {
      'small': 'text-xs',
      'medium': 'text-sm',
      'large': 'text-md',
      'extra-large': 'text-lg',
    };
    return sizeMap[this.size()];
  });
}
