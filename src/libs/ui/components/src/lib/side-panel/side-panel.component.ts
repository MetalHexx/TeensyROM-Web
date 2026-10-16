import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IconButtonComponent } from '../icon-button/icon-button.component';
import { ScalingCompactCardComponent } from '../scaling-compact-card/scaling-compact-card.component';

/**
 * A full-height side panel on the nav rail's glassy card surface: a header — the heading, an
 * optional row of header actions, and a close button — over a body that scrolls on its own.
 * Purely a frame; it knows nothing of what the body holds.
 *
 * The host fills the height its container gives it, so place it in a sized flex or grid area. It
 * announces as a `complementary` landmark named by `heading`.
 *
 * Content slots: `[sidePanelActions]` places header actions between the title and the close
 * button; everything else goes in the body.
 *
 * @example
 * ```html
 * <lib-side-panel heading="Bindings" (closePanel)="onClose()">
 *   <label sidePanelActions><input type="checkbox" /> Mapping mode</label>
 *
 *   <lib-binding-row [model]="row" />
 * </lib-side-panel>
 * ```
 */
@Component({
  selector: 'lib-side-panel',
  imports: [ScalingCompactCardComponent, IconButtonComponent],
  templateUrl: './side-panel.component.html',
  styleUrl: './side-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'complementary',
    '[attr.aria-label]': 'heading()',
  },
})
export class SidePanelComponent {
  /** The panel's title, rendered as an `h2` and used as the landmark's accessible name. */
  readonly heading = input.required<string>();
  /** Accessible name for the close button. Defaults to `'Close panel'`. */
  readonly closeAccessibleName = input<string>('Close panel');
  /** Emits when the close button is pressed. */
  readonly closePanel = output<void>();
}
