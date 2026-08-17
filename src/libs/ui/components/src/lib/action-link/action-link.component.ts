import { Component, computed, input, ChangeDetectionStrategy, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LinkComponent } from '../link/link.component';
import { StyledIconColor } from '../styled-icon/styled-icon.component';

/**
 * A link-styled `<button>` for triggering actions or opening modals — not for navigation.
 * Composes `LinkComponent` for icon + label rendering, and adds click emission plus the standard
 * keyboard accessibility (Enter/Space) that comes free with a native `<button>`.
 *
 * Reach for `ActionLinkComponent` whenever you want a link-looking control that runs code (open a
 * dialog, clear a filter, delete an item) rather than navigate to a URL. Use `ExternalLinkComponent`
 * instead when the target is a URL — an `<a>` is the semantically correct element there, and using
 * a button for navigation (or an anchor for actions) breaks screen reader and keyboard expectations.
 *
 * @example
 * ```html
 * <lib-action-link label="Watch Tutorial" icon="play_circle" (linkClick)="openYouTubeDialog(video)">
 * </lib-action-link>
 * ```
 */
@Component({
  selector: 'lib-action-link',
  standalone: true,
  imports: [CommonModule, LinkComponent],
  templateUrl: './action-link.component.html',
  styleUrl: './action-link.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActionLinkComponent {
  /** Button text displayed to the user. */
  label = input.required<string>();

  /** Material Design icon name displayed before the label — defaults to `'link'`. */
  icon = input<string>('link');

  /**
   * Semantic icon color from the design system — defaults to `'primary'`.
   * - `'normal'` — default Material icon color, no tint
   * - `'primary'` — `--color-primary-bright`, the standard accent for interactive elements
   * - `'highlight'` — `--color-highlight`, used to draw extra attention
   * - `'success'` — `--color-success`, positive/confirmed state
   * - `'error'` — `--color-error`, destructive or failure state (e.g. a "Delete" action)
   * - `'dimmed'` — `--color-dimmed`, de-emphasized/secondary
   * - `'directory'` — `--color-directory`, folder/directory affordance
   *
   * See the `style-guide` skill for the full design token reference.
   */
  iconColor = input<StyledIconColor>('primary');

  /** Custom accessible name for screen readers. When empty (the default), the button's `aria-label` falls back to `label`. */
  ariaLabel = input<string>('');

  /** Disables the button, preventing clicks and keyboard activation, and removes it from the tab order (`tabindex="-1"`) — defaults to `false`. */
  disabled = input<boolean>(false);

  /** Emitted when the button is clicked, but only when `disabled` is `false`. */
  linkClick = output<void>();

  /** Resolved accessible name: `ariaLabel` when provided, otherwise `label`. */
  ariaLabelText = computed(() => {
    const customLabel = this.ariaLabel();
    return customLabel || this.label();
  });

  /** Emits `linkClick` when the button is activated and not disabled. */
  onButtonClick(): void {
    if (!this.disabled()) {
      this.linkClick.emit();
    }
  }
}
