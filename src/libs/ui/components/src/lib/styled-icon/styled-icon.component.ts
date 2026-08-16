import { Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

export type StyledIconSize = 'small' | 'medium' | 'large' | 'extra-large';
export type StyledIconColor =
  | 'normal'
  | 'primary'
  | 'highlight'
  | 'success'
  | 'error'
  | 'dimmed'
  | 'directory';

/**
 * Standalone Material Design icon with consistent sizing and semantic
 * coloring from the design system. Use it wherever a single icon needs to
 * stand on its own — directory listings, file browsers, navigation trees,
 * status indicators — without the button chrome that {@link IconButtonComponent}
 * adds.
 *
 * Reach for `lib-styled-icon` for non-interactive, purely presentational
 * icons. Reach for `lib-icon-button` instead as soon as the icon needs to be
 * clickable, and for `lib-icon-label` when the icon needs an adjacent text
 * label.
 *
 * `size` and `color` map to `styled-icon-*` utility classes; see the
 * `style-guide` skill for their pixel values and the `--color-*` tokens
 * behind each color option.
 *
 * @example
 * ```html
 * <lib-styled-icon icon="folder" color="directory" size="medium"></lib-styled-icon>
 * ```
 */
@Component({
  selector: 'lib-styled-icon',
  imports: [CommonModule, MatIconModule],
  templateUrl: './styled-icon.component.html',
  styleUrl: './styled-icon.component.scss',
})
export class StyledIconComponent {
  /** Material icon ligature name to display. */
  icon = input.required<string>();
  /**
   * Semantic color variant from the design system. Defaults to `'normal'`.
   * - `'normal'` — default Material icon color, no override
   * - `'primary'` — brand primary (`--color-primary-bright`)
   * - `'highlight'` — cyan accent (`--color-highlight`), for active/selected state
   * - `'success'` — green (`--color-success`), for positive status
   * - `'error'` — red (`--color-error`), for error/warning status
   * - `'dimmed'` — muted gray (`--color-dimmed`), for de-emphasized icons
   * - `'directory'` — folder/gold accent (`--color-directory`), for directory entries
   */
  color = input<StyledIconColor>('normal');
  /**
   * Size variant, controlling both font size and rendered dimensions. Defaults to `'medium'`.
   * - `'small'` — compact lists, inline indicators
   * - `'medium'` — standard size, matches directory tree icons
   * - `'large'` — emphasized single icons
   * - `'extra-large'` — headline-scale icons (e.g. empty-state illustrations)
   */
  size = input<StyledIconSize>('medium');

  iconClasses = computed(() => {
    const classes: string[] = [];

    switch (this.size()) {
      case 'small':
        classes.push('styled-icon-small');
        break;
      case 'medium':
        classes.push('styled-icon-medium');
        break;
      case 'large':
        classes.push('styled-icon-large');
        break;
      case 'extra-large':
        classes.push('styled-icon-extra-large');
        break;
    }

    switch (this.color()) {
      case 'primary':
        classes.push('styled-icon-primary');
        break;
      case 'highlight':
        classes.push('styled-icon-highlight');
        break;
      case 'success':
        classes.push('styled-icon-success');
        break;
      case 'error':
        classes.push('styled-icon-error');
        break;
      case 'dimmed':
        classes.push('styled-icon-dimmed');
        break;
      case 'directory':
        classes.push('styled-icon-directory');
        break;
      case 'normal':
        break;
    }

    return classes.join(' ');
  });
}
