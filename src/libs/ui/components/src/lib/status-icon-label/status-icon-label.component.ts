import { Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { IconLabelComponent } from '../icon-label/icon-label.component';
import { MatCardModule } from '@angular/material/card';

/**
 * An `IconLabelComponent` extended with a trailing success/error status glyph — a green check
 * circle for a good state, a red cancel icon for a bad one, or nothing at all when there's no
 * status to report.
 *
 * Reach for `StatusIconLabelComponent` over plain `IconLabelComponent` whenever the row itself
 * represents a pass/fail or connected/disconnected condition — device status, connection state,
 * feature availability — and the status icon should live next to the label rather than as separate
 * markup.
 *
 * @example
 * ```html
 * <lib-status-icon-label icon="wifi" label="Network Connection" [status]="true"></lib-status-icon-label>
 * ```
 */
@Component({
  selector: 'lib-status-icon-label',
  standalone: true,
  imports: [MatIconModule, CommonModule, IconLabelComponent, MatCardModule],
  templateUrl: './status-icon-label.component.html',
  styleUrl: './status-icon-label.component.scss',
})
export class StatusIconLabelComponent {
  /** Primary Material Design icon name — defaults to `''` (no icon rendered). */
  icon = input<string>('');

  /** Text label to display — defaults to `''`. */
  label = input<string>('');

  /**
   * Status indicator rendered after the label — defaults to `undefined`.
   * - `true` — green `check_circle` icon (`.success` class)
   * - `false` — red `cancel` icon (`.error` class)
   * - `undefined` — no status icon shown
   */
  status = input<boolean | undefined>(undefined);
}
