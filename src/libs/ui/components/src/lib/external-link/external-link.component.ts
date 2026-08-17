import { Component, computed, input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LinkComponent } from '../link/link.component';
import { StyledIconColor } from '../styled-icon/styled-icon.component';

/**
 * A native `<a>` link with consistent icon + label styling, automatic security attributes for
 * external targets, and generated accessibility text. Use it for anything that navigates —
 * external URLs, internal routes, deep links — rather than rolling a bare anchor tag.
 *
 * When `href` points at `http://`/`https://` and `target` is `'_blank'` (the default), the
 * component automatically adds `rel="noopener noreferrer"` to close the `window.opener` and
 * referrer-leak risks that new-tab external links otherwise carry, and appends "(opens in new
 * window)" to the generated `aria-label` so screen reader users get the same warning sighted users
 * get from context. Internal links and same-tab links receive neither.
 *
 * Reach for `ExternalLinkComponent` over `ActionLinkComponent` whenever the target is a URL — the
 * anchor semantics (right-click "open in new tab", middle-click, `Ctrl`+click) only work correctly
 * on a real `<a>`. Use `ActionLinkComponent` instead when the interaction triggers code rather than
 * navigating.
 *
 * @example
 * ```html
 * <lib-external-link href="https://example.com" label="Visit Example"></lib-external-link>
 * ```
 */
@Component({
  selector: 'lib-external-link',
  standalone: true,
  imports: [CommonModule, LinkComponent],
  templateUrl: './external-link.component.html',
  styleUrl: './external-link.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'link',
  },
})
export class ExternalLinkComponent {
  /** URL to navigate to — absolute (`https://...`) or relative (`/path`). */
  href = input.required<string>();

  /** Link text displayed to the user. */
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

  /** Link target: `'_blank'` opens in a new window/tab, `'_self'` navigates in place — defaults to `'_blank'`. */
  target = input<'_blank' | '_self'>('_blank');

  /** Custom accessible name for screen readers. When empty (the default), the label is auto-generated from `label`, with "(opens in new window)" appended for external `_blank` links. */
  ariaLabel = input<string>('');

  /** True when `href` starts with `http://` or `https://`; false for relative/internal links. */
  isExternal = computed(() => {
    const url = this.href();
    return url.startsWith('http://') || url.startsWith('https://');
  });

  /** `'noopener noreferrer'` for external links opening in a new tab; `undefined` otherwise. Rendered as the anchor's `rel` attribute. */
  relAttribute = computed(() => {
    if (this.isExternal() && this.target() === '_blank') {
      return 'noopener noreferrer';
    }
    return undefined;
  });

  /** The resolved `target` value, rendered on the anchor. */
  effectiveTarget = computed(() => this.target());

  /** Resolved accessible name: `ariaLabel` when provided, otherwise `label` with "(opens in new window)" appended for external `_blank` links. */
  ariaLabelText = computed(() => {
    const customLabel = this.ariaLabel();
    if (customLabel) return customLabel;

    const label = this.label();
    if (this.isExternal() && this.target() === '_blank') {
      return `${label} (opens in new window)`;
    }
    return label;
  });
}
